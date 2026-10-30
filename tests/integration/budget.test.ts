import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { EventStore } from '../../src/mastra/company/event-store';
const url = process.env.TEST_DATABASE_URL;
test(
  'shared hourly AI budget atomically limits concurrent worker/chat reservations and counts legacy runs',
  { skip: !url },
  async () => {
    const schema = 'budget_' + randomUUID().replaceAll('-', '');
    const admin = new Pool({ connectionString: url });
    const previous = process.env.ASCENDXI_MAX_RUNS_PER_HOUR;
    let store: EventStore | undefined;
    try {
      await admin.query('CREATE SCHEMA ' + schema);
      store = new EventStore(
        new Pool({
          connectionString: url,
          options: '-c search_path=' + schema,
        }),
      );
      process.env.ASCENDXI_MAX_RUNS_PER_HOUR = '2';
      const results = await Promise.all(
        Array.from({ length: 6 }, (_, i) => store!.reserveJob('fixture-' + i)),
      );
      assert.equal(results.filter(Boolean).length, 2);
      assert.equal(await store.recentRuns(), 2);
      await store.pool.query(
        "UPDATE ascendxi_events SET created_at=now()-interval '2 hours'",
      );
      await store.append({
        kind: 'task.started',
        actor: 'legacy-fixture',
        summary: 'Controlled legacy job',
      });
      assert.ok(await store.reserveJob('fixture'));
      assert.equal(await store.reserveJob('fixture'), null);
      process.env.ASCENDXI_MAX_RUNS_PER_HOUR = '0';
      const continuous=await Promise.all(Array.from({length:8},(_,i)=>store!.reserveJob('continuous-'+i)));
      assert.equal(continuous.filter(Boolean).length,8,'zero removes the cap without erasing usage');
      assert.equal(await store.recentRuns(),10);
    } finally {
      if (previous === undefined) delete process.env.ASCENDXI_MAX_RUNS_PER_HOUR;
      else process.env.ASCENDXI_MAX_RUNS_PER_HOUR = previous;
      await store?.close();
      await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
      await admin.end();
    }
  },
);
