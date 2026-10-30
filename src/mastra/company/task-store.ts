import { eventSchema } from './event-store';
import { Pool } from 'pg';
import { z } from 'zod';
import { departmentIds, products, roleIds, roleCatalog } from './catalog';

export const taskInput = z.object({
  key: z.string().min(1).max(200),
  specialist: z
    .enum(roleIds as [string, ...string[]])
    .nullable()
    .optional(),
  goal_key: z.string().max(120).nullable().optional(),
  client_key: z.string().max(120).nullable().optional(),
  title: z.string().min(1).max(300),
  objective: z.string().min(1).max(12000),
  product: z.enum(products),
  department: z.enum(departmentIds as [string, ...string[]]),
  acceptance: z.array(z.string().min(1).max(2000)).min(1).max(20),
});
export type TaskInput = z.infer<typeof taskInput>;
export type Task = TaskInput & {
  id: string;
  status: 'queued' | 'running' | 'review' | 'blocked' | 'completed';
  report: unknown;
  attempts: number;
};

/** Lazy pool: no credentials or database access is needed to import agents or run unit tests. */
export class TaskStore {
  private initialized?: Promise<void>;
  constructor(private readonly pool: Pool) {}
  close() {
    return this.pool.end();
  }
  private init() {
    return (this.initialized ??= this.initialize().catch((error) => {
      this.initialized = undefined;
      throw error;
    }));
  }
  private async initialize() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize first boot across replicas: IF NOT EXISTS alone is not concurrency-safe DDL.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('ascendxi.company.schema.v1'))",
      );
      await client.query(`CREATE TABLE IF NOT EXISTS ascendxi_tasks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text UNIQUE NOT NULL,
        title text NOT NULL, objective text NOT NULL, product text NOT NULL, department text NOT NULL,
        acceptance jsonb NOT NULL, status text NOT NULL DEFAULT 'queued'
          CHECK (status IN ('queued','running','review','blocked','completed')),
        report jsonb, attempts integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      )`);
      const columns = (await client.query("SELECT attname FROM pg_attribute WHERE attrelid=to_regclass('ascendxi_tasks') AND attnum>0 AND NOT attisdropped")).rows;
      for (const name of ['goal_key', 'specialist', 'client_key']) {
        if (!columns.some(a => a.attname === name))
          await client.query('ALTER TABLE ascendxi_tasks ADD COLUMN '+name+' text');
      }
      if (!(await client.query("SELECT to_regclass('ascendxi_tasks_status_created') AS id")).rows[0].id)
        await client.query('CREATE INDEX ascendxi_tasks_status_created ON ascendxi_tasks (status,created_at)');
      await eventSchema(client);
      await client.query(`CREATE TABLE IF NOT EXISTS ascendxi_task_evidence(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,task_id uuid NOT NULL REFERENCES ascendxi_tasks(id),path text NOT NULL,content text NOT NULL,source text NOT NULL,hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  private mutation(
    sql: string,
    values: unknown[],
    kind: string,
    actor?: string,
    jobId?: string,
  ) {
    const n = values.length;
    return this.pool.query<Task>(
      `WITH changed AS (${sql}), recorded AS (
      INSERT INTO ascendxi_events(kind,actor,summary,task_id,client_key,data)
      SELECT $${n + 1},COALESCE($${n + 2}::text,specialist,department),title,id,client_key,
        jsonb_build_object('status',status,'attempt',attempts,'report',report,'jobId',$${n + 3}::text) FROM changed RETURNING id
    ) SELECT * FROM changed`,
      [...values, kind, actor ?? null, jobId ?? null],
    );
  }
  async byKey(key: string) {
    await this.init();
    return (
      await this.pool.query<Task>('SELECT * FROM ascendxi_tasks WHERE key=$1', [
        key,
      ])
    ).rows[0];
  }
  async create(input: TaskInput): Promise<Task> {
    const data = taskInput.parse(input);
    if (
      data.specialist &&
      roleCatalog[data.specialist as keyof typeof roleCatalog].department !==
        data.department
    )
      throw new Error('Specialist must belong to the assigned department');
    await this.init();
    const result = await this.mutation(
      `INSERT INTO ascendxi_tasks
      (key,title,objective,product,department,acceptance,goal_key,specialist,client_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (key) DO NOTHING RETURNING *`,
      [
        data.key,
        data.title,
        data.objective,
        data.product,
        data.department,
        JSON.stringify(data.acceptance),
        data.goal_key ?? null,
        data.specialist ?? null,
        data.client_key ?? null,
      ],
      'task.created',
      'company-system',
    );
    const task =
      result.rows[0] ??
      (
        await this.pool.query<Task>(
          'SELECT * FROM ascendxi_tasks WHERE key=$1',
          [data.key],
        )
      ).rows[0]!;
    if (
      ['title', 'objective', 'product', 'department'].some(
        (k) => task[k as keyof Task] !== data[k as keyof TaskInput],
      ) ||
      JSON.stringify(task.acceptance) !== JSON.stringify(data.acceptance) ||
      (task.goal_key ?? null) !== (data.goal_key ?? null) ||
      (task.specialist ?? null) !== (data.specialist ?? null) ||
      (task.client_key ?? null) !== (data.client_key ?? null)
    )
      throw new Error(
        'Idempotency key already belongs to a different assignment',
      );
    return task;
  }
  async get(id: string): Promise<Task> {
    await this.init();
    const task = (
      await this.pool.query<Task>('SELECT * FROM ascendxi_tasks WHERE id=$1', [
        id,
      ])
    ).rows[0];
    if (!task) throw new Error('Task not found');
    return task;
  }
  async putEvidence(id:string,path:string,content:string,source:string) {
    const {createHash}=await import('node:crypto');
    z.string().uuid().parse(id);z.string().min(1).max(300).parse(path);z.string().max(100000).parse(content);z.string().min(3).max(2000).parse(source);
    await this.init();const hash=createHash('sha256').update(content).digest('hex');
    return (await this.pool.query(`WITH saved AS(INSERT INTO ascendxi_task_evidence(task_id,path,content,source,hash)VALUES($1,$2,$3,$4,$5)RETURNING *),logged AS(INSERT INTO ascendxi_events(kind,actor,summary,task_id,data)SELECT 'task.evidence.attached','evidence-provider',path,task_id,jsonb_build_object('path',path,'hash',hash,'source',source)FROM saved)SELECT id,path,source,hash,created_at FROM saved`,[id,path,content,source,hash])).rows[0];
  }
  async evidence(id:string) {
    await this.init();return (await this.pool.query('SELECT DISTINCT ON(path)id,path,source,hash,created_at,length(content) AS characters FROM ascendxi_task_evidence WHERE task_id=$1 ORDER BY path,id DESC',[id])).rows;
  }
  async readEvidence(id:string,path:string) {
    await this.init();const row=(await this.pool.query('SELECT path,content,source,hash,created_at FROM ascendxi_task_evidence WHERE task_id=$1 AND path=$2 ORDER BY id DESC LIMIT 1',[id,path])).rows[0];
    if(!row)throw Error('Task evidence not found');return row;
  }
  async metrics() {
    await this.init();
    return (
      await this.pool.query(
        'SELECT goal_key,status,count(*)::int AS count FROM ascendxi_tasks GROUP BY goal_key,status',
      )
    ).rows;
  }
  async all(limit = 200) {
    await this.init();
    return (
      await this.pool.query<Task>(
        'SELECT * FROM ascendxi_tasks ORDER BY created_at DESC,id LIMIT $1',
        [limit],
      )
    ).rows;
  }
  async list(limit = 100, offset = 0): Promise<Task[]> {
    await this.init();
    return (
      await this.pool.query<Task>(
        "SELECT * FROM ascendxi_tasks WHERE status <> 'completed' ORDER BY created_at LIMIT $1 OFFSET $2",
        [limit, offset],
      )
    ).rows;
  }
  async claim(id: string, jobId?: string): Promise<Task> {
    await this.init();
    const task = (
      await this.mutation(
        `UPDATE ascendxi_tasks SET status='running',
      attempts=attempts+1, updated_at=now() WHERE id=$1 AND status='queued' RETURNING *`,
        [id],
        'task.started',
        undefined,
        jobId,
      )
    ).rows[0];
    if (!task) throw new Error('Task must be queued and unclaimed');
    return task;
  }
  async finish(
    id: string,
    attempt: number,
    status: 'review' | 'blocked',
    report: unknown,
  ) {
    await this.init();
    const result = await this.mutation(
      `UPDATE ascendxi_tasks SET status=$2, report=$3, updated_at=now()
      WHERE id=$1 AND status='running' AND attempts=$4 RETURNING *`,
      [id, status, JSON.stringify(report), attempt],
      'task.' + status,
    );
    if (!result.rowCount) throw new Error('Task is not running');
  }
  async decide(
    id: string,
    decision: 'complete' | 'retry',
    evidence: string,
  ): Promise<Task> {
    await this.init();
    const task = (
      await this.mutation(
        `UPDATE ascendxi_tasks SET status=$2,
      report=COALESCE(report,'{}'::jsonb) || jsonb_build_object('humanDecision',$3::text), updated_at=now()
      WHERE id=$1 AND status = ANY($4::text[]) RETURNING *`,
        [
          id,
          decision === 'complete' ? 'completed' : 'queued',
          evidence,
          decision === 'complete' ? ['review'] : ['review', 'blocked'],
        ],
        'task.' + decision,
        'operator',
      )
    ).rows[0];
    if (!task) throw new Error('Invalid task decision for current state');
    return task;
  }
  /** Operator recovery only: never silently retry possibly executed external work. */
  async recover(id: string, evidence: string) {
    await this.init();
    const result = await this.mutation(
      `UPDATE ascendxi_tasks SET status='blocked', report=$2, updated_at=now()
      WHERE id=$1 AND status='running' RETURNING *`,
      [id, JSON.stringify({ recovery: evidence })],
      'task.recovered',
      'operator',
    );
    if (!result.rowCount) throw new Error('Task is not running');
  }
}
let singleton: TaskStore | undefined;
export const taskStore = () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return (singleton ??= new TaskStore(
    new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10_000,
      query_timeout: 15_000,
    }),
  ));
};

export async function closeTaskStore() {
  const current = singleton;
  singleton = undefined;
  await current?.close();
}
