// Handing a Cycle to Work bike over at the till: the sale
// (openspec/changes/cycle-to-work, tasks 7.1–7.4; design 5; drawings cw-hand-over,
// till-c2w-basket, till-c2w-pay, till-c2w-extra, till-c2w-paid-cert, till-c2w-paid
// in docs/design/user-journeys/generator/c2w.mjs and till.mjs). The drawings
// leave amounts and numbers bracketed, so the figures here are made-up test values.
//
// The server clock is pinned to 1 Sep 2026 (WHEELHOUSE_TEST_CLOCK).
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedProduct } from './helpers/till.js';

let server;
let owner;
let provider;
let maya;
let site;
let lock;
let pump;
let cashierId;
const own = (p, options) => staffRequest(server.baseUrl, owner.cookie, p, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const tag = () => randomUUID().slice(0, 8);
const TENDER = 'Cycle to Work · [Provider]';

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const set = await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 7, remindDays: 2, quoteValidDays: 30 } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  // 10% commission, paying in about 28 days, with two checks at hand-over.
  const made = await own('/api/c2w/providers', {
    method: 'POST',
    body: { name: '[Provider]', commissionKind: 'percent', commissionValue: 1000, paysInDays: 28, handoverNote: '[Check one]\n\n[Check two]' },
  });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  provider = made.body.provider;
  maya = (await own('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: `maya-${tag()}@example.test` } })).body;
  site = await inShop(async () => (await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get()).id);
  lock = await seedProduct(owner.shop.id, { name: '[Lock]', price: '40.00' });
  pump = await seedProduct(owner.shop.id, { name: '[Pump]', price: '20.00' });
  const jo = await own('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${tag()}@example.test`, password: 'password123' } });
  cashierId = jo.body.employeeId;
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

// A bike at £1,000 with one frame number, in stock at the shop's site.
async function framedBike() {
  const id = await seedProduct(owner.shop.id, { name: '[Bike] · [Size]', price: '1000.00', stock: 1 });
  await inShop(async () => {
    await prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, ?) RETURNING product_id').get(site, id, 1);
    const key = `[FRAME-${tag()}]`;
    await prepare('INSERT INTO stock_frames (product_id, site_id, frame_number, frame_key) VALUES (?, ?, ?, ?) RETURNING id').get(id, site, key, key);
  });
  return id;
}
const post = (p, body) => own(p, { method: 'POST', body });
const order = async (id) => (await own(`/api/c2w/orders/${id}`)).body.order;
// Maya's order for the bike and a £40 lock (£1,040), certificate £800, ready to collect.
async function readyOrder({ certificatePence = 80000, providerId = provider.id } = {}) {
  const bike = await framedBike();
  const res = await post('/api/c2w/orders', { customerId: maya.id, providerId, productId: bike, accessoryIds: [lock] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const cert = await post(`/api/c2w/orders/${res.body.order.id}/certificate`, { number: '[certificate number]', amountPence: certificatePence, difference: 'keep', ready: true });
  assert.equal(cert.status, 200, JSON.stringify(cert.body));
  assert.equal(cert.body.order.stage, 'ready');
  return { ...cert.body.order, bike };
}
const sell = (body) => post('/api/sales', { cashierId, sellPastStock: true, requestKey: randomUUID(), items: [], ...body });
const salesCount = () => inShop(async () => Number((await prepare('SELECT count(*)::int AS n FROM sales').get()).n));
const paymentsOf = (saleId) => inShop(async () => prepare('SELECT tender_type, amount FROM sale_payments WHERE sale_id = ? ORDER BY id').all(saleId));

// ---------- 7.1–7.3 ----------

test('7.2–7.3 the hand-over sale: the server adds the provider’s share, the order is collected and expected, the frame is sold onto Maya’s bike', async () => {
  const o = await readyOrder();
  const res = await sell({ c2wOrderId: o.id, cardAmount: 240, c2wChecks: ['[Check one]'] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const sale = res.body;
  assert.equal(sale.customerId, maya.id, 'the sale is Maya’s');
  // The bike and the order's accessory, at the quoted prices.
  assert.deepEqual(sale.items.map((it) => [it.productId, it.unitPrice, it.qty]), [[o.bike, 1000, 1], [lock, 40, 1]]);
  assert.equal(sale.total, 1040);
  assert.deepEqual(await paymentsOf(sale.id), [{ tender_type: TENDER, amount: 800 }]);
  assert.equal(sale.cardAmount, 240);

  const after = await order(o.id);
  assert.deepEqual([after.stage, after.saleId], ['collected', sale.id]);
  assert.ok(after.collectedAt, 'collected now');
  // What the provider pays less its 10% commission, by collection plus its 28 days.
  assert.deepEqual([after.expectedPence, after.expectedBy], [72000, '2026-09-29']);
  const line = after.events.at(-1);
  assert.deepEqual([line.kind, line.by], ['collected', 'Jo Taylor']);
  assert.deepEqual(line.detail, { saleId: sale.id, providerPence: 80000, checks: ['[Check one]'] });

  const frame = await inShop(async () => prepare('SELECT f.state, f.customer_id, b.serial_number, b.bought_here_on FROM stock_frames f JOIN customer_bikes b ON b.id = f.customer_bike_id WHERE f.id = ?').get(o.frameId));
  assert.deepEqual([frame.state, frame.customer_id], ['sold', maya.id]);
  assert.match(frame.serial_number, /^\[FRAME-/, 'on Maya’s bike record by its frame number');
  assert.ok(frame.bought_here_on, 'bought here');
});

test('7.4 the order names the frame held for it, for the till’s line and its collected note (till.mjs c2wLine)', async () => {
  const o = await readyOrder();
  const held = await inShop(async () => prepare('SELECT frame_number FROM stock_frames WHERE id = ?').get(o.frameId));
  assert.equal((await order(o.id)).frameNumber, held.frame_number);
  assert.match(held.frame_number, /^\[FRAME-/);
  const bike = await framedBike();
  const unheld = (await post('/api/c2w/orders', { customerId: maya.id, providerId: provider.id, productId: bike, accessoryIds: [], hold: false })).body.order;
  assert.equal(unheld.frameNumber, null, 'no frame, no number');
});

test('7.2 a sale claiming a different share is refused, and the order stays ready; the same share is taken once', async () => {
  const o = await readyOrder();
  const before = await salesCount();
  const wrong = await sell({ c2wOrderId: o.id, cardAmount: 340, payments: [{ tenderType: TENDER, amount: 700 }] });
  assert.deepEqual([wrong.status, wrong.body.code], [400, 'c2w_share']);
  assert.equal(await salesCount(), before, 'nothing kept');
  assert.equal((await order(o.id)).stage, 'ready');
  // Another provider's name is a different share too.
  const other = await sell({ c2wOrderId: o.id, cardAmount: 240, payments: [{ tenderType: 'Cycle to Work · [Other]', amount: 800 }] });
  assert.deepEqual([other.status, other.body.code], [400, 'c2w_share']);

  const right = await sell({ c2wOrderId: o.id, cardAmount: 240, payments: [{ tenderType: TENDER, amount: 800 }] });
  assert.equal(right.status, 201, JSON.stringify(right.body));
  assert.deepEqual(await paymentsOf(right.body.id), [{ tender_type: TENDER, amount: 800 }], 'one share, not two');
});

test('7.2 only an order at Ready to collect can be handed over', async () => {
  const bike = await framedBike();
  const made = (await post('/api/c2w/orders', { customerId: maya.id, providerId: provider.id, productId: bike, accessoryIds: [] })).body.order;
  const before = await salesCount();
  const early = await sell({ c2wOrderId: made.id, cardAmount: 1000 });
  assert.deepEqual([early.status, early.body.code], [409, 'wrong_stage']);
  const missing = await sell({ c2wOrderId: 999999, cardAmount: 1000 });
  assert.equal(missing.status, 404);
  const junk = await sell({ c2wOrderId: 'one', cardAmount: 1000 });
  assert.equal(junk.status, 400);
  assert.equal(await salesCount(), before);
});

test('7.2 a sale sent twice counts once; a second hand-over of the same order is refused', async () => {
  const o = await readyOrder();
  const body = { c2wOrderId: o.id, cardAmount: 240, requestKey: randomUUID() };
  const first = await sell(body);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const again = await sell(body);
  assert.deepEqual([again.status, again.body.id], [201, first.body.id], 'the first answer');
  const second = await sell({ c2wOrderId: o.id, cardAmount: 240 });
  assert.deepEqual([second.status, second.body.code], [409, 'wrong_stage']);
  const sales = await inShop(async () => prepare('SELECT count(*)::int AS n FROM sale_payments WHERE tender_type = ? AND sale_id = ?').get(TENDER, first.body.id));
  assert.equal(sales.n, 1);
});

test('7.3 the provider’s share is never cash in the drawer: close the day counts only what Maya pays in cash', async () => {
  // The day's float, counted this morning, so close the day works out the drawer.
  await inShop(async () => prepare('INSERT INTO float_checks (day, login_id, expected_pence, counted_pence, checked_at) VALUES (?, ?, ?, ?, ?) RETURNING id')
    .get('2026-09-01', owner.loginId, 15000, 15000, '2026-09-01T06:00:00Z'));
  const drawer = async () => {
    const res = await own('/api/close-the-day');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body;
  };
  const before = await drawer();
  const o = await readyOrder();
  const res = await sell({ c2wOrderId: o.id, cashAmount: 240, cashTendered: 250 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(await paymentsOf(res.body.id), [{ tender_type: TENDER, amount: 800 }]);
  const after = await drawer();
  assert.equal(after.cashPence - before.cashPence, 24000, 'Maya’s £240 cash, not the provider’s £800');
  assert.equal(after.expectedPence - before.expectedPence, 24000);
});

test('7.3 commission in pounds, and a provider with no days to pay has no expected date', async () => {
  const flat = (await post('/api/c2w/providers', { name: '[Flat provider]', commissionKind: 'pounds', commissionValue: 5000 })).body.provider;
  const o = await readyOrder({ providerId: flat.id });
  const res = await sell({ c2wOrderId: o.id, cardAmount: 240 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(await paymentsOf(res.body.id), [{ tender_type: 'Cycle to Work · [Flat provider]', amount: 800 }]);
  const after = await order(o.id);
  assert.deepEqual([after.expectedPence, after.expectedBy], [75000, null]);
});

test('7.3 a percentage commission on odd pence rounds to the nearest penny', async () => {
  const o = await readyOrder({ certificatePence: 80005 });
  const res = await sell({ c2wOrderId: o.id, cardAmount: 239.95 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal((await order(o.id)).expectedPence, 72004, '£800.05 less 10% (£80.005, rounded to £80.01)');
});

test('7.2 two hand-overs of one order at once: one sale, the other refused', async () => {
  const o = await readyOrder();
  const before = await salesCount();
  const both = await Promise.all([sell({ c2wOrderId: o.id, cardAmount: 240 }), sell({ c2wOrderId: o.id, cardAmount: 240 })]);
  // The second waits on the order's lock: refused as already collected, or, on a
  // slow machine, as busy once the lock wait runs out (limitLockWait, 2 s).
  const statuses = both.map((r) => r.status).sort();
  assert.ok(statuses[0] === 201 && [409, 503].includes(statuses[1]), JSON.stringify(statuses));
  assert.equal(await salesCount(), before + 1);
});

test('7.2 a bike no longer held for the order is refused, and nothing changes', async () => {
  const o = await readyOrder();
  await inShop(async () => prepare("UPDATE stock_frames SET state = 'sold' WHERE id = ? RETURNING id").get(o.frameId));
  const before = await salesCount();
  const res = await sell({ c2wOrderId: o.id, cardAmount: 240 });
  assert.deepEqual([res.status, res.body.code], [409, 'not_held']);
  assert.equal(await salesCount(), before);
  assert.equal((await order(o.id)).stage, 'ready');
});

test('7.2 the sale is the order’s customer’s, whoever the till has picked', async () => {
  const o = await readyOrder();
  const other = (await own('/api/customers', { method: 'POST', body: { name: 'Sam Reed', email: `sam-${tag()}@example.test` } })).body;
  const res = await sell({ c2wOrderId: o.id, cardAmount: 240, customerId: other.id });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const sale = await inShop(async () => prepare('SELECT customer_id FROM sales WHERE id = ?').get(res.body.id));
  assert.equal(sale.customer_id, maya.id);
});

// A site code is one to three capital letters.
const letters = () => Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');

test('7.2 a bike held at another of the shop’s sites is handed over there, not at this till', async () => {
  const o = await readyOrder();
  await inShop(async () => {
    const elsewhere = (await prepare(`INSERT INTO sites (name, code) VALUES ('[Other site]', ?) RETURNING id`).get(letters())).id;
    await prepare('UPDATE c2w_orders SET site_id = ? WHERE id = ? RETURNING id').get(elsewhere, o.id);
    await prepare('UPDATE stock_frames SET site_id = ? WHERE id = ? RETURNING id').get(elsewhere, o.frameId);
  });
  const before = await salesCount();
  const res = await sell({ c2wOrderId: o.id, cardAmount: 240 });
  assert.deepEqual([res.status, res.body.code], [409, 'c2w_other_site']);
  assert.match(res.body.error, /\[Other site\]/);
  assert.equal(await salesCount(), before);
  assert.equal((await order(o.id)).stage, 'ready');
});

test('7.2 a frame held for a different order is refused, and nothing changes', async () => {
  const o = await readyOrder();
  const other = await readyOrder();
  await inShop(async () => prepare('UPDATE stock_frames SET c2w_order_id = ? WHERE id = ? RETURNING id').get(other.id, o.frameId));
  const before = await salesCount();
  const res = await sell({ c2wOrderId: o.id, cardAmount: 240 });
  assert.deepEqual([res.status, res.body.code], [409, 'not_held']);
  assert.equal(await salesCount(), before);
  assert.equal((await order(o.id)).stage, 'ready');
});

test('7.2 at a till in the other site, the bike held there is handed over', async () => {
  const o = await readyOrder();
  const elsewhere = await inShop(async () => {
    const id = (await prepare(`INSERT INTO sites (name, code) VALUES ('[Other site]', ?) RETURNING id`).get(letters())).id;
    await prepare('UPDATE c2w_orders SET site_id = ? WHERE id = ? RETURNING id').get(id, o.id);
    await prepare('UPDATE stock_frames SET site_id = ? WHERE id = ? RETURNING id').get(id, o.frameId);
    return id;
  });
  const made = await fetch(`${server.baseUrl}/api/till-setup`, { method: 'POST', headers: { cookie: owner.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ siteId: elsewhere, number: 8 }) });
  assert.equal(made.status, 201, await made.text());
  const tillCookie = [owner.cookie, ...made.headers.getSetCookie().map((l) => l.split(';')[0])].join('; ');
  const res = await staffRequest(server.baseUrl, tillCookie, '/api/sales', { method: 'POST', body: { cashierId, sellPastStock: true, requestKey: randomUUID(), items: [], c2wOrderId: o.id, cardAmount: 240 } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal((await order(o.id)).stage, 'collected');
});

test('7.2 the till can’t put the order’s bike on the sale a second time', async () => {
  const o = await readyOrder();
  const before = await salesCount();
  const res = await sell({ c2wOrderId: o.id, items: [{ productId: o.bike, qty: 1 }], cardAmount: 1240 });
  assert.deepEqual([res.status, res.body.code], [400, 'c2w_bike_twice']);
  assert.equal(await salesCount(), before);
  assert.equal((await order(o.id)).stage, 'ready');
});

test('7.2 a Cycle to Work payment on a sale with no order is refused, however it is written', async () => {
  const before = await salesCount();
  const res = await sell({ items: [{ productId: pump, qty: 1 }], payments: [{ tenderType: 'CYCLE TO WORK · [Provider]', amount: 20 }] });
  assert.deepEqual([res.status, res.body.code], [400, 'c2w_share']);
  assert.equal(await salesCount(), before);
});

// ---------- 7.4 ----------

test('7.4 anything Maya adds at the counter goes on the same sale, for her to pay', async () => {
  const o = await readyOrder();
  const res = await sell({ c2wOrderId: o.id, items: [{ productId: pump, qty: 1 }], cardAmount: 260 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(res.body.items.map((it) => it.productId), [o.bike, lock, pump]);
  assert.equal(res.body.total, 1060);
  assert.deepEqual(await paymentsOf(res.body.id), [{ tender_type: TENDER, amount: 800 }], 'the provider’s share is unchanged');
});

test('7.4 a certificate covering the whole order: Maya pays nothing, and a discount lowers what the provider pays, never above the sale', async () => {
  const whole = await readyOrder({ certificatePence: 104000 });
  const res = await sell({ c2wOrderId: whole.id });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(await paymentsOf(res.body.id), [{ tender_type: TENDER, amount: 1040 }]);

  const o = await readyOrder();
  const off = await sell({ c2wOrderId: o.id, discount: 300 });
  assert.equal(off.status, 201, JSON.stringify(off.body));
  assert.deepEqual([off.body.total, off.body.cardAmount], [740, 0]);
  assert.deepEqual(await paymentsOf(off.body.id), [{ tender_type: TENDER, amount: 740 }]);
  assert.equal((await order(o.id)).expectedPence, 66600, '£740 less 10%');

  // A discount never moves what Maya adds at the counter onto the provider.
  const both = await readyOrder({ certificatePence: 104000 });
  const extra = await sell({ c2wOrderId: both.id, items: [{ productId: pump, qty: 1 }], discount: 20, cardAmount: 20 });
  assert.equal(extra.status, 201, JSON.stringify(extra.body));
  assert.equal(extra.body.total, 1040);
  assert.deepEqual(await paymentsOf(extra.body.id), [{ tender_type: TENDER, amount: 1020 }], 'Maya pays for the pump');
});

test('7.1 the ticked checks must be the provider’s own lines', async () => {
  const o = await readyOrder();
  for (const c2wChecks of [['[Not a check]'], '[Check one]', [1]]) {
    const res = await sell({ c2wOrderId: o.id, cardAmount: 240, c2wChecks });
    assert.equal(res.status, 400, JSON.stringify(c2wChecks));
  }
  assert.equal((await order(o.id)).stage, 'ready');
  const none = await sell({ c2wOrderId: o.id, cardAmount: 240 });
  assert.equal(none.status, 201, 'no ticks is allowed');
  assert.deepEqual((await order(o.id)).events.at(-1).detail.checks, []);
});

test('7.2 a plain sale can’t claim a Cycle to Work payment, and still needs items', async () => {
  const claim = await sell({ items: [{ productId: pump, qty: 1 }], payments: [{ tenderType: TENDER, amount: 20 }] });
  assert.deepEqual([claim.status, claim.body.code], [400, 'c2w_share']);
  const empty = await sell({ cardAmount: 0 });
  assert.equal(empty.status, 400);
  // Nor can paying for a counter order.
  const made = await own('/api/sale-documents', { method: 'POST', body: { kind: 'order', items: [{ lineType: 'product', productId: pump, qty: 1 }] } });
  assert.equal(made.status, 201);
  const paid = await own(`/api/sale-documents/${made.body.id}/convert`, { method: 'POST', body: { cashierId, sellPastStock: true, payments: [{ tenderType: TENDER, amount: 20 }] } });
  assert.deepEqual([paid.status, paid.body.code], [400, 'c2w_share']);
});
