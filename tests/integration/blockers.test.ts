import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ensureCompanyRecords} from '../../src/mastra/company/bootstrap';
import {projectStore,closeProjectStore} from '../../src/mastra/company/project-store';
import {planningStore,closePlanningStore} from '../../src/mastra/company/planning-store';
import {operationsStore,closeOperationsStore} from '../../src/mastra/company/operations-store';
import {taskStore,closeTaskStore} from '../../src/mastra/company/task-store';
import {closeKnowledgeStore} from '../../src/mastra/company/knowledge-store';
import {closeEventStore} from '../../src/mastra/company/event-store';
import {remediateTask} from '../../src/mastra/company/blockers';
const url=process.env.TEST_DATABASE_URL;
test('safe recovery requires an approved scope and new evidence; access failures never auto-retry',{skip:!url},async()=>{
 const previous=process.env.DATABASE_URL;process.env.DATABASE_URL=url;
 try{
  await ensureCompanyRecords();const project=await projectStore().create({key:'recovery-'+randomUUID(),kind:'internal',name:'Controlled recovery fixture',brief:'A disposable internal artifact fixture; no real client or provider action.',awardEvidence:'Controlled test founder charter only',product:'AscendXI'});
  const plan=(await planningStore().list()).find(p=>p.payload.subjectKey===project.id)!;
  const node=(await projectStore().list()).find(p=>p.id===project.id).steps.find((s:any)=>s.key==='scope');
  const task=await taskStore().claim(node.taskId);await taskStore().finish(task.id,task.attempts,'blocked',{report:{blockers:['Missing source evidence'],nextAction:'Attach current test output'},review:{accepted:false,evidenceGaps:['Missing current test output']}});
  assert.equal((await remediateTask(task.id)).changed,false,'unapproved scope stays blocked');
  await planningStore().decide(plan.key,plan.version,plan.hash,'approve','Controlled founder approval of test scope');
  // Approval of a project with already attempted work creates new tasks; historical blocked work is excluded.
  const active=(await projectStore().list()).find(p=>p.id===project.id).steps.find((s:any)=>s.key==='scope');
  assert.notEqual(active.taskId,task.id);assert.equal((await remediateTask(task.id)).changed,false);
  const current=await taskStore().claim(active.taskId);await taskStore().finish(current.id,current.attempts,'blocked',{report:{blockers:['Need source proof']},review:{accepted:false,evidenceGaps:['Missing test output']}});
  assert.equal((await remediateTask(current.id)).changed,false,'same inputs are not retried');
  await operationsStore().pool.query("UPDATE ascendxi_tasks SET updated_at=now()-interval '1 second' WHERE id=$1",[current.id]);
  await projectStore().putArtifact(project.id,'evidence/fixture.txt','Controlled source test output','Disposable integration fixture');
  const recovery=await remediateTask(current.id);assert.equal(recovery.changed,true,JSON.stringify(recovery));assert.equal((await taskStore().get(current.id)).status,'queued');
  const retry=await taskStore().claim(current.id);await taskStore().finish(current.id,retry.attempts,'blocked',{report:{blockers:['Missing OAuth access credential']},review:{accepted:false,evidenceGaps:['Missing authorized provider access']}});
  await projectStore().putArtifact(project.id,'evidence/fixture-new.txt','A new fixture source cannot grant access','Disposable integration fixture');
  assert.equal((await remediateTask(current.id)).changed,false,'new evidence cannot bypass access approval');
 }finally{await closeProjectStore();await closePlanningStore();await closeOperationsStore();await closeTaskStore();await closeKnowledgeStore();await closeEventStore();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;}
});
