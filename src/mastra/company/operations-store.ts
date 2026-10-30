import { blockerDetails } from './blocker-details';
import { ownerFor } from './team';
import { planningStore } from './planning-store';
import { Pool } from 'pg';
import { z } from 'zod';
import { eventStore, eventSchema } from './event-store';
import { taskStore } from './task-store';
import { knowledgeStore } from './knowledge-store';

export const suggestionInput = z.object({
  agentId: z.string().min(1).max(100),
  kind: z.enum(['knowledge', 'memory', 'access']),
  title: z.string().min(3).max(160),
  content: z.string().min(10).max(6000),
  source: z.string().min(3).max(2000),
  taskId: z.string().uuid().nullable().optional(),
});
export const preferenceInput = z
  .object({
    verbosity: z.enum(['concise', 'balanced', 'detailed']).optional(),
    format: z.enum(['bullets', 'prose']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0);
export function maturity(tasks: any[], feedback: any[]) {
  const terminal = tasks.filter((t) =>
    ['completed', 'blocked', 'review'].includes(t.status),
  );
  const reviewed = terminal.filter((t) => t.report?.review);
  const accepted = terminal.filter((t) => t.status === 'completed').length;
  const passed = reviewed.filter(
    (t) => t.report.review.accepted && !t.report.review.evidenceGaps?.length,
  ).length;
  const ratings = feedback.map((f) => Number(f.rating));
  const pieces = [
    terminal.length ? { weight: 0.5, value: accepted / terminal.length } : null,
    reviewed.length ? { weight: 0.3, value: passed / reviewed.length } : null,
    ratings.length
      ? {
          weight: 0.2,
          value: (ratings.reduce((a, b) => a + b, 0) / ratings.length - 1) / 4,
        }
      : null,
  ].filter(Boolean) as { weight: number; value: number }[];
  return {
    score: pieces.length
      ? Math.round(
          (100 * pieces.reduce((a, p) => a + p.weight * p.value, 0)) /
            pieces.reduce((a, p) => a + p.weight, 0),
        )
      : null,
    confidence:
      terminal.length >= 10 && ratings.length >= 3
        ? 'established'
        : 'provisional',
    completed: accepted,
    assessed: terminal.length,
    qualityPassed: passed,
    qualityReviewed: reviewed.length,
    feedbackCount: ratings.length,
    rating: ratings.length
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null,
    rubric:
      '50% completed/assessed tasks · 30% quality passes/reviews · 20% operator rating. Missing components are omitted and weights normalized. Provisional until 10 assessed tasks and 3 ratings. This is evidence coverage/performance, not a capability certification.',
  };
}
export class OperationsStore {
  private initialized?: Promise<void>;
  constructor(readonly pool: Pool) {}
  async init() {
    return (this.initialized ??= this.initialize().catch((e) => {
      this.initialized = undefined;
      throw e;
    }));
  }
  private async initialize() {
    // Finish event schema/index setup in its own transaction before touching runs.
    await eventStore().init();
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(
        "SELECT pg_advisory_xact_lock(hashtext('ascendxi.operations.v1'))",
      );
      await c.query(`
 CREATE TABLE IF NOT EXISTS ascendxi_agent_settings(agent_id text PRIMARY KEY,paused boolean NOT NULL DEFAULT false,model_override text,preferences jsonb NOT NULL DEFAULT '{}',auto_preferences boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS ascendxi_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),agent_id text NOT NULL,task_id uuid,project_id uuid,kind text NOT NULL,model_id text NOT NULL,status text NOT NULL DEFAULT 'running',preview text NOT NULL DEFAULT '',input_tokens bigint,output_tokens bigint,started_at timestamptz NOT NULL DEFAULT now(),ended_at timestamptz,error text);
 CREATE TABLE IF NOT EXISTS ascendxi_feedback(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,agent_id text NOT NULL,task_id uuid,rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),note text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS ascendxi_improvements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),key text UNIQUE NOT NULL,agent_id text NOT NULL,kind text NOT NULL,title text NOT NULL,content text NOT NULL,source text NOT NULL,task_id uuid,preferences jsonb,status text NOT NULL DEFAULT 'pending',decision text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS ascendxi_notifications(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,key text UNIQUE NOT NULL,kind text NOT NULL,severity text NOT NULL,title text NOT NULL,detail text NOT NULL,agent_id text,task_id uuid,target text NOT NULL DEFAULT 'health',status text NOT NULL DEFAULT 'open',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS ascendxi_task_plan(task_id uuid PRIMARY KEY,priority text NOT NULL DEFAULT 'normal',estimate_minutes integer,due_at timestamptz,next_step text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now());
 `);
      if (!(await c.query("SELECT to_regclass('ascendxi_runs_agent_time') AS id")).rows[0].id)
        await c.query('CREATE INDEX ascendxi_runs_agent_time ON ascendxi_runs(agent_id,started_at DESC)');
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  async settings(agentId: string) {
    await this.init();
    return (
      (
        await this.pool.query(
          'SELECT * FROM ascendxi_agent_settings WHERE agent_id=$1',
          [agentId],
        )
      ).rows[0] ?? {
        agent_id: agentId,
        paused: false,
        model_override: null,
        preferences: {},
        auto_preferences: false,
      }
    );
  }
  async configure(
    agentId: string,
    input: {
      paused?: boolean;
      model?: string | null;
      autoPreferences?: boolean;
    },
  ) {
    await this.init();
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(
        'INSERT INTO ascendxi_agent_settings(agent_id)VALUES($1)ON CONFLICT DO NOTHING',
        [agentId],
      );
      const row = (
        await c.query(
          `UPDATE ascendxi_agent_settings SET paused=COALESCE($2,paused),model_override=CASE WHEN $3 THEN $4 ELSE model_override END,auto_preferences=COALESCE($5,auto_preferences),updated_at=now()WHERE agent_id=$1 RETURNING *`,
          [
            agentId,
            input.paused ?? null,
            'model' in input,
            input.model ?? null,
            input.autoPreferences ?? null,
          ],
        )
      ).rows[0];
      await c.query(
        "INSERT INTO ascendxi_events(kind,actor,summary,data)VALUES('agent.configured','operator',$1,$2)",
        [agentId, JSON.stringify(input)],
      );
      await c.query('COMMIT');
      return row;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  async pausedAgents() {
    await this.init();
    return (
      await this.pool.query(
        'SELECT agent_id FROM ascendxi_agent_settings WHERE paused',
      )
    ).rows.map((r) => r.agent_id);
  }
  async beginRun(d: {
    agentId: string;
    taskId?: string;
    projectId?: string;
    kind: string;
    model: string;
  }) {
    await this.init();
    return (
      await this.pool.query(
        `WITH saved AS(INSERT INTO ascendxi_runs(agent_id,task_id,project_id,kind,model_id)VALUES($1,$2,$3,$4,$5)RETURNING *),logged AS(INSERT INTO ascendxi_events(kind,actor,summary,task_id,project_id,data)SELECT 'agent.run.started',agent_id,kind,task_id,project_id,jsonb_build_object('runId',id,'model',model_id)FROM saved)SELECT * FROM saved`,
        [d.agentId, d.taskId ?? null, d.projectId ?? null, d.kind, d.model],
      )
    ).rows[0];
  }
  async preview(id: string, text: string) {
    await this.init();
    await this.pool.query(
      "UPDATE ascendxi_runs SET preview=$2 WHERE id=$1 AND status='running'",
      [id, text.slice(-12000)],
    );
  }
  async endRun(id: string, status: 'succeeded' | 'failed', usage?: any) {
    await this.init();
    await this.pool.query(
      `WITH changed AS(UPDATE ascendxi_runs SET status=$2,ended_at=now(),input_tokens=$3,output_tokens=$4,error=CASE WHEN $2='failed' THEN 'Run failed; inspect protected traces' ELSE NULL END WHERE id=$1 AND status='running' RETURNING *),logged AS(INSERT INTO ascendxi_events(kind,actor,summary,task_id,project_id,data)SELECT 'agent.run.'||status,agent_id,kind,task_id,project_id,jsonb_build_object('runId',id,'elapsedSeconds',EXTRACT(EPOCH FROM ended_at-started_at),'model',model_id,'inputTokens',input_tokens,'outputTokens',output_tokens)FROM changed)SELECT id FROM changed`,
      [
        id,
        status,
        Number.isFinite(usage?.inputTokens) ? usage.inputTokens : null,
        Number.isFinite(usage?.outputTokens) ? usage.outputTokens : null,
      ],
    );
  }
  async suggest(
    key: string,
    input: z.input<typeof suggestionInput>,
    preferences?: z.input<typeof preferenceInput>,
  ) {
    const d = suggestionInput.parse(input);
    await this.init();
    return (
      await this.pool.query(
        `WITH saved AS(INSERT INTO ascendxi_improvements(key,agent_id,kind,title,content,source,task_id,preferences)VALUES($1,$2,$3,$4,$5,$6,$7,$8)ON CONFLICT(key)DO NOTHING RETURNING *),logged AS(INSERT INTO ascendxi_events(kind,actor,summary,task_id,data)SELECT 'improvement.proposed',agent_id,title,task_id,jsonb_build_object('improvementId',id,'kind',kind)FROM saved)SELECT * FROM saved`,
        [
          key,
          d.agentId,
          d.kind,
          d.title,
          d.content,
          d.source,
          d.taskId ?? null,
          preferences
            ? JSON.stringify(preferenceInput.parse(preferences))
            : null,
        ],
      )
    ).rows[0];
  }
  async decide(id: string, decision: 'apply' | 'reject', future = false) {
    await this.init();
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const item = (
        await c.query(
          "SELECT * FROM ascendxi_improvements WHERE id=$1 AND status='pending' FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!item) throw Error('Improvement decision conflict');
      if (decision === 'apply' && item.kind === 'access')
        throw Error(
          'Access requests require exact tool configuration and separate verification; a suggestion cannot grant access',
        );
      if (decision === 'apply' && item.kind === 'knowledge') {
        const slug = 'learning-' + id;
        let existing;
        try {
          existing = await knowledgeStore().get(slug);
        } catch (e) {
          if (
            !(e instanceof Error) ||
            e.message !== 'Knowledge record not found'
          )
            throw e;
        }
        if (existing) {
          if (
            existing.content !== item.content ||
            existing.title !== item.title
          )
            throw Error(
              'Knowledge draft conflicts with the reviewed improvement',
            );
        } else
          await knowledgeStore().put({
            slug,
            title: item.title,
            product: 'AscendXI',
            content: item.content,
            sources: [{ kind: 'document', reference: item.source }],
            expectedVersion: 0,
          });
      }
      if (decision === 'apply' && item.kind === 'memory') {
        if (!item.preferences)
          throw Error(
            'Only structured response preferences can be applied as memory; propose factual knowledge for source review',
          );
        await c.query(
          'INSERT INTO ascendxi_agent_settings(agent_id,preferences,auto_preferences)VALUES($1,$2,$3)ON CONFLICT(agent_id)DO UPDATE SET preferences=ascendxi_agent_settings.preferences||EXCLUDED.preferences,auto_preferences=CASE WHEN $3 THEN true ELSE ascendxi_agent_settings.auto_preferences END,updated_at=now()',
          [item.agent_id, item.preferences, future],
        );
      }
      await c.query(
        'UPDATE ascendxi_improvements SET status=$2,decision=$3,updated_at=now()WHERE id=$1',
        [
          id,
          decision === 'apply' ? 'applied' : 'rejected',
          future
            ? 'Operator applied; future structured response preferences allowed'
            : 'Operator ' + decision,
        ],
      );
      await c.query(
        "INSERT INTO ascendxi_events(kind,actor,summary,data)VALUES('improvement.decided','operator',$1,$2)",
        [item.title, JSON.stringify({ id, decision, future })],
      );
      await c.query('COMMIT');
      return { ok: true };
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  async feedback(d: {
    agentId: string;
    taskId?: string | null;
    rating: number;
    note: string;
    preferences?: any;
  }) {
    await this.init();
    if (d.taskId) {
      const t = await taskStore().get(d.taskId);
      if (ownerFor(t.specialist || t.department) !== d.agentId)
        throw Error('Feedback task does not belong to this agent');
    }
    const row = (
      await this.pool.query(
        'INSERT INTO ascendxi_feedback(agent_id,task_id,rating,note)VALUES($1,$2,$3,$4)RETURNING *',
        [d.agentId, d.taskId ?? null, d.rating, d.note],
      )
    ).rows[0];
    await eventStore().append({
      kind: 'feedback.recorded',
      actor: 'operator',
      summary: 'Feedback for ' + d.agentId,
      taskId: d.taskId,
      data: { rating: d.rating, feedbackId: row.id },
    });
    if (d.note.length >= 10)
      await this.suggest(
        'feedback:' + row.id,
        {
          agentId: d.agentId,
          taskId: d.taskId,
          kind: d.preferences ? 'memory' : 'knowledge',
          title: d.preferences
            ? 'Response preference from operator'
            : 'Learning from operator feedback',
          content: d.note,
          source: 'Operator feedback #' + row.id,
        },
        d.preferences,
      );
    if (d.preferences && (await this.settings(d.agentId)).auto_preferences) {
      const proposal = (
        await this.pool.query(
          'SELECT id FROM ascendxi_improvements WHERE key=$1',
          ['feedback:' + row.id],
        )
      ).rows[0];
      await this.decide(proposal.id, 'apply');
    }
    return row;
  }
  async notify(d: {
    key: string;
    kind: string;
    severity: string;
    title: string;
    detail: string;
    agentId?: string;
    taskId?: string;
    target?: string;
  }) {
    await this.init();
    return (
      await this.pool.query(
        `INSERT INTO ascendxi_notifications(key,kind,severity,title,detail,agent_id,task_id,target)VALUES($1,$2,$3,$4,$5,$6,$7,$8)ON CONFLICT(key)DO UPDATE SET title=EXCLUDED.title,detail=EXCLUDED.detail,updated_at=CASE WHEN ascendxi_notifications.detail<>EXCLUDED.detail THEN now()ELSE ascendxi_notifications.updated_at END RETURNING *`,
        [
          d.key,
          d.kind,
          d.severity,
          d.title,
          d.detail.slice(0, 6000),
          d.agentId ?? null,
          d.taskId ?? null,
          d.target ?? 'health',
        ],
      )
    ).rows[0];
  }
  async readNotification(id: string) {
    await this.init();
    await this.pool.query(
      "UPDATE ascendxi_notifications SET status='read',updated_at=now()WHERE id=$1 AND status='open'",
      [id],
    );
  }
  async plan(
    taskId: string,
    input: {
      priority: string;
      estimateMinutes: number | null;
      dueAt: string | null;
      nextStep: string;
    },
  ) {
    await taskStore().get(taskId);
    await this.init();
    await this.pool.query(
      'INSERT INTO ascendxi_task_plan(task_id,priority,estimate_minutes,due_at,next_step)VALUES($1,$2,$3,$4,$5)ON CONFLICT(task_id)DO UPDATE SET priority=$2,estimate_minutes=$3,due_at=$4,next_step=$5,updated_at=now()',
      [
        taskId,
        input.priority,
        input.estimateMinutes,
        input.dueAt,
        input.nextStep,
      ],
    );
    await eventStore().append({
      kind: 'task.planned',
      actor: 'operator',
      summary: 'Priority / estimate updated',
      taskId,
      data: input,
    });
  }
  async monitor() {
    await this.init();
    await taskStore().list(1);
    // Retain obsolete diagnoses in history without asking the founder to publish them as facts.
    await this.pool.query(`UPDATE ascendxi_improvements SET status='recorded',decision='Incident diagnosis retained in history; current blocker and recovery controls live on the task. No knowledge publication decision required.',updated_at=now() WHERE status='pending' AND key LIKE 'blocked:%'`);
    await (await import('./communications')).communicationStore().init();
    const rows = (
      await this.pool.query(
        "SELECT * FROM ascendxi_tasks WHERE status IN('blocked','running','review')",
      )
    ).rows;
    const keys: string[] = [];
    for (const t of rows) {
      const agentId = ownerFor(t.specialist || t.department);
      let title = '',
        detail = '',
        severity = 'warning';
      if (t.status === 'blocked') {
        title = 'Blocked · ' + t.title;
        detail =
          [
            ...(t.report?.report?.blockers ?? []),
            ...(t.report?.review?.evidenceGaps ?? []),
            ...(t.report?.error ? [t.report.error] : []),
          ].join('\n') ||
          'Inspect task evidence and choose a bounded next action.';
      } else if (
        t.status === 'running' &&
        Date.now() - new Date(t.updated_at).getTime() > 360000
      ) {
        title = 'Stalled · ' + t.title;
        detail =
          'Assignment has exceeded six minutes. Check the worker/run before approving recovery; do not start a duplicate attempt.';
        severity = 'critical';
      } else if (t.status === 'review') {
        title = 'Review ready · ' + t.title;
        detail =
          'Inspect the specialist evidence and independent review before accepting.';
      }
      if (!title) continue;
      const key = 'monitor:' + t.id + ':' + t.attempts + ':' + t.status;
      keys.push(key);
      await this.notify({
        key,
        kind: 'monitor',
        severity,
        title,
        detail,
        agentId,
        taskId: t.id,
        target: 'workboard',
      });
      // The actionable incident is already retained by notify(). Raw failure text
      // is not a reusable company fact and must not create another KB approval.
    }
    const runProblems = (await this.pool.query(
      "SELECT * FROM (SELECT DISTINCT ON(agent_id) * FROM ascendxi_runs ORDER BY agent_id,started_at DESC,id DESC) latest WHERE (status='failed' AND ended_at>now()-interval '1 day') OR (status='running' AND started_at<now()-interval '6 minutes')",
    )).rows;
    for (const run of runProblems) {
      const key = 'monitor:run:' + run.id;
      keys.push(key);
      await this.notify({key, kind:'monitor', severity:run.status==='running'?'critical':'warning',
        title:(run.status==='running'?'Stalled agent run · ':'Agent run failed · ')+run.agent_id,
        detail:'Run '+run.id+' · '+run.kind+'. Inspect recorded output and protected traces before retrying. A subsequent successful run clears this latest-run alert; it does not erase the failure history.',
        agentId:run.agent_id, taskId:run.task_id, target:'health'});
    }
    await this.pool.query(
      "UPDATE ascendxi_notifications SET status='resolved',updated_at=now()WHERE kind='monitor' AND status<>'resolved' AND NOT(key=ANY($1::text[]))",
      [keys],
    );
    const worker = await eventStore().worker();
    if (!worker.alive)
      await this.notify({
        key: 'monitor:worker',
        kind: 'health',
        severity: 'critical',
        title: 'Worker heartbeat missing',
        detail:
          'The local worker has no fresh heartbeat. Verify the local service before recovering active tasks.',
      });
    else
      await this.pool.query(
        "UPDATE ascendxi_notifications SET status='resolved',updated_at=now()WHERE key='monitor:worker' AND status<>'resolved'",
      );
    const actions = (
      await this.pool
        .query(
          "SELECT id,kind,status FROM ascendxi_actions WHERE status IN('draft','uncertain','blocked')",
        )
        .catch(() => ({ rows: [] }))
    ).rows;
    for (const a of actions)
      await this.notify({
        key: 'action:' + a.id + ':' + a.status,
        kind: 'approval',
        severity: a.status === 'uncertain' ? 'critical' : 'warning',
        title:
          a.status === 'draft'
            ? 'Communication needs approval'
            : 'Communication needs inspection',
        detail:
          a.kind +
          ' · ' +
          a.status +
          '. Open the exact payload and evidence in Outbox.',
        target: 'outbox',
      });
    await this.pool.query(
      "UPDATE ascendxi_notifications n SET status='resolved',updated_at=now()WHERE kind='approval' AND status<>'resolved' AND NOT EXISTS(SELECT 1 FROM ascendxi_actions a WHERE n.key='action:'||a.id||':'||a.status AND a.status IN('draft','uncertain','blocked'))",
    );
    return {
      checkedAt: new Date().toISOString(),
      blocked: rows.filter((t) => t.status === 'blocked').length,
      workerAlive: worker.alive,
      worker: {status:worker.status,detail:worker.detail,heartbeatAt:worker.heartbeat_at},
      reviewReady: rows.filter((t)=>t.status==='review').length,
      activeTasks: rows.filter((t)=>t.status==='running').length,
      blockedTasks: rows.filter((t)=>t.status==='blocked').slice(0,20).map((t)=>({id:t.id,title:t.title,agentId:t.specialist||t.department,blockers:t.report?.report?.blockers??[],evidenceGaps:t.report?.review?.evidenceGaps??[]})),
      notices: (await this.pool.query("SELECT id,title,detail,severity,agent_id,task_id,target FROM ascendxi_notifications WHERE status='open' ORDER BY created_at DESC LIMIT 20")).rows,
    };
  }
  async snapshot(
    agentDefinitions: {
      id: string;
      name: string;
      department: string;
      model: string;
    }[],
  ) {
    await this.init();
    await taskStore().list(1);
    await planningStore().init();
    const [
      tasks,
      runs,
      settings,
      feedback,
      notifications,
      improvements,
      plans,
      worker,
    ] = await Promise.all([
      this.pool.query(
        `SELECT t.*,COALESCE((SELECT status FROM ascendxi_goals WHERE key=t.goal_key),CASE WHEN t.goal_key IS NULL THEN 'active' ELSE 'unapproved' END) AS goal_status,EXISTS(SELECT 1 FROM ascendxi_milestone_tasks m JOIN ascendxi_plans mp ON mp.key=m.plan_key WHERE m.task_id=t.id AND (mp.status<>'approved' OR mp.version<>m.version OR EXISTS(SELECT 1 FROM ascendxi_milestone_tasks needed JOIN ascendxi_tasks nt ON nt.id=needed.task_id WHERE needed.plan_key=m.plan_key AND needed.version=m.version AND m.after_keys ? needed.milestone_key AND nt.status<>'completed'))) AS milestone_waiting,s.project_id,s.key AS step_key,s.after_keys,p.paused AS project_paused,p.ready AS project_ready,p.name AS project_name FROM ascendxi_tasks t LEFT JOIN ascendxi_project_steps s ON s.task_id=t.id LEFT JOIN ascendxi_projects p ON p.id=s.project_id ORDER BY t.created_at DESC LIMIT 1000`,
      ),
      this.pool.query(
        "SELECT id,agent_id,task_id,project_id,kind,model_id,status,CASE WHEN status='running' THEN right(preview,6000)ELSE left(preview,400)END AS preview,input_tokens,output_tokens,started_at,ended_at,error,EXTRACT(EPOCH FROM COALESCE(ended_at,now())-started_at)::int AS elapsed_seconds FROM ascendxi_runs ORDER BY started_at DESC LIMIT 500",
      ),
      this.pool.query('SELECT * FROM ascendxi_agent_settings'),
      this.pool.query(
        'SELECT * FROM ascendxi_feedback ORDER BY created_at DESC LIMIT 1000',
      ),
      this.pool.query(
        "SELECT * FROM ascendxi_notifications WHERE status<>'resolved' ORDER BY CASE severity WHEN 'critical' THEN 0 ELSE 1 END,created_at DESC LIMIT 100",
      ),
      this.pool.query(
        'SELECT * FROM ascendxi_improvements ORDER BY created_at DESC LIMIT 100',
      ),
      this.pool.query('SELECT * FROM ascendxi_task_plan'),
      eventStore().worker(),
    ]);
    const agents = agentDefinitions.map((def) => {
      const owned = tasks.rows.filter(
          (t) => ownerFor(t.specialist || t.department) === def.id,
        ),
        activeOwned = owned.filter(t=>!(t.key.startsWith('project:')&&!t.project_id)),
        history = runs.rows.filter((r) => r.agent_id === def.id),
        active = history.filter((r) => r.status === 'running'),
        config = settings.rows.find((r) => r.agent_id === def.id) ?? {
          paused: false,
          model_override: null,
          preferences: {},
          auto_preferences: false,
        };
      return {
        ...def,
        config,
        model: config.model_override || def.model,
        state: active.length
          ? worker.alive
            ? 'working'
            : 'stalled'
          : config.paused
            ? 'paused'
            : activeOwned.some((t) => t.status === 'blocked')
              ? 'blocked'
              : activeOwned.some((t) => t.status === 'queued')
                ? 'waiting'
                : 'idle',
        activeRun: active[0] ?? null,
        queued: activeOwned.filter((t) => t.status === 'queued').length,
        blocked: activeOwned.filter((t) => t.status === 'blocked').length,
        completed: owned.filter((t) => t.status === 'completed').length,
        maturity: maturity(
          owned,
          feedback.rows.filter((f) => f.agent_id === def.id),
        ),
        runs: history.slice(0, 10),
        tokens: history.reduce(
          (n, r) =>
            n + (Number(r.input_tokens) || 0) + (Number(r.output_tokens) || 0),
          0,
        ),
      };
    });
    return {
      agents,
      tasks: tasks.rows.map((t) => ({
        ...t,
        owner: ownerFor(t.specialist || t.department),
        superseded: t.key.startsWith('project:')&&!t.project_id,
        plan: plans.rows.find((p) => p.task_id === t.id) ?? null,
        blocker: t.status === 'blocked' ? blockerDetails(t) : null,
        report: undefined,
        objective: undefined,
        acceptance: undefined,
        blockedBy: (t.after_keys ?? []).filter(
          (dep: string) =>
            !tasks.rows.some(
              (other) =>
                other.project_id === t.project_id &&
                other.step_key === dep &&
                other.status === 'completed',
            ),
        ),
        runnable:
          t.status === 'queued' &&
          !(t.key.startsWith('project:')&&!t.project_id) &&
          t.goal_status === 'active' && !t.milestone_waiting &&
          !t.project_paused &&
          (!t.project_id || t.project_ready) &&
          (t.after_keys ?? []).every((dep: string) =>
            tasks.rows.some(
              (other) =>
                other.project_id === t.project_id &&
                other.step_key === dep &&
                other.status === 'completed',
            ),
          ),
      })),
      notifications: notifications.rows,
      improvements: improvements.rows,
      feedback: feedback.rows.slice(0, 30),
      worker,
      runs: runs.rows.slice(0, 30),
      sampleWindow:
        'Latest 1,000 tasks/ratings and 500 runs. Agent elapsed times are wall time, not billable hours. ETA uses operator estimates only; it is not a delivery commitment.',
      generatedAt: new Date().toISOString(),
    };
  }
  async close() {
    await this.pool.end();
  }
}
let store: OperationsStore | undefined;
export function operationsStore() {
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL is required');
  return (store ??= new OperationsStore(
    new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10000,
      query_timeout: 15000,
    }),
  ));
}
export async function closeOperationsStore() {
  const s = store;
  store = undefined;
  await s?.close();
}
