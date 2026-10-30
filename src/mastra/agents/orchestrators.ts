import { agentModel } from '../company/model-policy';
import { improvementTools } from '../tools/improvement-tools';
import { knowledgeReadTools } from '../tools/knowledge-tools';
import { clientPipelineTool, clientStageTaskTool } from '../tools/client-tools';
import { Agent } from '@mastra/core/agent';
import { companyInstructions } from '../company/catalog';
import { specialistAgents } from './departments';

const groups = {
  delivery: ['product', 'engineering', 'operations', 'security', 'quality'],
  commercial: ['growth', 'sales', 'customer', 'finance', 'quality'],
} as const;
export const orchestratorAgents = Object.fromEntries(
  Object.entries(groups).map(([id, members]) => [
    id,
    new Agent({
      id,
      name: `AscendXI ${id} orchestrator`,
      description: `Coordinate ${members.join(', ')}. Resolve dependencies and return a consolidated, evidence-based handoff.`,
      instructions: `${companyInstructions}\nCoordinate these advisory departments: ${members.join(', ')}. Delegate bounded, specific questions. Collect reports, resolve contradictions, and return dependencies, deliverables, evidence and blockers. You cannot perform external actions or approve decisions.`,
      model: () => agentModel(id),
      tools: {
        ...improvementTools,
        ...knowledgeReadTools,
        client_pipeline: clientPipelineTool,
        client_stage_assignment: clientStageTaskTool,
      },
      agents: Object.fromEntries(
        members.map((member) => [member, specialistAgents[member]!]),
      ),
      defaultOptions: { maxSteps: 12, autoResumeSuspendedTools: false, providerOptions:{openrouter:{reasoning:{effort:"none"}}} },
    }),
  ]),
);
