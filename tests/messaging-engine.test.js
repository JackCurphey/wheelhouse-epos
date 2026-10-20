// The messages engine (Jack, 20 Oct, docs/decisions/2026-10-20-messages-engine.md:
// pretend for now; openspec/changes/messages-engine): a message is queued for a
// customer the way they chose, waits its Undo minute, then the server's timer
// sends it with the pretend sender — recorded in the outbox, never sent.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { channelFor, queueMessage } from '../server/messaging/engine.js';

let server;
let owner;
before(async () => {
  // The timer every 100 ms in this test server.
  server = await startLiveServer({ env: { WH_MESSAGES_TICK_MS: '100' } });
  owner = await staffSignup(server.baseUrl);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const inShop = (fn) => runWithShop(owner.shop.id, fn);
const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const customer = (fields) => inShop(async () => (await prepare(
  'INSERT INTO customers (name, phone, email, update_channel) VALUES (?, ?, ?, ?) RETURNING id'
).get(fields.name ?? 'Maya Patel', fields.phone ?? null, fields.email ?? null, fields.channel ?? null)).id);
const message = (id) => inShop(() => prepare('SELECT * FROM customer_messages WHERE id = ?').get(id));
const until = async (check, ms = 5000) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await check();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 50));
  }
};
const VARS = { 'Customer’s first name': 'Maya', Bike: 'Trek Domane AL 3', 'Shop name': 'North Street Cycles', 'Amount to pay': '£111.00', 'Link to the job': 'https://example.test/j', 'Job number': 'WH-1042', 'Opening hours': '9 to 5' };

test('the customer’s chosen way, else text, else email, else none', () => {
  assert.deepEqual(channelFor({ update_channel: 'whatsapp', phone: '07700 900142', email: 'm@example.test' }), { channel: 'whatsapp', to: '07700 900142' });
  assert.deepEqual(channelFor({ update_channel: 'email', phone: '07700 900142', email: 'm@example.test' }), { channel: 'email', to: 'm@example.test' });
  assert.deepEqual(channelFor({ update_channel: null, phone: '07700 900142', email: 'm@example.test' }), { channel: 'sms', to: '07700 900142' });
  assert.deepEqual(channelFor({ update_channel: null, phone: null, email: 'm@example.test' }), { channel: 'email', to: 'm@example.test' });
  assert.equal(channelFor({ update_channel: 'sms', phone: null, email: null }), null);
});

test('a queued message waits, then is sent by the pretend sender and recorded in the outbox', async () => {
  const c = await customer({ phone: '07700 900142' });
  const queued = await inShop(() => queueMessage({ customerId: c, key: 'bike_ready', vars: VARS, delayMs: 300 }));
  assert.equal(queued.channel, 'sms');
  let row = await message(queued.id);
  assert.equal(row.intent_state, 'intended');
  assert.equal(row.status, 'queued');
  assert.equal(row.template_key, 'bike_ready');
  assert.equal(row.body, 'Hi Maya, your Trek Domane AL 3 is ready to collect from North Street Cycles. £111.00 to pay on collection. See what we did: https://example.test/j. Job WH-1042. We’re open 9 to 5.');
  row = await until(async () => { const r = await message(queued.id); return r.intent_state === 'delivered' && r; });
  assert.equal(row.pretend, true);
  assert.equal(row.status, 'sent');
  assert.equal(row.provider_sid, 'pretend');
  assert.ok(row.sent_at);
});

test('an email has its subject filled in', async () => {
  const c = await customer({ email: 'm@example.test', channel: 'email' });
  const queued = await inShop(() => queueMessage({ customerId: c, key: 'bike_ready', vars: VARS }));
  const row = await message(queued.id);
  assert.equal(row.channel, 'email');
  assert.equal(row.subject, 'Your bike is ready — North Street Cycles');
});

test('a message switched off, or a customer with no phone or email, queues nothing', async () => {
  const none = await customer({});
  assert.deepEqual(await inShop(() => queueMessage({ customerId: none, key: 'bike_ready', vars: VARS })), { skipped: 'no_contact' });
  await inShop(() => prepare("INSERT INTO message_templates (key, enabled) VALUES ('quote_to_approve', false)").run());
  const c = await customer({ phone: '07700 900142' });
  assert.deepEqual(await inShop(() => queueMessage({ customerId: c, key: 'quote_to_approve', vars: VARS })), { skipped: 'off' });
});

test('Undo within the minute stops it for good; after that it’s too late', async () => {
  const c = await customer({ phone: '07700 900142' });
  const queued = await inShop(() => queueMessage({ customerId: c, key: 'bike_ready', vars: VARS, delayMs: 60_000 }));
  const undone = await staff(`/api/messages/${queued.id}/undo`, { method: 'POST', body: {} });
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  assert.equal(undone.body.state, 'undone');
  const row = await message(queued.id);
  assert.equal(row.intent_state, 'undone');
  assert.equal(row.status, 'undone');
  const sent = await inShop(() => queueMessage({ customerId: c, key: 'bike_ready', vars: VARS, delayMs: 0 }));
  await until(async () => (await message(sent.id)).intent_state === 'delivered');
  const late = await staff(`/api/messages/${sent.id}/undo`, { method: 'POST', body: {} });
  assert.equal(late.status, 409);
  assert.equal(late.body.error, 'It’s already gone');
});

test('an old message with no send time is never picked up, and a stuck send becomes unknown', async () => {
  const c = await customer({ phone: '07700 900142' });
  const old = await inShop(() => prepare("INSERT INTO customer_messages (customer_id, body, status, intent_state) VALUES (?, 'Old', 'sent', 'intended') RETURNING id").get(c));
  const sending = (claimed) => inShop(() => prepare(
    `INSERT INTO customer_messages (customer_id, body, status, intent_state, channel, to_address, send_after, claimed_at)
     VALUES (?, 'Stuck', 'queued', 'sending', 'sms', '07700 900142', now() - interval '1 hour', now() - interval '${claimed}') RETURNING id`
  ).get(c));
  // Timed from when it was claimed, not from its send time: one that waited
  // an hour and was claimed a moment ago is still sending.
  const stuck = await sending('10 minutes');
  const justClaimed = await sending('1 second');
  await until(async () => (await message(stuck.id)).intent_state === 'unknown');
  await new Promise((r) => setTimeout(r, 300));
  assert.equal((await message(justClaimed.id)).intent_state, 'sending', 'claimed a moment ago');
  assert.equal((await message(old.id)).intent_state, 'intended', 'never claimed');
});

test('a claimed message records when it was claimed', async () => {
  const c = await customer({ phone: '07700 900142' });
  const queued = await inShop(() => queueMessage({ customerId: c, key: 'bike_ready', vars: VARS }));
  const row = await until(async () => { const r = await message(queued.id); return r.intent_state === 'delivered' && r; });
  assert.ok(row.claimed_at, 'claimed_at set');
});

test('the outbox refuses a customer number out of range, and any limit works', async () => {
  assert.equal((await staff('/api/messages?customerId=99999999999')).status, 400);
  for (const limit of ['-5', '1.5', 'x', '100000']) {
    const res = await staff(`/api/messages?limit=${limit}`);
    assert.equal(res.status, 200, `limit ${limit}: ${JSON.stringify(res.body)}`);
  }
});

test('the outbox lists a customer’s messages, newest first, with how and when', async () => {
  const c = await customer({ phone: '07700 900142' });
  const first = await inShop(() => queueMessage({ customerId: c, key: 'bike_ready', vars: VARS, delayMs: 0 }));
  await until(async () => (await message(first.id)).intent_state === 'delivered');
  const res = await staff(`/api/messages?customerId=${c}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const [m] = res.body;
  assert.equal(m.id, first.id);
  assert.equal(m.name, 'Bike ready');
  assert.equal(m.channel, 'sms');
  assert.equal(m.to, '07700 900142');
  assert.equal(m.state, 'delivered');
  assert.equal(m.pretend, true);
  assert.ok(m.sentAt);
  assert.match(m.body, /^Hi Maya/);
});
