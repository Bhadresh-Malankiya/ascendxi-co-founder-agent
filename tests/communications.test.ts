import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emailPayload,
  emailMime,
  meetingPayload,
  actionHash,
  BridgeProvider,
  PreflightError,
} from '../src/mastra/company/communications';
const mail = {
  from: 'owner@example.com',
  to: ['client@example.com'],
  subject: 'Project — update',
  body: 'A truthful update.\nNext step: review.',
};
test('email payloads reject header injection and preserve Unicode content in MIME', () => {
  assert.equal(
    emailPayload.safeParse({ ...mail, subject: 'Update\r\nBcc: other@example.com' }).success,
    false,
  );
  const raw = Buffer.from(emailMime(mail, 'stable-key'), 'base64url').toString();
  assert.match(raw, /Message-ID: <[a-f0-9]{64}@ascendxi.local>/);
  assert.ok(raw.includes(Buffer.from(mail.subject).toString('base64')));
  assert.ok(raw.includes(Buffer.from(mail.body).toString('base64')));
  const a = {
    key: 'mail-1',
    projectId: '11111111-1111-4111-8111-111111111111',
    kind: 'email.send' as const,
    payload: mail,
  };
  assert.equal(actionHash(a), actionHash(a));
  assert.notEqual(
    actionHash(a),
    actionHash({ ...a, payload: { ...mail, body: 'Changed content' } }),
  );
});
test('calendar payloads require explicit offsets, valid timezone and an increasing interval', () => {
  const p = {
    calendarId: 'primary',
    summary: 'Discovery',
    description: 'Approved agenda',
    start: '2026-10-20T09:00:00+05:30',
    end: '2026-10-20T09:30:00+05:30',
    timeZone: 'Asia/Kolkata',
    attendees: ['client@example.com'],
  };
  assert.ok(meetingPayload.safeParse(p).success);
  assert.equal(meetingPayload.safeParse({ ...p, end: p.start }).success, false);
  assert.equal(meetingPayload.safeParse({ ...p, timeZone: 'Imaginary/Place' }).success, false);
});
test('bridge validates provider receipts, constructs documented Gmail payloads and fails closed on availability', async () => {
  const calls: any[] = [];
  const request: typeof fetch = async (url, init) => {
    const id = String(url).split('/tools/')[1]?.split('/')[0];
    const body = JSON.parse(String(init?.body));
    calls.push({ id, body });
    return Response.json(
      id === 'google_mail_send_message'
        ? { id: 'fixture-message', threadId: 'fixture-thread' }
        : {
            calendars: {
              primary: { busy: [] },
              'client@example.com': { errors: [{ reason: 'forbidden' }] },
            },
          },
    );
  };
  const provider = new BridgeProvider('https://bridge.example.com', 'private-test-token', request);
  const receipt = await provider.send({
    key: 'approved-fixture',
    projectId: '11111111-1111-4111-8111-111111111111',
    kind: 'email.send',
    payload: mail,
  });
  assert.equal(receipt.id, 'fixture-message');
  assert.equal(calls[0].id, 'google_mail_send_message');
  assert.equal(typeof calls[0].body.data.raw, 'string');
  await assert.rejects(
    provider.send({
      key: 'meeting-fixture',
      projectId: '11111111-1111-4111-8111-111111111111',
      kind: 'calendar.create',
      payload: {
        calendarId: 'primary',
        summary: 'Discovery',
        description: 'Agenda',
        start: '2026-10-20T09:00:00Z',
        end: '2026-10-20T09:30:00Z',
        timeZone: 'UTC',
        attendees: ['client@example.com'],
      },
    }),
    PreflightError,
  );
  assert.equal(
    calls.some((c) => c.id === 'google_calendar_create_event'),
    false,
  );
});
