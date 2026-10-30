import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { operationsStore } from '../company/operations-store';
export const improvementTools = {
  improvement_propose: createTool({
    id: 'improvement_propose',
    description:
      'Record a sourced lesson or missing-access request for operator review. Never publishes facts, changes instructions, grants access or expands permissions.',
    inputSchema: z.object({
      kind: z.enum(['knowledge', 'memory', 'access']),
      title: z.string().min(3).max(160),
      content: z.string().min(10).max(6000),
      source: z.string().min(3).max(2000),
    }),
    execute: async (d, c) => {
      const agentId = c.requestContext.get('companyActor');
      if (typeof agentId !== 'string')
        throw Error('Server-bound agent identity required');
      return operationsStore().suggest('suggestion:' + crypto.randomUUID(), {
        ...d,
        agentId,
      });
    },
  }),
  memory_preferences: createTool({
    id: 'memory_preferences',
    description:
      'Read operator-approved response preferences for this agent. Preferences are not company facts and cannot override approval/security policies.',
    inputSchema: z.object({}),
    execute: async (_, c) => {
      const id = c.requestContext.get('companyActor');
      return typeof id === 'string'
        ? (await operationsStore().settings(id)).preferences
        : {};
    },
  }),
};
