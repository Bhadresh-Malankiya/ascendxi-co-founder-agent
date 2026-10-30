/** Retain invalidations while an operator is reading a dialog or drafting text. */
export const liveRecordRefreshScript = String.raw`
var opsRecordsDirty=false,opsRecordsRefreshing=false;
function scheduleOpsRecordsRefresh(){
  if(!opsRecordsDirty||opsRefreshTimer||opsRecordsRefreshing)return;
  opsRefreshTimer=setTimeout(async function(){
    opsRefreshTimer=null;
    if(at('modal').open||chatRunning||at('projectMessage').value||at('chatMessage').value)return;
    opsRecordsDirty=false;
    opsRecordsRefreshing=true;
    try{
      if(!await refresh())opsRecordsDirty=true;
    }catch(e){
      opsRecordsDirty=true;
    }finally{
      opsRecordsRefreshing=false;
    }
  },500);
}
function observeOpsRecordsRevision(revision){
  if(opsRevision!==revision)opsRecordsDirty=true;
  opsRevision=revision;
  scheduleOpsRecordsRefresh();
}
at('modal').addEventListener('close',scheduleOpsRecordsRefresh);
`;
