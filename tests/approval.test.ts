import test from 'node:test';
import assert from 'node:assert/strict';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { z } from 'zod';

test('native Mastra approval blocks execution when the model requests an external action', async () => {
  let executions = 0;
  const model = new MastraLanguageModelV2Mock({
    doGenerate: async () => ({
      content: [
        {
          type: 'tool-call',
          toolCallId: 'approval-test-call',
          toolName: 'external_action',
          input: '{}',
        },
      ],
      finishReason: 'tool-calls',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    }),
  });
  const subject = new Agent({
    id: 'approval-test',
    name: 'Approval test',
    instructions: 'Call the provided tool.',
    model,
    defaultOptions: { autoResumeSuspendedTools: false, maxSteps: 2 },
    tools: {
      external_action: createTool({
        id: 'external_action',
        description: 'Test external action',
        inputSchema: z.object({}),
        requireApproval: true,
        execute: async () => {
          executions++;
          return { changed: true };
        },
      }),
    },
  });
  const result = await subject.generate('Perform the action.');
  assert.equal(executions, 0);
  assert.ok(
    result.suspendPayload,
    'The runtime should return an approval suspension, not silently skip the action',
  );
});
