import { registerApiRoute, type MiddlewareHandler } from '@mastra/core/server';
import { z } from 'zod';
import { connectorStore, connectionNeedInput, connectorGrantInput } from './connector-store';

export function connectorRoutes(guard:MiddlewareHandler){
  const route=(path:string,method:'GET'|'POST',handler:(c:any)=>Promise<unknown>)=>registerApiRoute('/company'+path,{method,middleware:guard,handler:async(c:any)=>{
    try{return c.json(await handler(c));}catch(e){return c.json({error:e instanceof z.ZodError?'Check the connector form fields.':e instanceof Error?e.message:'Connector operation failed'},409);}
  }});
  const id=(c:any)=>z.string().uuid().parse(c.req.param('id'));
  return [
    route('/connectors','GET',()=>connectorStore().list()),
    route('/connectors','POST',async c=>{const d=z.object({config:z.unknown()}).strict().parse(await c.req.json());return connectorStore().save(d.config);}),
    route('/connectors/:id','POST',async c=>{const d=z.object({config:z.unknown(),expectedVersion:z.number().int().positive()}).strict().parse(await c.req.json());return connectorStore().save(d.config,id(c),d.expectedVersion);}),
    route('/connectors/:id/discover','POST',c=>connectorStore().discover(id(c))),
    route('/connectors/:id/disable','POST',async c=>{await connectorStore().disable(id(c));return {disabled:true};}),
    route('/tasks/:id/connection-requests','POST',async c=>connectorStore().request(id(c),connectionNeedInput.parse(await c.req.json()))),
    route('/connector-grants','POST',async c=>connectorStore().approveRead(connectorGrantInput.parse(await c.req.json()))),
    route('/connector-grants/:id/test','POST',c=>connectorStore().executeRead(id(c))),
    route('/connector-grants/:id/revoke','POST',async c=>{await connectorStore().revoke(id(c));return {revoked:true};}),
  ];
}
