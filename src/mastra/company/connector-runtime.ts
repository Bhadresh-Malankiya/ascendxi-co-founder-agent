import { randomUUID } from 'node:crypto';
import { MCPClient } from '@mastra/mcp';
import { configuredConnectResolver } from './connections';
import { noopObserve, type Tool } from '@mastra/core/tools';
import { z } from 'zod';
import { guardConnectedTools } from './policy';
import { connectorHash, connectorTransport } from './connector-security';

export const connectorInput=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('http_mcp'),name:z.string().min(2).max(100),endpoint:z.string().url().max(2000),allowLocal:z.boolean().default(false),auth:z.enum(['none','bearer','api_key']).default('none'),headerName:z.enum(['X-API-Key','Api-Key','api-key']).default('X-API-Key'),secret:z.string().max(12000).default('')}),
  z.object({kind:z.literal('mastra_connect'),name:z.string().min(2).max(100),projectId:z.string().min(1).max(200),providers:z.array(z.string().regex(/^[a-z0-9_-]+$/)).min(1).max(20),secret:z.string().min(1).max(12000)}),
]);
export type ConnectorConfig=z.infer<typeof connectorInput>;
export type ConnectorTool={name:string;description:string;inputSchema:unknown;schemaHash:string;requiresApproval:boolean;declaredReadOnly:boolean|null;declaredDestructive:boolean|null};
export type ConnectorSession={catalog:ConnectorTool[];execute:(name:string,args:Record<string,unknown>)=>Promise<unknown>;close:()=>Promise<unknown>};
export type ConnectorFactory=(config:ConnectorConfig)=>Promise<ConnectorSession>;

function schemaOf(value:any):unknown {
  if(!value)return {type:'object',properties:{}};
  if(value._zod)return z.toJSONSchema(value,{unrepresentable:'any'});
  if(value.jsonSchema)return value.jsonSchema;
  if(value.type || value.$schema || value.properties)return value;
  throw Error('This provider schema cannot be reviewed in the current connector UI.');
}

/** No discovered tool is exposed to an agent directly. Each execution needs an exact saved read grant. */
export const openConnector:ConnectorFactory=async(config)=>{
  let close:()=>Promise<unknown>,catalog:ConnectorTool[],execute:ConnectorSession['execute'];
  if(config.kind==='http_mcp'){
    const transport=await connectorTransport(config.endpoint,config.allowLocal);
    const headers:Record<string,string>=config.auth==='none'?{}:config.auth==='bearer'?{Authorization:'Bearer '+config.secret}:{[config.headerName]:config.secret};
    const client=new MCPClient({id:'company-'+randomUUID(),timeout:15000,servers:{service:{url:transport.url,fetch:transport.request,requestInit:{headers},allowedHosts:[transport.url.host],forwardInstructions:false,enableServerLogs:false,requireToolApproval:false,onToolError:'throw'}}});
    close=async()=>{try{await client.disconnect();}finally{await transport.close();}};
    try{
      const result=await client.listToolDefinitionsWithErrors({perServerTimeoutMs:15000});
      if(Object.keys(result.errors).length)throw Error('Unable to discover MCP tools. Check endpoint, authentication and server availability.');
      const definitions=result.definitions.service || {};
      catalog=Object.entries(definitions).slice(0,500).map(([name,d])=>({name,description:(d.description||d.title||name).slice(0,1500),inputSchema:d.inputSchema,schemaHash:connectorHash({name,description:d.description,inputSchema:d.inputSchema,outputSchema:d.outputSchema,annotations:d.annotations}),requiresApproval:false,declaredReadOnly:d.annotations?.readOnlyHint??null,declaredDestructive:d.annotations?.destructiveHint??null}));
      execute=async(name,args)=>{
        const definition=definitions[name];if(!definition)throw Error('Tool no longer exists');
        const tool=await client.toolFromDefinition({serverName:'service',definition});
        const guarded=guardConnectedTools({[name]:tool},new Set([name]))[name] as Tool;
        if(guarded.requireApproval || !guarded.execute)throw Error('Upstream tool approval is still required');
        return guarded.execute(args,{observe:noopObserve,abortSignal:AbortSignal.timeout(20000)} as any);
      };
    }catch(e){await close();throw e;}
  }else{
    const resolver=configuredConnectResolver(config.projectId,config.providers,config.secret);
    close=()=>resolver.disconnect();
    try{
      const resolved=await resolver.refresh() as Record<string,Tool>;
      catalog=Object.entries(resolved).slice(0,500).map(([name,t])=>{
        const inputSchema=schemaOf(t.inputSchema),requiresApproval=!!t.requireApproval;
        return {name,description:String(t.description||name).slice(0,1500),inputSchema,schemaHash:connectorHash({name,description:t.description,inputSchema,requiresApproval}),requiresApproval,declaredReadOnly:null,declaredDestructive:null};
      });
      execute=async(name,args)=>{
        const tool=guardConnectedTools(resolved,new Set([name]))[name] as Tool;
        if(!tool?.execute || tool.requireApproval)throw Error('Upstream tool approval is still required');
        return tool.execute(args,{observe:noopObserve,abortSignal:AbortSignal.timeout(20000)} as any);
      };
    }catch(e){await close();throw e;}
  }
  if(JSON.stringify(catalog).length>1_000_000){await close();throw Error('Provider tool catalog is too large. Narrow the configured providers.');}
  return {catalog,execute,close};
};
