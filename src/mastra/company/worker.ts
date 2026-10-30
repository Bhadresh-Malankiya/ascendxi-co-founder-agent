import { connectorStore } from './connector-store';
import { processDiscordRequest } from './discord-advisory';
import { hourlyJobLimit } from './autonomy';
import { planningStore } from './planning-store';
import { recoverEvidenceBlockers } from './blockers';
import { InboxWatch } from './inbox-watch';
import { DiscordService } from './discord-service';
import { operationsStore } from './operations-store';
import type { Mastra } from '@mastra/core/mastra';
import { Pool } from 'pg';
import { eventStore } from './event-store';
import { projectStore } from './project-store';
import { taskStore } from './task-store';
import { BridgeProvider, communicationStore } from './communications';
import { ensureCompanyRecords } from './bootstrap';
export function modelConfigured() {
  // The offered per-agent profiles use the verified Mastra Gateway transport.
  return Boolean(process.env.MASTRA_GATEWAY_API_KEY);
}
export async function companyTick(
  mastra: Mastra,
  provider = new BridgeProvider(),
) {
  const journal = eventStore();
  await ensureCompanyRecords();
  await projectStore().init();
  await communicationStore().init();
  await planningStore().approveRoutinePlans();
  await operationsStore().monitor();
  if (provider.configured()) {
    await journal.heartbeat(
      'working',
      'Checking approved communications and tracked client replies',
    );
    await communicationStore().processOne(provider);
    await communicationStore().pollReplies(provider);
  }
  if (!modelConfigured()) {
    await journal.heartbeat(
      'blocked',
      'Worker is running; AI assignments need a valid model credential',
    );
    return;
  }
  await projectStore().acceptPendingArtifacts();
  await planningStore().acceptReviewedArtifacts();
  await connectorStore().resumeReady();
  await recoverEvidenceBlockers();
  const max = hourlyJobLimit();
  if (max !== null && (await journal.recentRuns()) >= max) {
    await journal.heartbeat(
      'rate limited',
      `Hourly assignment limit reached (${max}); communications still checked`,
    );
    return;
  }
  const discord = new DiscordService();
  if (await discord.enabled()) {
    const responded = await processDiscordRequest(mastra,(key,channel,content)=>discord.queue(key,channel,content));
    if (responded) {await journal.heartbeat('idle','Discord discussion answered; waiting for the next cycle');return;}
  }
  const task = await projectStore().nextTask(
    await operationsStore().pausedAgents(),
    true,
  );
  if (task) {
    await journal.heartbeat('working', 'Preparing ' + task.title, task.id);
    const run = await mastra.getWorkflow('companyTaskWorkflow').createRun();
    await run.start({ inputData: { taskId: task.id } });
    await projectStore().acceptReviewedArtifact(task.id);
    await planningStore().acceptReviewedArtifacts();
    await journal.heartbeat(
      'idle',
      'Assignment cycle finished; waiting for the next cycle',
    );
    return;
  }
  await journal.heartbeat(
    'idle',
    'No eligible queued work; waiting for dependencies, review or a new project',
  );
}
export async function startCompanyWorker(mastra: Mastra) {
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL is required');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  const lease = await pool.connect();
  const got = await lease.query(
    "SELECT pg_try_advisory_lock(hashtext('ascendxi.local.worker'))AS acquired",
  );
  if (!got.rows[0].acquired) {
    lease.release();
    await pool.end();
    throw Error('A company worker already owns this database');
  }
  await operationsStore().init();
  await operationsStore().pool.query(
    "UPDATE ascendxi_runs SET status='failed',ended_at=now(),error='Process restarted; inspect interrupted work before retry' WHERE status='running'",
  );
  let monitorBusy = false;
  const monitorTimer = setInterval(() => {
    if (monitorBusy) return;
    monitorBusy = true;
    void operationsStore()
      .monitor()
      .catch(() => {})
      .finally(() => {
        monitorBusy = false;
      });
  }, 15000);
  let discordBusy = false;
  const discordTimer = setInterval(() => {
    if (discordBusy) return;
    discordBusy = true;
    void Promise.all([new DiscordService().tick(), new InboxWatch().tick()])
      .catch(() => {})
      .finally(() => {
        discordBusy = false;
      });
  }, 15000);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pulse: ReturnType<typeof setInterval> | undefined;
  let active = false;
  const stop = () => {
    stopped = true;
    clearInterval(monitorTimer);
    clearInterval(discordTimer);
    if (timer) clearTimeout(timer);
    if (pulse) clearInterval(pulse);
    if (!active) {
      lease.release();
      void pool.end();
    }
  };
  lease.on('error', () => {
    stop();
    mastra.getLogger()?.error('company.worker.lease_lost');
    process.exit(1); // The supervisor must restart a worker that lost its database lease.
  });
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  await eventStore().append({
    kind: 'worker.started',
    actor: 'local-worker',
    summary: 'Local company worker started',
    data: {
      pid: process.pid,
      maxRunsPerHour: hourlyJobLimit(),
    },
  });
  const cycle = async () => {
    if (stopped) return;
    active = true;
    pulse = setInterval(() => {
      void lease
        .query('SELECT 1')
        .then(() =>
          eventStore().pool.query(
            "UPDATE ascendxi_worker_state SET heartbeat_at=now()WHERE id='local' AND pid=$1",
            [process.pid],
          ),
        )
        .catch(() => {
          stop();
          process.exit(1);
        });
    }, 15000);
    let failed = false;
    try {
      await lease.query('SELECT 1');
      await companyTick(mastra);
    } catch {
      failed = true;
      await eventStore().append({
        kind: 'worker.cycle.failed',
        actor: 'local-worker',
        summary: 'Worker cycle failed; no provider payload was recorded',
      });
      await eventStore().heartbeat(
        'error',
        'Cycle failed; inspect the event feed and protected logs',
      );
      mastra.getLogger()?.warn('company.worker.cycle_failed');
    } finally {
      active = false;
      if (pulse) clearInterval(pulse);
      if (stopped) {
        lease.release();
        await pool.end();
      } else {
        // Continue a real backlog promptly. No model calls are made by idle polling.
        const next = await projectStore().nextTask(await operationsStore().pausedAgents(), true).catch(() => null);
        timer = setTimeout(cycle, !failed && next && hourlyJobLimit() === null ? 1000 : 15000);
      }
    }
  };
  void cycle();
  return stop;
}
