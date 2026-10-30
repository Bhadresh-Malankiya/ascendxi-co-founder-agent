import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {planningStore,closePlanningStore, type PlanInput} from '../../src/mastra/company/planning-store';
import {knowledgeStore,closeKnowledgeStore} from '../../src/mastra/company/knowledge-store';
import {projectStore,closeProjectStore} from '../../src/mastra/company/project-store';
import {taskStore,closeTaskStore} from '../../src/mastra/company/task-store';
import {closeEventStore} from '../../src/mastra/company/event-store';
const url=process.env.TEST_DATABASE_URL;
test('founder approves exact plan revisions; dependencies, edits and historical work stay gated', {skip:!url}, async()=>{
  const previous=process.env.DATABASE_URL;process.env.DATABASE_URL=url;
  const store=planningStore(), key='fixture-'+randomUUID();
  const input:PlanInput={key,kind:'goal',title:'Fixture readiness scope',product:'VocalXI',outcome:'Verify controlled launch evidence without external execution.',scope:'Internal artifact preparation only, using controlled fixture evidence.',exclusions:['No deployment or purchase.'],department:'product',acceptance:['Evidence supports the scoped claim.'],assumptions:['No real launch date or spend approved.'],evidence:['Controlled fixture, not live product evidence.'],milestones:[
    {key:'source',title:'Source inventory',owner:'product',objective:'Prepare a sourced fixture inventory.',acceptance:['Cite fixture records'],targetDate:'2026-10-20',estimateMinutes:null,after:[]},
    {key:'review',title:'Independent readiness check',owner:'quality',objective:'Review the fixture inventory against its acceptance.',acceptance:['Record missing proof'],targetDate:'2026-10-21',estimateMinutes:30,after:['source']},
  ],budget:{monthlyCap:null,currency:'USD',note:'No new spending is authorized.'},subjectKey:key,requestedAgent:null,toolIds:[],setupUrl:null,manualSteps:[],expectedVersion:0};
  try{
    await store.propose(input);
    assert.equal((await taskStore().all(10000)).some(t=>t.goal_key===key),false);
    let p=await store.inspect(key);
    await assert.rejects(store.decide(key,1,'0'.repeat(64),'approve','Fixture approval reason'),/Stale/);
    const outcomes=await Promise.allSettled([store.decide(key,1,p.hash,'approve','Fixture founder exact approval'),store.decide(key,1,p.hash,'approve','Duplicate fixture approval')]);
    assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
    p=await store.inspect(key);assert.equal(p.work.length,2);
    const first=p.work.find((m:any)=>m.key==='source'), second=p.work.find((m:any)=>m.key==='review');
    assert.equal(await projectStore().eligible(first.taskId),true);
    assert.equal(await projectStore().eligible(second.taskId),false);
    const task=await taskStore().claim(first.taskId);await taskStore().finish(task.id,task.attempts,'review',{report:{blockers:[]},review:{accepted:true,evidenceGaps:[]}});
    await store.acceptReviewedArtifacts();assert.equal((await taskStore().get(first.taskId)).status,'completed');
    assert.equal(await projectStore().eligible(second.taskId),true);
    await store.propose({...input,outcome:'Revised fixture outcome with explicit acceptance.',expectedVersion:1});
    assert.equal(await projectStore().eligible(second.taskId),false);
    await assert.rejects(store.decide(key,1,p.hash,'approve','Stale fixture scope approval'),/Stale/);
    assert.equal((await knowledgeStore().goals()).find(g=>g.key===key).status,'proposed');
    const revised=await store.inspect(key);await store.decide(key,2,revised.hash,'approve','Revised fixture scope approved');
    assert.equal(await projectStore().eligible(second.taskId),false,'old revision never resumes');
    assert.equal((await taskStore().get(first.taskId)).status,'completed','history preserved');
    await assert.rejects(store.propose({...input,kind:'access',expectedVersion:2}),/identity/);
    const access={...input,key:'access-'+key,kind:'access' as const,subjectKey:null,milestones:[],requestedAgent:'engineering' as const,toolIds:['fixture_github_read']};
    await store.propose(access);const a=await store.inspect(access.key);await store.decide(a.key,a.version,a.hash,'approve','Fixture scoped access consent only');
    assert.equal((await store.inspect(a.key)).status,'approved');
    assert.equal((await store.inspect(a.key)).work.length,0,'access consent never creates work or credentials');
    const proposed=await knowledgeStore().createGoal({key:'new-'+key,title:'Unapproved fixture goal',outcome:'Must remain proposed until reviewed by the founder.',product:'HelpXI',department:'product',acceptance:['No automatic activation']});
    assert.equal(proposed.status,'proposed');
  } finally {await closeProjectStore();await closePlanningStore();await closeKnowledgeStore();await closeTaskStore();await closeEventStore();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;}
});
