import { createHash } from 'node:crypto';
import { operationsStore } from './operations-store';
import { projectStore } from './project-store';
import { taskStore } from './task-store';

import { blockerDetails } from './blocker-details';
export { blockerDetails } from './blocker-details';

/** Only artifact-only project assignments, only after new evidence, at most two recoveries/day. */
export async function remediateTask(id: string) {
  const ops = operationsStore(); await ops.init(); await projectStore().init();
  await ops.pool.query(`CREATE TABLE IF NOT EXISTS ascendxi_recoveries(task_id uuid NOT NULL,fingerprint text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(task_id,fingerprint))`);
  const task = await taskStore().get(id), detail = blockerDetails(task);
  if (task.status !== 'blocked') return {changed:false,detail:'This assignment is not blocked.',blocker:detail};
  const project = await projectStore().forTask(id);
  if (!(await projectStore().eligible(id)) || (!project && (!task.goal_key || task.client_key))) return {changed:false,detail:'Automatic retry needs an approved, unpaused internal artifact workflow with completed prerequisites.',blocker:detail};
  if (detail.kind !== 'evidence') return {changed:false,detail:'No safe evidence-only recovery is established. Inspect the failure and request its exact missing access, budget or configuration.',blocker:detail};
  const c = await ops.pool.connect();
  try {
    await c.query('BEGIN');
    const current = (await c.query("SELECT * FROM ascendxi_tasks WHERE id=$1 AND status='blocked' FOR UPDATE",[id])).rows[0];
    if (!current) { await c.query('ROLLBACK'); return {changed:false,detail:'State changed; inspect the current assignment.'}; }
    const artifacts = project ? (await c.query('SELECT DISTINCT ON(path)path,hash,created_at FROM ascendxi_project_artifacts WHERE project_id=$1 ORDER BY path,id DESC',[project.id])).rows : await taskStore().evidence(id);
    const fresh = artifacts.filter(a => new Date(a.created_at) > new Date(current.updated_at));
    if (!fresh.length) { await c.query('ROLLBACK'); return {changed:false,detail:'No new project evidence since the last review. Attach the requested proof; repeating the same inputs would waste tokens.',blocker:detail}; }
    const fingerprint = createHash('sha256').update(JSON.stringify(artifacts.map(a=>[a.path,a.hash]))).digest('hex');
    const count = Number((await c.query("SELECT count(*) FROM ascendxi_recoveries WHERE task_id=$1 AND created_at>now()-interval '1 day'",[id])).rows[0].count);
    if (count >= 2) { await c.query('ROLLBACK'); return {changed:false,detail:'Two safe recoveries already attempted today. A human needs to inspect the remaining evidence gap.',blocker:detail}; }
    const claim = await c.query('INSERT INTO ascendxi_recoveries(task_id,fingerprint)VALUES($1,$2)ON CONFLICT DO NOTHING RETURNING task_id',[id,fingerprint]);
    if (!claim.rowCount) { await c.query('ROLLBACK'); return {changed:false,detail:'This evidence revision was already retried.',blocker:detail}; }
    await c.query("UPDATE ascendxi_tasks SET status='queued',updated_at=now(),report=report||jsonb_build_object('recoveryEvidence',$2::jsonb)WHERE id=$1",[id,JSON.stringify(fresh.map(a=>({path:a.path,hash:a.hash})))]);
    await c.query("INSERT INTO ascendxi_events(kind,actor,summary,task_id,project_id,data)VALUES('task.safe_recovery','operations-monitor','New evidence queued for independent reassessment',$1,$2,$3)",[id,project?.id??null,{fingerprint,paths:fresh.map(a=>a.path)}]);
    await c.query('COMMIT'); return {changed:true,detail:'Queued one reassessment using new evidence. It shares the hourly AI limit; independent review still determines the result.'};
  } catch(e) { await c.query('ROLLBACK');throw e; } finally {c.release();}
}
export async function recoverEvidenceBlockers() {
  const tasks = (await taskStore().list()).filter(t=>t.status === 'blocked').slice(0,10);
  for (const t of tasks) await remediateTask(t.id);
}
