import { Pool, type PoolClient } from 'pg';
import { z } from 'zod';
import { hourlyJobLimit } from './autonomy';
export const eventInput = z.object({
  kind: z.string().max(100),
  actor: z.string().max(100),
  summary: z.string().max(2000),
  taskId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  clientKey: z.string().max(120).nullable().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});
export async function eventSchema(c: PoolClient) {
  await c.query(
    "SELECT pg_advisory_xact_lock(hashtext('ascendxi.events.schema.v1'))",
  );
  await c.query(
    `CREATE TABLE IF NOT EXISTS ascendxi_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,kind text NOT NULL,actor text NOT NULL,summary text NOT NULL,task_id uuid,project_id uuid,client_key text,data jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now())`,
  );
  // Even CREATE INDEX IF NOT EXISTS takes a ShareLock. Avoid it on a live table:
  // another initializer can otherwise deadlock with a run → event journal write.
  if (!(await c.query("SELECT to_regclass('ascendxi_events_project_time') AS id")).rows[0].id)
    await c.query('CREATE INDEX ascendxi_events_project_time ON ascendxi_events(project_id,id)');
  await c.query(
    `CREATE TABLE IF NOT EXISTS ascendxi_messages(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,key text UNIQUE NOT NULL,project_id uuid,task_id uuid,speaker text NOT NULL,channel text NOT NULL,content text NOT NULL,source text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`,
  );
  await c.query(
    `CREATE TABLE IF NOT EXISTS ascendxi_worker_state(id text PRIMARY KEY,status text NOT NULL,detail text NOT NULL,pid integer NOT NULL,heartbeat_at timestamptz NOT NULL DEFAULT now(),active_task uuid)`,
  );
}
export class EventStore {
  private initialized?: Promise<void>;
  constructor(readonly pool: Pool) {}
  async init() {
    return (this.initialized ??= this.initialize().catch((e) => {
      this.initialized = undefined;
      throw e;
    }));
  }
  private async initialize() {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await eventSchema(c);
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  async append(input: z.input<typeof eventInput>) {
    const d = eventInput.parse(input);
    await this.init();
    return (
      await this.pool.query(
        'INSERT INTO ascendxi_events(kind,actor,summary,task_id,project_id,client_key,data)VALUES($1,$2,$3,$4,$5,$6,$7)RETURNING *',
        [
          d.kind,
          d.actor,
          d.summary,
          d.taskId ?? null,
          d.projectId ?? null,
          d.clientKey ?? null,
          JSON.stringify(d.data),
        ],
      )
    ).rows[0];
  }
  async events(after = 0, projectId?: string) {
    await this.init();
    return (
      await this.pool.query(
        'SELECT * FROM ascendxi_events WHERE id>$1 AND ($2::uuid IS NULL OR project_id=$2)ORDER BY id DESC LIMIT 200',
        [after, projectId ?? null],
      )
    ).rows;
  }
  async message(d: {
    key: string;
    projectId?: string | null;
    taskId?: string;
    speaker: string;
    channel: string;
    content: string;
    source: string;
  }) {
    await this.init();
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const r = await c.query(
        'INSERT INTO ascendxi_messages(key,project_id,task_id,speaker,channel,content,source)VALUES($1,$2,$3,$4,$5,$6,$7)ON CONFLICT(key)DO NOTHING RETURNING *',
        [
          d.key,
          d.projectId ?? null,
          d.taskId ?? null,
          d.speaker,
          d.channel,
          d.content.slice(0, 40000),
          d.source,
        ],
      );
      if (r.rowCount)
        await c.query(
          "INSERT INTO ascendxi_events(kind,actor,summary,task_id,project_id,data)VALUES('message.recorded',$1,$2,$3,$4,$5)",
          [
            d.speaker,
            d.channel + ' message recorded',
            d.taskId ?? null,
            d.projectId ?? null,
            JSON.stringify({ messageId: r.rows[0].id }),
          ],
        );
      await c.query('COMMIT');
      return r.rows[0];
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  async eventsBefore(before: string, projectId?: string) {
    await this.init();
    return (
      await this.pool.query(
        'SELECT * FROM ascendxi_events WHERE id<$1 AND ($2::uuid IS NULL OR project_id=$2)ORDER BY id DESC LIMIT 100',
        [before, projectId ?? null],
      )
    ).rows;
  }
  async messagesBefore(projectId: string | undefined, before: string) {
    await this.init();
    return (
      await this.pool.query(
        'SELECT * FROM ascendxi_messages WHERE ($1::uuid IS NULL OR project_id=$1) AND id<$2 ORDER BY id DESC LIMIT 100',
        [projectId ?? null, before],
      )
    ).rows;
  }
  async messages(projectId?: string) {
    await this.init();
    return (
      await this.pool.query(
        'SELECT * FROM ascendxi_messages WHERE ($1::uuid IS NULL OR project_id=$1)ORDER BY id DESC LIMIT 200',
        [projectId ?? null],
      )
    ).rows;
  }
  async heartbeat(status: string, detail: string, taskId?: string) {
    await this.init();
    await this.pool.query(
      `INSERT INTO ascendxi_worker_state(id,status,detail,pid,active_task)VALUES('local', $1,$2,$3,$4)ON CONFLICT(id)DO UPDATE SET status=$1,detail=$2,pid=$3,active_task=$4,heartbeat_at=now()`,
      [status, detail, process.pid, taskId ?? null],
    );
  }
  async worker() {
    await this.init();
    return (
      (
        await this.pool.query(
          "SELECT *,heartbeat_at>now()-interval '90 seconds' AS alive FROM ascendxi_worker_state WHERE id='local'",
        )
      ).rows[0] ?? {
        status: 'not started',
        alive: false,
        detail: 'No local worker heartbeat has been recorded',
      }
    );
  }
  async reserveJob(actor: string, taskId?: string) {
    await this.init();
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(
        "SELECT pg_advisory_xact_lock(hashtext('ascendxi.model.hourly.budget'))",
      );
      const max = hourlyJobLimit();
      const count = Number(
        (
          await c.query(
            "SELECT count(*) FROM ascendxi_events WHERE created_at>now()-interval '1 hour' AND(kind='ai.job.reserved' OR(kind='task.started' AND data->>'jobId' IS NULL))",
          )
        ).rows[0].count,
      );
      if (max !== null && count >= max) {
        await c.query('ROLLBACK');
        return null;
      }
      const row = (
        await c.query(
          "INSERT INTO ascendxi_events(kind,actor,summary,task_id,data)VALUES('ai.job.reserved',$1,'Reserved a bounded AI job',$2,$3)RETURNING id",
          [actor, taskId ?? null, JSON.stringify({ hourlyLimit: max })],
        )
      ).rows[0];
      await c.query('COMMIT');
      return row.id as string;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  async recentRuns() {
    await this.init();
    return Number(
      (
        await this.pool.query(
          "SELECT count(*) FROM ascendxi_events WHERE created_at>now()-interval '1 hour' AND(kind='ai.job.reserved' OR(kind='task.started' AND data->>'jobId' IS NULL))",
        )
      ).rows[0].count,
    );
  }
  close() {
    return this.pool.end();
  }
}
let store: EventStore | undefined;
export function eventStore() {
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL is required');
  return (store ??= new EventStore(
    new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 10000,
      query_timeout: 15000,
    }),
  ));
}
export async function closeEventStore() {
  const old = store;
  store = undefined;
  await old?.close();
}
