import { planningStore } from './planning-store';
import { ownerFor, pausedCapabilities } from './team';
import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { z } from 'zod';
import { products, roleCatalog } from './catalog';
import { eventStore } from './event-store';
import { taskStore } from './task-store';
import { clientStore } from './client-store';
export const projectInput = z.object({
  key: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100),
  kind: z.enum(['client', 'internal']).default('client'),
  clientKey: z.string().min(3).max(120).nullable().optional(),
  name: z.string().min(3).max(200),
  brief: z.string().min(20).max(8000),
  awardEvidence: z.string().min(10).max(2000),
  product: z.enum(products),
  autoAcceptArtifacts: z.boolean().default(false),
});
export const deliverySteps = [
  {
    key: 'scope',
    role: 'product-manager',
    title: 'Confirm project scope and acceptance',
    after: [],
  },
  {
    key: 'ux',
    role: 'ux-researcher',
    title: 'Prepare user journeys and usability evidence',
    after: ['scope'],
  },
  {
    key: 'design',
    role: 'ui-designer',
    title: 'Prepare reviewed interface specifications',
    after: ['ux'],
  },
  {
    key: 'ai',
    role: 'ai-agent-specialist',
    title: 'Prepare agent architecture and evaluation contracts',
    after: ['scope'],
  },
  {
    key: 'backend',
    role: 'backend-developer',
    title: 'Prepare backend deliverable and verification evidence',
    after: ['ai'],
  },
  {
    key: 'frontend',
    role: 'frontend-developer',
    title: 'Prepare frontend deliverable and verification evidence',
    after: ['design', 'backend'],
  },
  {
    key: 'security',
    role: null,
    title: 'Review access, privacy and delivery risks',
    after: ['backend', 'frontend'],
  },
  {
    key: 'qa',
    role: 'qa-engineer',
    title: 'Independently review client acceptance evidence',
    after: ['security'],
  },
  {
    key: 'release',
    role: 'devops-engineer',
    title: 'Prepare release, monitoring and rollback evidence',
    after: ['qa'],
  },
  {
    key: 'handoff',
    role: 'delivery-manager',
    title: 'Prepare client handoff and status update',
    after: ['release'],
  },
  {
    key: 'support',
    role: 'knowledge-curator',
    title: 'Prepare ongoing support and knowledge proposals',
    after: ['handoff'],
  },
] as const;
export class ProjectStore {
  private initialized?: Promise<void>;
  constructor(readonly pool: Pool) {}
  async init() {
    return (this.initialized ??= this.initialize().catch((e) => {
      this.initialized = undefined;
      throw e;
    }));
  }
  private async initialize() {
    await eventStore().init();
    await taskStore().list(1);
    await planningStore().init();
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(
        "SELECT pg_advisory_xact_lock(hashtext('ascendxi.projects.schema.v1'))",
      );
      await c.query(
        `CREATE TABLE IF NOT EXISTS ascendxi_projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),key text UNIQUE NOT NULL,client_key text,kind text NOT NULL DEFAULT 'client',name text NOT NULL,brief text NOT NULL,award_evidence text NOT NULL,product text NOT NULL,paused boolean NOT NULL DEFAULT false,ready boolean NOT NULL DEFAULT false,auto_accept_artifacts boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now())`,
      );
      await c.query(
        `CREATE TABLE IF NOT EXISTS ascendxi_project_steps(project_id uuid REFERENCES ascendxi_projects(id),key text NOT NULL,task_id uuid NOT NULL UNIQUE,after_keys jsonb NOT NULL,PRIMARY KEY(project_id,key))`,
      );
      // Existing-column ALTERs still request AccessExclusiveLock. Avoid upgrading
      // locks on live tables while a dashboard/workflow reads projects + steps.
      const stepColumns = (await c.query("SELECT attname FROM pg_attribute WHERE attrelid=to_regclass('ascendxi_project_steps') AND attnum>0 AND NOT attisdropped")).rows;
      if (!stepColumns.some(a => a.attname === 'position'))
        await c.query('ALTER TABLE ascendxi_project_steps ADD COLUMN position integer');
      const projectColumns = (await c.query("SELECT attname,attnotnull FROM pg_attribute WHERE attrelid=to_regclass('ascendxi_projects') AND attnum>0 AND NOT attisdropped")).rows;
      for (const [name, definition] of [['kind', "text NOT NULL DEFAULT 'client'"], ['ready', 'boolean NOT NULL DEFAULT false'], ['auto_accept_artifacts', 'boolean NOT NULL DEFAULT false']]) {
        if (!projectColumns.some(a => a.attname === name))
          await c.query('ALTER TABLE ascendxi_projects ADD COLUMN '+name+' '+definition);
      }
      if (projectColumns.find(a => a.attname === 'client_key')?.attnotnull)
        await c.query('ALTER TABLE ascendxi_projects ALTER COLUMN client_key DROP NOT NULL');
      await c.query(
        `CREATE TABLE IF NOT EXISTS ascendxi_project_artifacts(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,project_id uuid REFERENCES ascendxi_projects(id),path text NOT NULL,content text NOT NULL,source text NOT NULL,hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`,
      );
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  async create(input: z.input<typeof projectInput>) {
    const d = projectInput.parse(input);
    await this.init();
    if (d.kind === 'client') {
      if (!d.clientKey)
        throw Error('Project requires a won opportunity with award evidence');
      const lead = await clientStore().get(d.clientKey);
      if (
        !['won', 'delivery', 'quality', 'handoff', 'support'].includes(
          lead.stage,
        )
      )
        throw Error('Project requires a won opportunity with award evidence');
    }
    const c = await this.pool.connect();
    let project;
    try {
      await c.query('BEGIN');
      const r = await c.query(
        `INSERT INTO ascendxi_projects(key,client_key,name,brief,award_evidence,product,auto_accept_artifacts,kind)VALUES($1,$2,$3,$4,$5,$6,$7,$8)ON CONFLICT(key)DO NOTHING RETURNING *`,
        [
          d.key,
          d.clientKey ?? null,
          d.name,
          d.brief,
          d.awardEvidence,
          d.product,
          d.autoAcceptArtifacts,
          d.kind,
        ],
      );
      project =
        r.rows[0] ??
        (await c.query('SELECT * FROM ascendxi_projects WHERE key=$1', [d.key]))
          .rows[0];
      if (
        project.client_key !== (d.clientKey ?? null) ||
        project.kind !== d.kind ||
        project.name !== d.name ||
        project.brief !== d.brief ||
        project.award_evidence !== d.awardEvidence ||
        project.product !== d.product ||
        project.auto_accept_artifacts !== d.autoAcceptArtifacts
      )
        throw Error('Project key already belongs to a different project');
      if (r.rowCount)
        await c.query(
          "INSERT INTO ascendxi_events(kind,actor,summary,project_id,client_key)VALUES('project.awarded','operator',$1,$2,$3)",
          [d.name, project.id, d.clientKey],
        );
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
    if (project.ready) return project;
    // Re-entrant initialization repairs an interrupted setup without duplicating assignments.
    for (const step of deliverySteps) {
      const department = step.role
        ? roleCatalog[step.role].department
        : 'security';
      const task = await taskStore().create({
        key: `project:${project.id}:${step.key}:v1`,
        title: step.title + ' / ' + d.name,
        objective: `Project brief: ${d.brief}\nAward evidence: ${d.awardEvidence}\nPrepare the assigned deliverable with actual evidence and clear blockers. This durable task workflow may read operator-provided project source/evidence artifacts. External actions and writes are disabled. Do not claim implementation, deployment, communication or acceptance without actual receipts. Use project room messages and prerequisite deliverables as context.`,
        product: d.product,
        department,
        specialist: step.role,
        client_key: d.clientKey,
        goal_key:
          d.kind === 'internal' ? 'agent-led-company' : 'client-lifecycle',
        acceptance: [
          'Address the approved brief and acceptance criteria',
          'Cite actual artifacts/tests or clearly identify missing evidence',
          'Name the receiving role, blockers and next action',
        ],
      });
      await this.pool.query(
        'INSERT INTO ascendxi_project_steps(project_id,key,task_id,after_keys)VALUES($1,$2,$3,$4)ON CONFLICT DO NOTHING',
        [project.id, step.key, task.id, JSON.stringify(step.after)],
      );
    }
    if (!project.ready && !(await planningStore().list()).some(p => p.key === 'project-' + project.id)) {
      const today = new Date();
      await planningStore().propose({
        key: 'project-' + project.id, kind: 'project', title: d.name, product: d.product,
        outcome: d.brief, scope: d.brief, exclusions: ['No external writes, deployments, spending or access changes are approved by this plan.'],
        department: 'product', acceptance: ['Every milestone has cited evidence and independent review', 'Founder reviews scope and target dates before work starts'],
        assumptions: ['Target dates are provisional until founder approval; capacity and rates are not yet verified.'], evidence: [d.awardEvidence],
        milestones: deliverySteps.map((s, i) => ({ key: s.key, title: s.title, owner: s.role ? ownerFor(s.role) : 'quality', objective: s.title + ' within this brief: ' + d.brief,
          acceptance: ['Address the approved scope with cited evidence', 'Identify remaining limitations and next owner'],
          targetDate: new Date(today.getTime() + (i + 1) * 86400000).toISOString().slice(0,10), estimateMinutes: null, after: [...s.after] })),
        budget: { monthlyCap: null, currency: 'USD', note: 'Budget undecided; this proposal does not authorize any new spending.' },
        subjectKey: project.id, requestedAgent: null, toolIds: [], setupUrl: null, manualSteps: [], expectedVersion: 0,
      }, 'company-system');
    }
    return project;
  }
  async list() {
    await this.init();
    return (
      await this.pool.query(
        `SELECT p.*,COALESCE((SELECT jsonb_agg(jsonb_build_object('key',s.key,'taskId',t.id,'title',t.title,'status',t.status,'specialist',t.specialist,'after',s.after_keys,'report',t.report)ORDER BY COALESCE(s.position,CASE s.key WHEN 'scope' THEN 0 WHEN 'ux' THEN 1 WHEN 'design' THEN 2 WHEN 'ai' THEN 3 WHEN 'backend' THEN 4 WHEN 'frontend' THEN 5 WHEN 'security' THEN 6 WHEN 'qa' THEN 7 WHEN 'release' THEN 8 WHEN 'handoff' THEN 9 ELSE 10 END),t.created_at)FROM ascendxi_project_steps s JOIN ascendxi_tasks t ON t.id=s.task_id WHERE s.project_id=p.id),'[]'::jsonb)AS steps FROM ascendxi_projects p ORDER BY p.created_at DESC LIMIT 100`,
      )
    ).rows;
  }
  async putArtifact(
    projectId: string,
    path: string,
    content: string,
    source: string,
  ) {
    await this.init();
    if (
      !path ||
      path.length > 300 ||
      path.startsWith('/') ||
      path.split('/').some((p) => p === '..' || p.startsWith('.env')) ||
      content.length > 50000 ||
      source.length < 3 ||
      source.length > 2000
    )
      throw Error('Invalid bounded project artifact');
    const hash = createHash('sha256').update(content).digest('hex');
    return (
      await this.pool.query(
        `WITH saved AS(INSERT INTO ascendxi_project_artifacts(project_id,path,content,source,hash)VALUES($1,$2,$3,$4,$5)RETURNING *),logged AS(INSERT INTO ascendxi_events(kind,actor,summary,project_id,data)SELECT 'artifact.saved','operator',path,project_id,jsonb_build_object('path',path,'hash',hash,'source',source)FROM saved)SELECT id,path,hash,source FROM saved`,
        [projectId, path, content, source, hash],
      )
    ).rows[0];
  }
  async artifacts(projectId: string) {
    await this.init();
    return (
      await this.pool.query(
        'SELECT DISTINCT ON(path)path,hash,source,length(content)AS size,created_at FROM ascendxi_project_artifacts WHERE project_id=$1 ORDER BY path,id DESC',
        [projectId],
      )
    ).rows;
  }
  async artifact(projectId: string, path: string) {
    await this.init();
    const row = (
      await this.pool.query(
        'SELECT path,content,source,hash,created_at FROM ascendxi_project_artifacts WHERE project_id=$1 AND path=$2 ORDER BY id DESC LIMIT 1',
        [projectId, path],
      )
    ).rows[0];
    if (!row) throw Error('Project artifact not found');
    return row;
  }
  async projectIdForClient(clientKey: string) {
    await this.init();
    const rows = (
      await this.pool.query(
        'SELECT id FROM ascendxi_projects WHERE client_key=$1 AND ready ORDER BY created_at DESC LIMIT 2',
        [clientKey],
      )
    ).rows;
    return rows.length === 1 ? rows[0].id : undefined;
  }
  async forTask(taskId: string) {
    await this.init();
    return (
      await this.pool.query(
        'SELECT p.* FROM ascendxi_projects p JOIN ascendxi_project_steps s ON s.project_id=p.id WHERE s.task_id=$1',
        [taskId],
      )
    ).rows[0];
  }
  async prerequisites(taskId: string) {
    await this.init();
    return (
      await this.pool.query(
        `SELECT t.* FROM ascendxi_project_steps own JOIN ascendxi_project_steps needed ON needed.project_id=own.project_id AND own.after_keys ? needed.key JOIN ascendxi_tasks t ON t.id=needed.task_id WHERE own.task_id=$1`,
        [taskId],
      )
    ).rows;
  }
  async nextTask(excludedAgents: string[] = [], planned = false) {
    await this.init();
    return (
      await this.pool.query(
        `SELECT t.* FROM ascendxi_tasks t ${planned ? 'LEFT JOIN ascendxi_task_plan plan ON plan.task_id=t.id' : ''} LEFT JOIN ascendxi_project_steps s ON s.task_id=t.id LEFT JOIN ascendxi_projects p ON p.id=s.project_id WHERE t.status='queued' AND (t.goal_key IS NULL OR EXISTS(SELECT 1 FROM ascendxi_goals g WHERE g.key=t.goal_key AND g.status='active')) AND NOT EXISTS(SELECT 1 FROM ascendxi_milestone_tasks m JOIN ascendxi_plans mp ON mp.key=m.plan_key WHERE m.task_id=t.id AND (mp.status<>'approved' OR mp.version<>m.version OR EXISTS(SELECT 1 FROM ascendxi_milestone_tasks needed JOIN ascendxi_tasks nt ON nt.id=needed.task_id WHERE needed.plan_key=m.plan_key AND needed.version=m.version AND m.after_keys ? needed.milestone_key AND nt.status<>'completed'))) AND NOT(COALESCE(t.specialist,t.department)=ANY($1::text[])) AND NOT(t.key LIKE 'project:%' AND s.task_id IS NULL) AND (s.task_id IS NULL OR (p.ready AND NOT p.paused))AND NOT EXISTS(SELECT 1 FROM ascendxi_project_steps dep JOIN ascendxi_tasks dt ON dt.id=dep.task_id WHERE dep.project_id=s.project_id AND s.after_keys ? dep.key AND dt.status<>'completed') ORDER BY ${planned ? "CASE COALESCE(plan.priority,(SELECT r.payload->>'priority' FROM ascendxi_milestone_tasks m JOIN ascendxi_plan_revisions r ON r.key=m.plan_key AND r.version=m.version WHERE m.task_id=t.id)) WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'low' THEN 3 ELSE 2 END,plan.due_at ASC NULLS LAST," : ''}t.created_at LIMIT 1`,
        [pausedCapabilities(excludedAgents)],
      )
    ).rows[0];
  }
  async acceptPendingArtifacts() {
    await this.init();
    const ids = (
      await this.pool.query(
        `SELECT t.id FROM ascendxi_tasks t JOIN ascendxi_project_steps s ON s.task_id=t.id JOIN ascendxi_projects p ON p.id=s.project_id WHERE t.status='review' AND p.auto_accept_artifacts AND NOT p.paused AND p.ready LIMIT 100`,
      )
    ).rows;
    for (const task of ids) await this.acceptReviewedArtifact(task.id);
  }
  async claimApprovedTask(taskId: string, jobId?: string) {
    await this.init();
    const c=await this.pool.connect();
    try {
      await c.query('BEGIN');
      // Lock scope before checking/claiming. A concurrent edit cannot slip between eligibility and claim.
      await c.query('SELECT p.key FROM ascendxi_plans p JOIN ascendxi_milestone_tasks m ON m.plan_key=p.key WHERE m.task_id=$1 ORDER BY p.key FOR SHARE OF p',[taskId]);
      await c.query('SELECT p.id FROM ascendxi_projects p JOIN ascendxi_project_steps s ON s.project_id=p.id WHERE s.task_id=$1 FOR SHARE OF p',[taskId]);
      await c.query('SELECT g.key FROM ascendxi_goals g JOIN ascendxi_tasks t ON t.goal_key=g.key WHERE t.id=$1 FOR SHARE OF g',[taskId]);
      if (!(await this.eligible(taskId,c))) throw Error('Scope approval or prerequisites changed before claim');
      const task=await taskStore().claim(taskId,jobId);
      await c.query('COMMIT');return task;
    } catch(e) {await c.query('ROLLBACK');throw e;} finally {c.release();}
  }
  async eligible(taskId: string, client?: PoolClient) {
    await this.init();
    const r = await (client ?? this.pool).query(
      `SELECT 1 FROM ascendxi_tasks own LEFT JOIN ascendxi_project_steps s ON s.task_id=own.id LEFT JOIN ascendxi_projects p ON p.id=s.project_id WHERE own.id=$1 AND ((own.goal_key IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ascendxi_goals g WHERE g.key=own.goal_key AND g.status='active')) OR EXISTS(SELECT 1 FROM ascendxi_milestone_tasks m JOIN ascendxi_plans mp ON mp.key=m.plan_key WHERE m.task_id=own.id AND (mp.status<>'approved' OR mp.version<>m.version OR EXISTS(SELECT 1 FROM ascendxi_milestone_tasks needed JOIN ascendxi_tasks nt ON nt.id=needed.task_id WHERE needed.plan_key=m.plan_key AND needed.version=m.version AND m.after_keys ? needed.milestone_key AND nt.status<>'completed'))) OR (own.key LIKE 'project:%' AND (s.task_id IS NULL OR p.paused OR NOT p.ready)) OR EXISTS(SELECT 1 FROM ascendxi_project_steps dep JOIN ascendxi_tasks t ON t.id=dep.task_id WHERE dep.project_id=s.project_id AND s.after_keys ? dep.key AND t.status<>'completed'))`,
      [taskId],
    );
    return !r.rowCount;
  }
  async acceptReviewedArtifact(taskId: string) {
    await this.init();
    return (
      await this.pool.query(
        `WITH changed AS(UPDATE ascendxi_tasks t SET status='completed',report=report||jsonb_build_object('projectPolicy','Independent artifact review accepted under operator-approved project charter'),updated_at=now()FROM ascendxi_project_steps s JOIN ascendxi_projects p ON p.id=s.project_id WHERE t.id=$1 AND s.task_id=t.id AND p.ready AND NOT p.paused AND p.auto_accept_artifacts AND t.status='review' AND t.report->'review'->>'accepted'='true' AND t.report->'review'->'evidenceGaps'='[]'::jsonb AND t.report->'report'->'blockers'='[]'::jsonb RETURNING t.*,p.id AS project_id),logged AS(INSERT INTO ascendxi_events(kind,actor,summary,task_id,project_id,data)SELECT 'task.policy.accepted','project-policy',title,id,project_id,jsonb_build_object('authority','Operator-approved internal artifact acceptance','report',report)FROM changed)SELECT * FROM changed`,
        [taskId],
      )
    ).rows[0];
  }
  async pause(id: string, paused: boolean) {
    await this.init();
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const r = await c.query(
        'UPDATE ascendxi_projects SET paused=$2 WHERE id=$1 RETURNING *',
        [id, paused],
      );
      if (!r.rowCount) throw Error('Project not found');
      await c.query(
        "INSERT INTO ascendxi_events(kind,actor,summary,project_id,data)VALUES('project.pause','operator',$1,$2,$3)",
        [r.rows[0].name, id, JSON.stringify({ paused })],
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
  close() {
    return this.pool.end();
  }
}
let store: ProjectStore | undefined;
export function projectStore() {
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL is required');
  return (store ??= new ProjectStore(
    new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 10000,
      query_timeout: 15000,
    }),
  ));
}
export async function closeProjectStore() {
  const old = store;
  store = undefined;
  await old?.close();
}
