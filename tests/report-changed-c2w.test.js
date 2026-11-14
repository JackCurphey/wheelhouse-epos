// "Change what's shown" from Cycle to Work, the server (openspec/changes/cycle-to-work,
// task 10.4's follow-up; rp-c2w's "Change what's shown" button, rp-change,
// rp-changed). The Cycle to Work base's figures are the columns rp-c2w counts
// for a period (Bikes collected, Paid, Commission) and its split is the
// report's grouping, Provider, as well as Day and Week. Defaults logged in
// docs/decisions/decided-while-building/2026-11-jack.md ("Change what's shown
// from Cycle to Work").
// The clock is pinned to Saturday 17 October 2026: This month is 1 – 17
// October, against 1 – 17 September. Providers and amounts are bracketed or
// made-up test values; orders are put in place with SQL, as reports-c2w does.
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
let other;
let jo;
const tag = () => randomUUID().slice(0, 8);
const as = (who) => (path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const changed = (query, who = owner) => as(who)(`/api/reports/changed?base=c2w&period=this-month&${query}`);
const byLabel = (rows) => Object.fromEntries(rows.map((r) => [r.label, r]));

// A shop with Cycle to Work set up, two providers and a customer; `order` makes
// one order for a provider and puts its columns in place.
async function shopWithC2w(shop) {
  const own = as(shop);
  assert.equal((await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 7, remindDays: 2, quoteValidDays: 30 } })).status, 200);
  const provider = async (name) => (await own('/api/c2w/providers', { method: 'POST', body: { name } })).body.provider;
  const customer = (await own('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: `maya-${tag()}@example.test` } })).body;
  const inShop = (fn) => runWithShop(shop.shop.id, fn);
  const productId = await inShop(async () => (await prepare(
    "INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES (?, '[Bike] · [Size]', 'Bikes', 1000, 600, 0, now())"
  ).run(`[Supplier code]-${tag()}`)).lastInsertRowid);
  const order = async (prov, cols) => {
    const res = await own('/api/c2w/orders', { method: 'POST', body: { customerId: customer.id, providerId: prov.id, productId, accessoryIds: [] } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const keys = Object.keys(cols);
    await inShop(() => prepare(`UPDATE c2w_orders SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(cols), res.body.order.id));
  };
  return { provider, order };
}

before(async () => {
  server = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2026-10-17T11:00:00Z' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  await firstShopIsBolton(owner);
  other = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  const made = await as(owner)('/api/team', { method: 'POST', body: { name: 'Jo Cashier', isCashier: true, email: `jo-${tag()}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };

  const s = await shopWithC2w(owner);
  const a = await s.provider('[Provider A]');
  const b = await s.provider('[Provider B]');
  // [Provider A] paid on 5 October: £950 paid, £50 commission; collected 20 September.
  await s.order(a, { stage: 'paid', certificate_pence: 100000, expected_pence: 95000, paid_pence: 95000, paid_on: '2026-10-05', collected_at: '2026-09-20T10:00:00Z' });
  // Paid on 10 September (the same days last month) and 25 September (neither).
  await s.order(a, { stage: 'paid', certificate_pence: 50000, expected_pence: 47500, paid_pence: 47500, paid_on: '2026-09-10', collected_at: '2026-09-02T10:00:00Z' });
  await s.order(a, { stage: 'paid', certificate_pence: 50000, expected_pence: 47500, paid_pence: 47500, paid_on: '2026-09-25', collected_at: '2026-09-21T10:00:00Z' });
  // Collected on 16 October, still owed.
  await s.order(a, { stage: 'collected', certificate_pence: 40000, expected_pence: 40000, collected_at: '2026-10-16T10:00:00Z', expected_by: '2026-11-01' });
  // [Provider B] paid today with no certificate amount: paid, no commission counted; collected 3 October.
  await s.order(b, { stage: 'paid', expected_pence: 30000, paid_pence: 30000, paid_on: '2026-10-17', collected_at: '2026-10-03T10:00:00Z' });
  // Part paid, collected 2 October: in no Paid figure.
  await s.order(b, { stage: 'collected', certificate_pence: 80000, expected_pence: 80000, paid_pence: 20000, collected_at: '2026-10-02T10:00:00Z', expected_by: '2026-10-10' });
  // Closed with a reason, collected 5 September: a bike collected the same days last month.
  await s.order(b, { stage: 'closed', certificate_pence: 50000, expected_pence: 50000, paid_pence: 45000, close_reason: '[reason]', collected_at: '2026-09-05T10:00:00Z' });

  // Another shop's order, paid and collected this month: never counted here.
  const t = await shopWithC2w(other);
  await t.order(await t.provider('[Provider A]'), { stage: 'paid', certificate_pence: 900000, expected_pence: 800000, paid_pence: 800000, paid_on: '2026-10-06', collected_at: '2026-10-06T10:00:00Z' });
});

after(async () => {
  for (const s of [owner, other]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

test('opens on Paid by Provider, the money rp-c2w shows, against the same days last month', async () => {
  const res = await as(owner)('/api/reports/changed?base=c2w&period=this-month');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const r = res.body;
  assert.equal(r.title, 'Cycle to Work: paid by provider');
  assert.deepEqual(r.columns, ['Provider', 'Paid']);
  assert.match(r.line, /^Changed from Cycle to Work · /);
  const rows = byLabel(r.rows);
  assert.deepEqual(Object.keys(rows), ['[Provider A]', '[Provider B]'], 'biggest first, and not the other shop');
  assert.equal(rows['[Provider A]'].value, 95000);
  assert.equal(rows['[Provider A]'].beforeValue, 47500);
  assert.equal(rows['[Provider B]'].value, 30000);
  assert.equal(rows['[Provider B]'].beforeValue, 0);
  assert.deepEqual([r.total.label, r.total.value], ['Total', 125000]);
  assert.deepEqual(r.figures, { value: 125000, beforeValue: 47500, diffValue: 77500 });
  assert.equal(r.fileName, 'c2w-changed');
});

test('the panel offers Bikes collected, Paid and Commission, by Day, Week or Provider, Only a provider', async () => {
  const res = await as(owner)('/api/reports/changed/choices?base=c2w&period=this-month');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { choices, selection } = res.body;
  assert.deepEqual(selection, { measure: 'paid', split: 'provider', only: [], supplier: '' });
  assert.deepEqual(choices.measure, [{ value: 'bikes', label: 'Bikes collected' }, { value: 'paid', label: 'Paid' }, { value: 'commission', label: 'Commission' }]);
  assert.deepEqual(choices.split.map((c) => [c.value, Boolean(c.why)]), [['day', false], ['week', false], ['provider', false], ['shop', true]]);
  assert.deepEqual(choices.only.map((c) => c.value), ['[Provider A]', '[Provider B]']);
  assert.deepEqual(choices.suppliers, []);
});

test('Sales, Takings and Workshop still offer none of the Cycle to Work choices', async () => {
  for (const base of ['sales', 'takings', 'workshop']) {
    const { body } = await as(owner)(`/api/reports/changed/choices?base=${base}&period=this-month`);
    assert.ok(!body.choices.measure.some((c) => ['bikes', 'paid', 'commission'].includes(c.value)), base);
    assert.ok(!body.choices.split.some((c) => c.value === 'provider'), base);
  }
});

test('Commission by Provider: the certificate less what the provider was expected to pay', async () => {
  const { body } = await changed('measure=commission&split=provider');
  const rows = byLabel(body.rows);
  assert.deepEqual([rows['[Provider A]'].value, rows['[Provider A]'].beforeValue], [5000, 2500]);
  assert.equal(rows['[Provider B]'].value, 0);
  assert.deepEqual(body.columns, ['Provider', 'Commission']);
  assert.equal(body.total.value, 5000);
});

test('Bikes collected by Day: each bike on the day it was collected, against the same days last month', async () => {
  const res = await changed('measure=bikes&split=day');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { body } = res;
  const counted = body.rows.filter((r) => r.value > 0).map((r) => [r.key, r.value]);
  assert.deepEqual(counted, [['2026-10-02', 1], ['2026-10-03', 1], ['2026-10-16', 1]]);
  assert.deepEqual(body.figures, { value: 3, beforeValue: 2, diffValue: 1 });
  assert.deepEqual(body.columns, ['Day', 'Bikes collected']);
});

test('Only [Provider A], Paid by Week', async () => {
  const res = await changed('measure=paid&split=week&only=%5BProvider%20A%5D');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.only, ['[Provider A]']);
  assert.equal(res.body.total.value, 95000);
  assert.equal(res.body.total.label, 'Total, [Provider A] only');
  assert.equal(res.body.rows.find((r) => r.key === '2026-10-05').value, 95000);
});

test('a choice that is not Cycle to Work’s is refused, and Cycle to Work’s choices on another report', async () => {
  for (const [query, why] of [
    ['base=c2w&measure=takings', 'Choose Bikes collected, Paid or Commission'],
    ['base=c2w&measure=paid&split=category', 'Choose Day, Week or Provider'],
    ['base=sales&measure=paid', 'Choose Takings or Items sold'],
    ['base=sales&split=provider', 'Cycle to Work only'],
  ]) {
    const res = await as(owner)(`/api/reports/changed?${query}&period=this-month`);
    assert.equal(res.status, 400, query);
    assert.equal(res.body.error, why, query);
  }
  const unknown = await as(owner)('/api/reports/changed?base=nonsense');
  assert.equal(unknown.body.error, 'Choose Sales, Takings and cash-ups, Workshop or Cycle to Work');
});

test('the spreadsheet is the table as shown, in pounds', async () => {
  const res = await fetch(`${server.baseUrl}/api/reports/changed.csv?base=c2w&period=this-month`, { headers: { cookie: owner.cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /c2w-changed-/);
  const lines = (await res.text()).trim().split(/\r?\n/);
  assert.deepEqual(lines, ['Provider,Paid', '[Provider A],950.00', '[Provider B],300.00', 'Total,1250.00']);
});

test('a Cycle to Work report can be saved', async () => {
  const res = await as(owner)('/api/reports/saved', { method: 'POST', body: { name: 'Provider money', base: 'c2w', measure: 'commission', split: 'provider', only: ['[Provider B]'], supplier: '', period: 'this-month', shared: false } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
});

// Commission is a cost: the changed report from Cycle to Work is behind
// canSeeCosts, as rp-c2w is (a cashier, or the Owner's sign-in on a till with
// nobody checked in).
test('nobody who can’t see costs gets the Cycle to Work base', async () => {
  for (const path of ['/api/reports/changed', '/api/reports/changed/choices']) {
    assert.equal((await as(jo)(`${path}?base=c2w`)).status, 403, path);
  }
  const cookie = await staffFreshCookie(owner.loginId);
  const site = await runWithShop(owner.shop.id, async () => (await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get()).id);
  const setup = await fetch(`${server.baseUrl}/api/till-setup`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ siteId: site, number: 9 }) });
  assert.equal(setup.status, 201);
  const tillCookie = [cookie, ...setup.headers.getSetCookie().map((l) => l.split(';')[0])].join('; ');
  for (const path of ['/api/reports/changed', '/api/reports/changed/choices', '/api/reports/changed.csv']) {
    const res = await fetch(`${server.baseUrl}${path}?base=c2w&period=this-month`, { headers: { cookie: tillCookie } });
    assert.equal(res.status, 403, `${path} on a till`);
  }
  // The same till still gets Sales changed: only the Cycle to Work base is held back.
  const sales = await fetch(`${server.baseUrl}/api/reports/changed?base=sales&period=this-month`, { headers: { cookie: tillCookie } });
  assert.equal(sales.status, 200);
});
