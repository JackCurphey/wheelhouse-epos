// The staff's online orders on the server (openspec/changes/website-buy-online,
// tasks 6.1-6.6; design 5, 7 and 10; drawings on-orders, on-orders-ready,
// on-orders-sold-at-till, on-order-staff, on-not-ready and on-hand-over in
// docs/design/user-journeys/generator/online.mjs). Paid orders are made straight
// in the database, as tests/online-order-messages.test.js makes them: paying
// (group 5) is built separately. Names, emails and amounts are made-up test values.
//
// The server clock is pinned to 1 Sep 2026 (WHEELHOUSE_TEST_CLOCK).
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer, TEST_CLOCK_PIN } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { READY_WAIT_SECONDS } from '../server/online-orders/messages.js';
import { orderReference } from '../server/online-orders/numbers.js';

let server;
let owner;
let site;
let siteName;
let numbers = 500;
const own = (p, options) => staffRequest(server.baseUrl, owner.cookie, p, options);
const post = (p, body = {}) => own(p, { method: 'POST', body });
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const tag = () => randomUUID().slice(0, 8);
const ago = (days, hours = 0) => new Date(new Date(TEST_CLOCK_PIN).getTime() - (days * 24 + hours) * 3600_000).toISOString();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  ({ id: site, name: siteName } = await inShop(() => prepare('SELECT id, name FROM sites ORDER BY id LIMIT 1').get()));
  await inShop(() => prepare("INSERT INTO online_order_settings (remind_days, keep_days, shelf_name) VALUES (3, 7, '[Shelf name]') ON CONFLICT (shop_id) DO UPDATE SET remind_days = 3, keep_days = 7, shelf_name = '[Shelf name]' RETURNING shop_id").get());
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

// A product with a stock figure at the shop.
async function product(qty = 1, name = `[Product ${tag()}]`) {
  return inShop(async () => {
    const { id } = await prepare(
      "INSERT INTO products (sku, name, category, price, cost, stock_qty, active, updated_at) VALUES (?, ?, 'Brakes', 15, 1, ?, 1, now()) RETURNING id",
    ).get(`SKU-${tag()}`, name, qty);
    await prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, ?) RETURNING qty').get(site, id, qty);
    return { id, name };
  });
}
const setStock = (productId, qty) => inShop(() => prepare('UPDATE product_stock SET qty = ? WHERE site_id = ? AND product_id = ?').run(qty, site, productId));

// A paid order for Maya, with its own email, at a stage, with lines.
async function paidOrder({ stage = 'to_get_ready', lines = [], paidAt = ago(0, 2), readyAt = null, collectedAt = null, keepUntil = null } = {}) {
  numbers += 1;
  const email = `maya-${tag()}@example.test`;
  return inShop(async () => {
    const order = await prepare(
      `INSERT INTO online_orders (site_id, name, email, phone, total_pence, card_pence, credit_pence, order_code, request_key_hash, number, paid_at, stage, ready_at, collected_at, keep_until)
       VALUES (?, 'Maya Patel', ?, '07700 900123', 1500, 1500, 0, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, number`,
    ).get(site, email, `code-${tag()}`, `key-${tag()}`, numbers, paidAt, stage, readyAt, collectedAt, keepUntil);
    for (const [p, qty] of lines) {
      await prepare('INSERT INTO online_order_lines (order_id, product_id, qty, unit_pence) VALUES (?, ?, ?, 1500)').run(order.id, p.id, qty);
    }
    return { ...order, email, reference: orderReference(order.number) };
  });
}
const orderRow = (order) => inShop(() => prepare(
  "SELECT stage, ready_at, to_char(keep_until, 'YYYY-MM-DD') AS keep_until, ready_message_id, collected_at, collected_by FROM online_orders WHERE id = ?",
).get(order.id));
const messagesFor = (order) => inShop(() => prepare(
  'SELECT template_key, intent_state FROM customer_messages WHERE to_address = ? ORDER BY id',
).all(order.email));
const eventsOf = (order) => inShop(() => prepare('SELECT kind, detail FROM online_order_events WHERE order_id = ? ORDER BY id').all(order.id));
const listed = async () => {
  const res = await own('/api/online-orders');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
};
const find = (list, order) => {
  for (const g of list.groups) {
    const row = g.orders.find((o) => o.id === order.id);
    if (row) return { group: g.key, row };
  }
  return null;
};

test('6.1 the list in three groups, with their hints and each row’s words', async () => {
  const pads = await product(3, 'Shimano brake pads B05S-RX');
  const toGet = await paidOrder({ lines: [[pads, 1]] });
  const ready = await paidOrder({ stage: 'ready', readyAt: ago(0, 1), keepUntil: '2026-09-08', lines: [[pads, 1]] });
  const late = await paidOrder({ stage: 'ready', readyAt: ago(4), keepUntil: '2026-09-04', lines: [[pads, 1]] });
  const notYet = await paidOrder({ stage: 'ready', readyAt: ago(2), keepUntil: '2026-09-06', lines: [[pads, 1]] });
  const collected = await paidOrder({ stage: 'collected', readyAt: ago(3), collectedAt: ago(3), lines: [[pads, 1]] });
  const old = await paidOrder({ stage: 'collected', readyAt: ago(9), collectedAt: ago(8), lines: [[pads, 1]] });
  const unpaid = await inShop(() => prepare(
    "INSERT INTO online_orders (site_id, name, email, total_pence, card_pence, order_code, request_key_hash, stage) VALUES (?, 'Sam Unpaid', 'sam@example.test', 1500, 1500, ?, ?, 'awaiting_payment') RETURNING id",
  ).get(site, `code-${tag()}`, `key-${tag()}`));
  const cancelled = await paidOrder({ stage: 'cancelled' });

  const list = await listed();
  assert.deepEqual(list.groups.map((g) => [g.key, g.title, g.hint]), [
    ['to_get_ready', 'To get ready', 'Mark ready when everything’s on the shelf for collection — the customer is told straight away.'],
    ['ready', 'Ready to collect', 'Hand over opens the till’s hand-over for that order — it’s already paid.'],
    ['collected', 'Collected', 'The last 7 days. Older orders are on each customer’s page.'],
  ]);

  const a = find(list, toGet);
  assert.equal(a.group, 'to_get_ready');
  assert.equal(a.row.customer, 'Maya Patel');
  assert.equal(a.row.reference, toGet.reference);
  assert.ok(a.row.paidAt, 'paid [time]');
  assert.equal(a.row.how, `Collect · ${siteName}`);
  assert.deepEqual(a.row.items, [{ productId: pads.id, name: 'Shimano brake pads B05S-RX', qty: 1, where: 'On the shelf', notOnShelf: false }]);
  assert.equal(a.row.markReadyOff, null);

  const r = find(list, ready);
  assert.equal(r.group, 'ready');
  assert.ok(r.row.readyAt);
  assert.equal(r.row.items[0].where, 'Waiting at [Shelf name]');
  assert.equal(r.row.notCollectedDays, null, 'ready today: not late');
  assert.equal(find(list, late).row.notCollectedDays, 4, 'past the reminder day (3): "Not collected · 4 days"');
  assert.equal(find(list, notYet).row.notCollectedDays, null, 'before the reminder day');

  const c = find(list, collected);
  assert.equal(c.group, 'collected');
  assert.ok(c.row.collectedAt);
  assert.equal(find(list, old), null, 'collected 8 days ago: older than the last 7 days');
  assert.equal(find(list, { id: unpaid.id }), null, 'not paid yet: not listed');
  assert.equal(find(list, cancelled), null, 'cancelled: not listed');

  // The counts each group shows, and the sidebar's count: To get ready.
  const counts = Object.fromEntries(list.groups.map((g) => [g.key, g.orders.length]));
  const count = await own('/api/online-order-count');
  assert.equal(count.status, 200);
  assert.equal(count.body.count, counts.to_get_ready);
  assert.ok(counts.to_get_ready >= 1);
});

test('6.1 a ready order whose email didn’t arrive says so, with the phone', async () => {
  const order = await paidOrder({ stage: 'ready', readyAt: ago(0, 1), keepUntil: '2026-09-08' });
  await inShop(async () => {
    const m = await prepare(
      "INSERT INTO customer_messages (channel, template_key, to_address, body, status, intent_state) VALUES ('email', 'order_ready', ?, 'x', 'failed', 'failed') RETURNING id",
    ).get(order.email);
    await prepare("INSERT INTO online_order_events (order_id, kind, detail) VALUES (?, 'message', ?)").run(order.id, JSON.stringify({ key: 'order_ready', messageId: m.id }));
  });
  assert.deepEqual(find(await listed(), order).row.emailProblem, { failed: 'order_ready', phone: '07700 900123' });
});

test('6.2 Mark ready moves the order, sets keep_until from the keep days and queues the ready email with its wait', async () => {
  const order = await paidOrder({ lines: [[await product(2), 1]] });
  const before = Date.now();
  const res = await post(`/api/online-orders/${order.id}/ready`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.waitSeconds, READY_WAIT_SECONDS);
  assert.equal(res.body.order.stage, 'ready');
  const row = await orderRow(order);
  assert.equal(row.stage, 'ready');
  assert.ok(row.ready_at);
  assert.equal(row.keep_until, '2026-09-08', 'today (1 Sep) plus 7 keep days');
  assert.ok(row.ready_message_id, 'the ready email is kept for Undo');
  const [m, ...more] = await messagesFor(order);
  assert.deepEqual(more, []);
  assert.deepEqual([m.template_key, m.intent_state], ['order_ready', 'intended']);
  const sendAfter = await inShop(() => prepare('SELECT send_after FROM customer_messages WHERE id = ?').get(row.ready_message_id));
  const wait = new Date(sendAfter.send_after).getTime() - before;
  assert.ok(wait >= READY_WAIT_SECONDS * 1000 - 50, `waits ${READY_WAIT_SECONDS} s, not ${wait} ms`);
  assert.deepEqual((await eventsOf(order)).filter((e) => e.kind !== 'message').map((e) => [e.kind, e.detail.by]), [['ready', 'Jack Lewis']]);

  // Pressed again: the order has moved on.
  const again = await post(`/api/online-orders/${order.id}/ready`);
  assert.deepEqual([again.status, again.body.code], [409, 'wrong_stage']);
  assert.equal((await messagesFor(order)).length, 1, 'one email only');
});

test('6.2 Undo puts the order back and stops the email', async () => {
  const order = await paidOrder({ lines: [[await product(2), 1]] });
  assert.equal((await post(`/api/online-orders/${order.id}/ready`)).status, 200);
  const undo = await post(`/api/online-orders/${order.id}/ready/undo`);
  assert.equal(undo.status, 200, JSON.stringify(undo.body));
  assert.equal(undo.body.order.stage, 'to_get_ready');
  const row = await orderRow(order);
  assert.deepEqual([row.stage, row.ready_at, row.keep_until, row.ready_message_id], ['to_get_ready', null, null, null]);
  assert.deepEqual((await messagesFor(order)).map((m) => m.intent_state), ['undone']);
  // Undo of an order not ready changes nothing.
  const twice = await post(`/api/online-orders/${order.id}/ready/undo`);
  assert.deepEqual([twice.status, twice.body.code], [409, 'wrong_stage']);
});

test('6.3 Not ready after all moves it back and sends the sorry email only when ticked', async () => {
  const told = await paidOrder({ stage: 'ready', readyAt: ago(0, 1), keepUntil: '2026-09-08' });
  const res = await post(`/api/online-orders/${told.id}/not-ready`, { tell: true });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.order.stage, 'to_get_ready');
  const row = await orderRow(told);
  assert.deepEqual([row.stage, row.ready_at, row.keep_until], ['to_get_ready', null, null]);
  assert.deepEqual((await messagesFor(told)).map((m) => m.template_key), ['order_not_ready']);
  assert.deepEqual((await eventsOf(told)).filter((e) => e.kind !== 'message').map((e) => [e.kind, e.detail.told]), [['not_ready', true]]);

  const quiet = await paidOrder({ stage: 'ready', readyAt: ago(0, 1), keepUntil: '2026-09-08' });
  assert.equal((await post(`/api/online-orders/${quiet.id}/not-ready`, { tell: false })).status, 200);
  assert.equal((await orderRow(quiet)).stage, 'to_get_ready');
  assert.deepEqual(await messagesFor(quiet), [], 'unticked: no email');

  // Tick is yes or no; only a ready order moves back.
  const bad = await paidOrder({ stage: 'ready', readyAt: ago(0, 1) });
  assert.equal((await post(`/api/online-orders/${bad.id}/not-ready`, { tell: 'yes' })).status, 400);
  const notReady = await paidOrder();
  const refused = await post(`/api/online-orders/${notReady.id}/not-ready`, { tell: true });
  assert.deepEqual([refused.status, refused.body.code], [409, 'wrong_stage']);
});

test('6.4 Hand over collects a ready order once, with who and when, taking no money and changing no stock', async () => {
  const pads = await product(1);
  const order = await paidOrder({ stage: 'ready', readyAt: ago(0, 1), keepUntil: '2026-09-08', lines: [[pads, 1]] });
  const sales = async () => inShop(async () => (await prepare('SELECT count(*)::int AS n FROM sales').get()).n);
  const stock = async () => inShop(async () => ({
    site: (await prepare('SELECT qty FROM product_stock WHERE site_id = ? AND product_id = ?').get(site, pads.id)).qty,
    total: (await prepare('SELECT stock_qty FROM products WHERE id = ?').get(pads.id)).stock_qty,
  }));
  const [salesBefore, stockBefore] = [await sales(), await stock()];

  const [one, two] = await Promise.all([post(`/api/online-orders/${order.id}/hand-over`), post(`/api/online-orders/${order.id}/hand-over`)]);
  assert.deepEqual([one.status, two.status].sort(), [200, 200], 'sent twice: both answer, the order collected once');
  assert.equal(one.body.order.stage, 'collected');
  assert.equal(one.body.order.collectedBy, 'Jack Lewis');
  const row = await orderRow(order);
  assert.equal(row.stage, 'collected');
  assert.ok(row.collected_at);
  assert.equal((await eventsOf(order)).filter((e) => e.kind === 'collected').length, 1, 'one collected step');
  assert.equal(await sales(), salesBefore, 'no sale: already paid online');
  assert.deepEqual(await stock(), stockBefore, 'no stock change: it came off at payment');
  const c = find(await listed(), order);
  assert.deepEqual([c.group, c.row.collectedBy], ['collected', 'Jack Lewis']);

  // Refused from any other stage, changing nothing.
  for (const stage of ['to_get_ready', 'cancelled']) {
    const other = await paidOrder({ stage });
    const refused = await post(`/api/online-orders/${other.id}/hand-over`);
    assert.deepEqual([refused.status, refused.body.code], [409, 'wrong_stage'], stage);
    assert.equal((await orderRow(other)).stage, stage);
  }
  assert.equal((await post('/api/online-orders/999999999/hand-over')).status, 404);
});

test('6.5 sold at the till anyway: the newest order’s line is not on the shelf, and its Mark ready is off', async () => {
  const pads = await product(0, 'Shimano brake pads B05S-RX');
  const older = await paidOrder({ paidAt: ago(0, 5), lines: [[pads, 1]] });
  const newer = await paidOrder({ paidAt: ago(0, 2), lines: [[pads, 1]] });
  // Both paid: the figure is 0 with two still on the shelf. The till sells one: -1.
  let list = await listed();
  assert.equal(find(list, newer).row.items[0].notOnShelf, false);
  await setStock(pads.id, -1);
  list = await listed();
  const n = find(list, newer).row;
  assert.deepEqual([n.items[0].where, n.items[0].notOnShelf], ['Not on the shelf any more', true]);
  assert.equal(n.markReadyOff, 'Sold at the till. Open the order to sort it.');
  const o = find(list, older).row;
  assert.deepEqual([o.items[0].where, o.markReadyOff], ['On the shelf', null], 'the older order keeps its pads');
  // Mark ready is refused for it on the server too.
  const refused = await post(`/api/online-orders/${newer.id}/ready`);
  assert.deepEqual([refused.status, refused.body.code], [409, 'not_on_shelf']);
  assert.equal((await orderRow(newer)).stage, 'to_get_ready');
  assert.equal((await post(`/api/online-orders/${older.id}/ready`)).status, 200);
  // Both sold: both lines go, the newest first.
  await setStock(pads.id, -2);
  list = await listed();
  assert.equal(find(list, newer).row.items[0].notOnShelf, true);
  assert.equal(find(list, older).row.items[0].notOnShelf, true, 'a ready order’s line can go too');
});

test('6.5 a shortfall smaller than the newest order’s line marks only that line', async () => {
  const tubes = await product(0);
  const big = await paidOrder({ lines: [[tubes, 3]] });
  const first = await paidOrder({ paidAt: ago(1), lines: [[tubes, 1]] });
  await setStock(tubes.id, -1);
  const list = await listed();
  assert.equal(find(list, big).row.items[0].notOnShelf, true);
  assert.equal(find(list, first).row.items[0].notOnShelf, false);
});

test('6.6 the till’s stock lookup says how many are for an online order, with the order number', async () => {
  const pads = await product(1, `Shimano brake pads ${tag()}`);
  const order = await paidOrder({ lines: [[pads, 2]] });
  const collected = await paidOrder({ stage: 'collected', readyAt: ago(1), collectedAt: ago(1), lines: [[pads, 1]] });
  const res = await own(`/api/products?search=${encodeURIComponent(pads.name)}`);
  assert.equal(res.status, 200);
  const [p] = res.body;
  assert.equal(p.id, pads.id);
  assert.deepEqual(p.forOnlineOrders, [{ orderId: order.id, reference: order.reference, qty: 2 }], 'only open orders; the collected one has gone');
  assert.equal(p.freeQty, 1, 'the figure already lost them at payment');
  assert.ok(collected.id);
  const plain = (await own(`/api/products?search=${encodeURIComponent('no such product')}`)).body;
  assert.deepEqual(plain, []);
});

test('who may: a till with nobody checked in can’t take a step', async () => {
  const order = await paidOrder({ stage: 'ready', readyAt: ago(0, 1) });
  const jar = new Map();
  const cookie0 = await staffFreshCookie(owner.loginId);
  const send = async (path, body) => {
    const cookie = [cookie0, ...[...jar].map(([k, v]) => `${k}=${v}`)].join('; ');
    const res = await fetch(`${server.baseUrl}${path}`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      jar.set(pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1));
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  assert.equal((await send('/api/till-setup', { siteId: site, number: 7 })).status, 201);
  const nobody = await send(`/api/online-orders/${order.id}/hand-over`, {});
  assert.deepEqual([nobody.status, nobody.body.code], [409, 'check_in_first']);
  assert.equal((await orderRow(order)).stage, 'ready');
});
