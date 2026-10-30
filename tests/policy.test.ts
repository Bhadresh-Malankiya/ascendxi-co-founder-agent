import test from 'node:test';
import assert from 'node:assert/strict';
import { readToolAllowlist, requiresApproval } from '../src/mastra/company/policy';
import { departments, products, companyInstructions } from '../src/mastra/company/catalog';
import { taskInput } from '../src/mastra/company/task-store';

test('unknown tools fail closed, including deceptively named reads', () => {
  for (const tool of ['stripe_transfer', 'list_and_delete', 'get_customer', 'unknown']) {
    assert.equal(requiresApproval(tool, new Set()), true);
  }
  const reads = readToolAllowlist(' linear_list_issues,notion_search, ,linear_list_issues');
  assert.equal(reads.size, 2);
  assert.equal(requiresApproval('linear_list_issues', reads), false);
  assert.equal(requiresApproval('linear_list_issues_and_send', reads), true);
});
test('portfolio and departments are explicit and unverified facts stay unverified', () => {
  assert.equal(Object.keys(departments).length, 9);
  assert.deepEqual(products, ['AscendXI', 'VocalXI', 'HelpXI', 'JewelXI']);
  assert.match(companyInstructions, /NOT established facts/);
});
test('assignment validation rejects unowned and unbounded tasks', () => {
  const task = {
    key: 'test',
    title: 'Plan',
    objective: 'Prepare a plan',
    product: 'VocalXI',
    department: 'engineering',
    acceptance: ['Include test criteria'],
  };
  assert.equal(taskInput.safeParse(task).success, true);
  for (const bad of [
    { ...task, department: 'unknown' },
    { ...task, acceptance: [] },
    { ...task, product: 'Unknown' },
    { ...task, objective: '' },
  ]) {
    assert.equal(taskInput.safeParse(bad).success, false);
  }
});

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { guardConnectedTools } from '../src/mastra/company/policy';
test('Connect guard preserves real tools and upstream approval while denying conditional bypasses', () => {
  const tool = createTool({
    id: 'provider_unknown',
    description: 'test',
    inputSchema: z.object({}),
    requireApproval: () => false,
    execute: async () => 'ok',
  });
  const guarded = guardConnectedTools({ provider_unknown: tool });
  const result = guarded.provider_unknown as typeof tool;
  assert.equal(result.requireApproval, true);
  assert.equal(result.execute, tool.execute);
  assert.equal(Object.getPrototypeOf(result), Object.getPrototypeOf(tool));
  assert.equal(typeof tool.requireApproval, 'function');
  const upstream = createTool({
    id: 'provider_list',
    description: 'test',
    inputSchema: z.object({}),
    requireApproval: true,
    execute: async () => 'ok',
  });
  assert.equal(
    (
      guardConnectedTools({ provider_list: upstream }, new Set(['provider_list']))
        .provider_list as typeof upstream
    ).requireApproval,
    true,
  );
});

import { departmentToolGrants, roleToolGrants } from '../src/mastra/company/connections';
test('department grants reject unknown departments and invalid configuration', () => {
  assert.deepEqual(departmentToolGrants('{"engineering":["github_get_issue"]}'), {
    engineering: ['github_get_issue'],
  });
  for (const value of ['{"engneering":["write_all"]}', '{"sales":"*"}', 'not JSON', 'null']) {
    assert.throws(() => departmentToolGrants(value));
  }
});

test('role grants are exact and reject unknown role names', () => {
  assert.deepEqual(roleToolGrants('{"meeting-coordinator":["google_calendar_create_event"]}'), {
    'meeting-coordinator': ['google_calendar_create_event'],
  });
  assert.throws(() => roleToolGrants('{"all":["*"]}'));
});
