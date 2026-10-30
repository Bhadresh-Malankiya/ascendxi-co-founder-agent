import { connectorTools } from '../tools/connector-tools';
import { agentModel } from '../company/model-policy';
import { improvementTools } from '../tools/improvement-tools';
import { artifactReadTools } from '../tools/artifact-tools';
import { projectTools } from '../tools/project-tools';
import { workspace } from '../company/workspace';
import { Agent } from '@mastra/core/agent';
import { TaskSignalProvider } from '@mastra/core/signals';
import { askUserTool, webFetchTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { startScheduleTool, stopScheduleTool } from '../tools/schedule-tools';
import { webSearchTool } from '../tools/web-search';
import { companyInstructions } from '../company/catalog';
import { clientTools } from '../tools/client-tools';
import { knowledgeTools } from '../tools/knowledge-tools';
import { companyTools } from '../tools/company-tools';
import { teamAgents } from './team';
import { planningTools } from '../tools/planning-tools';
import { hasConnectEnv, connectTools } from '../company/connections';
export { hasConnectEnv, connectTools } from '../company/connections';

/**
 * The agent's display name in Studio and in its own replies. Mastra platform
 * sets AGENT_NAME from the name chosen during onboarding; set it yourself
 * elsewhere. The agent id stays 'agent', so renaming never orphans threads or
 * channel connections.
 */
export const agentName =
  process.env.AGENT_NAME?.trim() || 'AscendXI AI Co-Founder';

export const agent = new Agent({
  id: 'agent',
  name: agentName,
  description:
    'AscendXI operating co-founder: coordinate departments, persist assignments, review evidence and escalate consequential actions.',
  metadata: {
    suggestedPrompts: [
      'Review company status and propose the highest priority assignments.',
      'Create an engineering assignment for VocalXI with clear acceptance criteria.',
      'Identify blocked tasks and recommend the next decision.',
    ],
  },
  instructions: companyInstructions,
  agents: teamAgents,
  model: () => agentModel('agent'),
  defaultOptions: {
    maxSteps: 25,
    autoResumeSuspendedTools: false,
        providerOptions: {openrouter:{reasoning:{effort:"none"}}},
  },
  memory: new Memory({
    options: {
      generateTitle: false,
      lastMessages: 10,
    },
  }),
  workspace,
  tools: async ({ requestContext, mastra }) => ({
    ...companyTools,
      ...connectorTools,
    ...planningTools,
    ...improvementTools,
    ...projectTools,
    ...artifactReadTools,
    ...knowledgeTools,
    ...clientTools,
    ask_user: askUserTool,
    start_schedule: startScheduleTool,
    stop_schedule: stopScheduleTool,
    web_fetch: webFetchTool,
    web_search: webSearchTool,
    ...(connectTools ? await connectTools({ requestContext, mastra }) : {}),
  }),
  signals: [new TaskSignalProvider()],
});
