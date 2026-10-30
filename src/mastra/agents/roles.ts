import { agentModel } from '../company/model-policy';
import { improvementTools } from '../tools/improvement-tools';
import { artifactReadTools } from '../tools/artifact-tools';
import {
  clientPipelineTool,
  proposeLeadTool,
  estimateClientTool,
  proposeResourceTool,
} from '../tools/client-tools';
import { projectTools } from '../tools/project-tools';
import { roleTools } from '../company/connections';
import { workspace } from '../company/workspace';
import { webSearchTool } from '../tools/web-search';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { companyInstructions, roleCatalog } from '../company/catalog';
import { knowledgeReadTools } from '../tools/knowledge-tools';

export const roleAgents = Object.fromEntries(
  Object.entries(roleCatalog).map(([id, role]) => [
    id,
    new Agent({
      id,
      name: 'AscendXI ' + role.name,
      description: role.mandate,
      instructions:
        companyInstructions +
        '\nYour single responsibility: ' +
        role.mandate +
        '\nReport to the ' +
        role.department +
        ' department lead. Return the specific artifact, evidence, blockers and receiving role. Do not take over other responsibilities. You have company knowledge tools; external execution requires an explicitly granted action tool and approval.',
      model: () => agentModel(id),
      ...([
        'ai-agent-specialist',
        'backend-developer',
        'frontend-developer',
        'ui-designer',
        'devops-engineer',
      ].includes(id)
        ? { workspace }
        : {}),
      tools: async (context) => ({
        ...(await roleTools(id)(context)),
        ...knowledgeReadTools,
        ...improvementTools,
        ...artifactReadTools,
        project_overview: projectTools.project_overview,
        project_conversation: projectTools.project_conversation,
        ...([
          'account-executive',
          'delivery-manager',
          'meeting-coordinator',
        ].includes(id)
          ? { communication_propose: projectTools.communication_propose }
          : {}),
        ...(['lead-researcher', 'ux-researcher'].includes(id)
          ? { web_search: webSearchTool }
          : {}),
        ...(['lead-researcher', 'account-executive'].includes(id)
          ? {
              client_pipeline: clientPipelineTool,
              lead_propose: proposeLeadTool,
            }
          : {}),
        ...(['estimator', 'resource-planner'].includes(id)
          ? {
              client_pipeline: clientPipelineTool,
              client_estimate: estimateClientTool,
              resource_propose: proposeResourceTool,
            }
          : {}),
      }),
      defaultOptions: { maxSteps: 6, autoResumeSuspendedTools: false, providerOptions:{openrouter:{reasoning:{effort:"none"}}} },
      memory: new Memory({ options: { generateTitle: true } }),
    }),
  ]),
);
