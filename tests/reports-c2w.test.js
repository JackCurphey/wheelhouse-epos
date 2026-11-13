// Cycle to Work: owed and paid, the server (openspec/changes/cycle-to-work,
// task 10.3; drawn as rp-c2w in generator/reports.mjs, UX walk-through 5 H3).
// The clock is pinned to Saturday 17 October 2026: This month is 1 – 17
// October, against 1 – 17 September. Providers and amounts stay bracketed or
// are made-up test values; orders are put in place with SQL (the hand-over,
// Mark paid and Close with a reason have their own tests).
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, firstShopIsBolton } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let empty;
let jo;
let a;
let b;
let c;
const tag = () => randomUUID().slice(0, 8);
const as = (who) => (path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const report = (query = '', who = owner) => as(who)(`/api/reports/c2w?${query}`);

before(async () => {
  server = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2026-10-17T11:00:00Z' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  await firstShopIsBolton(owner);
  empty = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  const own = as(owner);
  const made = await own('/api/team', { method: 'POST', body: { name: 'Jo Cashier', isCashier: true, email: `jo-${tag()}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  assert.equal((await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 7, remindDays: 2, quoteValidDays: 30 } })).status, 200);
  const provider = async (name) => (await own('/api/c2w/providers', { method: 'POST', body: { name } })).body.provider;
  a = await provider('[Provider A]');
  b = await provider('[Provider B]');
  c = await provider('[Provider C]');
  // Retired with nothing on it: no row.
  const retired = await provider('[Retired provider]');
  assert.equal((await own(`/api/c2w/providers/${retired.id}/retire`, { method: 'POST', body: {} })).status, 200);
  const maya = (await own('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: `maya-${tag()}@example.test` } })).body;
  const inShop = (fn) => runWithShop(owner.shop.id, fn);
  const productId = await inShop(async () => (await prepare(
    "INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES (?, '[Bike] · [Size]', 'Bikes', 1000, 600, 0, now())"
  ).run(`[Supplier code]-${tag()}`)).lastInsertRowid);
  const order = async (prov, set) => {
    const res = await own('/api/c2w/orders', { method: 'POST', body: { customerId: maya.id, providerId: prov.id, productId, accessoryIds: [] } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const { id } = res.body.order;
    const { closedAt, ...cols } = set;
    const keys = Object.keys(cols);
    await inShop(() => prepare(`UPDATE c2w_orders SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(cols), id));
    // A shortfall closed with a reason, dated by its line in "What's happened".
    if (closedAt) await inShop(() => prepare("INSERT INTO c2w_order_events (order_id, kind, reason, detail, created_at) VALUES (?, 'shortfall_closed', '[reason]', '{}'::jsonb, ?)").run(id, closedAt));
    return id;
  };
  // [Provider A] paid on 5 October: £1,000 certificate, £950 paid, £50 commission.
  await order(a, { stage: 'paid', certificate_pence: 100000, expected_pence: 95000, paid_pence: 95000, paid_on: '2026-10-05', collected_at: '2026-09-20T10:00:00Z' });
  // Paid on 10 September (the same days last month) and on 25 September (neither).
  await order(a, { stage: 'paid', certificate_pence: 50000, expected_pence: 47500, paid_pence: 47500, paid_on: '2026-09-10', collected_at: '2026-09-02T10:00:00Z' });
  await order(a, { stage: 'paid', certificate_pence: 50000, expected_pence: 47500, paid_pence: 47500, paid_on: '2026-09-25', collected_at: '2026-09-21T10:00:00Z' });
  // Collected on 16 October, owed, expected by 1 November: not late.
  await order(a, { stage: 'collected', certificate_pence: 40000, expected_pence: 40000, collected_at: '2026-10-16T10:00:00Z', expected_by: '2026-11-01' });
  // [Provider B] paid today with no certificate amount: paid, but no commission counted.
  await order(b, { stage: 'paid', expected_pence: 30000, paid_pence: 30000, paid_on: '2026-10-17', collected_at: '2026-10-03T10:00:00Z' });
  // Part paid, expected by 10 October: late, still owed £600, and in no Paid figure.
  await order(b, { stage: 'collected', certificate_pence: 80000, expected_pence: 80000, paid_pence: 20000, collected_at: '2026-10-02T10:00:00Z', expected_by: '2026-10-10' });
  // Closed with a reason on 8 October: £50 short. Another closed on 3 September.
  await order(b, { stage: 'closed', certificate_pence: 50000, expected_pence: 50000, paid_pence: 45000, close_reason: '[reason]', collected_at: '2026-09-05T10:00:00Z', closedAt: '2026-10-08T12:00:00Z' });
  await order(b, { stage: 'closed', certificate_pence: 50000, expected_pence: 50000, paid_pence: 40000, close_reason: '[reason]', collected_at: '2026-08-31T10:00:00Z', closedAt: '2026-09-03T12:00:00Z' });
});

after(async () => {
  for (const s of [owner, empty]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const row = (body, name) => body.providers.find((p) => p.name === name);

test('opens on This month, against the same days last month, with the shop line', async () => {
  const res = await report();
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.period.period, 'this-month');
  assert.equal(res.body.period.from, '2026-10-01');
  assert.equal(res.body.period.through, '2026-10-17');
  assert.equal(res.body.period.against, 'the same days last month');
  assert.deepEqual(res.body.before, { from: '2026-09-01', to: '2026-09-17' });
  assert.deepEqual(res.body.columns, { now: 'This month so far', before: 'Same days last month' });
  assert.match(res.body.shopLine, /^North Street Cycles.*, Bolton$/);
});

test('the four figures: owed now with bikes and late, paid and commission on the day marked paid, shortfalls closed', async () => {
  const { body } = await report('period=this-month');
  assert.deepEqual(body.figures, {
    owedNow: { pence: 100000, bikes: 2, late: 1 },
    paid: { pence: 125000, beforePence: 47500, diffPence: 77500 },
    commission: { pence: 5000, beforePence: 2500, diffPence: 2500 },
    shortfalls: { pence: 5000, orders: 1 },
  });
});

test('one row per provider in Settings order, an empty one included, a retired empty one left out, and the All providers row', async () => {
  const { body } = await report('period=this-month');
  assert.deepEqual(body.providers.map((p) => p.name), ['[Provider A]', '[Provider B]', '[Provider C]']);
  assert.deepEqual(row(body, '[Provider A]'), { id: a.id, name: '[Provider A]', bikesCollected: 1, owedPence: 40000, paidPence: 95000, beforePaidPence: 47500, commissionPence: 5000, late: 0 });
  assert.deepEqual(row(body, '[Provider B]'), { id: b.id, name: '[Provider B]', bikesCollected: 2, owedPence: 60000, paidPence: 30000, beforePaidPence: 0, commissionPence: 0, late: 1 });
  assert.deepEqual(row(body, '[Provider C]'), { id: c.id, name: '[Provider C]', bikesCollected: 0, owedPence: 0, paidPence: 0, beforePaidPence: 0, commissionPence: 0, late: 0 });
  assert.deepEqual(body.total, { label: 'All providers', bikesCollected: 3, owedPence: 100000, paidPence: 125000, beforePaidPence: 47500, commissionPence: 5000, late: 1 });
});

test('Last month counts September; what is owed now stays the same', async () => {
  const { body } = await report('period=last-month');
  assert.equal(body.period.from, '2026-09-01');
  assert.equal(body.period.to, '2026-09-30');
  assert.deepEqual(body.figures.paid, { pence: 95000, beforePence: 0, diffPence: 95000 });
  assert.deepEqual(body.figures.commission, { pence: 5000, beforePence: 0, diffPence: 5000 });
  assert.deepEqual(body.figures.shortfalls, { pence: 10000, orders: 1 });
  assert.deepEqual(body.figures.owedNow, { pence: 100000, bikes: 2, late: 1 });
  assert.deepEqual(body.providers.map((p) => p.bikesCollected), [3, 1, 0]);
});

test('a shop with no providers has no rows and nothing counted', async () => {
  const { status, body } = await report('', empty);
  assert.equal(status, 200, JSON.stringify(body));
  assert.deepEqual(body.providers, []);
  assert.deepEqual(body.total, { label: 'All providers', bikesCollected: 0, owedPence: 0, paidPence: 0, beforePaidPence: 0, commissionPence: 0, late: 0 });
});

test('the download is the by-provider table with its All providers row, as on screen', async () => {
  const res = await fetch(`${server.baseUrl}/api/reports/c2w.csv?period=this-month`, { headers: { cookie: owner.cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /filename="c2w-[a-z0-9-]+-2026-10-01-to-2026-10-17\.csv"/);
  const text = (await res.text()).replace(/^﻿/, '');
  assert.deepEqual(text.trim().split('\r\n'), [
    'Cycle to Work by provider',
    'Provider,Bikes collected,Owed now,Paid,Commission,Late',
    '[Provider A],1,400.00,950.00,50.00,0',
    '[Provider B],2,600.00,300.00,0.00,1',
    '[Provider C],0,0.00,0.00,0.00,0',
    'All providers,3,1000.00,1250.00,50.00,1',
  ]);
});

test('Staff who can’t see costs are refused, and signed out is 401', async () => {
  assert.equal((await report('', jo)).status, 403);
  assert.equal((await fetch(`${server.baseUrl}/api/reports/c2w.csv`, { headers: { cookie: jo.cookie } })).status, 403);
  assert.equal((await fetch(`${server.baseUrl}/api/reports/c2w`)).status, 401);
});
