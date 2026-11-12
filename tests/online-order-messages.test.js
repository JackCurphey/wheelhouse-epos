// The six online order messages (openspec/changes/website-buy-online, tasks
// 3.1-3.3; design 9; decision 9 H4 and M5; drawings on-messages and
// on-email-ready in docs/design/user-journeys/generator/online.mjs and setup.mjs).
// Orders are made straight in the database: nothing writes order payments yet
// (Jack's question 9). Names, emails and amounts are made-up test values.
//
// The server clock is pinned to 1 Sep 2026 (WHEELHOUSE_TEST_CLOCK). Sending is
// pretend in tests, so a message's link is "[link]".
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { TEMPLATES, LIVE_KEYS } from '../server/messaging/templates.js';
import { UNDO_MS } from '../server/messaging/engine.js';
import { ORDER_KEYS, READY_WAIT_SECONDS, queueOrderMessage, undoOrderReady, orderEmailProblem } from '../server/online-orders/messages.js';
import { orderReference } from '../server/online-orders/numbers.js';

let server;
let owner;
let site;
let numbers = 100;
const own = (p, options) => staffRequest(server.baseUrl, owner.cookie, p, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const tag = () => randomUUID().slice(0, 8);

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  site = await inShop(async () => {
    await prepare("UPDATE shops SET phone = '[shop phone]', address = '[Shop address]' WHERE id = current_setting('app.current_shop_id')::int").run();
    return (await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get()).id;
  });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

// A paid order for Maya, to get ready, with its own email so its messages are only this test's.
async function paidOrder({ stage = 'to_get_ready', keepUntil = null } = {}) {
  numbers += 1;
  const email = `maya-${tag()}@example.test`;
  const order = await inShop(() => prepare(
    `INSERT INTO online_orders (site_id, name, email, phone, total_pence, card_pence, order_code, request_key_hash, number, paid_at, stage, keep_until)
     VALUES (?, 'Maya Patel', ?, '07700 900123', 4500, 4500, ?, ?, ?, now(), ?, ?) RETURNING id, number`,
  ).get(site, email, `code-${tag()}`, `key-${tag()}`, numbers, stage, keepUntil));
  return { ...order, email };
}
const messagesFor = (order) => inShop(() => prepare(
  'SELECT id, template_key, channel, to_address, subject, body, intent_state, send_after FROM customer_messages WHERE to_address = ? ORDER BY id',
).all(order.email));
const queue = (order, key, opts) => inShop(() => queueOrderMessage(order.id, key, opts));

test('3.1 the six order messages, as drawn on on-messages, each listed in Settings', () => {
  assert.deepEqual(ORDER_KEYS.map((k) => [TEMPLATES[k].name, TEMPLATES[k].when]), [
    ['Order confirmation', 'When an online order is paid'],
    ['Order ready to collect', 'When an online order is ready'],
    ['Order still waiting', 'When an order isn’t collected after [n] days'],
    ['Item we couldn’t supply', 'When staff refund an item, with their reason'],
    ['Order cancelled', 'When an order is cancelled, by the customer or the shop'],
    ['Order not ready after all', 'When an order marked ready is moved back'],
  ]);
  for (const k of ORDER_KEYS) {
    assert.equal(TEMPLATES[k].group, 'online_orders', k);
    assert.ok(LIVE_KEYS.includes(k), `${k} is listed in Settings › Messages`);
    assert.match(TEMPLATES[k].wording, /\[Order number\]/, `${k} carries the order number`);
    assert.match(TEMPLATES[k].wording, /See your order: \[Link to your order\]/, `${k} has See your order`);
  }
});

test('3.1 five are draft wording; Order ready to collect is the drawn wording', () => {
  assert.deepEqual(ORDER_KEYS.filter((k) => TEMPLATES[k].draft), ORDER_KEYS.filter((k) => k !== 'order_ready'));
  assert.equal(TEMPLATES.order_ready.draft, undefined);
  assert.equal(TEMPLATES.order_ready.subject, 'Your order is ready to collect');
});

test('3.1 the API marks the draft wordings for Settings', async () => {
  const res = await own('/api/message-templates');
  assert.equal(res.status, 200);
  const byKey = Object.fromEntries(res.body.map((t) => [t.key, t]));
  assert.equal(byKey.order_confirmation.draft, true);
  assert.equal(byKey.order_ready.draft, false);
  assert.equal(byKey.bike_ready.draft, false);
});

test('3.2 Order ready to collect: emailed to the order’s address as drawn, after a few seconds with Undo', async () => {
  const order = await paidOrder({ stage: 'ready', keepUntil: '2026-09-08' });
  const before = Date.now();
  const queued = await queue(order, 'order_ready');
  assert.ok(queued.id, JSON.stringify(queued));
  const [m, ...more] = await messagesFor(order);
  assert.deepEqual(more, []);
  assert.equal(m.channel, 'email');
  assert.equal(m.to_address, order.email);
  assert.equal(m.intent_state, 'intended');
  assert.equal(m.subject, 'Your order is ready to collect');
  assert.equal(m.body, [
    'Hi Maya,',
    `Your order ${orderReference(order.number)} is ready at ${owner.shop.name}. It’s paid — just give your name or order number at the counter.`,
    `${owner.shop.name}\nOpen Mon to Sun 9:00 to 18:00\n[Shop address] · [shop phone]`,
    'See your order: [link]',
    'We’ll keep it for you until 8 September 2026. Can’t make it? Call us on [shop phone].',
  ].join('\n\n'));
  const wait = new Date(m.send_after).getTime() - before;
  assert.ok(READY_WAIT_SECONDS >= 3 && READY_WAIT_SECONDS <= 15, 'a few seconds');
  assert.ok(wait >= READY_WAIT_SECONDS * 1000 - 50 && wait <= READY_WAIT_SECONDS * 1000 + 5000, `waits ${READY_WAIT_SECONDS} s, not ${wait} ms`);
  const row = await inShop(() => prepare('SELECT ready_message_id FROM online_orders WHERE id = ?').get(order.id));
  assert.equal(row.ready_message_id, queued.id, 'the order keeps its ready email, for Undo');

  await inShop(() => undoOrderReady(order.id));
  assert.equal((await messagesFor(order))[0].intent_state, 'undone');
});

test('3.2 Undo stops only a ready email still waiting, never one already sent', async () => {
  const order = await paidOrder({ stage: 'ready', keepUntil: '2026-09-08' });
  const { id } = await queue(order, 'order_ready');
  await inShop(() => prepare("UPDATE customer_messages SET intent_state = 'delivered', status = 'sent' WHERE id = ?").run(id));
  await inShop(() => undoOrderReady(order.id));
  assert.equal((await messagesFor(order))[0].intent_state, 'delivered');
});

test('3.2 Order confirmation goes with no wait', async () => {
  const order = await paidOrder();
  const before = Date.now();
  await queue(order, 'order_confirmation');
  const [m] = await messagesFor(order);
  assert.equal(m.template_key, 'order_confirmation');
  assert.ok(new Date(m.send_after).getTime() <= before + 1000, 'due at once');
  assert.match(m.body, new RegExp(`${orderReference(order.number).replace(/[[\]]/g, '\\$&')}`));
});

test('3.2 the shop’s other order messages wait the usual Undo time; each fills its own tap-ins', async () => {
  const order = await paidOrder();
  const before = Date.now();
  await queue(order, 'order_item_not_supplied', { vars: { Item: '[Item]', Reason: '[reason]', 'Amount refunded': '£[£]' } });
  await queue(order, 'order_cancelled', { vars: { 'Amount refunded': '£[£]' } });
  await queue(order, 'order_not_ready');
  const sent = await messagesFor(order);
  assert.deepEqual(sent.map((m) => m.template_key), ['order_item_not_supplied', 'order_cancelled', 'order_not_ready']);
  for (const m of sent) {
    const wait = new Date(m.send_after).getTime() - before;
    assert.ok(wait >= UNDO_MS - 50 && wait <= UNDO_MS + 5000, `${m.template_key} waits ${wait}`);
    assert.doesNotMatch(m.body, /\[(?!Item\]|reason\]|£\]|prefix\]|link\]|shop phone\])/, `${m.template_key} has no unfilled tap-in: ${m.body}`);
  }
  assert.match(sent[0].body, /\[Item\]/);
  assert.match(sent[0].body, /\[reason\]/);
});

test('3.2 a switched-off message isn’t queued', async () => {
  const res = await own('/api/message-templates/order_cancelled', { method: 'PUT', body: { enabled: false } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  try {
    const order = await paidOrder();
    assert.deepEqual(await queue(order, 'order_cancelled'), { skipped: 'off' });
    assert.deepEqual(await messagesFor(order), []);
  } finally {
    await own('/api/message-templates/order_cancelled', { method: 'PUT', body: { enabled: true } });
  }
});

test('3.2 a key that isn’t an order message is refused', async () => {
  const order = await paidOrder();
  await assert.rejects(() => queue(order, 'bike_ready'), /not an online order message/);
});

test('3.3 an email that couldn’t reach the customer shows on the order, with the order’s phone', async () => {
  const order = await paidOrder({ stage: 'ready', keepUntil: '2026-09-08' });
  assert.equal(await inShop(() => orderEmailProblem(order.id)), null, 'nothing before any email');
  const { id } = await queue(order, 'order_ready');
  assert.equal(await inShop(() => orderEmailProblem(order.id)), null, 'nothing while it waits');
  await inShop(() => prepare("UPDATE customer_messages SET intent_state = 'failed', status = 'failed', error = 'Not sent' WHERE id = ?").run(id));
  assert.deepEqual(await inShop(() => orderEmailProblem(order.id)), { failed: 'order_ready', phone: '07700 900123' });
});

test('3.3 another order’s failed email isn’t this order’s', async () => {
  const a = await paidOrder();
  const b = await paidOrder();
  const { id } = await queue(a, 'order_confirmation');
  await inShop(() => prepare("UPDATE customer_messages SET intent_state = 'failed', status = 'failed' WHERE id = ?").run(id));
  assert.equal(await inShop(() => orderEmailProblem(b.id)), null);
  assert.equal((await inShop(() => orderEmailProblem(a.id))).failed, 'order_confirmation');
});

test('3.4 the Edit box’s preview fills an order message with the drawing’s example, From and To as drawn (on-email-ready)', async () => {
  const res = await own('/api/message-templates/order_ready/preview', { method: 'POST', body: {} });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.email.from, `${owner.shop.name} <[email address]>`);
  assert.equal(res.body.email.to, 'maya@example.test');
  assert.equal(res.body.email.subject, 'Your order is ready to collect');
  assert.equal(res.body.email.body, [
    'Hi Maya,',
    `Your order [order number] is ready at ${owner.shop.name}. It’s paid — just give your name or order number at the counter.`,
    `${owner.shop.name}\nOpen [opening hours]\n[Shop address] · [shop phone]`,
    'See your order: [link]',
    'We’ll keep it for you until [date]. Can’t make it? Call us on [shop phone].',
  ].join('\n\n'));
  const supplied = await own('/api/message-templates/order_item_not_supplied/preview', { method: 'POST', body: {} });
  assert.match(supplied.body.email.body, /\[Item\]/);
  assert.match(supplied.body.email.body, /£\[£\]/);
});
