import { BridgeProvider } from './communications';
import { Pool } from 'pg';
import type { Mastra } from '@mastra/core/mastra';
import { noopObserve, type Tool } from '@mastra/core/tools';
import { RequestContext } from '@mastra/core/request-context';
const definitions = [
  { id: 'google_calendar_get_colors', name: 'Google Calendar', input: {}, field: 'calendar' },
  { id: 'google_drive_get_about', name: 'Google Drive', input: {}, field: 'user' },
  { id: 'google_mail_list_labels', name: 'Gmail', input: {}, field: 'labels' },
  { id: 'discord_list_guilds', name: 'Discord', input: { limit: 1 }, field: 'items' },
] as const;
let pool: Pool | undefined;
function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return (pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 10000,
    query_timeout: 15000,
  }));
}
let initialized: Promise<void> | undefined;
async function initialize() {
  const c = await db().connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT pg_advisory_xact_lock(hashtext('ascendxi.monitoring.schema.v1'))");
    await c.query(
      `CREATE TABLE IF NOT EXISTS ascendxi_service_checks(service text PRIMARY KEY,status text NOT NULL,detail text NOT NULL,checked_at timestamptz NOT NULL DEFAULT now())`,
    );
    await c.query('COMMIT');
  } catch (error) {
    await c.query('ROLLBACK');
    throw error;
  } finally {
    c.release();
  }
}
function init() {
  return (initialized ??= initialize().catch((error) => {
    initialized = undefined;
    throw error;
  }));
}
export async function serviceChecks() {
  await init();
  const rows = (await db().query('SELECT * FROM ascendxi_service_checks ORDER BY service')).rows;
  return definitions.map(
    (d) =>
      rows.find((r) => r.service === d.name) ?? {
        service: d.name,
        status: 'not checked',
        detail: 'No persisted check yet',
        checked_at: null,
      },
  );
}
export async function verifyServices(mastra: Mastra) {
  await init();
  const tools = await mastra.getAgent('agent').listTools();
  for (const d of definitions) {
    let status = 'unavailable',
      detail = 'The configured tool is not available';
    const tool = tools[d.id] as Tool | undefined;
    if (tool?.requireApproval) {
      status = 'approval required';
      detail = 'The read tool still requires operator approval';
    } else if (tool?.execute) {
      try {
        const result = await tool.execute(d.input, {
          mastra,
          requestContext: new RequestContext(),
          abortSignal: AbortSignal.timeout(30000),
          observe: noopObserve,
        });
        const data = result as Record<string, unknown>;
        if (data && typeof data === 'object' && d.field in data) {
          status = 'verified';
          detail = 'Read-only provider response received';
        } else {
          status = 'failed';
          detail = 'Provider response did not match the expected check';
        }
      } catch {
        status = 'failed';
        detail = 'Read-only check failed; inspect protected diagnostics';
      }
    }
    if (!tool && new BridgeProvider().configured()) {
      try {
        const data = await new BridgeProvider().safeRead(d.id, d.input);
        status = data && typeof data === 'object' && d.field in data ? 'verified' : 'failed';
        detail = 'Read-only check through the existing Mastra integration bridge';
      } catch {
        status = 'failed';
        detail = 'Integration bridge check failed or requires approval';
      }
    }
    await db().query(
      `INSERT INTO ascendxi_service_checks(service,status,detail)VALUES($1,$2,$3)ON CONFLICT(service)DO UPDATE SET status=$2,detail=$3,checked_at=now()`,
      [d.name, status, detail],
    );
  }
  return serviceChecks();
}
export async function closeMonitoringStore() {
  const current = pool;
  pool = undefined;
  initialized = undefined;
  await current?.end();
}
