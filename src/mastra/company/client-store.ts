import { Pool } from 'pg';
import { z } from 'zod';
import { products } from './catalog';
export const stages = [
  'research',
  'qualified',
  'discovery',
  'scoped',
  'estimated',
  'proposed',
  'won',
  'delivery',
  'quality',
  'handoff',
  'support',
  'lost',
] as const;
export const leadInput = z.object({
  key: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(120),
  company: z.string().min(2).max(200),
  contactEmail: z.email().nullable().optional(),
  need: z.string().min(10).max(5000),
  source: z.string().min(3).max(2000),
  product: z.enum(products),
});
export const resourceInput = z.object({
  key: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(120),
  name: z.string().min(2).max(200),
  capabilities: z.array(z.string().min(2)).min(1).max(30),
  availableHoursPerWeek: z.number().positive().max(168).nullable(),
  ratePerHour: z.number().min(0).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  source: z.string().min(3).max(2000),
  expectedVersion: z.number().int().min(0),
});
export const estimateInput = z
  .object({
    opportunityKey: z.string().min(3).max(120),
    items: z
      .array(
        z.object({
          resourceKey: z.string().min(3),
          scope: z.string().min(5).max(2000),
          lowHours: z.number().positive().max(100000),
          highHours: z.number().positive().max(100000),
        }),
      )
      .min(1)
      .max(100),
  })
  .refine(
    (v) => v.items.every((i) => i.highHours >= i.lowHours),
    'High effort must be at least low effort',
  );
export type Resource = z.infer<typeof resourceInput> & {
  version: number;
  verified: boolean;
  updated_at: string;
};
export function calculateEstimate(
  input: z.infer<typeof estimateInput>,
  resources: Resource[],
  now = new Date(),
) {
  const data = estimateInput.parse(input),
    blockers: string[] = [],
    loads = new Map<string, { low: number; high: number }>();
  let lowHours = 0,
    highHours = 0,
    lowCost = 0,
    highCost = 0,
    lowWeeks = 0,
    highWeeks = 0;
  const currencies = new Set<string>();
  for (const item of data.items) {
    lowHours += item.lowHours;
    highHours += item.highHours;
    const load = loads.get(item.resourceKey) ?? { low: 0, high: 0 };
    load.low += item.lowHours;
    load.high += item.highHours;
    loads.set(item.resourceKey, load);
  }
  for (const [key, load] of loads) {
    const resource = resources.find((r) => r.key === key);
    if (!resource) {
      blockers.push('Missing resource: ' + key);
      continue;
    }
    if (!resource.verified) blockers.push('Resource assumptions are not verified: ' + key);
    if (now.getTime() - new Date(resource.updated_at).getTime() > 7 * 86400000)
      blockers.push('Resource capacity needs refreshing: ' + key);
    if (resource.availableHoursPerWeek === null)
      blockers.push('Available weekly capacity is unknown: ' + key);
    else {
      lowWeeks = Math.max(lowWeeks, load.low / resource.availableHoursPerWeek);
      highWeeks = Math.max(highWeeks, load.high / resource.availableHoursPerWeek);
    }
    if (resource.ratePerHour === null) blockers.push('Cost rate is unknown: ' + key);
    else {
      lowCost += load.low * resource.ratePerHour;
      highCost += load.high * resource.ratePerHour;
      currencies.add(resource.currency);
    }
  }
  if (currencies.size > 1)
    blockers.push('Mixed currencies cannot be added without an approved conversion');
  const round = (n: number) => Math.ceil(n * 100) / 100;
  return {
    status: blockers.length ? 'blocked' : 'draft',
    effortHours: { low: round(lowHours), high: round(highHours) },
    cost: blockers.length
      ? null
      : { low: round(lowCost), high: round(highCost), currency: [...currencies][0] },
    durationWeeks: blockers.length ? null : { low: round(lowWeeks), high: round(highWeeks) },
    blockers,
    items: data.items,
    resourceSnapshot: resources
      .filter((r) => loads.has(r.key))
      .map((r) => ({
        key: r.key,
        version: r.version,
        availableHoursPerWeek: r.availableHoursPerWeek,
        ratePerHour: r.ratePerHour,
        currency: r.currency,
        verified: r.verified,
        source: r.source,
        updated_at: r.updated_at,
      })),
    assumptions: [
      'Effort ranges are scoped inputs, not measured agent throughput.',
      'Resources work in parallel; dependencies, calendar availability and review latency may extend duration.',
      'This estimate is not a resource reservation, client quote or delivery commitment.',
    ],
  };
}
export class ClientStore {
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
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT pg_advisory_xact_lock(hashtext('ascendxi.clients.schema.v1'))");
      await c.query(
        `CREATE TABLE IF NOT EXISTS ascendxi_opportunities(key text PRIMARY KEY,company text NOT NULL,contact_email text,need text NOT NULL,source text NOT NULL,product text NOT NULL,stage text NOT NULL DEFAULT 'research',history jsonb NOT NULL DEFAULT '[]',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())`,
      );
      await c.query(
        `CREATE TABLE IF NOT EXISTS ascendxi_resources(key text PRIMARY KEY,name text NOT NULL,capabilities jsonb NOT NULL,available_hours numeric,rate numeric,currency text NOT NULL,source text NOT NULL,version integer NOT NULL,verified boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now())`,
      );
      await c.query(
        `CREATE TABLE IF NOT EXISTS ascendxi_estimates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),opportunity_key text REFERENCES ascendxi_opportunities(key),report jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`,
      );
      await c.query('COMMIT');
    } catch (error) {
      await c.query('ROLLBACK');
      throw error;
    } finally {
      c.release();
    }
  }
  async get(key: string) {
    await this.init();
    const record = (
      await this.pool.query('SELECT * FROM ascendxi_opportunities WHERE key=$1', [key])
    ).rows[0];
    if (!record) throw new Error('Opportunity not found');
    return record;
  }
  async estimatesFor(key: string) {
    await this.init();
    return (
      await this.pool.query(
        'SELECT * FROM ascendxi_estimates WHERE opportunity_key=$1 ORDER BY created_at DESC LIMIT 20',
        [key],
      )
    ).rows;
  }
  async opportunities() {
    await this.init();
    return (
      await this.pool.query(
        'SELECT * FROM ascendxi_opportunities ORDER BY updated_at DESC LIMIT 200',
      )
    ).rows;
  }
  async createLead(input: z.infer<typeof leadInput>) {
    const d = leadInput.parse(input);
    await this.init();
    const result = await this.pool.query(
      `INSERT INTO ascendxi_opportunities(key,company,contact_email,need,source,product)VALUES($1,$2,$3,$4,$5,$6)ON CONFLICT DO NOTHING RETURNING *`,
      [d.key, d.company, d.contactEmail ?? null, d.need, d.source, d.product],
    );
    if (result.rows[0]) return result.rows[0];
    const old = (
      await this.pool.query('SELECT * FROM ascendxi_opportunities WHERE key=$1', [d.key])
    ).rows[0];
    if (
      old.company !== d.company ||
      old.contact_email !== (d.contactEmail ?? null) ||
      old.need !== d.need ||
      old.source !== d.source ||
      old.product !== d.product
    )
      throw new Error('Lead key already belongs to a different opportunity');
    return old;
  }
  async advance(
    key: string,
    expectedStage: string,
    nextStage: (typeof stages)[number],
    evidence: string,
  ) {
    await this.init();
    const from = stages.indexOf(expectedStage as (typeof stages)[number]),
      to = stages.indexOf(nextStage);
    if (
      from < 0 ||
      to < 0 ||
      expectedStage === 'lost' ||
      !((nextStage !== 'lost' && to === from + 1) || (nextStage === 'lost' && from < 6))
    )
      throw new Error('Invalid stage transition');
    const result = await this.pool.query(
      `UPDATE ascendxi_opportunities SET stage=$3,updated_at=now(),history=history||jsonb_build_array(jsonb_build_object('from',$2::text,'to',$3::text,'evidence',$4::text,'at',now()))WHERE key=$1 AND stage=$2 RETURNING *`,
      [key, expectedStage, nextStage, evidence],
    );
    if (!result.rows[0]) throw new Error('Stage conflict: reload before updating');
    return result.rows[0];
  }
  async resources(): Promise<Resource[]> {
    await this.init();
    return (
      await this.pool.query(
        `SELECT key,name,capabilities,available_hours::float8 AS "availableHoursPerWeek",rate::float8 AS "ratePerHour",currency,source,version,verified,updated_at FROM ascendxi_resources ORDER BY name LIMIT 200`,
      )
    ).rows;
  }
  async saveResource(input: z.infer<typeof resourceInput>) {
    const d = resourceInput.parse(input);
    await this.init();
    const values = [
      d.key,
      d.name,
      JSON.stringify(d.capabilities),
      d.availableHoursPerWeek,
      d.ratePerHour,
      d.currency,
      d.source,
    ];
    const result =
      d.expectedVersion === 0
        ? await this.pool.query(
            `INSERT INTO ascendxi_resources(key,name,capabilities,available_hours,rate,currency,source,version)VALUES($1,$2,$3,$4,$5,$6,$7,1)ON CONFLICT DO NOTHING RETURNING key`,
            values,
          )
        : await this.pool.query(
            `UPDATE ascendxi_resources SET name=$2,capabilities=$3,available_hours=$4,rate=$5,currency=$6,source=$7,verified=false,version=version+1,updated_at=now()WHERE key=$1 AND version=$8 RETURNING key`,
            [...values, d.expectedVersion],
          );
    if (!result.rowCount) throw new Error('Resource version conflict: reload before saving');
    return (await this.resources()).find((r) => r.key === d.key);
  }
  async verifyResource(key: string, version: number) {
    await this.init();
    const result = await this.pool.query(
      `UPDATE ascendxi_resources SET verified=true,version=version+1,updated_at=now() WHERE key=$1 AND version=$2 AND available_hours IS NOT NULL RETURNING key`,
      [key, version],
    );
    if (!result.rowCount)
      throw new Error('Resource version conflict or weekly capacity is missing');
    return (await this.resources()).find((r) => r.key === key);
  }
  async estimate(input: z.infer<typeof estimateInput>) {
    const d = estimateInput.parse(input);
    await this.init();
    const opportunity = (
      await this.pool.query('SELECT key FROM ascendxi_opportunities WHERE key=$1', [
        d.opportunityKey,
      ])
    ).rows[0];
    if (!opportunity) throw new Error('Opportunity not found');
    const report = calculateEstimate(d, await this.resources());
    return (
      await this.pool.query(
        'INSERT INTO ascendxi_estimates(opportunity_key,report)VALUES($1,$2)RETURNING *',
        [d.opportunityKey, JSON.stringify(report)],
      )
    ).rows[0];
  }
  async estimates() {
    await this.init();
    return (
      await this.pool.query('SELECT * FROM ascendxi_estimates ORDER BY created_at DESC LIMIT 100')
    ).rows;
  }
}
let singleton: ClientStore | undefined;
export function clientStore() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return (singleton ??= new ClientStore(
    new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10000,
      query_timeout: 15000,
    }),
  ));
}
export async function closeClientStore() {
  const current = singleton;
  singleton = undefined;
  await current?.close();
}
