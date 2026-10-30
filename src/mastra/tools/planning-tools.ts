import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { planInput, planningStore } from '../company/planning-store';
export const planningTools = {
  company_plans: createTool({ id: 'company_plans', description: 'Inspect centralized proposed and approved scopes, milestones and budget assumptions. Only founder approval can activate a new goal.', inputSchema: z.object({ key: z.string().max(120).optional() }), execute: async ({key}) => key ? planningStore().inspect(key) : planningStore().list() }),
  plan_propose: createTool({ id: 'plan_propose', description: 'Propose or revise a versioned scope for founder review. A revision suspends execution until approved; never use this for busywork or silently change a running scope. Targets are assumptions until accepted. Does not grant access, spend or deploy.', inputSchema: planInput, execute: async (input,context) => planningStore().propose(input, String(context.requestContext?.get('companyActor')||'agent')) }),
};
