import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createClientStageAssignment, lifecycle } from '../../src/mastra/company/client-lifecycle';
import { clientStore, closeClientStore } from '../../src/mastra/company/client-store';
import { closeKnowledgeStore } from '../../src/mastra/company/knowledge-store';
import { closeTaskStore } from '../../src/mastra/company/task-store';
const url = process.env.TEST_DATABASE_URL;
test(
  'client stage assignments persist one specialist handoff and reuse current-stage work',
  { skip: !url },
  async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url;
    const key = 'test-' + randomUUID(),
      pool = new Pool({ connectionString: url });
    try {
      await clientStore().createLead({
        key,
        company: 'Lifecycle test',
        need: 'A scoped agent operating workflow',
        source: 'Local integration fixture only',
        product: 'AscendXI',
      });
      const first = await createClientStageAssignment(key),
        replay = await createClientStageAssignment(key);
      assert.equal(first.id, replay.id);
      assert.equal(first.specialist, 'lead-researcher');
      assert.equal(first.client_key, key);
      assert.equal(first.goal_key, 'client-lifecycle');
      await clientStore().advance(key, 'research', 'qualified', 'Fixture business source reviewed');
      const next = await createClientStageAssignment(key);
      assert.notEqual(next.id, first.id);
      assert.equal(next.specialist, 'outreach-writer');
      assert.equal(next.department, 'growth');
      assert.equal(next.status, 'queued');
      assert.equal(Object.keys(lifecycle).length, 11);
    } finally {
      await pool.query('DELETE FROM ascendxi_tasks WHERE client_key=$1', [key]);
      await pool.query('DELETE FROM ascendxi_opportunities WHERE key=$1', [key]);
      await pool.end();
      await closeTaskStore();
      await closeClientStore();
      await closeKnowledgeStore();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  },
);
