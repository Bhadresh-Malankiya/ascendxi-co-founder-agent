import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {planningStore,closePlanningStore,type PlanInput} from '../../src/mastra/company/planning-store';
import {closeKnowledgeStore} from '../../src/mastra/company/knowledge-store';
import {taskStore,closeTaskStore} from '../../src/mastra/company/task-store';import {closeEventStore} from '../../src/mastra/company/event-store';
import {remediateTask} from '../../src/mastra/company/blockers';
import {closeOperationsStore} from '../../src/mastra/company/operations-store';
import {closeProjectStore} from '../../src/mastra/company/project-store';
const url=process.env.TEST_DATABASE_URL;
test('routine plans advance with audited delegated authority; consequential decisions remain pending',{skip:!url},async()=>{
  const previous=process.env.DATABASE_URL,mode=process.env.ASCENDXI_AUTONOMY,schema='auto_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString:url});await admin.query('CREATE SCHEMA '+schema);const isolated=new URL(url!);isolated.searchParams.set('options','-c search_path='+schema);process.env.DATABASE_URL=isolated.toString();process.env.ASCENDXI_AUTONOMY='internal';
  const key='auto-'+randomUUID(),store=planningStore();
  const data:PlanInput={key,kind:'goal',title:'Internal fixture plan',product:'VocalXI',outcome:'Prepare a controlled evidence report.',scope:'Internal fixture only with no external writes.',exclusions:['No deployment'],department:'product',acceptance:['Evidence retained'],assumptions:['Controlled fixture'],evidence:['Controlled fixture source'],milestones:[{key:'inventory',title:'Gather fixture evidence',owner:'product',objective:'Review controlled fixture source evidence.',acceptance:['Cite fixture source'],targetDate:'2026-10-20',estimateMinutes:null,after:[]}],budget:{monthlyCap:null,currency:'USD',note:'No new purchases are authorized.'},subjectKey:key,requestedAgent:null,toolIds:[],setupUrl:null,manualSteps:[],expectedVersion:0};
  try{
    await store.propose(data);await store.approveRoutinePlans();let p=await store.inspect(key);assert.equal(p.status,'approved');assert.equal(p.work.length,1);assert.equal(p.decisions[0].actor,'founder-autonomy-policy');
    for(const kind of ['access','service','budget','deployment'] as const){const k=kind+'-'+key;await store.propose({...data,key:k,kind,subjectKey:null,milestones:[]});await store.approveRoutinePlans();assert.equal((await store.inspect(k)).status,'proposed');}
    await store.approveRoutinePlans();p=await store.inspect(key);assert.equal(p.work.length,1,'policy polling never duplicates assignments');
    const task=await taskStore().claim(p.work[0].taskId);await taskStore().finish(task.id,task.attempts,'blocked',{report:{blockers:['Missing source evidence'],nextAction:'Inspect new source'},review:{accepted:false,evidenceGaps:['Missing actual source']}});
    assert.equal((await remediateTask(task.id)).changed,false);
    await taskStore().putEvidence(task.id,'fixture/source.txt','Controlled source evidence, not real product proof.','Controlled fixture');
    assert.equal((await taskStore().evidence(task.id)).length,1);
    await assert.rejects(taskStore().readEvidence(randomUUID(),'fixture/source.txt'),/not found/);
    assert.equal((await remediateTask(task.id)).changed,true,'new task-bound evidence requeues once without founder intervention');
    assert.equal((await taskStore().get(task.id)).status,'queued');
  }finally{await closeProjectStore();await closePlanningStore();await closeOperationsStore();await closeKnowledgeStore();await closeTaskStore();await closeEventStore();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;if(mode===undefined)delete process.env.ASCENDXI_AUTONOMY;else process.env.ASCENDXI_AUTONOMY=mode;}
});
