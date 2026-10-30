import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {liveRecordRefreshScript} from '../src/mastra/company/live-record-refresh';

function desk(){
  const timers: Array<()=>Promise<void>>=[];
  const listeners: Record<string,()=>void>={};
  const modal={open:false,addEventListener:(name:string,fn:()=>void)=>{listeners[name]=fn;}};
  const fields={modal,projectMessage:{value:''},chatMessage:{value:''}};
  let calls=0,success=true;
  const context:any={opsRevision:'1',opsRefreshTimer:null,chatRunning:false,
    at:(id:keyof typeof fields)=>fields[id],setTimeout:(fn:()=>Promise<void>)=>{timers.push(fn);return timers.length;},
    refresh:async()=>{calls++;return success;}};
  runInNewContext(liveRecordRefreshScript,context);
  return {context,modal,fields,listeners,timers,get calls(){return calls;},fail(){success=false;},recover(){success=true;},async flush(){const next=timers.shift();assert.ok(next);await next();}};
}
test('a knowledge update received inside a dialog reloads records after close without another revision',async()=>{
  const d=desk();d.modal.open=true;d.context.observeOpsRecordsRevision('2');await d.flush();
  assert.equal(d.calls,0);assert.equal(d.context.opsRecordsDirty,true);
  d.modal.open=false;d.listeners.close();await d.flush();
  assert.equal(d.calls,1);assert.equal(d.context.opsRecordsDirty,false);
  d.context.observeOpsRecordsRevision('2');assert.equal(d.timers.length,0);
});
test('draft text is preserved and a later unchanged snapshot still applies the pending update',async()=>{
  const d=desk();d.fields.projectMessage.value='Unsent founder question';d.context.observeOpsRecordsRevision('2');await d.flush();
  assert.equal(d.calls,0);assert.equal(d.fields.projectMessage.value,'Unsent founder question');
  d.fields.projectMessage.value='';d.context.observeOpsRecordsRevision('2');await d.flush();assert.equal(d.calls,1);
});
test('failed or busy refresh remains pending and concurrent invalidations are not lost',async()=>{
  const d=desk();d.fail();d.context.observeOpsRecordsRevision('2');await d.flush();assert.equal(d.context.opsRecordsDirty,true);
  d.recover();let finish!:(v:boolean)=>void;d.context.refresh=()=>new Promise<boolean>(resolve=>{finish=resolve;});
  d.context.observeOpsRecordsRevision('2');const pending=d.flush();
  d.context.observeOpsRecordsRevision('3');assert.equal(d.timers.length,0);
  finish(true);await pending;assert.equal(d.context.opsRecordsDirty,true);
  d.context.refresh=async()=>true;d.context.observeOpsRecordsRevision('3');await d.flush();assert.equal(d.context.opsRecordsDirty,false);
});
