import { knowledgeStore } from './knowledge-store';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { z } from 'zod';
import { products, departmentIds } from './catalog';
import { team, type TeamId } from './team';
import { eventSchema } from './event-store';
import { taskStore } from './task-store';
import { routinePlanEligible, internalAutonomyEnabled } from './autonomy';

const key = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
export const milestoneInput = z.object({
  key, title: z.string().min(3).max(200), owner: z.enum(Object.keys(team).filter(id=>id!=='operations-monitor') as [TeamId, ...TeamId[]]),
  objective: z.string().min(10).max(6000), acceptance: z.array(z.string().min(3).max(1000)).min(1).max(10),
  targetDate: z.iso.date(), estimateMinutes: z.number().int().min(1).max(525600).nullable(),
  after: z.array(key).max(20),
});
export const planInput = z.object({
  priority: z.enum(['urgent','high','normal','low']).optional(),
  key, kind: z.enum(['goal', 'project', 'access', 'service', 'budget', 'deployment']),
  title: z.string().min(3).max(200), product: z.enum(products),
  outcome: z.string().min(10).max(6000), scope: z.string().min(10).max(8000),
  exclusions: z.array(z.string().min(3).max(1000)).max(20),
  department: z.enum(departmentIds as [string, ...string[]]),
  acceptance: z.array(z.string().min(3).max(1000)).min(1).max(20),
  assumptions: z.array(z.string().min(3).max(1000)).min(1).max(20),
  evidence: z.array(z.string().min(3).max(2000)).min(1).max(20),
  milestones: z.array(milestoneInput).max(20),
  budget: z.object({ monthlyCap: z.number().min(0).max(1000000).nullable(), currency: z.enum(['USD', 'INR']), note: z.string().min(10).max(2000) }),
  subjectKey: z.string().max(120).nullable(),
  requestedAgent: z.enum(Object.keys(team) as [TeamId, ...TeamId[]]).nullable(),
  toolIds: z.array(z.string().min(1).max(200)).max(30),
  setupUrl: z.string().url().nullable().refine(url => !url || (new URL(url).protocol === 'https:' && !new URL(url).username && !new URL(url).password), 'Use a public HTTPS setup URL without credentials'),
  manualSteps: z.array(z.string().min(3).max(1000)).max(20),
  expectedVersion: z.number().int().min(0),
}).strict().superRefine((p, c) => {
  if (p.kind === 'goal' && p.subjectKey && p.subjectKey !== p.key) c.addIssue({code:'custom',path:['subjectKey'],message:'A goal proposal must use its own stable key'});
  if (p.kind === 'goal' && ['client-lifecycle','agent-led-company','accurate-company-knowledge','visible-reliable-operations'].includes(p.key)) c.addIssue({code:'custom',path:['key'],message:'Use a new scoped goal; preserve the established founder mandates'});
  const seen = new Set<string>();
  for (const [i, m] of p.milestones.entries()) {
    if (seen.has(m.key) || m.after.some(k => !seen.has(k))) c.addIssue({ code: 'custom', path: ['milestones', i], message: 'Milestone keys must be unique and depend only on earlier milestones' });
    seen.add(m.key);
  }
  if ((p.kind === 'goal' || p.kind === 'project') && !p.milestones.length) c.addIssue({ code: 'custom', path: ['milestones'], message: 'A goal or project needs milestones before approval' });
  if (p.kind === 'project' && !z.string().uuid().safeParse(p.subjectKey).success) c.addIssue({ code: 'custom', path: ['subjectKey'], message: 'Project ID required' });
});
export type PlanInput = z.infer<typeof planInput>;
export function planHash(data: Omit<PlanInput, 'expectedVersion'>) { return createHash('sha256').update(JSON.stringify(data)).digest('hex'); }

export class PlanningStore {
  private initialized?: Promise<void>;
  constructor(readonly pool: Pool) {}
  async init() { return this.initialized ??= this.initialize().catch(e => { this.initialized = undefined; throw e; }); }
  private async initialize() {
    await taskStore().list(1);
    await knowledgeStore().goals();
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT pg_advisory_xact_lock(hashtext('ascendxi.planning.schema.v1'))");
      await eventSchema(c);
      await c.query(`CREATE TABLE IF NOT EXISTS ascendxi_plans(key text PRIMARY KEY,version integer NOT NULL DEFAULT 0,status text NOT NULL DEFAULT 'proposed',updated_at timestamptz NOT NULL DEFAULT now());
        CREATE TABLE IF NOT EXISTS ascendxi_plan_revisions(key text REFERENCES ascendxi_plans(key),version integer NOT NULL,payload jsonb NOT NULL,hash text NOT NULL,actor text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(key,version));
        CREATE TABLE IF NOT EXISTS ascendxi_plan_decisions(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,key text NOT NULL,version integer NOT NULL,hash text NOT NULL,decision text NOT NULL,note text NOT NULL,actor text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
        CREATE TABLE IF NOT EXISTS ascendxi_plan_comments(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,key text REFERENCES ascendxi_plans(key),version integer NOT NULL,speaker text NOT NULL,content text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
        CREATE TABLE IF NOT EXISTS ascendxi_milestone_tasks(plan_key text REFERENCES ascendxi_plans(key),version integer NOT NULL,milestone_key text NOT NULL,task_id uuid UNIQUE NOT NULL,after_keys jsonb NOT NULL,PRIMARY KEY(plan_key,version,milestone_key));`);
      await c.query('COMMIT');
    } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  async propose(input: PlanInput, actor = 'agent') {
    const { expectedVersion, ...data } = planInput.parse(input);
    await this.init(); const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('INSERT INTO ascendxi_plans(key)VALUES($1)ON CONFLICT DO NOTHING', [data.key]);
      const current = (await c.query('SELECT * FROM ascendxi_plans WHERE key=$1 FOR UPDATE', [data.key])).rows[0];
      if (current.version !== expectedVersion) throw Error('Plan changed: reload the current revision before editing');
      if (current.version) {
        const prior = (await c.query('SELECT payload FROM ascendxi_plan_revisions WHERE key=$1 AND version=$2',[data.key,current.version])).rows[0].payload;
        if (prior.kind !== data.kind || prior.subjectKey !== data.subjectKey) throw Error('Plan identity is immutable; create a separate proposal for a different subject');
        if ((await c.query("SELECT 1 FROM ascendxi_milestone_tasks m JOIN ascendxi_tasks t ON t.id=m.task_id WHERE m.plan_key=$1 AND t.status='running'",[data.key])).rowCount) throw Error('Wait for the in-flight assignment before revising scope');
      }
      if (data.kind === 'project') {
        const running = await c.query("SELECT 1 FROM ascendxi_project_steps s JOIN ascendxi_tasks t ON t.id=s.task_id WHERE s.project_id=$1 AND t.status='running'", [data.subjectKey]);
        if (running.rowCount) throw Error('Wait for the in-flight project assignment before revising scope');
        await c.query('UPDATE ascendxi_projects SET ready=false WHERE id=$1', [data.subjectKey]);
      }
      const version = expectedVersion + 1, hash = planHash(data);
      await c.query('INSERT INTO ascendxi_plan_revisions(key,version,payload,hash,actor)VALUES($1,$2,$3,$4,$5)', [data.key, version, data, hash, actor]);
      await c.query("UPDATE ascendxi_plans SET version=$2,status='proposed',updated_at=now()WHERE key=$1", [data.key, version]);
      // Editing a goal suspends its execution until this revision is approved.
      if (data.kind === 'goal') await c.query("UPDATE ascendxi_goals SET status='proposed',updated_at=now()WHERE key=$1", [data.subjectKey || data.key]);
      await c.query("INSERT INTO ascendxi_events(kind,actor,summary,data)VALUES('plan.proposed',$1,$2,$3)", [actor, data.title, { key: data.key, version, hash, kind: data.kind }]);
      await c.query('COMMIT'); return { ...data, version, hash, status: 'proposed' };
    } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  async list() {
    await this.init();
    return (await this.pool.query(`SELECT p.*,r.hash,r.payload,r.actor,r.created_at,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('key',m.milestone_key,'taskId',t.id,'status',t.status) ORDER BY t.created_at)FROM ascendxi_milestone_tasks m JOIN ascendxi_tasks t ON t.id=m.task_id WHERE m.plan_key=p.key AND m.version=p.version),'[]'::jsonb) AS work
      FROM ascendxi_plans p JOIN ascendxi_plan_revisions r ON r.key=p.key AND r.version=p.version ORDER BY p.updated_at DESC LIMIT 100`)).rows;
  }
  async inspect(key: string) {
    await this.init();
    const plan = (await this.list()).find(p => p.key === key); if (!plan) throw Error('Plan not found');
    return { ...plan, history: (await this.pool.query('SELECT * FROM ascendxi_plan_revisions WHERE key=$1 ORDER BY version DESC', [key])).rows,
      comments: (await this.pool.query('SELECT * FROM ascendxi_plan_comments WHERE key=$1 ORDER BY id LIMIT 200', [key])).rows,
      decisions: (await this.pool.query('SELECT * FROM ascendxi_plan_decisions WHERE key=$1 ORDER BY id DESC', [key])).rows };
  }
  async forTask(taskId: string) {
    await this.init();
    const scope = (await this.pool.query('SELECT m.*,r.payload,p.status,p.version AS current_version FROM ascendxi_milestone_tasks m JOIN ascendxi_plans p ON p.key=m.plan_key JOIN ascendxi_plan_revisions r ON r.key=m.plan_key AND r.version=m.version WHERE m.task_id=$1',[taskId])).rows[0];
    if (!scope) return null;
    const prerequisites=(await this.pool.query(`SELECT t.id,t.title,t.status,t.report FROM ascendxi_milestone_tasks m JOIN ascendxi_tasks t ON t.id=m.task_id WHERE m.plan_key=$1 AND m.version=$2 AND m.milestone_key=ANY($3::text[])`,[scope.plan_key,scope.version,scope.after_keys])).rows;
    return {key:scope.plan_key,version:scope.version,status:scope.status,scope:scope.payload,prerequisites};
  }
  async acceptReviewedArtifacts() {
    await this.init();
    if (internalAutonomyEnabled()) await this.pool.query(`WITH changed AS(UPDATE ascendxi_tasks t SET status='completed',updated_at=now(),report=report||jsonb_build_object('planPolicy','Independent internal artifact accepted under founder-delegated autonomy') WHERE t.status='review' AND t.client_key IS NULL AND t.key NOT LIKE 'project:%' AND EXISTS(SELECT 1 FROM ascendxi_goals g WHERE g.key=t.goal_key AND g.status='active') AND NOT EXISTS(SELECT 1 FROM ascendxi_milestone_tasks m WHERE m.task_id=t.id) AND t.report->'review'->>'accepted'='true' AND t.report->'review'->'evidenceGaps'='[]'::jsonb AND t.report->'report'->'blockers'='[]'::jsonb RETURNING t.*)INSERT INTO ascendxi_events(kind,actor,summary,task_id)SELECT 'task.autonomy.accepted','founder-autonomy-policy',title,id FROM changed`);
    return (await this.pool.query(`WITH changed AS(UPDATE ascendxi_tasks t SET status='completed',updated_at=now(),report=report||jsonb_build_object('planPolicy','Independent internal artifact accepted under founder-approved scope') FROM ascendxi_milestone_tasks m JOIN ascendxi_plans p ON p.key=m.plan_key AND p.version=m.version WHERE m.task_id=t.id AND p.status='approved' AND t.status='review' AND t.report->'review'->>'accepted'='true' AND t.report->'review'->'evidenceGaps'='[]'::jsonb AND t.report->'report'->'blockers'='[]'::jsonb RETURNING t.*),logged AS(INSERT INTO ascendxi_events(kind,actor,summary,task_id,data)SELECT 'task.plan.accepted','approved-plan-policy',title,id,jsonb_build_object('authority','Founder-approved internal artifact scope')FROM changed)SELECT id FROM changed`)).rows;
  }
  async comment(key: string, version: number, content: string, speaker: string) {
    z.string().min(1).max(6000).parse(content); await this.init();
    const r = await this.pool.query(`WITH saved AS(INSERT INTO ascendxi_plan_comments(key,version,speaker,content)SELECT key,version,$3,$4 FROM ascendxi_plans WHERE key=$1 AND version=$2 RETURNING *), logged AS(INSERT INTO ascendxi_events(kind,actor,summary,data)SELECT 'plan.discussion',speaker,'Plan discussion',jsonb_build_object('key',key,'version',version)FROM saved)SELECT * FROM saved`, [key, version, speaker, content]);
    if (!r.rowCount) throw Error('Plan changed: reload before discussing'); return r.rows[0];
  }
  /** Only the authenticated operator route calls this; no agent approval tool is exposed. */
  async approveRoutinePlans() {
    const approved: string[] = [];
    for (const p of (await this.list()).filter(p => p.status === 'proposed' && routinePlanEligible(p.payload))) {
      if (p.payload.kind === 'project' && !(await this.pool.query("SELECT 1 FROM ascendxi_projects WHERE id=$1 AND kind='internal'",[p.payload.subjectKey])).rowCount) continue;
      try {
        await this.decide(p.key,p.version,p.hash,'approve','Automatic internal-work authorization under the founder-selected autonomy policy. Reviewed artifacts only; no new spending, access, outbound communication or deployment authority.','founder-autonomy-policy');
        approved.push(p.key);
      } catch (error) {
        // A concurrent exact decision can win. Other failures remain visible to the worker.
        if (!(error instanceof Error) || !error.message.startsWith('Stale or already decided')) throw error;
      }
    }
    return approved;
  }
  async decide(key: string, version: number, hash: string, decision: 'approve' | 'reject' | 'revoke', note: string, actor: 'operator'|'founder-autonomy-policy' = 'operator') {
    z.string().min(10).max(4000).parse(note); await this.init(); const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const p = (await c.query('SELECT p.*,r.payload,r.hash FROM ascendxi_plans p JOIN ascendxi_plan_revisions r ON r.key=p.key AND r.version=p.version WHERE p.key=$1 FOR UPDATE OF p', [key])).rows[0];
      if (!p || p.version !== version || p.hash !== hash || p.status !== (decision === 'revoke' ? 'approved' : 'proposed')) throw Error('Stale or already decided plan: inspect the exact current revision');
      const d = p.payload as Omit<PlanInput, 'expectedVersion'>;
      if (actor === 'founder-autonomy-policy') {
        if (decision !== 'approve' || !routinePlanEligible(d)) throw Error('This decision requires the founder');
        if (d.kind === 'project' && !(await c.query("SELECT 1 FROM ascendxi_projects WHERE id=$1 AND kind='internal'",[d.subjectKey])).rowCount) throw Error('Client scope requires the founder');
      }
      if (decision === 'approve' && d.kind === 'goal') {
        const goalKey = d.subjectKey || d.key;
        await c.query(`INSERT INTO ascendxi_goals(key,title,outcome,product,department,acceptance,status)VALUES($1,$2,$3,$4,$5,$6,'active')ON CONFLICT(key)DO UPDATE SET title=$2,outcome=$3,product=$4,department=$5,acceptance=$6,status='active',updated_at=now()`, [goalKey,d.title,d.outcome,d.product,d.department,JSON.stringify(d.acceptance)]);
        for (const m of d.milestones) {
          const department = m.owner === 'agent' ? 'finance' : m.owner === 'operations-monitor' ? 'operations' : team[m.owner].department;
          const task = (await c.query(`INSERT INTO ascendxi_tasks(key,title,objective,product,department,specialist,goal_key,acceptance)VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING id`, [`plan:${key}:${version}:${m.key}`,m.title,`Approved scope: ${d.scope}\nMilestone: ${m.objective}\nEvidence references: ${d.evidence.join('; ')}\nPrepare an internal artifact with verification evidence. External execution is disabled and needs a separately approved action.`,d.product,department,m.owner === 'ui-designer' ? 'ui-designer' : null,goalKey,JSON.stringify(m.acceptance)])).rows[0];
          await c.query('INSERT INTO ascendxi_milestone_tasks(plan_key,version,milestone_key,task_id,after_keys)VALUES($1,$2,$3,$4,$5)', [key,version,m.key,task.id,JSON.stringify(m.after)]);
          await c.query("INSERT INTO ascendxi_events(kind,actor,summary,task_id,data)VALUES('task.created','founder-approved-plan',$1,$2,$3)", [m.title,task.id,{ key,version,targetDate:m.targetDate,estimateMinutes:m.estimateMinutes }]);
        }
      }
      if (decision === 'approve' && d.kind === 'project') {
        const project = (await c.query('SELECT * FROM ascendxi_projects WHERE id=$1 FOR UPDATE',[d.subjectKey])).rows[0];
        if (!project) throw Error('Project not found');
        for (const m of d.milestones) {
          const department = m.owner === 'agent' ? 'finance' : m.owner === 'operations-monitor' ? 'operations' : team[m.owner].department;
          const existing = (await c.query('SELECT t.id,t.attempts,t.status FROM ascendxi_project_steps s JOIN ascendxi_tasks t ON t.id=s.task_id WHERE s.project_id=$1 AND s.key=$2',[project.id,m.key])).rows[0];
          const objective = `Approved scope revision ${version}: ${d.scope}\nMilestone: ${m.objective}\nSources: ${d.evidence.join('; ')}\nPrepare a reviewed internal artifact. External tools and writes are disabled. Never claim deployment, messages, payments or implementation without actual evidence.`;
          let taskId: string;
          if (version === 1 && existing?.attempts === 0 && existing.status === 'queued') {
            taskId=existing.id;
            await c.query('UPDATE ascendxi_tasks SET title=$2,objective=$3,department=$4,specialist=$5,acceptance=$6,updated_at=now()WHERE id=$1',[taskId,m.title,objective,department,m.owner==='ui-designer'?'ui-designer':null,JSON.stringify(m.acceptance)]);
          } else {
            taskId=(await c.query('INSERT INTO ascendxi_tasks(key,title,objective,product,department,specialist,goal_key,client_key,acceptance)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)RETURNING id',[
              `project:${project.id}:${m.key}:plan${version}`,m.title,objective,d.product,department,m.owner==='ui-designer'?'ui-designer':null,project.kind==='internal'?'agent-led-company':'client-lifecycle',project.client_key,JSON.stringify(m.acceptance),
            ])).rows[0].id;
          }
          await c.query('INSERT INTO ascendxi_project_steps(project_id,key,task_id,after_keys,position)VALUES($1,$2,$3,$4,$5)ON CONFLICT(project_id,key)DO UPDATE SET task_id=$3,after_keys=$4,position=$5',[project.id,m.key,taskId,JSON.stringify(m.after),d.milestones.indexOf(m)]);
          await c.query('INSERT INTO ascendxi_milestone_tasks(plan_key,version,milestone_key,task_id,after_keys)VALUES($1,$2,$3,$4,$5)',[key,version,m.key,taskId,JSON.stringify(m.after)]);
        }
        await c.query('DELETE FROM ascendxi_project_steps WHERE project_id=$1 AND NOT(key=ANY($2::text[]))',[project.id,d.milestones.map(m=>m.key)]);
        await c.query('UPDATE ascendxi_projects SET ready=true,brief=$2,auto_accept_artifacts=true WHERE id=$1',[d.subjectKey,d.scope]);
      }
      if (decision === 'revoke' && d.kind === 'goal') await c.query("UPDATE ascendxi_goals SET status='paused',updated_at=now()WHERE key=$1",[d.subjectKey || d.key]);
      if (decision === 'revoke' && d.kind === 'project') await c.query('UPDATE ascendxi_projects SET ready=false WHERE id=$1',[d.subjectKey]);
      // Exact Discord discussion consent is checked dynamically; other access requests require separate setup and verification.
      const status = decision === 'approve' ? 'approved' : decision === 'revoke' ? 'revoked' : 'rejected';
      await c.query("UPDATE ascendxi_plans SET status=$2,updated_at=now()WHERE key=$1", [key, status]);
      await c.query('INSERT INTO ascendxi_plan_decisions(key,version,hash,decision,note,actor)VALUES($1,$2,$3,$4,$5,$6)', [key,version,hash,decision,note,actor]);
      await c.query("INSERT INTO ascendxi_events(kind,actor,summary,data)VALUES('plan.decided',$1,$2,$3)", [actor,d.title,{ key,version,hash,decision,kind:d.kind }]);
      await c.query('COMMIT'); return { key,version,status };
    } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  close() { return this.pool.end(); }
}
let store: PlanningStore | undefined;
export function planningStore() { if (!process.env.DATABASE_URL) throw Error('DATABASE_URL is required'); return store ??= new PlanningStore(new Pool({ connectionString: process.env.DATABASE_URL,max:4,connectionTimeoutMillis:10000,query_timeout:15000 })); }
export async function closePlanningStore() { const old = store;store = undefined;await old?.close(); }
