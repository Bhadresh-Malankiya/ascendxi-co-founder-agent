import {projectStore} from './project-store';
import { registerApiRoute, type MiddlewareHandler } from '@mastra/core/server';
import { z } from 'zod';
import { planInput, planningStore } from './planning-store';
import { blockerDetails, remediateTask } from './blockers';
import { taskStore } from './task-store';
import { discussPlan } from './plan-discussion';

export function planningRoutes(guard: MiddlewareHandler) {
  const route = (path: string, method: 'GET'|'POST', fn:(c:any)=>Promise<any>) => registerApiRoute(path, {method,middleware:guard,handler:async(c:any)=>{
    try {return c.json(await fn(c));} catch(e) {return c.json({error:e instanceof z.ZodError ? 'Check the plan fields, dates and milestone dependencies.' : e instanceof Error ? e.message : 'Operation failed'},e instanceof z.ZodError ? 400 : 409);}
  }});
  return [
    route('/company/plans','GET',()=>planningStore().list()),
    route('/company/tasks/:id/evidence','GET',c=>taskStore().evidence(z.string().uuid().parse(c.req.param('id')))),
    route('/company/tasks/:id/evidence','POST',async c=>{const d=z.object({path:z.string().min(1).max(300),content:z.string().max(100000),source:z.string().min(3).max(2000)}).strict().parse(await c.req.json());return taskStore().putEvidence(z.string().uuid().parse(c.req.param('id')),d.path,d.content,d.source);}),
    route('/company/plans','POST',async c=>planningStore().propose(planInput.parse(await c.req.json()),'operator')),
    route('/company/plans/:key','GET',c=>planningStore().inspect(c.req.param('key'))),
    route('/company/plans/:key/decision','POST',async c=>{
      const d=z.object({version:z.number().int().min(1),hash:z.string().regex(/^[a-f0-9]{64}$/),decision:z.enum(['approve','reject','revoke']),note:z.string().min(10).max(4000)}).strict().parse(await c.req.json());
      return planningStore().decide(c.req.param('key'),d.version,d.hash,d.decision,d.note);
    }),
    route('/company/plans/:key/discuss','POST',async c=>{
      const d=z.object({version:z.number().int().min(1),message:z.string().min(1).max(6000)}).strict().parse(await c.req.json());
      return discussPlan(c.get('mastra'),c.req.param('key'),d.version,d.message);
    }),
    route('/company/blockers/:id','GET',async c=>{const id=z.string().uuid().parse(c.req.param('id'));return {...blockerDetails(await taskStore().get(id)),projectId:(await projectStore().forTask(id))?.id??null};}),
    route('/company/blockers/:id/remediate','POST',c=>remediateTask(z.string().uuid().parse(c.req.param('id')))),
  ];
}
