import {closeConnectorStore} from '../../src/mastra/company/connector-store';
import {agent} from '../../src/mastra/agents/agent';
import {planningStore,closePlanningStore} from '../../src/mastra/company/planning-store';
import {closeOperationsStore} from '../../src/mastra/company/operations-store';
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { Mastra } from '@mastra/core/mastra';
import { PostgresStore } from '@mastra/pg';
import {
  projectStore,
  closeProjectStore,
  deliverySteps,
} from '../../src/mastra/company/project-store';
import {
  clientStore,
  closeClientStore,
  stages,
} from '../../src/mastra/company/client-store';
import {
  eventStore,
  closeEventStore,
} from '../../src/mastra/company/event-store';
import { taskStore, closeTaskStore } from '../../src/mastra/company/task-store';
import {
  communicationStore,
  closeCommunicationStore,
} from '../../src/mastra/company/communications';
import { closeKnowledgeStore } from '../../src/mastra/company/knowledge-store';
import { teamAgents } from '../../src/mastra/agents/team';
import { companyTaskWorkflow } from '../../src/mastra/workflows/company-task';
import { companyTick } from '../../src/mastra/company/worker';
const url = process.env.TEST_DATABASE_URL;
test(
  'awarded project follows dependencies, journals actual outputs, accepts only chartered artifacts, sends once and captures replies',
  { skip: !url },
  async () => {
    const previous = process.env.DATABASE_URL,
      previousKey = process.env.MASTRA_GATEWAY_API_KEY;
    process.env.DATABASE_URL = url;
    delete process.env.MASTRA_GATEWAY_API_KEY;
    const pool = new Pool({ connectionString: url }),
      clientKey = 'ops-' + randomUUID(),
      store = projectStore(),
      journal = eventStore(),
      actions = communicationStore(),
      tasks = taskStore();
    let project: any;
    let internal: any;
    const storage = new PostgresStore({
      id: 'operations-test',
      connectionString: url!,
    });
    const mastra = new Mastra({
      agents: {agent,...teamAgents},
      workflows: { companyTaskWorkflow },
      storage,
    });
    const streamed = (object: unknown) => ({
      fullStream: new ReadableStream({start(controller){controller.enqueue({type:'text-delta',payload:{text:JSON.stringify(object)}});controller.close();}}),
      getFullOutput: async () => ({object,text:JSON.stringify(object),totalUsage:{inputTokens:10,outputTokens:10}}),
    });
    for (const agent of Object.values({
      ...teamAgents,
    }).filter((a) => a.id !== 'quality'))
      mock.method(agent, 'stream', async () => streamed({
          deliverable:
            'TEST FIXTURE: advisory artifact; no external implementation claimed.',
          evidence: ['Integration fixture acceptance evidence'],
          blockers: [],
          nextAction: 'Next project owner',
      }));
    mock.method(teamAgents.quality!, 'stream', async (prompt:any) => streamed(prompt.includes('Independently review against every acceptance criterion') ? { accepted: true, findings: [], evidenceGaps: [] } : {deliverable:'TEST FIXTURE independent security artifact',evidence:['Controlled fixture evidence'],blockers:[],nextAction:'Independent co-founder review'}));
    mock.method(agent,'stream',async()=>streamed({accepted:true,findings:[],evidenceGaps:[]}));
    try {
      internal = await store.create({
        key: 'internal-' + clientKey,
        kind: 'internal',
        name: 'TEST FIXTURE internal charter',
        brief: 'A controlled internal project with no invented client or sale.',
        awardEvidence: 'Integration fixture founder authorization',
        product: 'AscendXI',
      });
      assert.equal(internal.client_key, null);
      assert.equal(internal.kind, 'internal');
      await store.pause(internal.id, true);
      await clientStore().createLead({
        key: clientKey,
        company: 'TEST FIXTURE ONLY',
        need: 'Fixture scope for the operations integration suite',
        source: 'Disposable integration test record',
        product: 'AscendXI',
      });
      await assert.rejects(
        store.create({
          key: clientKey,
          clientKey,
          name: 'Fixture project',
          brief: 'An approved fixture scope for testing dependency routing.',
          awardEvidence: 'Fixture client approval evidence',
          product: 'AscendXI',
          autoAcceptArtifacts: true,
        }),
        /won opportunity/,
      );
      for (let i = 0; i < 6; i++)
        await clientStore().advance(
          clientKey,
          stages[i]!,
          stages[i + 1]!,
          'Fixture stage evidence only',
        );
      project = await store.create({
        key: clientKey,
        clientKey,
        name: 'Fixture project',
        brief: 'An approved fixture scope for testing dependency routing.',
        awardEvidence: 'Fixture client approval evidence',
        product: 'AscendXI',
        autoAcceptArtifacts: true,
      });
      const replay = await store.create({
        key: clientKey,
        clientKey,
        name: 'Fixture project',
        brief: 'An approved fixture scope for testing dependency routing.',
        awardEvidence: 'Fixture client approval evidence',
        product: 'AscendXI',
        autoAcceptArtifacts: true,
      });
      assert.equal(replay.id, project.id);
      assert.equal(project.ready,false);
      const proposal=(await planningStore().list()).find(p=>p.payload.subjectKey===project.id)!;
      await planningStore().decide(proposal.key,proposal.version,proposal.hash,'approve','Controlled fixture founder approval');
      const nodes = (await store.list()).find((p) => p.id === project.id).steps;
      assert.equal(nodes.length, 11);
      const backend = nodes.find((n: any) => n.key === 'backend');
      assert.equal(await store.eligible(backend.taskId), false);
      const blocked = await (
        await mastra.getWorkflow('companyTaskWorkflow').createRun()
      ).start({ inputData: { taskId: backend.taskId } });
      assert.equal(blocked.status, 'failed');
      assert.equal((await tasks.get(backend.taskId)).status, 'queued');
      for (const spec of deliverySteps) {
        const node = nodes.find((n: any) => n.key === spec.key);
        assert.equal(await store.eligible(node.taskId), true);
        const run = await (
          await mastra.getWorkflow('companyTaskWorkflow').createRun()
        ).start({ inputData: { taskId: node.taskId } });
        assert.equal(run.status, 'success');
        assert.equal((await tasks.get(node.taskId)).status, 'review');
        assert.ok(await store.acceptReviewedArtifact(node.taskId));
      }
      await store.putArtifact(
        project.id,
        'README.md',
        'Fixture source version one',
        'Controlled test evidence',
      );
      const firstArtifact = await store.artifact(project.id, 'README.md');
      await store.putArtifact(
        project.id,
        'README.md',
        'Fixture source version two',
        'Controlled updated evidence',
      );
      assert.notEqual(
        (await store.artifact(project.id, 'README.md')).hash,
        firstArtifact.hash,
      );
      await assert.rejects(
        store.putArtifact(
          project.id,
          '.env.local',
          'private fixture',
          'Not a permitted source artifact',
        ),
        /Invalid bounded/,
      );
      await assert.rejects(
        store.artifact(randomUUID(), 'README.md'),
        /not found/,
      );
      const messages = await journal.messages(project.id);
      assert.equal(messages.length, 33);
      assert.ok(messages.some((m) => m.speaker === 'quality'));
      assert.ok(messages.some((m) => m.speaker === 'engineering'));
      const events = await journal.events(0, project.id);
      assert.ok(events.some((e) => e.kind === 'task.policy.accepted'));
      assert.ok(events.some((e) => e.kind === 'project.awarded'));
      const payload = {
        from: 'fixture-owner@example.invalid',
        to: ['fixture-client@example.invalid'],
        subject: 'Fixture update',
        body: 'Integration fixture only; no real message will be sent.',
      };
      const draft = await actions.draft({
        key: 'action-' + clientKey,
        projectId: project.id,
        kind: 'email.send',
        payload,
      });
      assert.equal(draft.status, 'draft');
      let sends = 0;
      const provider = {
        send: async () => {
          sends++;
          return {
            id: 'fixture-sent-' + clientKey,
            threadId: 'thread-' + clientKey,
          };
        },
        thread: async () => ({
          messages: [
            {
              id: 'incoming-' + clientKey,
              labelIds: ['INBOX'],
              payload: {
                mimeType: 'text/plain',
                headers: [
                  { name: 'From', value: 'fixture-client@example.invalid' },
                  { name: 'Subject', value: 'Fixture reply' },
                ],
                body: {
                  data: Buffer.from(
                    'Can you clarify the reviewed scope?',
                  ).toString('base64url'),
                },
              },
            },
          ],
        }),
      };
      assert.equal(await actions.processOne(provider), null);
      assert.equal(sends, 0);
      await assert.rejects(
        actions.approve(draft.id, '0'.repeat(64), 'Test exact payload review'),
        /approval conflict/,
      );
      await actions.approve(
        draft.id,
        draft.hash,
        'Integration fixture exact payload review',
      );
      await store.pause(project.id, true);
      assert.equal(await actions.processOne(provider), null);
      assert.equal(sends, 0);
      await store.pause(project.id, false);
      await Promise.all([
        actions.processOne(provider),
        actions.processOne(provider),
      ]);
      assert.equal(sends, 1);
      await actions.pollReplies(provider);
      await actions.pollReplies(provider);
      assert.equal(
        (await journal.messages(project.id)).filter(
          (m) => m.speaker === 'fixture-client@example.invalid',
        ).length,
        1,
      );
      const reply = await tasks.byKey('reply:incoming-' + clientKey);
      assert.ok(reply);
      assert.equal((await store.forTask(reply.id)).id, project.id);
      const uncertain = await actions.draft({
        key: 'uncertain-' + clientKey,
        projectId: project.id,
        kind: 'email.send',
        payload,
      });
      await actions.approve(
        uncertain.id,
        uncertain.hash,
        'Fixture failure approval',
      );
      let attempts = 0;
      const failure = {
        send: async () => {
          attempts++;
          throw Error('private provider details must not persist');
        },
        thread: provider.thread,
      };
      await actions.processOne(failure);
      await actions.processOne(failure);
      assert.equal(attempts, 1);
      const saved = (await actions.list()).find((a) => a.id === uncertain.id);
      assert.equal(saved.status, 'uncertain');
      assert.doesNotMatch(saved.error, /private provider/);
      await actions.reconcile(
        uncertain.id,
        'not-sent',
        'Fixture provider inspection confirms no message was sent',
      );
      assert.equal(
        (await actions.list()).find((a) => a.id === uncertain.id).status,
        'reconciled',
      );
      await actions.processOne(failure);
      assert.equal(attempts, 1);
      await companyTick(mastra, { configured: () => false } as any);
      const heartbeat = await journal.worker();
      assert.equal(heartbeat.status, 'blocked');
      assert.equal(heartbeat.alive, true);
    } finally {
      await closePlanningStore();
      mock.restoreAll();
      await closeOperationsStore();
      if (internal) {
        await pool.query(
          'DELETE FROM ascendxi_tasks WHERE id IN(SELECT task_id FROM ascendxi_project_steps WHERE project_id=$1)',
          [internal.id],
        );
        await pool.query(
          'DELETE FROM ascendxi_project_steps WHERE project_id=$1',
          [internal.id],
        );
        await pool.query('DELETE FROM ascendxi_events WHERE project_id=$1', [
          internal.id,
        ]);
        await pool.query('DELETE FROM ascendxi_projects WHERE id=$1', [
          internal.id,
        ]);
      }
      if (project) {
        await pool.query('DELETE FROM ascendxi_actions WHERE project_id=$1', [
          project.id,
        ]);
        await pool.query('DELETE FROM ascendxi_messages WHERE project_id=$1', [
          project.id,
        ]);
        await pool.query('DELETE FROM ascendxi_events WHERE project_id=$1', [
          project.id,
        ]);
        await pool.query(
          'DELETE FROM ascendxi_project_steps WHERE project_id=$1',
          [project.id],
        );
        await pool.query('DELETE FROM ascendxi_tasks WHERE client_key=$1', [
          clientKey,
        ]);
        await pool.query(
          'DELETE FROM ascendxi_project_artifacts WHERE project_id=$1',
          [project.id],
        );
        await pool.query('DELETE FROM ascendxi_projects WHERE id=$1', [
          project.id,
        ]);
      }
      await pool.query('DELETE FROM ascendxi_opportunities WHERE key=$1', [
        clientKey,
      ]);
      await pool.end();
      await closeConnectorStore();
      await closeCommunicationStore();
      await closeProjectStore();
      await closeEventStore();
      await closeTaskStore();
      await closeClientStore();
      await closeKnowledgeStore();
      await storage.close();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
      if (previousKey === undefined) delete process.env.MASTRA_GATEWAY_API_KEY;
      else process.env.MASTRA_GATEWAY_API_KEY = previousKey;
    }
  },
);
