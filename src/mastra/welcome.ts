import { randomUUID } from 'node:crypto';
import type { Mastra } from '@mastra/core/mastra';
import { agentName, connectTools } from './agents/agent';
import { integrationIdForToolKey } from './workflows/activity-digest';

/** Studio scopes an agent's threads to its registered id. */
const AGENT_ID = 'agent';

/**
 * On the very first boot (no threads in storage yet), the agent opens the
 * conversation itself: it composes its own greeting from its live system
 * prompt and its actual configured tools, seeds a "Welcome" thread, and
 * writes the message as its first turn.
 */
export async function seedWelcomeThread(mastra: Mastra) {
  const agent = mastra.getAgent(AGENT_ID);
  const memory = await agent.getMemory();
  if (!memory) return;

  const { total } = await memory.listThreads({ filter: { resourceId: AGENT_ID }, perPage: 1 });
  if (total > 0) return;

  const text = staticWelcome(await listIntegrations(mastra));
  const thread = await memory.createThread({ resourceId: AGENT_ID, title: '👋 Welcome' });
  await memory.saveMessages({
    messages: [
      {
        id: randomUUID(),
        threadId: thread.id,
        resourceId: AGENT_ID,
        role: 'assistant',
        type: 'text',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text }], content: text },
      },
    ],
  });
  mastra.getLogger()?.info('Seeded welcome thread with the agent’s first message');
}

async function listIntegrations(mastra: Mastra): Promise<string[]> {
  if (!connectTools) return [];
  try {
    const tools = await connectTools({ mastra });
    return [...new Set(Object.keys(tools).map(integrationIdForToolKey))].sort();
  } catch {
    return [];
  }
}

function staticWelcome(integrations: string[]): string {
  const integrationLine = integrations.length
    ? `The resolver currently exposes tools for these integrations (service connectivity has not been verified): ${integrations.map(id => `**${id}**`).join(', ')}.`
    : 'No integrations are attached yet — attach some to your Mastra platform project and set `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PROJECT_ID` to unlock their tools live.';

  return `👋 Hi, I'm **${agentName}**.

I coordinate nine departments and two department orchestrators across AscendXI, VocalXI, HelpXI and JewelXI. I can persist assignments, prepare deliverables, independently review them and surface blockers. External changes, file writes, commands and schedule changes require approval. Running work interrupted by a restart requires operator recovery; stored reports and task states persist.

${integrationLine}

My system prompt lives in Studio — open **Agents → ${agentName}** to edit it. Your changes save to files under \`./mastra/editor\` and version with the project.

What should we try first?`;
}
