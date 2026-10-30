import {closePlanningStore} from '../../src/mastra/company/planning-store';
import {operationsStore,closeOperationsStore} from '../../src/mastra/company/operations-store';
import {closeProjectStore}from'../../src/mastra/company/project-store';
import {closeEventStore}from'../../src/mastra/company/event-store';
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Mastra } from '@mastra/core/mastra';
import { PostgresStore } from '@mastra/pg';
import { specialistAgents } from '../../src/mastra/agents/departments';
import { companyTaskWorkflow } from '../../src/mastra/workflows/company-task';
import { closeKnowledgeStore } from '../../src/mastra/company/knowledge-store';
import { taskStore, closeTaskStore } from '../../src/mastra/company/task-store';

const url = process.env.TEST_DATABASE_URL;
test(
  'workflow routes, reviews, persists, replays and blocks failures with actual Postgres and deterministic model doubles',
  { skip: !url },
  async () => {
    const previousUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url;
    const storage = new PostgresStore({ id: 'test-storage', connectionString: url! });
    const mastra = new Mastra({
      agents: specialistAgents,
      workflows: { companyTaskWorkflow },
      storage,
    });
    const store = taskStore();
    const streamed = (object: unknown) => ({
      fullStream: new ReadableStream({start(controller){controller.enqueue({type:'text-delta',payload:{text:JSON.stringify(object)}});controller.close();}}),
      getFullOutput: async () => ({object,text:JSON.stringify(object),totalUsage:{inputTokens:10,outputTokens:10}}),
    });
    const department = mock.method(specialistAgents.engineering!, 'stream', async () => streamed({
        deliverable: 'Specification',
        evidence: ['provided requirement'],
        blockers: [],
        limitations: ['A specification is not proof of deployed client behavior.'],
        nextAction: 'Founder review',
    }));
    const quality = mock.method(specialistAgents.quality!, 'stream', async () => streamed({ accepted: true, findings: [] as string[], evidenceGaps: [] as string[],limitations:['Future product launch is outside this specification scope.'] }));
    const create = () =>
      store.create({
        key: randomUUID(),
        title: 'Specification',
        objective: 'Write a specification only',
        product: 'AscendXI',
        department: 'engineering',
        acceptance: ['Include requirements'],
      });
    const run = async (taskId: string) =>
      (await mastra.getWorkflow('companyTaskWorkflow').createRun()).start({
        inputData: { taskId },
      });
    try {
      const good = await create();
      assert.equal((await run(good.id)).status, 'success');
      assert.equal((await store.get(good.id)).status, 'review');
      assert.equal(department.mock.callCount(), 1);
      assert.equal(quality.mock.callCount(), 1);
      await run(good.id);
      assert.equal(department.mock.callCount(), 1);
      assert.equal((await store.get(good.id)).attempts, 1);
      quality.mock.mockImplementation(async () => streamed({
          accepted: false,
          findings: ['Missing criterion'],
          evidenceGaps: ['Missing proof'],
      }));
      const rejected = await create();
      await run(rejected.id);
      assert.equal((await store.get(rejected.id)).status, 'blocked');
      department.mock.mockImplementation(async () => {
        throw new Error('private-provider-error');
      });
      const failure = await create();
      await run(failure.id);
      const failed = await store.get(failure.id);
      assert.equal(failed.status, 'blocked');
      assert.doesNotMatch(JSON.stringify(failed.report), /private-provider-error/);
      department.mock.mockImplementation(async()=>streamed(undefined));
      const noOutput=await create();await run(noOutput.id);
      assert.equal((await store.get(noOutput.id)).status,'blocked');
      const recorded=(await operationsStore().pool.query('SELECT status FROM ascendxi_runs WHERE task_id=$1',[noOutput.id])).rows;
      assert.ok(recorded.length>0&&recorded.every(r=>r.status==='failed'),'a tool-only run is not recorded as successful structured work');
    } finally {
      await closePlanningStore();
      mock.restoreAll();
      await closeOperationsStore();
      await closeProjectStore();
    await closeEventStore();
    await closeTaskStore();
      await closeKnowledgeStore();
      await storage.close();
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
    }
  },
);
