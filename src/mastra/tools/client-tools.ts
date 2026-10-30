import { createClientStageAssignment } from '../company/client-lifecycle';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  clientStore,
  leadInput,
  resourceInput,
  estimateInput,
  stages,
} from '../company/client-store';
export const clientPipelineTool = createTool({
  id: 'client_pipeline',
  description:
    'Inspect sourced opportunities, actual saved pipeline stages and resource assumptions. A stage is not proof that a message was sent or meeting booked.',
  inputSchema: z.object({}),
  execute: async () => ({
    opportunities: await clientStore().opportunities(),
    resources: await clientStore().resources(),
    estimates: await clientStore().estimates(),
  }),
});
export const proposeLeadTool = createTool({
  id: 'lead_propose',
  description:
    'Save an evidence-backed lead in research state. Must cite a real source. Does not send outreach or imply the contact consented.',
  inputSchema: leadInput,
  execute: async (input) => clientStore().createLead(input),
});
export const advanceClientTool = createTool({
  id: 'client_advance',
  description:
    'Requires approval of the exact pipeline transition and evidence. Never claim external communication occurred without its provider receipt.',
  requireApproval: true,
  inputSchema: z.object({
    key: z.string(),
    expectedStage: z.enum(stages),
    nextStage: z.enum(stages),
    evidence: z.string().min(10).max(4000),
  }),
  execute: async (d) => clientStore().advance(d.key, d.expectedStage, d.nextStage, d.evidence),
});
export const proposeResourceTool = createTool({
  id: 'resource_propose',
  description:
    'Save proposed resource capacity/rates with a source. Proposed figures are not verified availability. Updates require the current version.',
  inputSchema: resourceInput,
  execute: async (d) => clientStore().saveResource(d),
});
export const verifyResourceTool = createTool({
  id: 'resource_verify',
  description:
    'Requires human approval of the exact resource revision and capacity evidence. Registered AI agents do not imply measured throughput.',
  requireApproval: true,
  inputSchema: z.object({ key: z.string(), expectedVersion: z.number().int().min(1) }),
  execute: async (d) => clientStore().verifyResource(d.key, d.expectedVersion),
});
export const estimateClientTool = createTool({
  id: 'client_estimate',
  description:
    'Calculate and persist effort/cost/duration ranges from explicit scoped work and verified resource inputs. Missing, stale or mixed-currency inputs produce blockers. Does not reserve resources or issue a client quote.',
  inputSchema: estimateInput,
  execute: async (d) => clientStore().estimate(d),
});
export const clientStageTaskTool = createTool({
  id: 'client_stage_assignment',
  description:
    'Create or reuse the current client-stage assignment with one specialist owner, sourced context and handoff acceptance criteria. No message is sent or stage advanced.',
  inputSchema: z.object({ key: z.string().min(3).max(120) }),
  execute: async (d) => createClientStageAssignment(d.key),
});
export const clientTools = {
  client_stage_assignment: clientStageTaskTool,
  client_pipeline: clientPipelineTool,
  lead_propose: proposeLeadTool,
  client_advance: advanceClientTool,
  resource_propose: proposeResourceTool,
  resource_verify: verifyResourceTool,
  client_estimate: estimateClientTool,
};
