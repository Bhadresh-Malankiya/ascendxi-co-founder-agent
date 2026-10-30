import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { KnowledgeStore } from '../../src/mastra/company/knowledge-store';
const url = process.env.TEST_DATABASE_URL;
test(
  'knowledge revisions preserve published facts, reject stale writes and publish only exact drafts',
  { skip: !url },
  async () => {
    const pool = new Pool({ connectionString: url }),
      store = new KnowledgeStore(pool),
      slug = 'test-' + randomUUID();
    const input = {
      slug,
      title: 'Test company knowledge',
      product: 'AscendXI' as const,
      content: 'A sourced, reviewed company statement.',
      sources: [{ kind: 'founder' as const, reference: 'Test founder record' }],
      expectedVersion: 0,
    };
    try {
      const first = await store.put(input);
      assert.equal(first.status, 'draft');
      assert.equal((await store.search(slug)).length, 0);
      const published = await store.publish(slug, 1);
      assert.equal(published.version, 2);
      assert.equal(published.status, 'verified');
      await store.put({
        ...input,
        expectedVersion: 2,
        content: 'A proposed update with new evidence.',
      });
      assert.equal(
        (await store.search('sourced, reviewed')).find((k) => k.slug === slug)?.version,
        2,
      );
      assert.equal((await store.get(slug)).version, 3);
      const writes = await Promise.allSettled([
        store.put({ ...input, expectedVersion: 3 }),
        store.put({ ...input, expectedVersion: 3 }),
      ]);
      assert.equal(writes.filter((r) => r.status === 'fulfilled').length, 1);
      await assert.rejects(store.publish(slug, 3), /version conflict/);
      assert.equal((await store.history(slug)).length, 4);
      assert.equal((await store.get(slug, 1)).content, input.content);
    } finally {
      await pool.query('DELETE FROM ascendxi_knowledge_revisions WHERE slug=$1', [slug]);
      await pool.query('DELETE FROM ascendxi_knowledge_documents WHERE slug=$1', [slug]);
      await pool.end();
    }
  },
);
