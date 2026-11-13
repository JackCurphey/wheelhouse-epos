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
import { UNDO_MS, sendDueForShop } from '../server/messaging/engine.js';
import { ORDER_KEYS, READY_WAIT_SECONDS, queueOrderMessage, undoOrderReady, orderEmailProblem, whereToCollect } from '../server/online-orders/messages.js';
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
async function paidOrder({ stage = 'to_get_ready', keepUntil = null, customerId = null, siteId = site, card = 4500, credit = 0, paid = true } = {}) {
  numbers += 1;
  const email = `maya-${tag()}@example.test`;
  const order = await inShop(() => prepare(
    `INSERT INTO online_orders (site_id, customer_id, name, email, phone, total_pence, card_pence, credit_pence, order_code, request_key_hash, number, paid_at, stage, keep_until)
     VALUES (?, ?, 'Maya Patel', ?, '07700 900123', ?, ?, ?, ?, ?, ?, ${paid ? 'now()' : 'NULL'}, ?, ?) RETURNING id, number`,
  ).get(siteId, customerId, email, card + credit, card, credit, `code-${tag()}`, `key-${tag()}`, paid ? numbers : null, stage, keepUntil));
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

test('3.2 a signed-in customer who chose text still gets the order’s emails, at the order’s address', async () => {
  const customer = await inShop(() => prepare(
    "INSERT INTO customers (name, phone, email, update_channel) VALUES ('Maya Patel', '07700 900456', ?, 'sms') RETURNING id",
  ).get(`maya-account-${tag()}@example.test`));
  const order = await paidOrder({ customerId: customer.id });
  const queued = await queue(order, 'order_confirmation');
  assert.equal(queued.channel, 'email');
  assert.equal(queued.to, order.email);
  const [m] = await messagesFor(order);
  assert.equal(m.channel, 'email');
});

// Sends this shop's due messages now, as the timer would.
async function dueNow(id) {
  await inShop(() => prepare("UPDATE customer_messages SET send_after = now() - interval '1 second' WHERE id = ?").run(id));
  await sendDueForShop(owner.shop.id);
}

test('3.2 the ready email goes only while the order is still ready when it comes due', async () => {
  const stillReady = await paidOrder({ stage: 'ready', keepUntil: '2026-09-08' });
  const a = await queue(stillReady, 'order_ready');
  await dueNow(a.id);
  assert.equal((await messagesFor(stillReady))[0].intent_state, 'delivered');

  const movedBack = await paidOrder({ stage: 'ready', keepUntil: '2026-09-08' });
  const b = await queue(movedBack, 'order_ready');
  await inShop(() => prepare("UPDATE online_orders SET stage = 'to_get_ready' WHERE id = ?").run(movedBack.id));
  await dueNow(b.id);
  assert.equal((await messagesFor(movedBack))[0].intent_state, 'undone', 'not ready after all, before it went: nothing sent');
});

test('3.3 a failed email stops showing once a later email to the order arrives', async () => {
  const order = await paidOrder({ stage: 'ready', keepUntil: '2026-09-08' });
  const first = await queue(order, 'order_confirmation');
  await inShop(() => prepare("UPDATE customer_messages SET intent_state = 'failed', status = 'failed' WHERE id = ?").run(first.id));
  assert.equal((await inShop(() => orderEmailProblem(order.id))).failed, 'order_confirmation');
  const later = await queue(order, 'order_ready');
  await inShop(() => prepare("UPDATE customer_messages SET intent_state = 'delivered', status = 'sent' WHERE id = ?").run(later.id));
  assert.equal(await inShop(() => orderEmailProblem(order.id)), null);
});

// Task 3.7: left by the reviews of pull request 3.

test('3.7a an order at a second shop is ready at that shop: the business’s name and the shop’s', async () => {
  const second = await inShop(async () => (await prepare("INSERT INTO sites (name, code) VALUES ('[Second site]', 'Z') RETURNING id").get()).id);
  const order = await paidOrder({ stage: 'ready', keepUntil: '2026-09-08', siteId: second });
  await queue(order, 'order_ready');
  const [m] = await messagesFor(order);
  assert.match(m.body, new RegExp(`is ready at ${owner.shop.name}, \\[Second site\\]\\. It’s paid`));
  assert.match(m.body, new RegExp(`\n\n${owner.shop.name}, \\[Second site\\]\nOpen `), 'the shop’s lines name it too');
});

test('3.7b the confirmation says what was bought, how it was paid and where to collect it', async () => {
  const order = await paidOrder({ card: 3500, credit: 1000 });
  await inShop(async () => {
    const a = await prepare("INSERT INTO products (name, category, price) VALUES ('[Product]', 'Accessories', 10) RETURNING id").get();
    const b = await prepare("INSERT INTO products (name, category, price) VALUES ('[Second product]', 'Accessories', 25) RETURNING id").get();
    await prepare('INSERT INTO online_order_lines (order_id, product_id, qty, unit_pence) VALUES (?, ?, 2, 1000), (?, ?, 1, 2500)').run(order.id, a.id, order.id, b.id);
  });
  await queue(order, 'order_confirmation');
  const [m] = await messagesFor(order);
  assert.equal(m.body, [
    'Hi Maya,',
    `Thanks for your order ${orderReference(order.number)}. It’s paid, and we’ll email you when it’s ready to collect.`,
    'You bought:\n2 × [Product]\n1 × [Second product]',
    'You paid £10.00 store credit and £35.00 by card. Collect it from:',
    `${owner.shop.name}\nOpen Mon to Sun 9:00 to 18:00\n[Shop address] · [shop phone]`,
    'See your order: [link]',
  ].join('\n\n'));
});

test('3.7b how it was paid: by card alone, or store credit alone', async () => {
  const card = await paidOrder();
  await queue(card, 'order_confirmation');
  assert.match((await messagesFor(card))[0].body, /You paid £45\.00 by card\./);
  const credit = await paidOrder({ card: 0, credit: 4500 });
  await queue(credit, 'order_confirmation');
  assert.match((await messagesFor(credit))[0].body, /You paid £45\.00 store credit\./);
});

test('3.7c an unpaid order cancelled has its own wording: no number gap and nothing refunded', async () => {
  const order = await paidOrder({ stage: 'cancelled', paid: false });
  const queued = await queue(order, 'order_cancelled', { vars: { Reason: '[reason]', 'Amount refunded': '£[£]' } });
  assert.ok(queued.id, JSON.stringify(queued));
  const [m] = await messagesFor(order);
  assert.equal(m.template_key, 'order_cancelled_unpaid');
  assert.equal(m.subject, `Your order is cancelled — ${owner.shop.name}`);
  assert.equal(m.body, [
    'Hi Maya,',
    'Your order is cancelled: [reason].',
    'See your order: [link]',
    'Any questions? Call us on [shop phone].',
  ].join('\n\n'));
  assert.equal(TEMPLATES.order_cancelled_unpaid.partOf, 'order_cancelled', 'it follows Order cancelled’s switch and subject');
});

test('3.7c an unpaid cancellation isn’t sent when Order cancelled is switched off', async () => {
  await own('/api/message-templates/order_cancelled', { method: 'PUT', body: { enabled: false } });
  try {
    const order = await paidOrder({ stage: 'cancelled', paid: false });
    assert.deepEqual(await queue(order, 'order_cancelled'), { skipped: 'off' });
  } finally {
    await own('/api/message-templates/order_cancelled', { method: 'PUT', body: { enabled: true } });
  }
});

test('3.7d a second confirmation or cancellation for the same order isn’t queued', async () => {
  const order = await paidOrder();
  assert.ok((await queue(order, 'order_confirmation')).id);
  assert.deepEqual(await queue(order, 'order_confirmation'), { skipped: 'already' });
  assert.ok((await queue(order, 'order_cancelled', { vars: { 'Amount refunded': '£[£]' } })).id);
  assert.deepEqual(await queue(order, 'order_cancelled', { vars: { 'Amount refunded': '£[£]' } }), { skipped: 'already' });
  assert.deepEqual((await messagesFor(order)).map((m) => m.template_key), ['order_confirmation', 'order_cancelled']);
});

test('3.7d a cancellation undone in its Undo time can be sent again', async () => {
  const order = await paidOrder();
  const first = await queue(order, 'order_cancelled', { vars: { 'Amount refunded': '£[£]' } });
  await inShop(() => prepare("UPDATE customer_messages SET intent_state = 'undone', status = 'undone' WHERE id = ?").run(first.id));
  assert.ok((await queue(order, 'order_cancelled', { vars: { 'Amount refunded': '£[£]' } })).id);
});

test('3.7d a confirmation whose email failed can be sent again; one not known to have gone can’t', async () => {
  for (const [state, again] of [['failed', true], ['unknown', false]]) {
    const order = await paidOrder();
    const first = await queue(order, 'order_confirmation');
    await inShop(() => prepare('UPDATE customer_messages SET intent_state = ?, status = ? WHERE id = ?').run(state, state, first.id));
    const second = await queue(order, 'order_confirmation');
    assert.equal(Boolean(second.id), again, state);
  }
});

test('3.7e the reason has its own full stop, and one typed with a stop gets no second', async () => {
  for (const Reason of ['[reason]', '[reason].']) {
    const order = await paidOrder();
    await queue(order, 'order_cancelled', { vars: { Reason, 'Amount refunded': '£[£]' } });
    assert.match((await messagesFor(order))[0].body, new RegExp(`Your order ${orderReference(order.number).replace(/[[\]]/g, '\\$&')} is cancelled: \\[reason\\]\\. We’ve refunded £\\[£\\] the way you paid\\.`), Reason);
  }
  const none = await paidOrder();
  await queue(none, 'order_cancelled', { vars: { 'Amount refunded': '£[£]' } });
  assert.match((await messagesFor(none))[0].body, /is cancelled\. We’ve refunded/, 'no reason: no colon');
});

test('3.7f the shop’s lines leave out what Shop details hasn’t got: no bare "Open", no leading "·"', () => {
  const all = { name: 'North Street Cycles', hours: 'Mon to Sat 9:00 to 17:00', address: '[Shop address]', phone: '[shop phone]' };
  assert.equal(whereToCollect(all), 'North Street Cycles\nOpen Mon to Sat 9:00 to 17:00\n[Shop address] · [shop phone]');
  assert.equal(whereToCollect({ ...all, hours: '' }), 'North Street Cycles\n[Shop address] · [shop phone]');
  assert.equal(whereToCollect({ ...all, address: '' }), 'North Street Cycles\nOpen Mon to Sat 9:00 to 17:00\n[shop phone]');
  assert.equal(whereToCollect({ ...all, phone: null }), 'North Street Cycles\nOpen Mon to Sat 9:00 to 17:00\n[Shop address]');
  assert.equal(whereToCollect({ name: 'North Street Cycles', hours: '', address: null, phone: '' }), 'North Street Cycles');
});

test('3.7f a shop with no address in Shop details: the ready email has no leading "·"', async () => {
  await inShop(() => prepare("UPDATE shops SET address = NULL WHERE id = current_setting('app.current_shop_id')::int").run());
  try {
    const order = await paidOrder({ stage: 'ready', keepUntil: '2026-09-08' });
    await queue(order, 'order_ready');
    const [m] = await messagesFor(order);
    assert.ok(m.body.includes(`${owner.shop.name}\nOpen Mon to Sun 9:00 to 18:00\n[shop phone]\n\n`), m.body);
  } finally {
    await inShop(() => prepare("UPDATE shops SET address = '[Shop address]' WHERE id = current_setting('app.current_shop_id')::int").run());
  }
});

test('3.7g the preview has From and To only for the online order messages', async () => {
  const bike = await own('/api/message-templates/bike_ready/preview', { method: 'POST', body: {} });
  assert.equal(bike.status, 200);
  assert.equal(bike.body.email.from, undefined);
  assert.equal(bike.body.email.to, undefined);
  const order = await own('/api/message-templates/order_confirmation/preview', { method: 'POST', body: {} });
  assert.equal(order.body.email.to, 'maya@example.test');
});

test('3.7g Undo of Mark ready lets go of the undone email', async () => {
  const order = await paidOrder({ stage: 'ready', keepUntil: '2026-09-08' });
  await queue(order, 'order_ready');
  await inShop(() => undoOrderReady(order.id));
  const row = await inShop(() => prepare('SELECT ready_message_id FROM online_orders WHERE id = ?').get(order.id));
  assert.equal(row.ready_message_id, null);
});

test('3.7g an email stuck at "unknown" shows on the order as not arrived', async () => {
  const order = await paidOrder();
  const { id } = await queue(order, 'order_confirmation');
  await inShop(() => prepare("UPDATE customer_messages SET intent_state = 'unknown', status = 'unknown' WHERE id = ?").run(id));
  assert.deepEqual(await inShop(() => orderEmailProblem(order.id)), { failed: 'order_confirmation', phone: '07700 900123' });
});

test('3.7g a second Mark ready stops the first ready email when it comes due', async () => {
  const order = await paidOrder({ stage: 'ready', keepUntil: '2026-09-08' });
  const first = await queue(order, 'order_ready');
  const second = await queue(order, 'order_ready');
  await dueNow(first.id);
  const [a, b] = await messagesFor(order);
  assert.equal(a.id, first.id);
  assert.equal(a.intent_state, 'undone', 'the first went nowhere');
  assert.equal(b.id, second.id);
  assert.equal(b.intent_state, 'intended');
});
