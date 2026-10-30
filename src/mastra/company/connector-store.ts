import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { z } from 'zod';
import { connectorInput, openConnector, type ConnectorFactory } from './connector-runtime';
import { ConnectorVault, connectorHash, connectorUrl, redactConnector } from './connector-security';
import { operationsStore } from './operations-store';
import { eventStore } from './event-store';
import { taskStore } from './task-store';
import { projectStore } from './project-store';
import { ownerFor } from './team';

export const connectionNeedInput=z.object({service:z.string().trim().min(2).max(100),purpose:z.string().trim().min(10).max(2000)}).strict();
export const connectorGrantInput=z.object({requestId:z.string().uuid(),connectorId:z.string().uuid(),version:z.number().int().positive(),toolName:z.string().min(1).max(300),schemaHash:z.string().length(64),arguments:z.record(z.string(),z.unknown()),readConfirmed:z.literal(true)}).strict();
const publicColumns='id,name,kind,version,status,detail,catalog,checked_at,created_at,updated_at';

export class ConnectorStore {
  private initialized?:Promise<void>;
  constructor(readonly pool:Pool,private vault=new ConnectorVault(),private factory:ConnectorFactory=openConnector){}
  init(){return this.initialized??=this.initialize().catch(e=>{this.initialized=undefined;throw e;});}
  private async initialize(){
    await operationsStore().init();await taskStore().list(1);
    const c=await this.pool.connect();try{
      await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('ascendxi.connectors.v1'))");
      await c.query(`CREATE TABLE IF NOT EXISTS ascendxi_connectors(id uuid PRIMARY KEY,name text NOT NULL,kind text NOT NULL,version integer NOT NULL DEFAULT 1,sealed_config text NOT NULL,status text NOT NULL DEFAULT 'configured',detail text NOT NULL DEFAULT 'Discover tools to check the connection.',catalog jsonb NOT NULL DEFAULT '[]',checked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
        CREATE TABLE IF NOT EXISTS ascendxi_connection_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),task_id uuid NOT NULL REFERENCES ascendxi_tasks(id),owner text NOT NULL,service text NOT NULL,purpose text NOT NULL,attempt integer NOT NULL,status text NOT NULL DEFAULT 'open',detail text NOT NULL DEFAULT 'Add a connection and approve the exact read needed by this assignment.',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(task_id,service));
        CREATE TABLE IF NOT EXISTS ascendxi_connector_grants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL REFERENCES ascendxi_connection_requests(id),connector_id uuid NOT NULL REFERENCES ascendxi_connectors(id),connector_version integer NOT NULL,task_id uuid NOT NULL REFERENCES ascendxi_tasks(id),owner text NOT NULL,tool_name text NOT NULL,schema_hash text NOT NULL,arguments jsonb NOT NULL,arguments_hash text NOT NULL,revoked boolean NOT NULL DEFAULT false,verified_at timestamptz,receipt jsonb,created_at timestamptz NOT NULL DEFAULT now());`);
      await c.query('COMMIT');
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }
  async list(){await this.init();return {entries:(await this.pool.query('SELECT '+publicColumns+' FROM ascendxi_connectors ORDER BY created_at')).rows,
    requests:(await this.pool.query('SELECT r.*,t.title AS task_title,t.status AS task_status,t.attempts AS task_attempts FROM ascendxi_connection_requests r JOIN ascendxi_tasks t ON t.id=r.task_id ORDER BY r.updated_at DESC LIMIT 100')).rows,
    grants:(await this.pool.query('SELECT id,request_id,connector_id,connector_version,task_id,owner,tool_name,schema_hash,arguments,revoked,verified_at,created_at FROM ascendxi_connector_grants ORDER BY created_at DESC LIMIT 200')).rows};}
  async save(value:unknown,id:string=randomUUID(),expectedVersion=0){
    const config=connectorInput.parse(value);if(config.kind==='http_mcp'){
      connectorUrl(config.endpoint,config.allowLocal);
      if(config.auth!=='none'&&!config.secret.trim())throw Error('Enter the credential for this connection.');
    }
    await this.init();const version=expectedVersion+1,sealed=await this.vault.seal(config,id+':'+version),c=await this.pool.connect();
    try{await c.query('BEGIN');
      const prior=(await c.query('SELECT version FROM ascendxi_connectors WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if((prior?.version||0)!==expectedVersion)throw Error('Connection changed. Reopen it before saving.');
      await c.query("INSERT INTO ascendxi_connectors(id,name,kind,version,sealed_config)VALUES($1,$2,$3,$4,$5)ON CONFLICT(id)DO UPDATE SET name=$2,kind=$3,version=$4,sealed_config=$5,status='configured',detail='Connection changed; discover tools and review new grants.',catalog='[]',checked_at=NULL,updated_at=now()",[id,config.name,config.kind,version,sealed]);
      await c.query('UPDATE ascendxi_connector_grants SET revoked=true WHERE connector_id=$1',[id]);
      await c.query("INSERT INTO ascendxi_events(kind,actor,summary,data)VALUES('connector.saved','operator','Connection configuration saved privately',$1)",[{connectorId:id,version}]);
      await c.query('COMMIT');return {id,version};
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }
  private async config(id:string){await this.init();const row=(await this.pool.query('SELECT * FROM ascendxi_connectors WHERE id=$1',[id])).rows[0];if(!row)throw Error('Connection not found');if(row.status==='disabled')throw Error('Connection is disabled');return {row,config:connectorInput.parse(await this.vault.open(row.sealed_config,id+':'+row.version))};}
  async discover(id:string){
    const {row,config}=await this.config(id);let session;
    try{session=await this.factory(config);const catalog=redactConnector(session.catalog,[config.secret]);
      const saved=await this.pool.query("UPDATE ascendxi_connectors SET catalog=$2,status='discovered',detail='Tools discovered. A successful approved read is still needed to verify task access.',checked_at=now(),updated_at=now()WHERE id=$1 AND version=$3 AND status<>'disabled'",[id,JSON.stringify(catalog),row.version]);
      if(!saved.rowCount)throw Error('Connection changed during discovery.');
      await eventStore().append({kind:'connector.discovered',actor:'operator',summary:'Connection tools discovered',data:{connectorId:id,count:session.catalog.length}});
      return (await this.list()).entries.find(e=>e.id===id);
    }catch{await this.pool.query("UPDATE ascendxi_connectors SET status='error',detail='Discovery failed. Check endpoint, credential, provider login and server availability.',updated_at=now()WHERE id=$1 AND version=$2 AND status<>'disabled'",[id,row.version]);throw Error('Connection check failed. Confirm the endpoint and authentication; no task access was granted.');}
    finally{await session?.close();}
  }
  async disable(id:string){await this.init();const c=await this.pool.connect();try{await c.query('BEGIN');await c.query("UPDATE ascendxi_connectors SET status='disabled',updated_at=now()WHERE id=$1",[id]);await c.query('UPDATE ascendxi_connector_grants SET revoked=true WHERE connector_id=$1',[id]);await c.query("INSERT INTO ascendxi_events(kind,actor,summary,data)VALUES('connector.disabled','operator','Connection disabled; grants revoked',$1)",[{connectorId:id}]);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
  async request(taskId:string,value:unknown,actor?:string){
    const need=connectionNeedInput.parse(value);await this.init();const task=await taskStore().get(taskId),owner=ownerFor(task.specialist||task.department);
    if(actor&&actor!==owner)throw Error('Only this assignment owner can request its connection.');
    if(task.status==='completed')throw Error('Completed assignments cannot request new access.');
    const r=(await this.pool.query("INSERT INTO ascendxi_connection_requests(task_id,owner,service,purpose,attempt)VALUES($1,$2,$3,$4,$5)ON CONFLICT(task_id,service)DO UPDATE SET purpose=$4,attempt=$5,owner=$2,status=CASE WHEN ascendxi_connection_requests.attempt=$5 THEN ascendxi_connection_requests.status ELSE 'open' END,updated_at=now()RETURNING *",[taskId,owner,need.service,need.purpose,task.attempts])).rows[0];
    await operationsStore().notify({key:'connection-request:'+r.id,kind:'connection',severity:'warning',title:need.service+' connection needed',detail:owner+' needs a task-scoped connection: '+need.purpose,agentId:owner,taskId,target:'connections'});
    if(r.status==='open')await this.pool.query("UPDATE ascendxi_notifications SET status='open' WHERE key=$1 AND status='resolved'",['connection-request:'+r.id]);
    await eventStore().append({kind:'connector.requested',actor:actor||'operator',summary:need.service+' connection requested',taskId,data:{requestId:r.id,owner}});
    return r;
  }
  async approveRead(value:unknown){
    const d=connectorGrantInput.parse(value);if(JSON.stringify(d.arguments).length>16000)throw Error('Read arguments are too large');
    await this.init();const reference=(await this.pool.query('SELECT task_id FROM ascendxi_connection_requests WHERE id=$1',[d.requestId])).rows[0];if(!reference)throw Error('Request not found');const c=await this.pool.connect();try{await c.query('BEGIN');
      await c.query('SELECT id FROM ascendxi_tasks WHERE id=$1 FOR UPDATE',[reference.task_id]);
      const r=(await c.query("SELECT r.*,t.status AS task_status,t.attempts,t.department,t.specialist FROM ascendxi_connection_requests r JOIN ascendxi_tasks t ON t.id=r.task_id WHERE r.id=$1 FOR UPDATE OF r,t",[d.requestId])).rows[0];
      if(!r || r.status!=='open' || r.attempt!==r.attempts || r.owner!==ownerFor(r.specialist||r.department) || r.task_status==='completed')throw Error('Request is stale. Inspect the current task.');
      const entry=(await c.query("SELECT * FROM ascendxi_connectors WHERE id=$1 AND version=$2 AND status IN('discovered','verified')FOR UPDATE",[d.connectorId,d.version])).rows[0];
      const tool=entry?.catalog.find((t:any)=>t.name===d.toolName&&t.schemaHash===d.schemaHash);
      if(!tool || tool.requiresApproval || tool.declaredDestructive===true)throw Error('Select a current tool without a conflicting upstream/destructive restriction.');
      const argsHash=connectorHash(d.arguments);
      const same=(await c.query('SELECT id FROM ascendxi_connector_grants WHERE request_id=$1 AND connector_id=$2 AND connector_version=$3 AND tool_name=$4 AND schema_hash=$5 AND arguments_hash=$6 AND NOT revoked',[r.id,entry.id,entry.version,tool.name,tool.schemaHash,argsHash])).rows[0];
      const grant=same || (await c.query('INSERT INTO ascendxi_connector_grants(request_id,connector_id,connector_version,task_id,owner,tool_name,schema_hash,arguments,arguments_hash)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)RETURNING id',[r.id,entry.id,entry.version,r.task_id,r.owner,tool.name,tool.schemaHash,JSON.stringify(d.arguments),argsHash])).rows[0];
      await c.query("INSERT INTO ascendxi_events(kind,actor,summary,task_id,data)VALUES('connector.read.approved','operator','Exact task-scoped read approved',$1,$2)",[r.task_id,{grantId:grant.id,connectorId:entry.id,owner:r.owner,tool:tool.name,argumentsHash:argsHash}]);
      await c.query('COMMIT');return {id:grant.id};
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }
  async executeRead(grantId:string,actor?:string,taskId?:string){
    await this.init();const grant=(await this.pool.query('SELECT * FROM ascendxi_connector_grants WHERE id=$1 AND NOT revoked',[grantId])).rows[0];
    if(!grant || (actor&&grant.owner!==actor) || (taskId&&grant.task_id!==taskId))throw Error('No approved read for this agent and assignment.');
    const task=await taskStore().get(grant.task_id);
    if(grant.owner!==ownerFor(task.specialist||task.department) || !['blocked','queued','running','review'].includes(task.status))throw Error('This task is no longer eligible for its read grant.');
    if(actor&&((await operationsStore().settings(actor)).paused||!(await projectStore().eligible(task.id))))throw Error('The assignment scope, prerequisites or agent availability do not allow this read.');
    const {row,config}=await this.config(grant.connector_id);
    if(row.version!==grant.connector_version)throw Error('Connection changed. Review new access before using it.');
    let session;
    try{
      session=await this.factory(config);const tool=session.catalog.find(t=>t.name===grant.tool_name);
      if(!tool || tool.schemaHash!==grant.schema_hash || tool.requiresApproval || tool.declaredDestructive===true)throw Error('Tool changed or needs upstream approval.');
      const result=await session.execute(grant.tool_name,grant.arguments);
      if(result===null||result===undefined||(typeof result==='object'&&((result as any).isError||(result as any).error||(result as any).success===false||(result as any).status==='failed'||(result as any).status==='error')))throw Error('Provider rejected the read');
      const text=JSON.stringify(redactConnector(result,[config.secret]));
      if(!text || text.length>64000)throw Error('Read result exceeds the task evidence limit. Narrow the approved arguments.');
      const verifiedAt=new Date().toISOString(),receipt={verifiedAt,connectorId:row.id,connectorVersion:row.version,tool:grant.tool_name,argumentsHash:grant.arguments_hash,result:JSON.parse(text),limitation:'This receipt proves only the exact provider read; independent task acceptance remains required.'};
      // Serialize persistence with disable/reconfiguration. An in-flight read may finish,
      // but revoked access can never produce a new usable receipt or unblock work.
      const c=await this.pool.connect();try{await c.query('BEGIN');
        const current=(await c.query('SELECT version,status FROM ascendxi_connectors WHERE id=$1 FOR UPDATE',[row.id])).rows[0];
        const valid=(await c.query('SELECT revoked FROM ascendxi_connector_grants WHERE id=$1 FOR UPDATE',[grantId])).rows[0];
        if(current.version!==row.version || current.status==='disabled' || valid.revoked)throw Error('Read access changed while the request was in flight.');
        await c.query('UPDATE ascendxi_connector_grants SET verified_at=now(),receipt=$2 WHERE id=$1',[grantId,receipt]);
        await c.query("UPDATE ascendxi_notifications SET status='resolved',updated_at=now()WHERE key=$1",['connector-read:'+grantId]);
        await c.query("UPDATE ascendxi_connectors SET status='verified',detail='An exact approved read returned successfully. This does not grant other agents or tools access.',checked_at=now(),updated_at=now()WHERE id=$1",[row.id]);
        await c.query("INSERT INTO ascendxi_events(kind,actor,summary,task_id,data)VALUES('connector.read.verified',$1,'Task-scoped provider read returned successfully',$2,$3)",[actor||'operator',grant.task_id,{grantId,connectorId:row.id}]);
        await c.query('COMMIT');
      }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
      await taskStore().putEvidence(grant.task_id,'connections/'+grantId+'.json',JSON.stringify(receipt,null,2),'Actual approved connector read · '+verifiedAt);
      await this.pool.query("UPDATE ascendxi_connection_requests SET status='ready',detail='Read evidence attached; the responsible agent will reassess this task automatically.',updated_at=now()WHERE id=$1 AND status='open' AND attempt=$2",[grant.request_id,task.attempts]);
      await this.resumeReady();return receipt;
    }catch{
      await this.pool.query("UPDATE ascendxi_connection_requests SET status='open',attempt=$2,detail='The approved read failed or changed. Check authentication, tool scope and exact inputs; no automatic success is claimed.',updated_at=now()WHERE id=$1 AND EXISTS(SELECT 1 FROM ascendxi_tasks t WHERE t.id=task_id AND t.attempts=$2 AND t.status<>'completed')",[grant.request_id,task.attempts]);
      await operationsStore().notify({key:'connector-read:'+grantId,kind:'connection',severity:'warning',title:'Connection read needs attention',detail:'Read failed, access changed or the response was too large. Check the connection, authentication, exact tool and arguments. No successful task access is claimed.',agentId:grant.owner,taskId:grant.task_id,target:'connections'});
      throw Error('Approved read failed or access changed. Check the connection and exact arguments. The task was not marked complete.');
    }finally{await session?.close();}
  }
  async resumeReady(){
    await this.init();await projectStore().init();
    await this.pool.query("UPDATE ascendxi_connection_requests r SET status='satisfied',detail='The assignment completed; no further connection setup is needed for it.',updated_at=now()WHERE status IN('open','ready','resumed')AND EXISTS(SELECT 1 FROM ascendxi_tasks t WHERE t.id=r.task_id AND t.status='completed')");
    await this.pool.query("UPDATE ascendxi_connector_grants g SET revoked=true WHERE NOT revoked AND EXISTS(SELECT 1 FROM ascendxi_tasks t WHERE t.id=g.task_id AND t.status='completed')");
    await this.pool.query("UPDATE ascendxi_notifications n SET status='resolved',updated_at=now()WHERE kind='connection' AND status<>'resolved' AND EXISTS(SELECT 1 FROM ascendxi_tasks t WHERE t.id=n.task_id AND t.status='completed')");
    const ready=(await this.pool.query("SELECT * FROM ascendxi_connection_requests WHERE status='ready' ORDER BY updated_at LIMIT 20")).rows;
    for(const request of ready){
      if((await operationsStore().settings(request.owner)).paused || !(await projectStore().eligible(request.task_id)))continue;
      const c=await this.pool.connect();try{await c.query('BEGIN');
        const task=(await c.query('SELECT * FROM ascendxi_tasks WHERE id=$1 FOR UPDATE',[request.task_id])).rows[0];
        const related=(await c.query('SELECT * FROM ascendxi_connection_requests WHERE task_id=$1 ORDER BY id FOR UPDATE',[request.task_id])).rows;
        const current=related.find(r=>r.id===request.id);
        if(related.some(r=>r.attempt===task.attempts&&r.status==='open')){await c.query('ROLLBACK');continue;}
        const proof=(await c.query("SELECT g.id FROM ascendxi_connector_grants g JOIN ascendxi_connectors c ON c.id=g.connector_id WHERE g.request_id=$1 AND NOT g.revoked AND g.verified_at IS NOT NULL AND c.version=g.connector_version AND c.status='verified' LIMIT 1",[request.id])).rows[0];
        if(current.status!=='ready'||!proof||task.attempts!==request.attempt||ownerFor(task.specialist||task.department)!==request.owner){await c.query('ROLLBACK');continue;}
        if(task.status==='blocked'){
          await c.query("UPDATE ascendxi_tasks SET status='queued',report=COALESCE(report,'{}'::jsonb)||jsonb_build_object('connectionRecovery',$2::jsonb),updated_at=now()WHERE id=$1",[task.id,{requestId:request.id,grantId:proof.id}]);
          await c.query("INSERT INTO ascendxi_events(kind,actor,summary,task_id,data)VALUES('task.connection.resumed',$1,'Verified connection evidence queued for independent reassessment',$2,$3)",[request.owner,task.id,{requestId:request.id}]);
        }else if(task.status!=='queued'){await c.query('ROLLBACK');continue;}
        await c.query("UPDATE ascendxi_connection_requests SET status='resumed',detail='Connection evidence is available to the assignment owner. Task completion still requires independent review.',updated_at=now()WHERE task_id=$1 AND status='ready' AND attempt=$2",[request.task_id,task.attempts]);
        await c.query("UPDATE ascendxi_notifications SET status='resolved',updated_at=now()WHERE key IN(SELECT 'connection-request:'||id::text FROM ascendxi_connection_requests WHERE task_id=$1 AND status='resumed')",[request.task_id]);
        await c.query('COMMIT');
      }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
    }
  }
  async agentGrants(taskId:string,actor:string){
    const task=await taskStore().get(taskId);if(ownerFor(task.specialist||task.department)!==actor)throw Error('Task belongs to another agent');
    await this.init();return (await this.pool.query("SELECT g.id,g.tool_name,g.arguments,g.verified_at,c.name FROM ascendxi_connector_grants g JOIN ascendxi_connectors c ON c.id=g.connector_id WHERE g.task_id=$1 AND g.owner=$2 AND NOT g.revoked AND g.connector_version=c.version AND c.status IN('discovered','verified')",[taskId,actor])).rows;
  }
  async revoke(grantId:string){await this.init();await this.pool.query('UPDATE ascendxi_connector_grants SET revoked=true WHERE id=$1',[grantId]);await eventStore().append({kind:'connector.read.revoked',actor:'operator',summary:'Task read grant revoked',data:{grantId}});}
  async close(){await this.pool.end();}
}
let store:ConnectorStore|undefined;
export function connectorStore(){if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');return store??=new ConnectorStore(new Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:10000,query_timeout:15000}));}
export async function closeConnectorStore(){const current=store;store=undefined;await current?.close();}
