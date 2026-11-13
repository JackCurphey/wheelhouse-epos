// The provider's money (openspec/changes/cycle-to-work, design 6 and 7; tasks
// 8.1–8.4): Mark paid, Save as part paid, Close with a reason, Record a payment
// and the Owed lists. Drawings cw-mark-paid, cw-mark-paid-diff, cw-record-payment,
// cw-record-payment-more, cw-owed and cw-owed-provider in
// docs/design/user-journeys/generator/c2w.mjs. The drawings leave names, amounts
// and references bracketed, so the values here are made-up test values.
//
// Collected orders are put in place with SQL: the hand-over sale that collects
// them is pull request 7's, tested in tests/c2w-hand-over.test.js.
//
// The server clock is pinned to 1 Sep 2026 (WHEELHOUSE_TEST_CLOCK).
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let jo;
let provider;
let other;
let maya;
let productId;
const own = (p, options) => staffRequest(server.baseUrl, owner.cookie, p, options);
const asJo = (p, options) => staffRequest(server.baseUrl, jo, p, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const tag = () => randomUUID().slice(0, 8);
const post = (p, body, as = own) => as(p, { method: 'POST', body });

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const made = await own('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${tag()}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = await staffFreshCookie(made.body.loginId);
  const set = await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 7, remindDays: 2, quoteValidDays: 30 } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  provider = (await own('/api/c2w/providers', { method: 'POST', body: { name: '[Provider]' } })).body.provider;
  other = (await own('/api/c2w/providers', { method: 'POST', body: { name: '[Other provider]' } })).body.provider;
  maya = (await own('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: `maya-${tag()}@example.test` } })).body;
  productId = await inShop(async () => (await prepare(
    "INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES (?, '[Bike] · [Size]', 'Bikes', 1000, 600, 0, now())"
  ).run(`[Supplier code]-${tag()}`)).lastInsertRowid);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

// A £1,000 order collected on 20 Aug, its certificate £1,000, the provider
// expected to pay `expected` pence by `by` (12 days late on 1 Sep by default).
async function collected({ expected = 90000, by = '2026-08-20', prov = provider, paid = null, at = '2026-08-20T10:00:00Z' } = {}) {
  const res = await post('/api/c2w/orders', { customerId: maya.id, providerId: prov.id, productId, accessoryIds: [] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const { id } = res.body.order;
  await inShop(() => prepare(`UPDATE c2w_orders SET stage = 'collected', certificate_number = ?, certificate_pence = 100000,
    collected_at = ?, expected_pence = ?, expected_by = ?, paid_pence = ? WHERE id = ?`).run(`[certificate ${tag()}]`, at, expected, by, paid, id));
  return id;
}
const order = async (id) => (await own(`/api/c2w/orders/${id}`)).body.order;
// What an order is owed now, as the screen would have shown it (null if it can't be seen or has nothing expected).
const owedNow = (id) => inShop(async () => {
  const r = await prepare('SELECT expected_pence, paid_pence FROM c2w_orders WHERE id = ?').get(id);
  return r && r.expected_pence !== null ? r.expected_pence - (r.paid_pence ?? 0) : null;
});
const markPaid = async (id, body, as = own) => post(`/api/c2w/orders/${id}/paid`, { receivedOn: '2026-09-01', reference: '[reference]', owedPence: await owedNow(id), ...body }, as);
const record = async (body, as = own, prov = provider) => {
  let expectedPence = null;
  if (Array.isArray(body.orderIds) && body.orderIds.every(Number.isInteger)) {
    expectedPence = 0;
    for (const i of body.orderIds) expectedPence += (await owedNow(i)) ?? 0;
  }
  return post(`/api/c2w/providers/${prov.id}/payments`, { receivedOn: '2026-09-01', reference: '[reference]', expectedPence, ...body }, as);
};
const paymentsOf = (id) => inShop(() => prepare(`SELECT p.amount_pence, to_char(p.received_on, 'YYYY-MM-DD') AS received_on, p.reference, po.amount_pence AS put
  FROM c2w_payment_orders po JOIN c2w_payments p ON p.id = po.payment_id WHERE po.order_id = ? ORDER BY po.id`).all(id));
const lastEvent = async (id) => (await order(id)).events.at(-1);

test('8.1 Mark paid for what was expected moves the order to Paid by the provider', async () => {
  const id = await collected();
  const res = await markPaid(id, { amountPence: 90000 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const o = await order(id);
  assert.deepEqual([o.stage, o.paidPence, o.paidOn, o.providerReference], ['paid', 90000, '2026-09-01', '[reference]']);
  assert.deepEqual(await paymentsOf(id), [{ amount_pence: 90000, received_on: '2026-09-01', reference: '[reference]', put: 90000 }]);
  const e = o.events.at(-1);
  assert.deepEqual([e.kind, e.by, e.detail.amountPence], ['paid', 'Jack Lewis', 90000]);
});

test('8.1 A different amount is refused with the difference, and nothing changes', async () => {
  const id = await collected();
  const less = await markPaid(id, { amountPence: 85000 });
  assert.equal(less.status, 409, JSON.stringify(less.body));
  assert.deepEqual([less.body.code, less.body.differencePence], ['difference', -5000]);
  const o = await order(id);
  assert.deepEqual([o.stage, o.paidPence], ['collected', null]);
  assert.deepEqual(await paymentsOf(id), []);
});

test('8.1 Save as part paid keeps it Collected; Mark the rest paid then pays it', async () => {
  const id = await collected();
  const part = await markPaid(id, { amountPence: 60000, as: 'part' });
  assert.equal(part.status, 200, JSON.stringify(part.body));
  let o = await order(id);
  assert.deepEqual([o.stage, o.paidPence, o.next], ['collected', 60000, 'paid']);
  assert.equal(o.events.at(-1).kind, 'part_paid');
  // The rest is what's still owed: £300 of the £900.
  const wrongRest = await markPaid(id, { amountPence: 90000 });
  assert.equal(wrongRest.status, 409, JSON.stringify(wrongRest.body));
  assert.equal(wrongRest.body.differencePence, 60000);
  const rest = await markPaid(id, { amountPence: 30000, reference: '[second reference]' });
  assert.equal(rest.status, 200, JSON.stringify(rest.body));
  o = await order(id);
  assert.deepEqual([o.stage, o.paidPence], ['paid', 90000]);
  assert.deepEqual((await paymentsOf(id)).map((p) => p.put), [60000, 30000]);
});

test('8.1 Close with a reason closes the order with the shortfall recorded', async () => {
  const id = await collected();
  const blank = await markPaid(id, { amountPence: 85000, as: 'close', reason: '  ' });
  assert.equal(blank.status, 400, JSON.stringify(blank.body));
  const res = await markPaid(id, { amountPence: 85000, as: 'close', reason: '[reason]' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const o = await order(id);
  assert.deepEqual([o.stage, o.paidPence, o.closeReason], ['closed', 85000, '[reason]']);
  const e = o.events.at(-1);
  assert.deepEqual([e.kind, e.reason, e.detail.shortfallPence, e.by], ['shortfall_closed', '[reason]', 5000, 'Jack Lewis']);
  assert.equal((await markPaid(id, { amountPence: 5000 })).status, 409, 'a closed order takes no more payments');
});

test('8.1 Part paid and close are only for less than owed; more is saved as paid with the extra noted', async () => {
  const id = await collected();
  assert.equal((await markPaid(id, { amountPence: 95000, as: 'part' })).status, 400);
  assert.equal((await markPaid(id, { amountPence: 90000, as: 'close', reason: '[reason]' })).status, 400);
  assert.equal((await markPaid(id, { amountPence: 85000, as: 'paid' })).status, 400);
  assert.equal((await order(id)).stage, 'collected');
  const more = await markPaid(id, { amountPence: 95000 });
  assert.deepEqual([more.status, more.body.differencePence], [409, 5000]);
  const res = await markPaid(id, { amountPence: 95000, as: 'paid' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const o = await order(id);
  assert.deepEqual([o.stage, o.paidPence], ['paid', 90000]);
  assert.equal(o.events.at(-1).detail.extraPence, 5000);
  assert.deepEqual((await paymentsOf(id)).map((p) => [p.amount_pence, p.put]), [[95000, 90000]]);
});

test('8.1 Mark paid checks what it is given, and is only for a collected order', async () => {
  const id = await collected();
  for (const body of [{ amountPence: -1 }, { amountPence: 1.5 }, { amountPence: 90000, receivedOn: 'soon' }, { amountPence: 90000, receivedOn: '2026-09-02' }, { amountPence: 90000, reference: 'x'.repeat(61) }]) {
    const res = await markPaid(id, body);
    assert.equal(res.status, 400, `${JSON.stringify(body)} → ${JSON.stringify(res.body)}`);
  }
  const quote = (await post('/api/c2w/orders', { customerId: maya.id, providerId: provider.id, productId, accessoryIds: [] })).body.order;
  const early = await markPaid(quote.id, { amountPence: 0 });
  assert.deepEqual([early.status, early.body.code], [409, 'wrong_stage']);
  assert.equal((await markPaid(999999, { amountPence: 1 })).status, 404);
});

test('8.2 Record a payment over several ticked bikes marks each paid', async () => {
  const a = await collected({ expected: 90000 });
  const b = await collected({ expected: 45000 });
  const res = await record({ amountPence: 135000, orderIds: [a, b] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual([res.body.expectedPence, res.body.receivedPence, res.body.differencePence], [135000, 135000, 0]);
  assert.deepEqual([(await order(a)).stage, (await order(b)).stage], ['paid', 'paid']);
  assert.deepEqual((await paymentsOf(a)).map((p) => [p.amount_pence, p.put]), [[135000, 90000]]);
  assert.deepEqual((await paymentsOf(b)).map((p) => [p.amount_pence, p.put]), [[135000, 45000]]);
  assert.equal((await lastEvent(a)).kind, 'paid');
});

test('8.2 A payment that is less saves the bikes it does not fully cover as part paid, oldest first', async () => {
  // Made newest first, so the order they were made in is not the order they are paid in.
  const newer = await collected({ expected: 45000, by: '2026-08-25' });
  const older = await collected({ expected: 90000, by: '2026-08-10' });
  const res = await record({ amountPence: 100000, orderIds: [newer, older] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.differencePence, -35000);
  const [o1, o2] = [await order(older), await order(newer)];
  assert.deepEqual([o1.stage, o1.paidPence], ['paid', 90000]);
  assert.deepEqual([o2.stage, o2.paidPence], ['collected', 10000]);
  assert.equal((await lastEvent(newer)).kind, 'part_paid');
});

test('8.2 a bike the payment doesn’t reach is left as it was', async () => {
  const first = await collected({ expected: 50000, at: '2026-08-01T10:00:00Z' });
  const second = await collected({ expected: 50000, at: '2026-08-02T10:00:00Z' });
  const third = await collected({ expected: 50000, at: '2026-08-03T10:00:00Z' });
  const res = await record({ amountPence: 50000, orderIds: [third, second, first] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await order(first)).stage, 'paid');
  for (const id of [second, third]) {
    const o = await order(id);
    assert.deepEqual([o.stage, o.paidPence ?? 0], ['collected', 0]);
    assert.ok(!o.events.some((e) => e.kind === 'part_paid' || e.kind === 'paid'), JSON.stringify(o.events.at(-1)));
    assert.deepEqual(await paymentsOf(id), []);
  }
});

test('8.2 a payment of nothing is refused, and nothing changes', async () => {
  const a = await collected({ expected: 90000 });
  const res = await record({ amountPence: 0, orderIds: [a] });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal((await order(a)).stage, 'collected');
  assert.deepEqual(await paymentsOf(a), []);
});

test('8.2 A payment that is more marks each paid and notes the extra on the payment', async () => {
  const a = await collected({ expected: 90000 });
  const res = await record({ amountPence: 92000, orderIds: [a] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual([res.body.differencePence, (await order(a)).stage], [2000, 'paid']);
  assert.equal((await lastEvent(a)).detail.extraPence, 2000);
});

test('8.2 Record a payment refuses bikes that are not this provider’s collected ones, and changes nothing', async () => {
  const mine = await collected();
  const theirs = await collected({ prov: other });
  const quote = (await post('/api/c2w/orders', { customerId: maya.id, providerId: provider.id, productId, accessoryIds: [] })).body.order;
  for (const orderIds of [[mine, theirs], [mine, quote.id], [], [mine, mine], 'all']) {
    const res = await record({ amountPence: 90000, orderIds });
    assert.ok([400, 409].includes(res.status), `${JSON.stringify(orderIds)} → ${res.status} ${JSON.stringify(res.body)}`);
  }
  assert.equal((await order(mine)).stage, 'collected');
  assert.deepEqual(await paymentsOf(mine), []);
});

test('8.1 a part payment sent twice counts once: the second is refused as what’s owed has changed', async () => {
  const id = await collected();
  const first = await markPaid(id, { amountPence: 30000, as: 'part', owedPence: 90000 });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const again = await markPaid(id, { amountPence: 30000, as: 'part', owedPence: 90000 });
  assert.deepEqual([again.status, again.body.code], [409, 'owed_changed']);
  assert.equal((await order(id)).paidPence, 30000);
  assert.equal((await paymentsOf(id)).length, 1);
  const missing = await markPaid(id, { amountPence: 60000, owedPence: undefined });
  assert.equal(missing.status, 400, JSON.stringify(missing.body));
});

test('8.2 a payment sent twice counts once: the second is refused as what’s owed has changed', async () => {
  const a = await collected();
  const first = await record({ amountPence: 30000, orderIds: [a], expectedPence: 90000 });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const again = await record({ amountPence: 30000, orderIds: [a], expectedPence: 90000 });
  assert.deepEqual([again.status, again.body.code], [409, 'owed_changed']);
  assert.equal((await order(a)).paidPence, 30000);
  assert.equal((await paymentsOf(a)).length, 1);
});

test('8.1–8.2 an order with nothing expected from the provider can’t be paid, and nothing changes', async () => {
  const id = await collected({ expected: null });
  const one = await markPaid(id, { amountPence: 0, owedPence: 0 });
  assert.deepEqual([one.status, one.body.code], [409, 'no_expected']);
  const many = await record({ amountPence: 0, orderIds: [id], expectedPence: 0 });
  assert.deepEqual([many.status, many.body.code], [409, 'no_expected']);
  assert.equal((await order(id)).stage, 'collected');
  assert.deepEqual(await paymentsOf(id), []);
});

test('8.2 oldest first is the first collected, then the earliest expected', async () => {
  // Expected 14 Aug (a Friday) made first, then 10 Aug (a Monday): the Monday one is paid first.
  const fri = await collected({ expected: 45000, by: '2026-08-14' });
  const mon = await collected({ expected: 45000, by: '2026-08-10' });
  // Collected a day earlier, though expected later: paid before both.
  const first = await collected({ expected: 45000, by: '2026-08-25', at: '2026-08-19T10:00:00Z' });
  const res = await record({ amountPence: 100000, orderIds: [fri, mon, first] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual([(await order(first)).paidPence, (await order(mon)).paidPence, (await order(fri)).paidPence], [45000, 45000, 10000]);
});

test('8.2 the extra on a payment is noted once, not on every bike it pays', async () => {
  const a = await collected({ expected: 90000 });
  const b = await collected({ expected: 45000 });
  const res = await record({ amountPence: 137000, orderIds: [a, b] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const extras = [(await lastEvent(a)).detail.extraPence ?? 0, (await lastEvent(b)).detail.extraPence ?? 0];
  assert.equal(extras[0] + extras[1], 2000);
});

test('8.3 The Owed list gives each provider its bikes, owed and late, with a total', async () => {
  // A shop of its own, so the list holds only this test's orders.
  const shop = await staffSignup(server.baseUrl, { shopName: 'Owed Cycles', ownerName: 'Jack Lewis' });
  const as = (p, options) => staffRequest(server.baseUrl, shop.cookie, p, options);
  try {
    await as('/api/c2w/settings', { method: 'PUT', body: { holdDays: 7, remindDays: 2, quoteValidDays: 30 } });
    const p1 = (await as('/api/c2w/providers', { method: 'POST', body: { name: '[Provider]' } })).body.provider;
    const p2 = (await as('/api/c2w/providers', { method: 'POST', body: { name: '[Other provider]' } })).body.provider;
    const cust = (await as('/api/customers', { method: 'POST', body: { name: '[Customer]' } })).body;
    const prod = await runWithShop(shop.shop.id, async () => (await prepare(
      "INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES (?, '[Bike]', 'Bikes', 1000, 600, 0, now())"
    ).run(`[code]-${tag()}`)).lastInsertRowid);
    const make = async (prov, expected, by, paid = null) => {
      const { id } = (await as('/api/c2w/orders', { method: 'POST', body: { customerId: cust.id, providerId: prov.id, productId: prod, accessoryIds: [] } })).body.order;
      await runWithShop(shop.shop.id, () => prepare(`UPDATE c2w_orders SET stage = 'collected', certificate_number = '[certificate number]', certificate_pence = 100000,
        collected_at = '2026-08-20T10:00:00Z', expected_pence = ?, expected_by = ?, paid_pence = ? WHERE id = ?`).run(expected, by, paid, id));
      return id;
    };
    await make(p1, 90000, '2026-08-20');          // 12 days late
    await make(p1, 45000, '2026-08-27', 15000);   // part paid, 5 days late: £300 owed
    await make(p1, 30000, '2026-09-20');          // not due yet
    await make(p2, 50000, '2026-09-25');
    const res = await as('/api/c2w/owed');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.providers.map((p) => [p.name, p.bikes, p.owedPence, p.latePence, p.lateDays]), [
      ['[Provider]', 3, 150000, 120000, 12],
      ['[Other provider]', 1, 50000, 0, null],
    ]);
    assert.deepEqual([res.body.total.bikes, res.body.total.owedPence, res.body.total.latePence], [4, 200000, 120000]);

    const one = await as(`/api/c2w/providers/${p1.id}/owed`);
    assert.equal(one.status, 200, JSON.stringify(one.body));
    assert.equal(one.body.provider.name, '[Provider]');
    assert.deepEqual(one.body.orders.map((o) => [o.customerName, o.collectedOn, o.certificateNumber, o.expectedPence, o.owedPence, o.expectedBy, o.lateDays]), [
      ['[Customer]', '2026-08-20', '[certificate number]', 90000, 90000, '2026-08-20', 12],
      ['[Customer]', '2026-08-20', '[certificate number]', 45000, 30000, '2026-08-27', 5],
      ['[Customer]', '2026-08-20', '[certificate number]', 30000, 30000, '2026-09-20', null],
    ]);
    // Record a payment words the commission from what the certificate was for (cw-record-payment).
    assert.deepEqual(one.body.orders.map((o) => o.certificatePence), [100000, 100000, 100000]);

    const csv = await fetch(`${server.baseUrl}/api/c2w/owed.csv`, { headers: { cookie: shop.cookie } });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /text\/csv/);
    assert.match(csv.headers.get('content-disposition'), /attachment; filename="cycle-to-work-owed-2026-09-01\.csv"/);
    const lines = (await csv.text()).replace(/^﻿/, '').trim().split('\r\n');
    assert.deepEqual(lines, ['Provider,Bikes,Owed,Late,Days late', '[Provider],3,1500.00,1200.00,12', '[Other provider],1,500.00,0.00,', 'Total,4,2000.00,1200.00,']);
  } finally {
    await deleteTestShop(shop.shop.id);
  }
});

test('8.3 A late payment counts in the list’s payment late line', async () => {
  const id = await collected({ by: '2026-08-30' });
  const { groups, counts } = (await own('/api/c2w/orders')).body;
  assert.ok(groups.collected.some((o) => o.id === id));
  assert.ok(counts.paymentLate >= 1);
});

test('8.4 The money steps and the owed lists are refused for Staff, and nothing changes', async () => {
  const id = await collected();
  for (const res of [
    await markPaid(id, { amountPence: 90000 }, asJo),
    await markPaid(id, { amountPence: 60000, as: 'part' }, asJo),
    await markPaid(id, { amountPence: 60000, as: 'close', reason: '[reason]' }, asJo),
    await record({ amountPence: 90000, orderIds: [id] }, asJo),
    await asJo('/api/c2w/owed'),
    await asJo(`/api/c2w/providers/${provider.id}/owed`),
  ]) assert.equal(res.status, 403, JSON.stringify(res.body));
  const csv = await fetch(`${server.baseUrl}/api/c2w/owed.csv`, { headers: { cookie: jo } });
  assert.equal(csv.status, 403);
  const o = await order(id);
  assert.deepEqual([o.stage, o.paidPence, o.events.some((e) => ['paid', 'part_paid', 'shortfall_closed'].includes(e.kind))], ['collected', null, false]);
});

test('8.4 Each money step is logged with who took it and, for a close, why', async () => {
  const id = await collected();
  await markPaid(id, { amountPence: 10000, as: 'part' });
  await markPaid(id, { amountPence: 20000, as: 'close', reason: '[reason]' });
  const steps = (await order(id)).events.filter((e) => ['part_paid', 'shortfall_closed'].includes(e.kind));
  assert.deepEqual(steps.map((e) => [e.kind, e.by, e.reason, e.detail.amountPence]), [
    ['part_paid', 'Jack Lewis', null, 10000],
    ['shortfall_closed', 'Jack Lewis', '[reason]', 20000],
  ]);
});
