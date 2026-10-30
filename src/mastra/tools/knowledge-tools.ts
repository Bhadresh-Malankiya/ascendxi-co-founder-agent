import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { knowledgeInput, knowledgeStore } from '../company/knowledge-store';
import { ensureCompanyRecords } from '../company/bootstrap';

export const searchKnowledgeTool = createTool({
  id: 'knowledge_search',
  description:
    'Search sourced, verified company knowledge. Drafts are excluded. Review-due records are explicitly marked; never infer facts not in the sources.',
  inputSchema: z.object({ query: z.string().max(500).default('') }),
  execute: async ({ query }) => {
    await ensureCompanyRecords();
    return knowledgeStore().search(query);
  },
});
export const getKnowledgeTool = createTool({
  id: 'knowledge_get',
  description:
    'Inspect a company knowledge record and its revision history. Draft revisions are proposals, not authoritative facts.',
  inputSchema: z.object({ slug: z.string().min(1).max(120) }),
  execute: async ({ slug }) => {
    await ensureCompanyRecords();
    return {
      current: await knowledgeStore().get(slug),
      history: await knowledgeStore().history(slug),
    };
  },
});
export const proposeKnowledgeTool = createTool({
  id: 'knowledge_propose',
  description:
    'Save a sourced knowledge draft using the current expectedVersion (0 for a new document). Does not publish or verify a claim.',
  inputSchema: knowledgeInput,
  execute: async (input) => knowledgeStore().put(input),
});
export const publishKnowledgeTool = createTool({
  id: 'knowledge_publish',
  description:
    'Requires human approval: publish the exact reviewed draft revision as verified internal knowledge. Source accuracy must be checked first.',
  requireApproval: true,
  inputSchema: z.object({
    slug: z.string().min(1).max(120),
    expectedVersion: z.number().int().min(1),
  }),
  execute: async ({ slug, expectedVersion }) => knowledgeStore().publish(slug, expectedVersion),
});
export const knowledgeReadTools = {
  knowledge_search: searchKnowledgeTool,
  knowledge_get: getKnowledgeTool,
};
export const knowledgeTools = {
  ...knowledgeReadTools,
  knowledge_propose: proposeKnowledgeTool,
  knowledge_publish: publishKnowledgeTool,
};
