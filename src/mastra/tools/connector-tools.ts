import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { connectorStore, connectionNeedInput } from '../company/connector-store';

function binding(context:any){
  const taskId=context.requestContext?.get('companyTaskId'),actor=context.requestContext?.get('companyActor');
  if(typeof taskId!=='string'||typeof actor!=='string')throw Error('A server-bound assignment and owner are required.');
  return {taskId,actor};
}
export const connectorTools={
  connection_request:createTool({id:'connection_request',description:'Record a missing app/MCP connection needed for the current assignment. Notify the founder in the portal. This does not grant access or stop other eligible work. Do not repeat an existing request.',inputSchema:connectionNeedInput,execute:async(d,c)=>{const {taskId,actor}=binding(c);return connectorStore().request(taskId,d,actor);}}),
  connection_reads:createTool({id:'connection_reads',description:'List exact reads approved for this assignment and its responsible owner. Credentials and unrelated agents grants are never returned.',inputSchema:z.object({}),execute:async(_,c)=>{const {taskId,actor}=binding(c);return connectorStore().agentGrants(taskId,actor);}}),
  connection_read:createTool({id:'connection_read',description:'Execute one founder-approved task-scoped read by grant ID. The exact tool and arguments are fixed on the server. It cannot issue arbitrary calls, writes or access another agents task.',inputSchema:z.object({grantId:z.string().uuid()}),execute:async(d,c)=>{const {taskId,actor}=binding(c);return connectorStore().executeRead(d.grantId,actor,taskId);}}),
};
