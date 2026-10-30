import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { TaskStore } from '../../src/mastra/company/task-store';

const url = process.env.TEST_DATABASE_URL;
test(
  'Postgres durable assignment lifecycle, concurrency, recovery and restart',
  { skip: !url },
  async () => {
    const pool = new Pool({ connectionString: url });
    const store = new TaskStore(pool);
    const input = {
      key: randomUUID(),
      title: 'Test deliverable',
      objective: 'Prepare a verified specification',
      product: 'VocalXI' as const,
      department: 'engineering',
      acceptance: ['Specification includes acceptance tests'],
    };
    try {
      const task = await store.create(input);
      assert.equal((await store.create(input)).id, task.id);
      await assert.rejects(
        store.create({ ...input, title: 'Different assignment' }),
        /different assignment/,
      );
      await assert.rejects(store.decide(task.id, 'complete', 'Cannot skip review'), /Invalid/);
      const claims = await Promise.allSettled([store.claim(task.id), store.claim(task.id)]);
      assert.equal(claims.filter((x) => x.status === 'fulfilled').length, 1);
      await store.recover(task.id, 'Worker confirmed stopped');
      assert.equal((await store.get(task.id)).status, 'blocked');
      await store.decide(task.id, 'retry', 'Recovery checked by operator');
      await store.claim(task.id);
      await assert.rejects(store.finish(task.id, 1, 'review', { stale: true }));
      await store.finish(task.id, 2, 'review', {
        report: { deliverable: 'Verified specification' },
      });
      const secondPool = new Pool({ connectionString: url });
      try {
        const restarted = new TaskStore(secondPool);
        assert.equal((await restarted.get(task.id)).status, 'review');
        assert.equal((await restarted.get(task.id)).attempts, 2);
        await restarted.decide(task.id, 'complete', 'Verified acceptance criteria and evidence');
        assert.equal((await restarted.get(task.id)).status, 'completed');
        await assert.rejects(restarted.claim(task.id));
        await assert.rejects(restarted.finish(task.id, 2, 'review', {}));
      } finally {
        await secondPool.end();
      }
      await pool.query('DELETE FROM ascendxi_tasks WHERE id=$1', [task.id]);
    } finally {
      await pool.end();
    }
  },
);
