import { agentModel } from '../company/model-policy';
import { improvementTools } from '../tools/improvement-tools';
import { artifactReadTools } from '../tools/artifact-tools';
import { roleAgents } from './roles';
import { Agent } from '@mastra/core/agent';
import { knowledgeReadTools } from '../tools/knowledge-tools';
import { departmentTools } from '../company/connections';
import { Memory } from '@mastra/memory';
import {
  companyInstructions,
  departments,
  roleCatalog,
} from '../company/catalog';

export const specialistAgents = Object.fromEntries(
  Object.entries(departments).map(([id, mandate]) => [
    id,
    new Agent({
      id,
      name: `AscendXI ${id[0]!.toUpperCase()}${id.slice(1)}`,
      description: mandate,
      agents: Object.fromEntries(
        Object.entries(roleCatalog)
          .filter(([, role]) => role.department === id)
          .map(([key]) => [key, roleAgents[key]!]),
      ),
      instructions: `${companyInstructions}\nYour department mandate: ${mandate}\nYou are an advisory specialist. Return a concrete deliverable, evidence references, blockers and handoff. Only use explicitly granted integration tools and honor their approvals. Do not imply you executed actions unless tool results prove it. In artifact workflows external tools are disabled.`,
      model: () => agentModel(id),
      tools: async (context) => ({
        ...knowledgeReadTools,
        ...improvementTools,
        ...artifactReadTools,
        ...(await departmentTools(id)(context)),
      }),
      defaultOptions: { maxSteps: 8, autoResumeSuspendedTools: false, providerOptions:{openrouter:{reasoning:{effort:"none"}}} },
      memory: new Memory({ options: { generateTitle: true } }),
    }),
  ]),
);
