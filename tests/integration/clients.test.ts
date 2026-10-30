import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { ClientStore } from '../../src/mastra/company/client-store';
const url = process.env.TEST_DATABASE_URL;
test(
  'client pipeline and estimates persist with evidence, stage fencing and resource version checks',
  { skip: !url },
  async () => {
    const pool = new Pool({ connectionString: url }),
      store = new ClientStore(pool),
      key = 'test-' + randomUUID(),
      resourceKey = 'resource-' + randomUUID();
    const lead = {
      key,
      company: 'Test business',
      contactEmail: 'contact@example.com',
      need: 'An explicitly scoped agent workflow',
      source: 'Test business record',
      product: 'AscendXI' as const,
    };
    const resource = {
      key: resourceKey,
      name: 'Test resource',
      capabilities: ['agent engineering'],
      availableHoursPerWeek: 20,
      ratePerHour: 50,
      currency: 'USD',
      source: 'Test capacity record',
      expectedVersion: 0,
    };
    try {
      await store.createLead(lead);
      assert.equal((await store.createLead(lead)).key, key);
      await assert.rejects(
        store.createLead({ ...lead, need: 'A conflicting different business need' }),
        /different opportunity/,
      );
      await assert.rejects(
        store.advance(key, 'research', 'won', 'Cannot skip qualification'),
        /Invalid stage/,
      );
      const moved = await store.advance(
        key,
        'research',
        'qualified',
        'Verified requirement in cited test record',
      );
      assert.equal(moved.history.length, 1);
      await assert.rejects(
        store.advance(key, 'research', 'qualified', 'A stale stage change'),
        /Stage conflict/,
      );
      await assert.rejects(
        store.saveResource({ ...resource, expectedVersion: 4 }),
        /version conflict/,
      );
      await store.saveResource(resource);
      const estimateInput = {
        opportunityKey: key,
        items: [
          { resourceKey, scope: 'Implement an approved workflow', lowHours: 10, highHours: 20 },
        ],
      };
      assert.equal((await store.estimate(estimateInput)).report.status, 'blocked');
      await store.verifyResource(resourceKey, 1);
      const estimate = await store.estimate(estimateInput);
      assert.equal(estimate.report.status, 'draft');
      assert.equal(estimate.report.resourceSnapshot[0].version, 2);
      await store.saveResource({ ...resource, expectedVersion: 2, availableHoursPerWeek: 10 });
      assert.equal(
        (await store.estimates()).find((e) => e.id === estimate.id).report.resourceSnapshot[0]
          .availableHoursPerWeek,
        20,
      );
    } finally {
      await pool.query('DELETE FROM ascendxi_estimates WHERE opportunity_key=$1', [key]);
      await pool.query('DELETE FROM ascendxi_opportunities WHERE key=$1', [key]);
      await pool.query('DELETE FROM ascendxi_resources WHERE key=$1', [resourceKey]);
      await pool.end();
    }
  },
);
