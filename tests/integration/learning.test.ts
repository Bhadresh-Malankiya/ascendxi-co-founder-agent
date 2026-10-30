import {closePlanningStore} from '../../src/mastra/company/planning-store';
import {InboxWatch} from '../../src/mastra/company/inbox-watch';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  operationsStore,
  closeOperationsStore,
} from '../../src/mastra/company/operations-store';
import { closeEventStore } from '../../src/mastra/company/event-store';
import {
  closeKnowledgeStore,
  knowledgeStore,
} from '../../src/mastra/company/knowledge-store';
import { DiscordService } from '../../src/mastra/company/discord-service';
const url = process.env.TEST_DATABASE_URL;
test(
  'reviewed learning remains sourced, scoped preference automation is revocable, runs persist, Discord writes are single-claim and uncertain writes never retry',
  { skip: !url },
  async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url;
    const ops = operationsStore(),
      id = 'fixture-' + randomUUID(),
      projectId = randomUUID();
    let kbId = '';
    try {
      await ops.init();
      const memory = await ops.suggest(
        'test-memory:' + id,
        {
          agentId: id,
          kind: 'memory',
          title: 'Fixture style preference',
          content: 'Controlled operator feedback requesting concise responses.',
          source: 'Fixture operator feedback',
        },
        { verbosity: 'concise' },
      );
      assert.equal((await ops.settings(id)).preferences.verbosity, undefined);
      await ops.decide(memory.id, 'apply', true);
      assert.equal((await ops.settings(id)).preferences.verbosity, 'concise');
      assert.equal((await ops.settings(id)).auto_preferences, true);
      await assert.rejects(ops.decide(memory.id, 'apply'), /conflict/);
      await ops.feedback({
        agentId: id,
        rating: 4,
        note: 'Controlled future response preference, with no company fact or permission grant.',
        preferences: { format: 'bullets' },
      });
      assert.equal((await ops.settings(id)).preferences.format, 'bullets');
      assert.equal(
        (await ops.settings('other-' + id)).preferences.format,
        undefined,
      );
      await ops.configure(id, { autoPreferences: false });
      await ops.feedback({
        agentId: id,
        rating: 3,
        note: 'Controlled preference after automation has been disabled.',
        preferences: { verbosity: 'detailed' },
      });
      assert.equal((await ops.settings(id)).preferences.verbosity, 'concise');
      const kb = await ops.suggest('test-kb:' + id, {
        agentId: id,
        kind: 'knowledge',
        title: 'Fixture knowledge proposal',
        content:
          'This is controlled test evidence, never an actual company fact.',
        source: 'Disposable integration source',
      });
      kbId = kb.id;
      await ops.decide(kb.id, 'apply');
      assert.equal(
        (await knowledgeStore().get('learning-' + kb.id)).status,
        'draft',
      );
      assert.equal(
        (await knowledgeStore().search()).some(
          (k) => k.slug === 'learning-' + kb.id,
        ),
        false,
      );
      const access = await ops.suggest('test-access:' + id, {
        agentId: id,
        kind: 'access',
        title: 'Fixture access request',
        content: 'Request a particular tool; do not grant arbitrary access.',
        source: 'Controlled test',
      });
      await assert.rejects(
        ops.decide(access.id, 'apply'),
        /cannot grant access/,
      );
      const run = await ops.beginRun({
        agentId: id,
        kind: 'fixture',
        model: 'test/model',
      });
      await ops.preview(run.id, 'Visible fixture output only');
      assert.equal(
        (
          await ops.pool.query(
            'SELECT preview FROM ascendxi_runs WHERE id=$1',
            [run.id],
          )
        ).rows[0].preview,
        'Visible fixture output only',
      );
      await ops.endRun(run.id, 'succeeded', {
        inputTokens: 12,
        outputTokens: 8,
      });
      await ops.endRun(run.id, 'failed');
      assert.equal(
        (
          await ops.pool.query('SELECT status FROM ascendxi_runs WHERE id=$1', [
            run.id,
          ])
        ).rows[0].status,
        'succeeded',
      );
      const failedRun=await ops.beginRun({agentId:id,kind:'fixture failure',model:'test/model'});
      await ops.endRun(failedRun.id,'failed');
      await ops.monitor();
      assert.equal((await ops.pool.query('SELECT status FROM ascendxi_notifications WHERE key=$1',['monitor:run:'+failedRun.id])).rows[0].status,'open');
      const recoveredRun=await ops.beginRun({agentId:id,kind:'fixture recovery',model:'test/model'});
      await ops.endRun(recoveredRun.id,'succeeded');await ops.monitor();
      assert.equal((await ops.pool.query('SELECT status FROM ascendxi_notifications WHERE key=$1',['monitor:run:'+failedRun.id])).rows[0].status,'resolved');
      let sends = 0,
        fail = false;
      const transport = {
        call: async (tool: string) => {
          if (tool === 'discord_create_message') {
            sends++;
            if (fail) throw Error('Private provider error');
            return { id: 'fixture-message-' + sends };
          }
          if (tool === 'discord_create_thread_from_message')
            return { id: 'fixture-thread' };
          return { items: [] };
        },
      };
      const service = new DiscordService(transport);
      await service.queue(
        'fixture-send:' + id,
        'fixture-channel',
        'Clearly marked fixture company log',
      );
      await Promise.all([service.processOne(), service.processOne()]);
      assert.equal(sends, 1);
      assert.equal(
        (
          await ops.pool.query(
            'SELECT status FROM ascendxi_discord_deliveries WHERE key=$1',
            ['fixture-send:' + id],
          )
        ).rows[0].status,
        'sent',
      );
      fail = true;
      await service.queue(
        'fixture-uncertain:' + id,
        'fixture-channel',
        'Controlled uncertain write',
      );
      await service.processOne();
      await service.processOne();
      assert.equal(sends, 2);
      assert.equal(
        (
          await ops.pool.query(
            'SELECT status FROM ascendxi_discord_deliveries WHERE key=$1',
            ['fixture-uncertain:' + id],
          )
        ).rows[0].status,
        'uncertain',
      );
      await service.queue('fixture-interrupted:' + id,'fixture-channel','Controlled crash boundary');
      await ops.pool.query("UPDATE ascendxi_discord_deliveries SET status='sending',updated_at=now()-interval '6 minutes' WHERE key=$1",['fixture-interrupted:'+id]);
      assert.equal(await service.recoverInterruptedSends(),1);
      await service.processOne();
      assert.equal(sends,2);
      assert.equal((await ops.pool.query('SELECT status FROM ascendxi_discord_deliveries WHERE key=$1',['fixture-interrupted:'+id])).rows[0].status,'uncertain');
      const previousBot=process.env.ASCENDXI_DISCORD_BOT_USER_ID;
      process.env.ASCENDXI_DISCORD_BOT_USER_ID='1234567890';
      assert.equal(await service.replyToMention({id:'fixture-status-'+id,content:'<@1234567890> status'},'fixture-channel'),true);
      assert.equal(await service.replyToMention({id:'fixture-status-'+id,content:'<@1234567890> status'},'fixture-channel'),true);
      assert.equal(await service.replyToMention({id:'fixture-other-'+id,content:'ordinary message'},'fixture-channel'),false);
      const queuedReply=(await ops.pool.query('SELECT content FROM ascendxi_discord_deliveries WHERE key=$1',['mention-reply:fixture-status-'+id])).rows;
      assert.equal(queuedReply.length,1);assert.match(queuedReply[0].content,/Worker:/);assert.match(queuedReply[0].content,/never grants access/);
      await ops.pool.query('DELETE FROM ascendxi_discord_deliveries WHERE key=$1',['mention-reply:fixture-status-'+id]);
      if(previousBot===undefined)delete process.env.ASCENDXI_DISCORD_BOT_USER_ID;else process.env.ASCENDXI_DISCORD_BOT_USER_ID=previousBot;
      fail = false;
      const channel = await service.projectChannel({
        id: projectId,
        name: 'TEST FIXTURE project room',
      });
      assert.equal(channel, 'fixture-thread');
      await service.projectChannel({
        id: projectId,
        name: 'TEST FIXTURE project room',
      });
      assert.equal(sends, 3);

    let phase=0;
    const watcher=new InboxWatch({safeRead:async(tool:string)=>tool==='google_mail_list_messages'?{messages:[{id:'watch-old-'+id},...(phase?[{id:'watch-new-'+id}]:[])]}:{payload:{headers:[{name:'Subject',value:'Controlled inbox fixture'},{name:'From',value:'fixture@example.invalid'}]},id:'fixture'}});
    await watcher.configure(true,'is:unread fixture-'+id);
    await watcher.set('polledAt',0);await watcher.tick();
    assert.equal((await watcher.status()).baseline.matched,1);
    phase=1;await watcher.set('polledAt',0);await watcher.tick();
    await watcher.set('polledAt',0);await watcher.tick();
    assert.equal(Number((await ops.pool.query('SELECT count(*) FROM ascendxi_notifications WHERE key=$1',['inbox-new:watch-new-'+id])).rows[0].count),1);
    assert.equal(Number((await ops.pool.query('SELECT count(*) FROM ascendxi_notifications WHERE key=$1',['inbox-new:watch-old-'+id])).rows[0].count),0);
  } finally {
      if (kbId) {
        await ops.pool
          .query('DELETE FROM ascendxi_knowledge_revisions WHERE slug=$1', [
            'learning-' + kbId,
          ])
          .catch(() => {});
        await ops.pool.query(
          'DELETE FROM ascendxi_knowledge_documents WHERE slug=$1',
          ['learning-' + kbId],
        );
      }
      await ops.pool.query(
        'DELETE FROM ascendxi_agent_settings WHERE agent_id=$1',
        [id],
      );
      await ops.pool.query('DELETE FROM ascendxi_runs WHERE agent_id=$1', [id]);
      await ops.pool.query('DELETE FROM ascendxi_feedback WHERE agent_id=$1', [
        id,
      ]);
      await ops.pool.query(
        'DELETE FROM ascendxi_improvements WHERE agent_id=$1',
        [id],
      );
      await ops.pool.query(
        'DELETE FROM ascendxi_discord_deliveries WHERE key=ANY($1)',
        [['fixture-send:' + id, 'fixture-uncertain:' + id,'fixture-interrupted:'+id]],
      );
      await ops.pool.query('DELETE FROM ascendxi_discord_state WHERE key=$1', [
        'project:' + projectId,
      ]);
      await closeKnowledgeStore();
      await closeEventStore();
      await closeOperationsStore();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  },
);
