import test from 'node:test';
import assert from 'node:assert/strict';
import { operatingSummary } from '../src/mastra/company/operating-summary';

function fixture() {
  return {
    worker: { alive: true, status: 'idle' },
    agents: [{ id: 'product', config: { paused: false } }, { id: 'engineering', config: { paused: false } }],
    tasks: [
      { id: 'audit', title: 'Read production evidence', owner: 'product', product: 'VocalXI', status: 'blocked', blockedBy: [], plan: { priority: 'high' }, blocker: { kind: 'evidence', causes: ['Database status is unverified'], nextAction: 'Attach a current read-only observation' } },
      { id: 'repair', title: 'Prepare repairs', owner: 'engineering', status: 'queued', runnable: false, blockedBy: ['audit'] },
      { id: 'pilot', title: 'Pilot review', owner: 'product', status: 'queued', runnable: false, blockedBy: ['repair'] },
      { id: 'done', title: 'Delivered offer', owner: 'product', status: 'completed', updated_at: '2026-10-16T14:00:00Z' },
    ],
    plans: [{ key: 'vocal', status: 'approved', payload: { kind: 'goal', title: 'VocalXI pilot', priority: 'high', milestones: [
      { key: 'audit', title: 'Read production evidence', owner: 'product', after: [] },
      { key: 'repair', title: 'Prepare repairs', owner: 'engineering', after: ['audit'] },
      { key: 'pilot', title: 'Pilot review', owner: 'product', after: ['repair'] },
    ] }, work: [{ key: 'audit', taskId: 'audit', status: 'blocked' }, { key: 'repair', taskId: 'repair', status: 'queued' }, { key: 'pilot', taskId: 'pilot', status: 'queued' }] },
    { key: 'read-request', status: 'proposed', payload: { kind: 'access', title: 'Production read evidence', subjectKey: 'audit', setupUrl: 'https://dashboard.render.com/', milestones: [] }, work: [] }],
    runs: [{ id: 'old', agent_id: 'product', task_id: 'done', kind: 'assignment', status: 'succeeded', started_at: '2026-10-16T13:59:00Z', ended_at: '2026-10-16T14:00:00Z' }],
  };
}
test('idle worker explains root blocker, transitive impact, existing request and real results', () => {
  const op = operatingSummary(fixture());
  assert.equal(op.phase, 'blocked');
  assert.deepEqual(op.counts, { executing: 0, ready: 0, blocked: 1, waiting: 2, review: 0, completed: 1 });
  assert.equal(op.primaryBlocker?.affected, 2);
  assert.equal(op.primaryBlocker?.request?.key, 'read-request');
  assert.equal(op.primaryBlocker?.cause, 'Database status is unverified');
  assert.equal(op.waiting[0].dependencies[0].title, 'Read production evidence');
  assert.equal(op.recent[0].id, 'done');
});
test('stale running records cannot make an offline worker appear active', () => {
  const frame = fixture(); frame.worker.alive = false;
  frame.runs[0].status = 'running'; frame.tasks[1].status = 'running';
  const op = operatingSummary(frame);
  assert.equal(op.phase, 'offline'); assert.equal(op.counts.executing, 0); assert.equal(op.activeRuns.length, 0);
});
test('real active output takes precedence over blocked backlog; paused and superseded work is excluded', () => {
  const frame = fixture(); frame.tasks[1].runnable = true; frame.tasks[1].blockedBy = [];
  assert.equal(operatingSummary(frame).phase, 'ready');
  frame.agents[1].config.paused = true;
  assert.equal(operatingSummary(frame).counts.ready, 0);
  frame.runs[0].status = 'running';
  assert.equal(operatingSummary(frame).phase, 'working');
  assert.equal(operatingSummary(frame).activeRuns[0].id, 'old');
  frame.runs[0].status = 'succeeded';
  const historical = { ...frame.tasks[0], id: 'superseded', superseded: true };
  frame.tasks.push(historical);
  assert.equal(operatingSummary(frame).counts.blocked, 1);
});
test('identical milestone keys never resolve dependencies across plans', () => {
  const frame = fixture();
  frame.plans.unshift({ key: 'other', status: 'approved', payload: { kind: 'goal', title: 'Other scope', priority: 'low', milestones: [{ key: 'audit', title: 'Unrelated audit', owner: 'product', after: [] }] }, work: [{ key: 'audit', taskId: 'done', status: 'completed' }] });
  assert.equal(operatingSummary(frame).waiting[0].dependencies[0].taskId, 'audit');
});
test('a missing model configuration is never described as work about to start', () => {
  const frame = fixture(); frame.worker.status = 'blocked';
  frame.tasks[1].runnable = true;
  assert.equal(operatingSummary(frame).phase, 'configuration');
  assert.equal(operatingSummary(frame).counts.executing, 0);
});
test('an unresolved preservation budget follows completed prerequisites into Quality without inheriting access', () => {
  const frame = fixture();
  frame.tasks[0].status = frame.tasks[1].status = 'completed';
  frame.tasks[2].status = 'blocked'; frame.tasks[2].product = 'VocalXI';
  frame.plans[0].work[0].status = frame.plans[0].work[1].status = 'completed';
  frame.plans[0].work[2].status = 'blocked';
  assert.equal(operatingSummary(frame).primaryBlocker?.request, null);
  const budget = { key: 'preserve', status: 'proposed', payload: {
    kind: 'budget', product: 'VocalXI', title: 'Preserve original database',
    subjectKey: 'audit', setupUrl: 'https://dashboard.render.com/', milestones: [],
  }, work: [] };
  frame.plans.push(budget);
  assert.equal(operatingSummary(frame).primaryBlocker?.request?.key, 'preserve');
  budget.payload.subjectKey = 'done';
  assert.equal(operatingSummary(frame).primaryBlocker?.request, null);
});
