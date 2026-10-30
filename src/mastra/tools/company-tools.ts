import {knowledgeStore} from '../company/knowledge-store';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { departmentIds, products } from '../company/catalog';
import { taskInput, taskStore } from '../company/task-store';

export const companyStatusTool = createTool({
  id: 'company_status',
  description:
    'Inspect known company scope and durable active tasks. This does not verify external integration connectivity.',
  inputSchema: z.object({
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  execute: async ({ limit, offset }) => {
    const tasks = await taskStore().list(limit, offset);
    return {
      products,
      departments: departmentIds,
      tasks,
      offset,
      nextOffset: tasks.length === limit ? offset + limit : null,
    };
  },
});
export const createCompanyTaskTool = createTool({
  id: 'create_company_task',
  description:
    'Persist a scoped assignment. Use a stable idempotency key and precise acceptance criteria. No external actions happen here.',
  inputSchema: taskInput.extend({goal_key:z.string().min(1).max(120)}),
  execute: async (input) => {
    if(!(await knowledgeStore().goals()).some(g=>g.key===input.goal_key&&g.status==='active'))throw Error('Select an active founder-approved goal; propose new goals for review first');
    return taskStore().create(input);
  },
});
export const runCompanyTaskTool = createTool({
  id: 'run_company_task',
  description:
    'Run a queued assignment through its department specialist and independent quality review. Generates advisory artifacts, not external actions.',
  inputSchema: z.object({ taskId: z.string().uuid() }),
  execute: async (input, { mastra }) => {
    const run = await mastra!.getWorkflow('companyTaskWorkflow').createRun();
    return run.start({ inputData: input });
  },
});
export const decideCompanyTaskTool = createTool({
  id: 'decide_company_task',
  description:
    'Requires human approval: accept a reviewed deliverable as complete, or requeue blocked/review work with an explanation. Never substitute for approval of external actions.',
  requireApproval: true,
  inputSchema: z.object({
    taskId: z.string().uuid(),
    decision: z.enum(['complete', 'retry']),
    evidence: z.string().min(10).max(4000),
  }),
  execute: async ({ taskId, decision, evidence }) => taskStore().decide(taskId, decision, evidence),
});
export const recoverCompanyTaskTool = createTool({
  id: 'recover_company_task',
  description:
    'Requires human approval: mark a stranded running task blocked after confirming no worker still owns it. Review before retry.',
  requireApproval: true,
  inputSchema: z.object({ taskId: z.string().uuid(), evidence: z.string().min(10).max(4000) }),
  execute: async ({ taskId, evidence }) => {
    await taskStore().recover(taskId, evidence);
    return { taskId, status: 'blocked' };
  },
});
export const inspectCompanyTaskTool = createTool({
  id: 'inspect_company_task',
  description:
    'Inspect a saved assignment, including its report, review and completion evidence, by task ID.',
  inputSchema: z.object({ taskId: z.string().uuid() }),
  execute: async ({ taskId }) => taskStore().get(taskId),
});
export const companyTools = {
  company_status: companyStatusTool,
  create_company_task: createCompanyTaskTool,
  run_company_task: runCompanyTaskTool,
  decide_company_task: decideCompanyTaskTool,
  recover_company_task: recoverCompanyTaskTool,
  inspect_company_task: inspectCompanyTaskTool,
};
