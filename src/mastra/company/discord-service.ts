import {queueDiscordRequest,initDiscordRequests,hasDiscordConsent} from './discord-advisory';
import { BridgeProvider } from './communications';
import { operationsStore } from './operations-store';
import { eventStore } from './event-store';
export type DiscordTransport = {
  call: (tool: string, input: unknown) => Promise<Record<string, any>>;
};
export function discordConfig() {
  return {
    guildId: process.env.ASCENDXI_DISCORD_GUILD_ID || '',
    botUserId: process.env.ASCENDXI_DISCORD_BOT_USER_ID || '',
    operations: process.env.ASCENDXI_DISCORD_OPERATIONS_CHANNEL || '',
    approvals: process.env.ASCENDXI_DISCORD_APPROVALS_CHANNEL || '',
    learning: process.env.ASCENDXI_DISCORD_LEARNING_CHANNEL || '',
  };
}
export class DiscordService {
  constructor(readonly provider: DiscordTransport = new BridgeProvider()) {}
  async init() {
    const ops = operationsStore();
    await ops.init();
    await ops.pool.query(
      `CREATE TABLE IF NOT EXISTS ascendxi_discord_state(key text PRIMARY KEY,value jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());CREATE TABLE IF NOT EXISTS ascendxi_discord_deliveries(key text PRIMARY KEY,channel_id text NOT NULL,content text NOT NULL,status text NOT NULL DEFAULT 'queued',receipt jsonb,error text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());`,
    );
  }
  async read(key: string) {
    await this.init();
    return (
      await operationsStore().pool.query(
        'SELECT value FROM ascendxi_discord_state WHERE key=$1',
        [key],
      )
    ).rows[0]?.value;
  }
  async save(key: string, value: unknown) {
    await this.init();
    await operationsStore().pool.query(
      'INSERT INTO ascendxi_discord_state(key,value)VALUES($1,$2)ON CONFLICT(key)DO UPDATE SET value=$2,updated_at=now()',
      [key, JSON.stringify(value)],
    );
  }
  async enabled() {
    return (await this.read('enabled')) === true;
  }
  async activate(enabled: boolean) {
    const config = discordConfig();
    if (enabled) {
      if (
        !config.guildId ||
        !config.operations ||
        !config.approvals ||
        !config.learning
      )
        throw Error('Discord channel configuration is incomplete');
      const result = await this.provider.call('discord_list_channels', {
        guild_id: config.guildId,
      });
      const channels =
        result.items ??
        result.channels ??
        (Array.isArray(result) ? result : []);
      if (
        ![config.operations, config.approvals, config.learning].every((id) =>
          channels.some((c: any) => c.id === id),
        )
      )
        throw Error('Discord channels did not verify in the selected server');
      if (!(await this.read('cursor'))) {
        const last = (
          await eventStore().pool.query(
            'SELECT COALESCE(max(id),0)AS id FROM ascendxi_events',
          )
        ).rows[0].id;
        await this.save('cursor', String(last));
      }
      await this.save('verifiedAt', new Date().toISOString());
    }
    await this.save('enabled', enabled);
    if (enabled) {
      for (const [kind, channel] of Object.entries({
        operations: config.operations,
        approvals: config.approvals,
        learning: config.learning,
      }))
        await this.queue(
          'setup:' + channel,
          channel,
          '[AscendXI company operating system] ' +
            kind +
            ' channel connected. Actual agent activity and decisions will be labelled with their source. The local portal is the approval surface; a Discord message never grants access or approves a send. This uses one existing company bot, not separate agent accounts.',
        );
    }

    await eventStore().append({
      kind: 'discord.configured',
      actor: 'operator',
      summary: enabled
        ? 'Company Discord logging enabled'
        : 'Company Discord logging paused',
      data: { guildId: config.guildId },
    });
    return { enabled };
  }
  async status() {
    await this.init();
    await initDiscordRequests();
    return {
      requests: (await operationsStore().pool.query("SELECT message_id,agent_id,status,created_at FROM ascendxi_discord_requests ORDER BY created_at DESC LIMIT 15")).rows,
      ...discordConfig(),
      enabled: await this.enabled(),
      verifiedAt: await this.read('verifiedAt'),
      deliveries: (
        await operationsStore().pool.query(
          'SELECT key,channel_id,status,receipt,error,created_at FROM ascendxi_discord_deliveries ORDER BY created_at DESC LIMIT 30',
        )
      ).rows,
      projects: (
        await operationsStore().pool.query(
          "SELECT key,value FROM ascendxi_discord_state WHERE key LIKE 'project:%'",
        )
      ).rows,
    };
  }
  async queue(key: string, channelId: string, content: string) {
    await this.init();
    await operationsStore().pool.query(
      'INSERT INTO ascendxi_discord_deliveries(key,channel_id,content)VALUES($1,$2,$3)ON CONFLICT DO NOTHING',
      [key, channelId, content.slice(0, 1900)],
    );
  }
  async projectChannel(project: any) {
    const key = 'project:' + project.id,
      existing = await this.read(key);
    if (existing?.channelId) return existing.channelId;
    if (existing?.status === 'uncertain') return null;
    const cfg = discordConfig();
    await this.save(key, { status: 'uncertain', name: project.name });
    try {
      const start = await this.provider.call('discord_create_message', {
        channelId: cfg.operations,
        content:
          '[Company operating system] Project room · ' +
          project.name +
          '\nActual approved project ' +
          project.id +
          '. Agent work and handoffs appear in its thread. Portal: http://127.0.0.1:4111/company/dashboard',
        allowedMentions: { parse: [] },
      });
      if (typeof start.id !== 'string')
        throw Error('No Discord message receipt');
      const thread = await this.provider.call(
        'discord_create_thread_from_message',
        {
          channel_id: cfg.operations,
          message_id: start.id,
          name: project.name.slice(0, 95),
          auto_archive_duration: 10080,
        },
      );
      if (typeof thread.id !== 'string')
        throw Error('No Discord thread receipt');
      await this.save(key, {
        channelId: thread.id,
        name: project.name,
        status: 'verified',
        starterMessageId: start.id,
      });
      await eventStore().append({
        kind: 'discord.project.ready',
        actor: 'discord-worker',
        summary: project.name,
        projectId: project.id,
        data: { channelId: thread.id, starterMessageId: start.id },
      });
      return thread.id;
    } catch {
      await operationsStore().notify({
        key: 'discord-project:' + project.id,
        kind: 'discord',
        severity: 'warning',
        title: 'Discord project room needs inspection',
        detail:
          'A room creation attempt has an uncertain outcome. Inspect Discord before another attempt; no automatic duplicate is created.',
        target: 'connections',
      });
      return null;
    }
  }
  async processOne() {
    await this.init();
    const pool = operationsStore().pool;
    const action = (
      await pool.query(
        "UPDATE ascendxi_discord_deliveries SET status='sending',updated_at=now()WHERE key=(SELECT key FROM ascendxi_discord_deliveries WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)RETURNING *",
      )
    ).rows[0];
    if (!action) return null;
    try {
      if (action.key.startsWith('advisory-response:')) {
        const request=(await pool.query('SELECT author_id,channel_id FROM ascendxi_discord_requests WHERE message_id=$1',[action.key.slice('advisory-response:'.length)])).rows[0];
        if (!request || request.channel_id!==action.channel_id || !(await hasDiscordConsent(request.author_id,request.channel_id))) {
          await pool.query("UPDATE ascendxi_discord_deliveries SET status='cancelled',error='Discussion consent is no longer approved; response retained locally',updated_at=now()WHERE key=$1",[action.key]);
          return null;
        }
      }
      const receipt = await this.provider.call('discord_create_message', {
        channelId: action.channel_id,
        content: action.content,
        allowedMentions: { parse: [] },
      });
      if (typeof receipt.id !== 'string') throw Error('No receipt');
      await pool.query(
        "UPDATE ascendxi_discord_deliveries SET status='sent',receipt=$2,updated_at=now()WHERE key=$1 AND status='sending'",
        [
          action.key,
          JSON.stringify({
            id: receipt.id,
            channelId: receipt.channel_id ?? action.channel_id,
          }),
        ],
      );
      await eventStore().append({
        kind: 'discord.message.sent',
        actor: 'discord-worker',
        summary: 'Company activity mirrored to Discord',
        data: {
          key: action.key,
          channelId: action.channel_id,
          messageId: receipt.id,
        },
      });
      return receipt;
    } catch {
      await pool.query(
        "UPDATE ascendxi_discord_deliveries SET status='uncertain',error='Inspect Discord before retry; delivery may have succeeded',updated_at=now()WHERE key=$1",
        [action.key],
      );
      await operationsStore().notify({
        key: 'discord-send:' + action.key,
        kind: 'discord',
        severity: 'warning',
        title: 'Discord delivery uncertain',
        detail:
          'A Discord write did not return a verified receipt. It will not be retried automatically.',
        target: 'connections',
      });
      return null;
    }
  }
  async replyToMention(message: {id:string;content:string;author?:{id?:string}}, channelId:string) {
    const botId=discordConfig().botUserId;
    if (!/^\d+$/.test(botId)) return false;
    const mention=new RegExp('<@!?'+botId+'>');
    if (!mention.test(message.content)) return false;
    const command=message.content.replace(mention,'').trim();
    let text='[Company monitor · recorded status]\n';
    if (/^(status|health|approvals)\b/i.test(command)) {
      const health=await operationsStore().monitor();
      const counts=(await operationsStore().pool.query("SELECT status,count(*)::int AS count FROM ascendxi_tasks GROUP BY status")).rows;
      const number=(status:string)=>counts.find(r=>r.status===status)?.count??0;
      text+='Worker: '+(health.workerAlive?'online':'heartbeat missing')+' · '+health.worker.status+
        '\nTasks: '+number('running')+' running · '+number('queued')+' queued · '+number('blocked')+' blocked · '+number('review')+' awaiting review · '+number('completed')+' accepted.'+
        '\nOpen notices: '+health.notices.length+'.';
      for (const task of health.blockedTasks.slice(0,3)) text+='\nBlocked: '+task.title+' · '+task.agentId;
    } else if (/^(help)?$/i.test(command)) {
      text+='Commands: status, health, approvals. For discussion: @Co-Founder engineering: your question, product:, growth:, quality:, ui-designer:, agent: or operations-monitor:. First use requests founder approval of this Discord identity and channel. Advisory replies share the hourly AI limit and cannot execute actions.';
    } else {
      try {
        const result=await queueDiscordRequest({...message,content:command},channelId);
        text=result.status==='queued'?'[Company desk] Advisory request saved for '+command.split(':')[0]+'. It will run within shared AI capacity.':result.status==='awaiting_access'?'[Founder approval needed] Discussion request saved. Review the exact Discord identity and channel in portal → Decisions before an agent can quote company context here.':result.status==='daily_limit'?'[Company desk] Daily discussion request limit reached. Use the portal for the next decision.':'[Company desk] Request already recorded: '+result.status+'.';
      } catch(e) { text='[Company desk] '+(e instanceof Error?e.message:'Choose an existing agent ID.'); }
    }
    text+='\nPortal on the company Mac: http://127.0.0.1:4111/company/dashboard\nA Discord message never grants access or approves an action.';
    await this.queue('mention-reply:'+message.id,channelId,text);
    return true;
  }
  async recoverInterruptedSends() {
    await this.init();
    const rows = (await operationsStore().pool.query(
      "UPDATE ascendxi_discord_deliveries SET status='uncertain',error='Interrupted send; inspect Discord before retry',updated_at=now() WHERE status='sending' AND updated_at<now()-interval '5 minutes' RETURNING key",
    )).rows;
    for (const row of rows) await operationsStore().notify({
      key: 'discord-send:' + row.key, kind: 'discord', severity: 'warning',
      title: 'Discord delivery uncertain',
      detail: 'The process stopped before recording a verified receipt. Inspect Discord before any retry; no automatic duplicate is sent.',
      target: 'connections',
    });
    return rows.length;
  }
  async tick() {
    if (!discordConfig().guildId) return;
    await this.init();
    await this.recoverInterruptedSends();
    if (!(await this.enabled())) return;
    const ops = operationsStore(),
      cfg = discordConfig();
    const projects = (
      await ops.pool.query(
        'SELECT * FROM ascendxi_projects WHERE ready ORDER BY created_at LIMIT 50',
      )
    ).rows;
    let newRooms = 0;
    for (const project of projects) {
      if (await this.read('project:' + project.id)) continue;
      await this.projectChannel(project);
      if (++newRooms >= 5) break;
    }
    const cursor = await this.read('cursor');
    const events = (
      await ops.pool.query(
        'SELECT * FROM ascendxi_events WHERE id>$1 ORDER BY id LIMIT 100',
        [cursor ?? '0'],
      )
    ).rows;
    for (const e of events) {
      let channel = cfg.operations,
        content = '';
      if (e.kind === 'message.recorded') {
        const m = (
          await ops.pool.query('SELECT * FROM ascendxi_messages WHERE id=$1', [
            e.data.messageId,
          ])
        ).rows[0];
        if (
          m &&
          [
            'assignment',
            'deliverable',
            'review',
            'direct-chat',
            'project-room',
          ].includes(m.channel) &&
          m.speaker !== 'operator'
        ) {
          let text = m.content;
          try {
            const parsed = JSON.parse(text);
            text =
              parsed.deliverable ??
              (parsed.accepted !== undefined
                ? (parsed.accepted ? 'Review passed' : 'Changes requested') +
                  '\n' +
                  (parsed.findings ?? []).join('\n')
                : text);
          } catch {}
          content = '[' + m.speaker + ' · ' + m.channel + ']\n' + text;
          if (m.project_id) {
            const project = projects.find((p) => p.id === m.project_id);
            channel = project
              ? (await this.projectChannel(project)) || cfg.operations
              : cfg.operations;
          }
        }
      } else if (
        [
          'agent.run.started',
          'agent.run.succeeded',
          'agent.run.failed',
        ].includes(e.kind)
      ) {
        content =
          '[' +
          e.actor +
          '] ' +
          e.kind.replace('agent.run.', '') +
          ' · ' +
          e.summary +
          '\n' +
          (e.data.elapsedSeconds !== undefined
            ? 'Elapsed: ' + Math.round(e.data.elapsedSeconds) + 's\n'
            : '') +
          'Run ' +
          e.data.runId;
        if (e.project_id) {
          const project = projects.find((p) => p.id === e.project_id);
          if (project) channel = (await this.projectChannel(project)) || cfg.operations;
        }
      } else if (e.kind === 'improvement.decided') {
        channel = cfg.learning;
        content = '[Learning decision · operator] ' + e.summary +
          '\nDecision: ' + e.data.decision +
          (e.data.future ? ' · future typed operator formatting feedback enabled for this agent' : '') +
          '\nKnowledge still requires source review; no access grant is implied.';
      } else if (e.kind === 'improvement.proposed') {
        channel = cfg.learning;
        content =
          '[Learning proposal · ' +
          e.actor +
          '] ' +
          e.summary +
          '\nPending operator review in the local portal. No knowledge, memory or permissions were changed.';
      } else if (
        /^action\.(draft|uncertain|blocked)$/.test(e.kind) ||
        e.kind === 'task.blocked'
      ) {
        channel = cfg.approvals;
        content =
          '[Attention needed · ' +
          e.actor +
          '] ' +
          e.summary +
          '\n' +
          e.kind +
          ' · inspect exact evidence and decide in the portal.';
      }
      if (content) await this.queue('event:' + e.id, channel, content);
      await this.save('cursor', String(e.id));
    }
    for (let i = 0; i < 5; i++) if (!(await this.processOne())) break;
    if (Date.now() - Number((await this.read('lastInboundPoll')) || 0) < 60000)
      return;
    await this.save('lastInboundPoll', Date.now());
    // Poll only configured company channels/rooms. Discord content is evidence, never action approval.
    const roomRows = (
      await ops.pool.query(
        "SELECT key,value FROM ascendxi_discord_state WHERE key LIKE 'project:%' AND value ? 'channelId' ORDER BY updated_at DESC LIMIT 50",
      )
    ).rows;
    for (const channelId of [
      cfg.operations,
      cfg.approvals,
      cfg.learning,
      ...roomRows.map((r) => r.value.channelId),
    ]) {
      const after = await this.read('inbound:' + channelId);
      try {
        const response = await this.provider.call('discord_list_messages', {
          channel_id: channelId,
          limit: 20,
          ...(after ? { after } : {}),
        });
        const messages = response.items ?? response.messages ?? [];
        for (const m of messages.slice().reverse()) {
          if (!m.id) continue;
          if (!m.author?.bot) {
            if (!m.content) {
              await ops.notify({
                key: 'discord-content:' + channelId, kind: 'discord', severity: 'warning',
                title: 'Discord message body unavailable',
                detail: 'Discord returned a message ID without readable content. Mention @Co-Founder in the company channel to address the bot within its existing access. Broader message-content access requires a separate reviewed provider setting. No request is claimed as understood.',
                target: 'connections',
              });
            } else {
            const projectState = roomRows.find(
              (r) => r.value.channelId === channelId,
            );
            const project = projectState
              ? projects.find((p) => projectState.key === 'project:' + p.id)
              : null;
            await eventStore().message({
              key: 'discord:' + m.id,
              projectId: project?.id,
              speaker: m.author?.username ?? 'Discord member',
              channel: 'discord',
              content: m.content,
              source: 'Discord channel ' + channelId + ' / message ' + m.id,
            });
            await ops.notify({
              key: 'discord-incoming:' + m.id,
              kind: 'discord',
              severity: 'info',
              title: 'New company Discord message',
              detail:
                m.content.slice(0, 1000) +
                '\nTreat as a request for review, not authorization. Choose the next action in the portal.',
              target: 'conversations',
            });
            await this.replyToMention(m,channelId);
            }
          }
          if (!after || BigInt(m.id) > BigInt(after))
            await this.save('inbound:' + channelId, m.id);
        }
      } catch {
        await ops.notify({
          key: 'discord-inbound:' + channelId,
          kind: 'discord',
          severity: 'warning',
          title: 'Discord room could not be refreshed',
          detail:
            'Inspect the connection and channel permission. No message is claimed as received.',
          target: 'connections',
        });
      }
    }
  }
}
