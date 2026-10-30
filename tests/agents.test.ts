import { z } from 'zod';
import test from 'node:test';
import assert from 'node:assert/strict';
import { agent } from '../src/mastra/agents/agent';
import { teamAgents } from '../src/mastra/agents/team';
import {
  decideCompanyTaskTool,
  recoverCompanyTaskTool,
} from '../src/mastra/tools/company-tools';
import {
  startScheduleTool,
  stopScheduleTool,
} from '../src/mastra/tools/schedule-tools';

test('lean co-founder registry retains independent review and approval gates', async () => {
  assert.equal(agent.id, 'agent');
  assert.deepEqual(Object.keys(await agent.listAgents()).sort(), Object.keys(teamAgents).sort());
  assert.equal(Object.keys(teamAgents).length, 5);
  const supportTools = await teamAgents.growth!.listTools();
  assert.equal('plan_approve' in supportTools, false);
  assert.equal(Object.keys(supportTools).some(id => /git|workspace.*(write|exec)/.test(id)), false);
  assert.equal(Object.keys(await teamAgents.quality!.listAgents()).length, 0);
  for (const tool of [
    decideCompanyTaskTool,
    recoverCompanyTaskTool,
    startScheduleTool,
    stopScheduleTool,
  ]) {
    assert.equal(tool.requireApproval, true);
  }
});

// Model providers reject union-root function parameters even when local Zod parsing succeeds.
test('all co-founder tool parameter schemas have a model-compatible object root', async () => {
  const tools = await agent.listTools();
  for (const [id, tool] of Object.entries(tools)) {
    if (!tool.inputSchema) continue;
    const schema = z.toJSONSchema(tool.inputSchema as z.ZodType, {
      io: 'input',
    }) as { type?: string };
    assert.equal(schema.type, 'object', id + ' must have an object root');
  }
});
