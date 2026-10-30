import test from 'node:test';
import assert from 'node:assert/strict';
import type { Mastra } from '@mastra/core/mastra';
import { verifyServices, closeMonitoringStore } from '../../src/mastra/company/monitoring';
const url = process.env.TEST_DATABASE_URL;
test(
  'service monitoring skips approval-gated tools and stores no provider payload',
  { skip: !url },
  async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url;
    let forbiddenCalls = 0;
    const mastra = {
      getAgent: () => ({
        listTools: async () => ({
          google_calendar_get_colors: {
            requireApproval: true,
            execute: () => {
              forbiddenCalls++;
            },
          },
          google_drive_get_about: { execute: async () => ({ user: { private: 'do-not-store' } }) },
          google_mail_list_labels: {
            execute: async () => {
              throw new Error('do-not-store-provider-error');
            },
          },
        }),
      }),
    } as unknown as Mastra;
    try {
      const results = await verifyServices(mastra);
      assert.equal(forbiddenCalls, 0);
      assert.deepEqual(
        results.map((r) => r.status),
        ['approval required', 'verified', 'failed', 'unavailable'],
      );
      assert.doesNotMatch(JSON.stringify(results), /do-not-store/);
    } finally {
      await closeMonitoringStore();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  },
);
