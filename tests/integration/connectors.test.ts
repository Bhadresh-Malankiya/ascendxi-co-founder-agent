import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID}from'node:crypto';
import {mkdtemp,rm}from'node:fs/promises';import {tmpdir}from'node:os';import {join}from'node:path';import {Pool}from'pg';
import {ConnectorStore}from'../../src/mastra/company/connector-store';
import {ConnectorVault,connectorHash}from'../../src/mastra/company/connector-security';
import {taskStore,closeTaskStore}from'../../src/mastra/company/task-store';
import {knowledgeStore,closeKnowledgeStore}from'../../src/mastra/company/knowledge-store';
import {operationsStore,closeOperationsStore}from'../../src/mastra/company/operations-store';
import {closePlanningStore}from'../../src/mastra/company/planning-store';import {closeProjectStore}from'../../src/mastra/company/project-store';import {closeEventStore}from'../../src/mastra/company/event-store';

test('task connector requests notify once, enforce owner/schema/input grants, attach real receipts and resume only eligible work',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const prior=process.env.DATABASE_URL,schema='connector_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString:process.env.TEST_DATABASE_URL});await admin.query('CREATE SCHEMA '+schema);const url=new URL(process.env.TEST_DATABASE_URL!);url.searchParams.set('options','-c search_path='+schema);process.env.DATABASE_URL=url.toString();
 const dir=await mkdtemp(join(tmpdir(),'ascendxi-connector-store-')),pool=new Pool({connectionString:url.toString()}),calls:any[]=[];let changed=false;
 const catalog=()=>[{name:'read_status',description:'Controlled service status',inputSchema:{type:'object'},schemaHash:connectorHash(changed?'changed-schema':'fixture-schema'),requiresApproval:false,declaredReadOnly:true,declaredDestructive:false}];
 const factory=async()=>({catalog:catalog(),execute:async(name:string,args:any)=>{calls.push({name,args});return {status:'controlled-available',secret:'must-not-persist'};},close:async()=>{}});
 const store=new ConnectorStore(pool,new ConnectorVault(dir),factory);
 try{
  await knowledgeStore().createGoal({key:'connector-fixture',title:'Controlled connector goal',outcome:'Verify a controlled connection evidence handoff only.',product:'VocalXI',department:'product',acceptance:['Retain controlled evidence']});
  await pool.query("UPDATE ascendxi_goals SET status='active' WHERE key='connector-fixture'");
  const task=await taskStore().create({key:randomUUID(),goal_key:'connector-fixture',title:'Controlled connection task',objective:'Read the controlled fixture status',product:'VocalXI',department:'product',acceptance:['Controlled receipt retained']});await taskStore().claim(task.id);await taskStore().finish(task.id,1,'blocked',{report:{blockers:['Missing credential for fixture'],nextAction:'Connect fixture'},review:{accepted:false,evidenceGaps:['Current fixture status']}});
  const need=await store.request(task.id,{service:'Controlled fixture',purpose:'Read the controlled status for this task'},'product');
  assert.equal((await store.request(task.id,{service:'Controlled fixture',purpose:'Read the controlled status for this task'},'product')).id,need.id);
  await assert.rejects(store.request(task.id,{service:'Other app',purpose:'Read another fixture status'},'growth'),/assignment owner/);
  assert.equal((await store.list()).requests.length,1);
  assert.equal(Number((await pool.query('SELECT count(*) FROM ascendxi_notifications WHERE key=$1',['connection-request:'+need.id])).rows[0].count),1);
  const saved=await store.save({kind:'http_mcp',name:'Controlled fixture',endpoint:'http://127.0.0.1:4329/mcp',allowLocal:true,auth:'bearer',secret:'controlled-token',headerName:'X-API-Key'});
  assert.doesNotMatch(JSON.stringify(await store.list()),/controlled-token|sealed_config/);
  await store.discover(saved.id);assert.equal((await store.list()).entries[0].status,'discovered');assert.equal((await taskStore().get(task.id)).status,'blocked');
  await assert.rejects(store.approveRead({requestId:need.id,connectorId:saved.id,version:1,toolName:'read_status',schemaHash:'0'.repeat(64),arguments:{resource:'fixture'},readConfirmed:true}));
  const grant=await store.approveRead({requestId:need.id,connectorId:saved.id,version:1,toolName:'read_status',schemaHash:catalog()[0].schemaHash,arguments:{resource:'fixture'},readConfirmed:true});
  await assert.rejects(store.executeRead(grant.id,'growth',task.id),/No approved read/);
  await assert.rejects(store.executeRead(grant.id,'product',randomUUID()),/No approved read/);
  const secondNeed=await store.request(task.id,{service:'Second controlled capability',purpose:'Read the second required fixture capability'},'product');
  await operationsStore().configure('product',{paused:true});
  const receipt=await store.executeRead(grant.id);assert.equal(calls.length,1);assert.deepEqual(calls[0].args,{resource:'fixture'});assert.equal((receipt.result as any).secret,'[redacted]');
  assert.equal((await taskStore().get(task.id)).status,'blocked','paused owner cannot automatically resume');
  assert.equal((await store.list()).requests[0].status,'ready');
  await operationsStore().configure('product',{paused:false});await store.resumeReady();
  assert.equal((await taskStore().get(task.id)).status,'blocked','all requested capabilities must be supplied before reassessment');
  const secondGrant=await store.approveRead({requestId:secondNeed.id,connectorId:saved.id,version:1,toolName:'read_status',schemaHash:catalog()[0].schemaHash,arguments:{resource:'second-fixture'},readConfirmed:true});await store.executeRead(secondGrant.id);
  assert.equal((await taskStore().get(task.id)).status,'queued');assert.equal((await store.list()).requests[0].status,'resumed');
  assert.equal((await taskStore().evidence(task.id)).length,2);assert.doesNotMatch(JSON.stringify(await taskStore().readEvidence(task.id,'connections/'+grant.id+'.json')),/must-not-persist|controlled-token/);
  await store.resumeReady();assert.equal((await store.list()).requests[0].status,'resumed');
  changed=true;await assert.rejects(store.executeRead(grant.id,'product',task.id),/read failed/);assert.equal(calls.length,2,'a changed tool schema never executes under the old grant');changed=false;
  await store.executeRead(grant.id,'product',task.id);assert.equal(calls.length,3);assert.equal((await pool.query('SELECT status FROM ascendxi_notifications WHERE key=$1',['connector-read:'+grant.id])).rows[0].status,'resolved');
  await store.disable(saved.id);await assert.rejects(store.executeRead(grant.id),/No approved read/);
  assert.equal((await store.list()).grants[0].revoked,true);
 }finally{await store.close();await closeProjectStore();await closePlanningStore();await closeOperationsStore();await closeKnowledgeStore();await closeTaskStore();await closeEventStore();await rm(dir,{recursive:true,force:true});await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();if(prior===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=prior;}
});
