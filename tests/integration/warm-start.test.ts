import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { ProjectStore, projectStore, closeProjectStore } from '../../src/mastra/company/project-store';
import { TaskStore, closeTaskStore } from '../../src/mastra/company/task-store';
import { closePlanningStore } from '../../src/mastra/company/planning-store';
import { closeKnowledgeStore } from '../../src/mastra/company/knowledge-store';
import { closeEventStore } from '../../src/mastra/company/event-store';

test('warm store startup does not request exclusive schema locks against live project/task readers',
  { skip: !process.env.TEST_DATABASE_URL }, async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL,
      options: '-c statement_timeout=1500' });
    let reader;
    try {
      await projectStore().init();
      reader = await pool.connect();
      await reader.query('BEGIN');
      // Hold ordinary reader locks until initialization finishes. An unnecessary
      // ALTER would block here and fail the server-side statement deadline.
      await reader.query('SELECT p.id,s.key,t.id FROM ascendxi_projects p LEFT JOIN ascendxi_project_steps s ON s.project_id=p.id LEFT JOIN ascendxi_tasks t ON t.id=s.task_id LIMIT 1');
      await new ProjectStore(pool).init();
      assert.ok(Array.isArray(await new TaskStore(pool).list(1)));
    } finally {
      if (reader) { await reader.query('ROLLBACK'); reader.release(); }
      await pool.end();
      await closeProjectStore(); await closePlanningStore(); await closeTaskStore();
      await closeKnowledgeStore(); await closeEventStore();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
