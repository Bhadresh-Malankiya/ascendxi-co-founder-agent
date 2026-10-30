import {DiscordService} from '../../src/mastra/company/discord-service';
import {Pool} from 'pg';
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Mastra} from '@mastra/core/mastra';
import {teamAgents} from '../../src/mastra/agents/team';
import {queueDiscordRequest,processDiscordRequest,hasDiscordConsent} from '../../src/mastra/company/discord-advisory';
import {planningStore,closePlanningStore} from '../../src/mastra/company/planning-store';
import {closeOperationsStore} from '../../src/mastra/company/operations-store';
import {closeKnowledgeStore} from '../../src/mastra/company/knowledge-store';
import {closeTaskStore} from '../../src/mastra/company/task-store';
import {closeEventStore} from '../../src/mastra/company/event-store';
const url=process.env.TEST_DATABASE_URL;
test('Discord advisory needs exact identity/channel consent, uses one bounded run and revokes immediately',{skip:!url},async()=>{
 const previous=process.env.DATABASE_URL,limit=process.env.ASCENDXI_MAX_RUNS_PER_HOUR;const schema='discord_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString:url});await admin.query('CREATE SCHEMA '+schema);const isolated=new URL(url!);isolated.searchParams.set('options','-c search_path='+schema);process.env.DATABASE_URL=isolated.toString();process.env.ASCENDXI_MAX_RUNS_PER_HOUR='30';
 const author='8'+Date.now()+'001',channel='9'+Date.now()+'002',id='fixture-'+randomUUID(),sent:any[]=[];
 const mastra=new Mastra({agents:teamAgents});
 const mocked=mock.method(teamAgents.engineering!,'stream',async()=>({fullStream:new ReadableStream({start(c){c.enqueue({type:'text-delta',payload:{text:'Controlled fixture advisory response.'}});c.close();}}),getFullOutput:async()=>({text:'Controlled fixture advisory response.',totalUsage:{inputTokens:10,outputTokens:5}})}));
 const queue=async(key:string,room:string,text:string)=>{sent.push({key,room,text});};
 try{
  const first=await queueDiscordRequest({id,content:'engineering: Review the fixture readiness scope only.',author:{id:author}},channel);
  assert.equal(first.status,'awaiting_access');assert.equal(await processDiscordRequest(mastra,queue),false);assert.equal(mocked.mock.callCount(),0);
  const store=planningStore(),key='discord-access-'+author+'-'+channel,p=await store.inspect(key);
  await store.decide(key,p.version,p.hash,'approve','Fixture identity and audience explicitly approved');
  assert.equal(await hasDiscordConsent(author,channel),true);assert.equal(await hasDiscordConsent(author,channel+'1'),false);
  assert.equal(await processDiscordRequest(mastra,queue),true);assert.equal(mocked.mock.callCount(),1);assert.equal(sent.length,1);assert.equal(sent[0].room,channel);assert.match(sent[0].text,/Controlled fixture/);
  assert.equal(await processDiscordRequest(mastra,queue),false);assert.equal(mocked.mock.callCount(),1);
  await store.decide(key,p.version,p.hash,'revoke','Fixture discussion access revoked');assert.equal(await hasDiscordConsent(author,channel),false);
  let writes=0;const delivery=new DiscordService({call:async()=>{writes++;return {id:'fixture-forbidden-send'};}});
  await delivery.queue(sent[0].key,channel,sent[0].text);assert.equal(await delivery.processOne(),null);assert.equal(writes,0,'revoked queued replies must never reach Discord');
  assert.equal((await queueDiscordRequest({id,content:'engineering: Duplicate',author:{id:author}},channel)).duplicate,true);
 }finally{mock.restoreAll();await closePlanningStore();await closeOperationsStore();await closeKnowledgeStore();await closeTaskStore();await closeEventStore();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;if(limit===undefined)delete process.env.ASCENDXI_MAX_RUNS_PER_HOUR;else process.env.ASCENDXI_MAX_RUNS_PER_HOUR=limit;}
});
