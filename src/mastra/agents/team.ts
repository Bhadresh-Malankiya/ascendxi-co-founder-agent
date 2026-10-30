import { connectorTools } from '../tools/connector-tools';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { companyInstructions } from '../company/catalog';
import { team } from '../company/team';
import { agentModel } from '../company/model-policy';
import { departmentTools, roleTools } from '../company/connections';
import { knowledgeReadTools } from '../tools/knowledge-tools';
import { improvementTools } from '../tools/improvement-tools';
import { artifactReadTools } from '../tools/artifact-tools';
import { planningTools } from '../tools/planning-tools';
import { projectTools } from '../tools/project-tools';
import { workspace } from '../company/workspace';

export const teamAgents = Object.fromEntries(
  Object.entries(team).filter(([id]) => !['agent', 'operations-monitor'].includes(id)).map(([id, definition]) => [id, new Agent({
    id, name: 'AscendXI ' + definition.name, description: definition.scope,
    instructions: companyInstructions + '\nYour accountable responsibility: ' + definition.scope + '\nUse the capability profile in each assignment to focus on one deliverable at a time. You do not need to create another agent for another skill. Never accept your own work. Product owns both internal products and client services; growth owns customer communications and support. Quality independently reviews engineering and product evidence. If scoped acceptance needs an unavailable connector, use connection_request or return connectionNeeds with the service and exact purpose. The portal notifies the founder. Use connection_reads and connection_read only for this task and your own approved grants; never substitute another agent’s permissions. Verified connector evidence triggers reassessment, not automatic acceptance. Integration grants belong to your exact runtime identity; do not inherit retired role grants.',
    model: () => agentModel(id),
    ...(id === 'engineering' || id === 'ui-designer' ? { workspace } : {}),
    tools: async context => ({
      ...connectorTools, ...knowledgeReadTools, ...improvementTools, ...artifactReadTools, ...planningTools,
      project_overview: projectTools.project_overview,
      project_conversation: projectTools.project_conversation,
      ...(id === 'growth' ? { communication_propose: projectTools.communication_propose } : {}),
      ...(id === 'ui-designer' ? await roleTools(id)(context) : await departmentTools(id)(context)),
    }),
    defaultOptions: { maxSteps: 6, autoResumeSuspendedTools: false, providerOptions: { openrouter: { reasoning: { effort: 'none' } } } },
    memory: new Memory({ options: { generateTitle: false, lastMessages: 10 } }),
  })]),
);
