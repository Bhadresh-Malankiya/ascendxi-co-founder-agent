import { operationsStore } from './operations-store';
import { BridgeProvider } from './communications';
import { eventStore } from './event-store';
export class InboxWatch {
  constructor(
    readonly provider: {
      safeRead: (
        tool: string,
        input: unknown,
      ) => Promise<Record<string, unknown>>;
    } = new BridgeProvider(),
  ) {}
  async init() {
    await operationsStore().init();
    await operationsStore().pool.query(
      'CREATE TABLE IF NOT EXISTS ascendxi_inbox_watch(key text PRIMARY KEY,value jsonb NOT NULL)',
    );
  }
  async get(key: string) {
    await this.init();
    return (
      await operationsStore().pool.query(
        'SELECT value FROM ascendxi_inbox_watch WHERE key=$1',
        [key],
      )
    ).rows[0]?.value;
  }
  async set(key: string, value: unknown) {
    await this.init();
    await operationsStore().pool.query(
      'INSERT INTO ascendxi_inbox_watch(key,value)VALUES($1,$2)ON CONFLICT(key)DO UPDATE SET value=$2',
      [key, JSON.stringify(value)],
    );
  }
  async status() {
    return {
      enabled: (await this.get('enabled')) === true,
      query:
        (await this.get('query')) ||
        'is:unread to:info@ascendxi.com newer_than:1d',
      lastCheck: await this.get('lastCheck'),
      lastError: await this.get('lastError'),
      baseline: await this.get('baseline'),
    };
  }
  async configure(enabled: boolean, query: string) {
    await this.init();
    await this.set('enabled', enabled);
    if (query !== (await this.status()).query) {
      await this.set('query', query);
      await this.set('baseline', null);
    }
    await eventStore().append({
      kind: 'inbox.watch.configured',
      actor: 'operator',
      summary: enabled
        ? 'Company email header watch enabled'
        : 'Company email header watch paused',
    });
    return this.status();
  }
  async tick() {
    const config = await this.status();
    if (
      !config.enabled ||
      Date.now() - Number((await this.get('polledAt')) || 0) < 60000
    )
      return;
    await this.set('polledAt', Date.now());
    try {
      const data = await this.provider.safeRead('google_mail_list_messages', {
        q: config.query,
        maxResults: 10,
        includeSpamTrash: false,
      });
      const messages = Array.isArray(data.messages) ? data.messages : [];
      if (!config.baseline) {
        for (const m of messages)
          if (m.id) await this.set('seen:' + m.id, true);
        await this.set('baseline', {
          at: new Date().toISOString(),
          matched: messages.length,
        });
      } else
        for (const m of messages) {
          if (!m.id || (await this.get('seen:' + m.id))) continue;
          const full = await this.provider.safeRead('google_mail_get_message', {
            id: m.id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date'],
          });
          const headers = (full.payload as any)?.headers ?? [];
          const header = (name: string) =>
            headers.find(
              (h: any) => h.name.toLowerCase() === name.toLowerCase(),
            )?.value ?? 'Unknown';
          await operationsStore().notify({
            key: 'inbox-new:' + m.id,
            kind: 'email',
            severity: 'info',
            title: 'New company email · ' + header('Subject').slice(0, 150),
            detail:
              'From: ' +
              header('From') +
              '\nDate: ' +
              header('Date') +
              '\nMessage ' +
              m.id +
              '\nHeader-only watch. Inspect this message and assign a bounded reply task before any communication. No send or approval has occurred.',
            target: 'notifications',
          });
          await this.set('seen:' + m.id, true);
          await eventStore().append({
            kind: 'inbox.message.detected',
            actor: 'operations-monitor',
            summary: 'New company email requires review',
            data: { messageId: m.id },
          });
        }
      await this.set('lastCheck', new Date().toISOString());
      await this.set('lastError', null);
    } catch {
      await this.set(
        'lastError',
        'Read-only email watch failed or needs provider approval',
      );
      await operationsStore().notify({
        key: 'inbox-watch-failed',
        kind: 'email',
        severity: 'warning',
        title: 'Company email watch needs inspection',
        detail:
          'The verified-read integration could not return the expected data. No email was changed or sent.',
        target: 'connections',
      });
    }
  }
}
