import { eventSchema } from './event-store';
import { Pool } from 'pg';
import { z } from 'zod';
import { products, departmentIds } from './catalog';

export const sourceSchema = z.object({
  reference: z.string().min(3).max(2000),
  kind: z.enum(['founder', 'document', 'service', 'implementation']),
});
export const knowledgeInput = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120),
  title: z.string().min(3).max(200),
  product: z.enum(products),
  content: z.string().min(10).max(40000),
  sources: z.array(sourceSchema).min(1).max(20),
  expectedVersion: z.number().int().min(0),
});
export type KnowledgeInput = z.infer<typeof knowledgeInput>;
export type Knowledge = Omit<KnowledgeInput, 'expectedVersion'> & {
  version: number;
  status: 'draft' | 'verified';
  created_at: string;
  review_after: string;
  review_due: boolean;
};
export const goalInput = z.object({
  key: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120),
  title: z.string().min(3).max(200),
  outcome: z.string().min(10).max(5000),
  product: z.enum(products),
  department: z.enum(departmentIds as [string, ...string[]]),
  acceptance: z.array(z.string().min(3).max(2000)).min(1).max(20),
});
export type GoalInput = z.infer<typeof goalInput>;

export class KnowledgeStore {
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
      await client.query("SELECT pg_advisory_xact_lock(hashtext('ascendxi.knowledge.schema.v1'))");
      await client.query(`CREATE TABLE IF NOT EXISTS ascendxi_knowledge_documents (
        slug text PRIMARY KEY, title text NOT NULL, product text NOT NULL, version integer NOT NULL DEFAULT 0
      )`);
      await client.query(`CREATE TABLE IF NOT EXISTS ascendxi_knowledge_revisions (
        slug text REFERENCES ascendxi_knowledge_documents(slug), version integer NOT NULL,
        title text NOT NULL, product text NOT NULL, content text NOT NULL, sources jsonb NOT NULL,
        status text NOT NULL CHECK (status IN ('draft','verified')), created_at timestamptz NOT NULL DEFAULT now(),
        review_after timestamptz NOT NULL DEFAULT now()+interval '30 days', PRIMARY KEY(slug,version)
      )`);
      await client.query(`CREATE TABLE IF NOT EXISTS ascendxi_goals (
        key text PRIMARY KEY, title text NOT NULL, outcome text NOT NULL, product text NOT NULL,
        department text NOT NULL, acceptance jsonb NOT NULL, status text NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      )`);
      await eventSchema(client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async put(input: KnowledgeInput, status: 'draft' | 'verified' = 'draft'): Promise<Knowledge> {
    const data = knowledgeInput.parse(input);
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO ascendxi_knowledge_documents(slug,title,product) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [data.slug, data.title, data.product],
      );
      const current = await client.query(
        'SELECT version FROM ascendxi_knowledge_documents WHERE slug=$1 FOR UPDATE',
        [data.slug],
      );
      if (current.rows[0].version !== data.expectedVersion)
        throw new Error('Knowledge version conflict: reload before saving');
      const next = data.expectedVersion + 1;
      await client.query(
        'UPDATE ascendxi_knowledge_documents SET version=$2,title=$3,product=$4 WHERE slug=$1',
        [data.slug, next, data.title, data.product],
      );
      await client.query(
        `INSERT INTO ascendxi_knowledge_revisions(slug,version,title,product,content,sources,status)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          data.slug,
          next,
          data.title,
          data.product,
          data.content,
          JSON.stringify(data.sources),
          status,
        ],
      );
      await client.query(
        "INSERT INTO ascendxi_events(kind,actor,summary,data)VALUES($1,'knowledge-store',$2,$3)",
        [
          'knowledge.' + status,
          data.title,
          JSON.stringify({ slug: data.slug, version: next, status, sources: data.sources }),
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.get(data.slug);
  }
  async get(slug: string, version?: number): Promise<Knowledge> {
    await this.init();
    const result = await this.pool.query<Knowledge>(
      `SELECT r.*,r.review_after < now() AS review_due FROM ascendxi_knowledge_revisions r
      JOIN ascendxi_knowledge_documents d ON d.slug=r.slug WHERE r.slug=$1 AND r.version=COALESCE($2,d.version)`,
      [slug, version ?? null],
    );
    if (!result.rows[0]) throw new Error('Knowledge record not found');
    return result.rows[0];
  }
  async search(query = '', includeDrafts = false): Promise<Knowledge[]> {
    await this.init();
    return (
      await this.pool.query<Knowledge>(
        `SELECT * FROM (
      SELECT DISTINCT ON (r.slug) r.*,r.review_after < now() AS review_due,
        (SELECT max(p.version) FROM ascendxi_knowledge_revisions p WHERE p.slug=r.slug AND p.status='verified') AS published_version
      FROM ascendxi_knowledge_revisions r JOIN ascendxi_knowledge_documents d ON r.slug=d.slug
      WHERE ($2 OR r.status='verified') AND (NOT $2 OR r.version=d.version)
      ORDER BY r.slug,r.version DESC
    ) latest WHERE ($1='' OR title ILIKE '%' || $1 || '%' OR content ILIKE '%' || $1 || '%')
    ORDER BY created_at DESC,slug LIMIT 100`,
        [query.slice(0, 500), includeDrafts],
      )
    ).rows;
  }

  async history(slug: string): Promise<Knowledge[]> {
    await this.init();
    return (
      await this.pool.query<Knowledge>(
        `SELECT *, review_after < now() AS review_due FROM ascendxi_knowledge_revisions
      WHERE slug=$1 ORDER BY version DESC LIMIT 100`,
        [slug],
      )
    ).rows;
  }
  async publish(slug: string, expectedVersion: number) {
    const current = await this.get(slug);
    if (current.version !== expectedVersion)
      throw new Error('Knowledge version conflict: reload before publishing');
    if (current.status === 'verified') throw new Error('Knowledge revision is already verified');
    return this.put({ ...current, expectedVersion }, 'verified');
  }
  async createGoal(input: GoalInput, founderMandate = false) {
    if (founderMandate && !['client-lifecycle','agent-led-company','accurate-company-knowledge','visible-reliable-operations'].includes(input.key)) throw Error('Unknown founder mandate');
    const data = goalInput.parse(input);
    await this.init();
    const result = await this.pool.query(
      `INSERT INTO ascendxi_goals(key,title,outcome,product,department,acceptance,status)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING *`,
      [
        data.key,
        data.title,
        data.outcome,
        data.product,
        data.department,
        JSON.stringify(data.acceptance),
        founderMandate ? 'active' : 'proposed',
      ],
    );
    const goal =
      result.rows[0] ??
      (await this.pool.query('SELECT * FROM ascendxi_goals WHERE key=$1', [data.key])).rows[0];
    if (
      ['title', 'outcome', 'product', 'department'].some(
        (key) => goal[key] !== data[key as keyof GoalInput],
      ) ||
      JSON.stringify(goal.acceptance) !== JSON.stringify(data.acceptance)
    )
      throw new Error('Goal key already belongs to a different goal');
    return goal;
  }
  async goals() {
    await this.init();
    return (await this.pool.query('SELECT * FROM ascendxi_goals ORDER BY created_at,key LIMIT 100'))
      .rows;
  }
}
let singleton: KnowledgeStore | undefined;
export function knowledgeStore() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return (singleton ??= new KnowledgeStore(
    new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10000,
      query_timeout: 15000,
    }),
  ));
}
export async function closeKnowledgeStore() {
  const current = singleton;
  singleton = undefined;
  await current?.close();
}
