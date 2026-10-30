import { Agent } from '@mastra/core/agent';
import { companyInstructions } from '../company/catalog';
import { agentModel } from '../company/model-policy';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { operationsStore } from '../company/operations-store';
export const operationsMonitor = new Agent({
  id: 'operations-monitor',
  name: 'Operations Monitor',
  model: () => agentModel('operations-monitor'),
  instructions:
    companyInstructions +
    '\nYour only role: inspect observed health, blocked/stalled work and approval notices. Explain a bounded next action. The deterministic monitor checks health without paid model calls. Never auto-retry tasks, grant access, create more agents or approve your own requests. Maturity is a transparent observed score, never a claim of production capability.',
  tools: {
    inspect_health: createTool({
      id: 'inspect_health',
      description:
        'Run deterministic health checks and persist actionable notifications; uses no model calls.',
      inputSchema: z.object({}),
      execute: () => operationsStore().monitor(),
    }),
  },
  defaultOptions: { maxSteps: 3, autoResumeSuspendedTools: false, providerOptions:{openrouter:{reasoning:{effort:"none"}}} },
});
