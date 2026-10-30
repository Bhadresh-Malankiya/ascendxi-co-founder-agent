type Task = {
  id: string; title: string; status: string; owner: string; product?: string;
  runnable?: boolean; superseded?: boolean; blockedBy?: string[];
  updated_at?: string | Date; plan?: { priority?: string } | null;
  blocker?: { kind: string; causes: string[]; nextAction: string } | null;
};
type Plan = {
  key: string; status: string;
  payload: { kind: string; title: string; product?: string; priority?: string;
    subjectKey?: string | null; setupUrl?: string | null;
    milestones: { key: string; title: string; after: string[]; owner: string; targetDate?: string }[] };
  work: { key: string; taskId: string; status: string }[];
};
type Frame = {
  worker: { alive: boolean; status?: string; detail?: string; heartbeat_at?: string | Date };
  tasks: Task[]; plans: Plan[];
  agents: { id: string; config?: { paused?: boolean } }[];
  runs: { id: string; status: string; agent_id: string; task_id?: string | null;
    kind: string; started_at: string | Date; ended_at?: string | Date | null; elapsed_seconds?: number; preview?: string }[];
};
const rank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/** A read model of actual work, independent of agent animations or monitor heartbeats. */
export function operatingSummary(frame: Frame) {
  const tasks = frame.tasks.filter(t => !t.superseded);
  const paused = new Set(frame.agents.filter(a => a.config?.paused).map(a => a.id));
  const queued = tasks.filter(t => t.status === 'queued');
  const ready = queued.filter(t => t.runnable && !paused.has(t.owner));
  const blocked = tasks.filter(t => t.status === 'blocked').sort((a, b) =>
    (rank[a.plan?.priority || 'normal'] ?? 2) - (rank[b.plan?.priority || 'normal'] ?? 2));
  const runs = frame.worker.alive ? frame.runs.filter(r => r.status === 'running') : [];
  const active = frame.worker.alive ? tasks.filter(t => t.status === 'running') : [];
  const primary = blocked[0];
  const scopeFor = (id: string) => frame.plans.find(p => p.work.some(w => w.taskId === id));
  const dependencies = (t: Task) => {
    const plan = scopeFor(t.id);
    return (t.blockedBy || []).map(key => {
      const work = plan?.work.find(w => w.key === key);
      return { key, taskId: work?.taskId ?? null,
        title: plan?.payload.milestones.find(m => m.key === key)?.title || key,
        status: work?.status || 'unavailable' };
    });
  };
  const roots = (id: string, seen = new Set<string>()): string[] => {
    if (seen.has(id)) return [];
    seen.add(id);
    const t = tasks.find(t => t.id === id);
    if (!t) return [];
    if (t.status === 'blocked') return [id];
    return dependencies(t).flatMap(d => d.taskId ? roots(d.taskId, seen) : []);
  };
  const linkedRequest = primary && frame.plans.find(p =>
    p.status === 'proposed' && p.payload.subjectKey === primary.id &&
    ['access', 'budget', 'service', 'deployment'].includes(p.payload.kind));
  // A preservation budget can remain unresolved when planning passes to Quality.
  // Only follow actual prerequisite edges in this plan; never inherit access grants.
  const prerequisiteIds = new Set<string>();
  const prerequisiteScope = primary && scopeFor(primary.id);
  const visitPrerequisite = (taskId: string) => {
    if (!prerequisiteScope || prerequisiteIds.has(taskId)) return;
    prerequisiteIds.add(taskId);
    const work = prerequisiteScope.work.find(w => w.taskId === taskId);
    const milestone = prerequisiteScope.payload.milestones.find(m => m.key === work?.key);
    for (const key of milestone?.after || []) {
      const prior = prerequisiteScope.work.find(w => w.key === key);
      if (prior) visitPrerequisite(prior.taskId);
    }
  };
  if (primary) visitPrerequisite(primary.id);
  const pendingRequest = linkedRequest || (primary && frame.plans.find(p =>
    p.status === 'proposed' && p.payload.kind === 'budget' &&
    !!primary.product && p.payload.product === primary.product &&
    !!p.payload.subjectKey && prerequisiteIds.has(p.payload.subjectKey)));
  const activePlan = active[0] && scopeFor(active[0].id);
  const focus = activePlan || (primary && scopeFor(primary.id)) ||
    frame.plans.filter(p => p.status === 'approved' && p.work.some(w => w.status !== 'completed'))
      .sort((a, b) => (rank[a.payload.priority || 'normal'] ?? 2) - (rank[b.payload.priority || 'normal'] ?? 2))[0];
  const review = tasks.filter(t => t.status === 'review');
  const phase = !frame.worker.alive ? 'offline' : runs.length || active.length ? 'working' :
    frame.worker.status === 'blocked' ? 'configuration' :
    ready.length ? frame.worker.status === 'rate limited' ? 'capacity' : 'ready' :
    primary ? 'blocked' : queued.length ? 'waiting' : review.length ? 'review' : 'complete';
  const headline = phase === 'offline' ? 'The local worker is offline' :
    phase === 'configuration' ? 'The worker needs configuration' :
    phase === 'working' ? (active[0]?.title || 'An agent is working') :
    phase === 'capacity' ? 'Ready work is waiting for capacity' :
    phase === 'ready' ? 'Work is ready for the next worker cycle' :
    phase === 'blocked' ? 'Waiting on ' + (primary!.product || 'assignment') + ' evidence' :
    phase === 'waiting' ? 'Work is waiting on prerequisites' :
    phase === 'review' ? 'Work is waiting for review' : 'Current assignments are complete';
  const affected = primary ? queued.filter(t => roots(t.id).includes(primary.id)).length : 0;
  const recent = tasks.filter(t => t.status === 'completed').sort((a, b) =>
    new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()).slice(0, 4)
    .map(t => ({ id: t.id, title: t.title, owner: t.owner, product: t.product,
      completedAt: t.updated_at, planTitle: scopeFor(t.id)?.payload.title || 'Company work' }));
  return {
    phase, headline,
    counts: { executing: Math.max(active.length, runs.length), ready: ready.length, blocked: blocked.length,
      waiting: queued.length - ready.length, review: review.length,
      completed: tasks.filter(t => t.status === 'completed').length },
    primaryBlocker: primary ? { taskId: primary.id, title: primary.title, owner: primary.owner,
      product: primary.product, affected, cause: primary.blocker?.causes[0] || null,
      nextAction: primary.blocker?.nextAction || 'Inspect the missing evidence and attach verified observations.',
      request: pendingRequest ? { key: pendingRequest.key, title: pendingRequest.payload.title,
        kind: pendingRequest.payload.kind, setupUrl: pendingRequest.payload.setupUrl } : null } : null,
    focus: focus ? { key: focus.key, title: focus.payload.title,
      milestones: focus.payload.milestones.map(m => {
        const work = focus.work.find(w => w.key === m.key);
        const task = tasks.find(t => t.id === work?.taskId);
        return { key: m.key, title: m.title, owner: m.owner, after: m.after,
          taskId: work?.taskId || null, status: work?.status || 'not started',
          ready: !!task && ready.some(r => r.id === task.id), targetDate: m.targetDate,
          dependencies: task ? dependencies(task) : [] };
      }) } : null,
    waiting: queued.map(t => ({ taskId: t.id, title: t.title, owner: t.owner,
      ready: ready.some(r => r.id === t.id), paused: paused.has(t.owner), dependencies: dependencies(t) })),
    activeRuns: runs, recent,
    lastRun: frame.runs.filter(r => r.ended_at).sort((a, b) =>
      new Date(b.ended_at!).getTime() - new Date(a.ended_at!).getTime())[0] || null,
  };
}
