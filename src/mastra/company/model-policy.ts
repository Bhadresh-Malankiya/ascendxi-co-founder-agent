import { operationsStore } from './operations-store';
export const modelProfiles = {
  routine: 'mastra/openai/gpt-6-luna',
  complex: 'mastra/openai/gpt-6-sol',
} as const;
export const modelRoles: Record<string, keyof typeof modelProfiles> = {
  agent: 'complex',
  delivery: 'complex',
  commercial: 'complex',
  engineering: 'complex',
  security: 'complex',
  quality: 'complex',
  finance: 'complex',
  product: 'complex',
  'ai-agent-specialist': 'complex',
  'backend-developer': 'complex',
  'frontend-developer': 'complex',
  'devops-engineer': 'complex',
  'qa-engineer': 'complex',
  'ui-designer': 'complex',
  'product-manager': 'complex',
  'ux-researcher': 'complex',
  'account-executive': 'complex',
  estimator: 'complex',
};
export function defaultAgentModel(id: string) {
  return modelProfiles[modelRoles[id] ?? 'routine'];
}
export async function agentModel(id: string) {
  return (
    (await operationsStore().settings(id)).model_override ||
    defaultAgentModel(id)
  );
}
