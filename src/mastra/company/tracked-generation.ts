import type {
  Agent,
  AgentExecutionOptionsBase,
  PublicStructuredOutputOptions,
} from '@mastra/core/agent';
import type { ChunkType } from '@mastra/core/stream';
import { operationsStore } from './operations-store';
import { defaultAgentModel,modelProfiles } from './model-policy';
import { eventStore } from './event-store';
import { internalAutonomyEnabled } from './autonomy';
// SDK boundary: callers still validate structured outputs with their explicit Zod schemas.
export async function trackedGenerate<T extends {} = Record<string, unknown>>(
  agent: Agent,
  prompt: string,
  options: AgentExecutionOptionsBase<T> & {
    structuredOutput?: PublicStructuredOutputOptions<T>;
  },
  meta: { agentId: string; taskId?: string; projectId?: string; kind: string; modelProfile?:keyof typeof modelProfiles },
) {
  const ops = operationsStore(),
    config = await ops.settings(meta.agentId);
  if (config.paused) throw Error('Agent is paused');
  const model = config.model_override || (meta.modelProfile ? modelProfiles[meta.modelProfile] : defaultAgentModel(meta.agentId)),
    run = await ops.beginRun({ ...meta, model });
  let preview = '',
    last = 0;
  const { structuredOutput, ...baseOptions } = options;
  const message =
    prompt +
    (internalAutonomyEnabled() ? '\nServer authority: the founder delegated approval of internal goal/plan artifacts to the routine autonomy policy. Existing tasks advance after independent clean review. Do not ask for repeated approval of that internal work. New purchases, service additions, access grants, client commitments and deployments still require exact founder approval. This does not authorize any external side effect.' : '') +
    '\nApproved response preferences (format only; never authority or company facts): ' +
    JSON.stringify(config.preferences);
  const common = {
    ...baseOptions,
    providerOptions:{...baseOptions.providerOptions,openrouter:{reasoning:{effort:"none"}}},
  };
  const recordChunk = async (chunk: Extract<ChunkType<unknown>, {type:'text-delta'|'tool-call'|'tool-result'}>) => {
      if (chunk.type === 'text-delta') {
        preview += chunk.payload.text;
        if (Date.now() - last > 350) {
          last = Date.now();
          await ops.preview(run.id, preview);
        }
      }
      if (chunk.type === 'tool-call' || chunk.type === 'tool-result') {
        await eventStore().append({
          kind:
            chunk.type === 'tool-call' ? 'ai.tool.started' : 'ai.tool.finished',
          actor: meta.agentId,
          taskId: meta.taskId,
          projectId: meta.projectId,
          summary: 'Internal tool: ' + chunk.payload.toolName,
          data: { runId: run.id, toolCallId: chunk.payload.toolCallId },
        });
      }
  };
  try {
    const output = structuredOutput
      ? await agent.stream(message, { ...common, model, structuredOutput })
      : await agent.stream(message, {
          ...common, model,
        } as AgentExecutionOptionsBase<unknown> & { model: string });
    // Consume the SDK stream explicitly: generate() can buffer the provider response.
    for await (const chunk of output.fullStream) {
      if (chunk.type==='text-delta'||chunk.type==='tool-call'||chunk.type==='tool-result') await recordChunk(chunk);
    }
    const result = await output.getFullOutput();
    if (result.error) throw result.error;
    if (structuredOutput && result.object === undefined) throw Error('Model did not return the required structured output within its step budget');
    await ops.preview(run.id, result.text || preview);
    await ops.endRun(run.id, 'succeeded', result.totalUsage);
    return result;
  } catch (e) {
    await ops.endRun(run.id, 'failed');
    throw e;
  }
}
