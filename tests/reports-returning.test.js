// Returning customers, the server (openspec/changes/reports-ready-made,
// design 3; rp-returning). The clock is pinned to Thursday 17 September 2026,
// so the last 12 months are October 2025 to September 2026, against October
// 2024 to September 2025. Times are noon UTC, well inside the shop's day.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare, pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, firstShopIsBolton } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let jo;
const ids = {};

const as = (who) => (path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const returning = (query, who = owner) => as(who)(`/api/reports/returning?${query}`);

async function seeder(shop) {
  const inShop = (fn) => runWithShop(shop.shop.id, fn);
  const one = (sql, ...args) => inShop(() => prepare(sql).get(...args));
  const { site, till } = await inShop(async () => {
    const siteRow = await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get();
    const tillRow = await prepare('INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, ?, ?) RETURNING id').get(siteRow.id, 'R1', 'Till 1', randomUUID());
    return { site: siteRow, till: tillRow };
  });
  let receipt = 0;
  const noon = (day) => `${day}T12:00:00Z`;
  return {
    customer: async (name, { yes = false, deleted = false } = {}) => (await one(
      'INSERT INTO customers (name, marketing_permission, deleted_at) VALUES (?, ?, ?) RETURNING id', name, yes, deleted ? noon('2026-09-01') : null
    )).id,
    // A sale in the old record, in pounds.
    old: (day, pounds, customer = null) => one(
      "INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, customer_id) VALUES (?, ?, ?, 'Cash', ?, ?) RETURNING id",
      noon(day), pounds, pounds, pounds, customer
    ),
    // A sale on the new till, in pence.
    till: (day, pence, customer = null) => one(
      `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, received_at, total_pence, vat_pence, customer_id)
       VALUES (?, ?, ?, ?, false, ?, ?, ?, 0, ?) RETURNING id`,
      randomUUID(), till.id, site.id, ++receipt, noon(day), noon(day), pence, customer
    ),
    // A repair collected.
    collected: (day, customer) => one(
      "INSERT INTO workshop_jobs (title, job_date, customer_id, collected_at) VALUES ('Service', ?, ?, ?) RETURNING id", day, customer, noon(day)
    ),
  };
}

before(async () => {
  server = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2026-09-17T11:00:00Z' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  await firstShopIsBolton(owner);
  other = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  const made = await as(owner)('/api/team', { method: 'POST', body: { name: 'Jo Cashier', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };

  const s = await seeder(owner);
  // Ann: first came in March 2025; back on the new till in February 2026 (11
  // months later) and collected a repair that month.
  ids.ann = await s.customer('Ann Fisher', { yes: true });
  await s.old('2025-03-10', 15, ids.ann);
  await s.till('2026-02-05', 3000, ids.ann);
  await s.collected('2026-02-20', ids.ann);
  // Ben: new in March 2026, back in May.
  ids.ben = await s.customer('Ben Hall');
  await s.old('2026-03-15', 20, ids.ben);
  await s.old('2026-05-01', 12.5, ids.ben);
  // Cat: first in June 2024, back 17 months later in November 2025: a sale and
  // a collection the same day are one visit.
  ids.cat = await s.customer('Cat Jones', { yes: true });
  await s.old('2024-06-01', 10, ids.cat);
  await s.old('2025-11-10', 40, ids.cat);
  await s.collected('2025-11-10', ids.cat);
  // Dan: once, in January 2025.
  ids.dan = await s.customer('Dan Moss');
  await s.old('2025-01-20', 25, ids.dan);
  // Gus: new in December 2024, back two months later.
  ids.gus = await s.customer('Gus Reid');
  await s.old('2024-12-01', 5, ids.gus);
  await s.old('2025-02-01', 5, ids.gus);
  // Eve was deleted: she never counts.
  ids.eve = await s.customer('Eve Deleted', { deleted: true });
  await s.old('2025-01-01', 9, ids.eve);
  await s.till('2026-04-01', 900, ids.eve);
  // A walk-in with no customer.
  await s.old('2026-04-02', 30);

  // Another shop, with a customer of its own.
  const t = await seeder(other);
  const fay = await t.customer('Fay Other', { yes: true });
  await t.old('2026-04-03', 50, fay);
  await t.old('2025-01-03', 50, fay);
});

after(async () => {
  for (const s of [owner, other]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

test('opens on the last 12 months: Customers once each, New on the first visit, compared with the 12 months before', async () => {
  const res = await returning('');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { period, figures } = res.body;
  assert.equal(period.period, 'last-12-months');
  assert.equal(period.from, '2025-10-01');
  assert.equal(period.label, 'the last 12 months');
  assert.equal(period.against, 'the 12 months before');
  // Ann, Ben and Cat; before them Ann, Dan and Gus. Eve and the walk-in never count.
  assert.deepEqual(figures.customers, { count: 3, beforeCount: 3, diff: 0 });
  // Ben is new; before, Ann, Dan and Gus were.
  assert.deepEqual(figures.new, { count: 1, beforeCount: 3, diff: -2 });
});

test('came back within 12 months: of those who had been before, the share back within 12 months, in points', async () => {
  const { figures } = (await returning('period=last-12-months')).body;
  // Ann (11 months) and Ben (2 months) came back in time; Cat after 17 months didn't.
  // Before: only Gus had been before, and was back in 2 months.
  assert.deepEqual(figures.cameBack, { percent: 67, beforePercent: 100, diff: -33 });
});

test('new and returning by month, a sale and a repair collected each a visit, with the total row once each', async () => {
  const { rows, total } = (await returning('period=last-12-months')).body;
  assert.deepEqual(rows.map((r) => r.label), ['Oct 25', 'Nov 25', 'Dec 25', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']);
  const by = Object.fromEntries(rows.map((r) => [r.key, [r.returning, r.new, r.all]]));
  assert.deepEqual(by['2025-11'], [1, 0, 1], 'Cat');
  assert.deepEqual(by['2026-02'], [1, 0, 1], 'Ann, twice that month');
  assert.deepEqual(by['2026-03'], [0, 1, 1], 'Ben, new');
  assert.deepEqual(by['2026-04'], [0, 0, 0], 'Eve deleted, the walk-in not counted');
  assert.deepEqual(by['2026-05'], [1, 0, 1], 'Ben, back');
  assert.deepEqual(total, { label: 'All 12 months', returning: 2, new: 1, all: 3 });
});

test('Last 24 months, compared with the 24 months before', async () => {
  const res = await returning('period=last-24-months');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.period.label, 'the last 24 months');
  assert.equal(res.body.period.against, 'the 24 months before');
  assert.equal(res.body.rows.length, 24);
  assert.equal(res.body.rows[0].label, 'Oct 24');
  // Ann, Ben, Cat, Dan and Gus; all but Cat are new in the 24 months.
  assert.equal(res.body.figures.customers.count, 5);
  assert.equal(res.body.figures.new.count, 4);
  assert.equal(res.body.total.label, 'All 24 months');
  assert.equal(res.body.notSeen.column, 'Spent in the last 24 months');
});

test('Pick dates goes by month, against the same number of days just before, and is checked', async () => {
  const res = await returning('period=dates&from=2026-02-01&to=2026-05-31');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.rows.map((r) => r.key), ['2026-02', '2026-03', '2026-04', '2026-05']);
  assert.equal(res.body.figures.customers.count, 2, 'Ann and Ben');
  assert.equal(res.body.total.label, 'All these dates');
  const wrong = await returning('period=dates&from=2026-05-10&to=2026-05-01');
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.error, /To is before From/);
  const notHere = await returning('period=this-week');
  assert.equal(notHere.status, 400);
});

test('not seen lately: more than 6 months, most recently seen first, spend in the period and Yes or No', async () => {
  const { notSeen } = (await returning('period=last-12-months')).body;
  assert.equal(notSeen.months, 6);
  assert.equal(notSeen.column, 'Spent in the last 12 months');
  assert.deepEqual(notSeen.customers, [
    { id: ids.ann, name: 'Ann Fisher', lastVisit: '2026-02-20', spentPence: 3000, happyToHear: true },
    { id: ids.cat, name: 'Cat Jones', lastVisit: '2025-11-10', spentPence: 4000, happyToHear: true },
    { id: ids.gus, name: 'Gus Reid', lastVisit: '2025-02-01', spentPence: 0, happyToHear: false },
    { id: ids.dan, name: 'Dan Moss', lastVisit: '2025-01-20', spentPence: 0, happyToHear: false },
  ]);
});

test('the months are set by ?months=, and must be a whole number', async () => {
  const res = await returning('period=last-12-months&months=12');
  assert.equal(res.body.notSeen.months, 12);
  assert.deepEqual(res.body.notSeen.customers.map((c) => c.name), ['Gus Reid', 'Dan Moss']);
  for (const months of ['0', 'abc', '2.5']) {
    const wrong = await returning(`period=last-12-months&months=${months}`);
    assert.equal(wrong.status, 400, months);
    assert.match(wrong.body.error, /whole number of months/);
  }
});

test('the spreadsheet is the two tables, each under its title', async () => {
  const res = await fetch(`${server.baseUrl}/api/reports/returning.csv?period=last-12-months`, { headers: { cookie: owner.cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /filename="returning-[a-z0-9-]+-2025-10-01-to-2026-09-17\.csv"/);
  const lines = (await res.text()).replace(/^﻿/, '').split('\r\n').slice(0, -1);
  assert.deepEqual(lines.slice(0, 3), ['New and returning customers by month', 'Month,Returning,New,All', 'Oct 25,0,0,0']);
  assert.deepEqual(lines.slice(13, 22), [
    'Sep,0,0,0',
    'All 12 months,2,1,3',
    '',
    'Not seen lately',
    'Customer,Last bought or collected,Spent in the last 12 months,Happy to hear about offers',
    'Ann Fisher,2026-02-20,30.00,Yes',
    'Cat Jones,2025-11-10,40.00,Yes',
    'Gus Reid,2025-02-01,0.00,No',
    'Dan Moss,2025-01-20,0.00,No',
  ]);
});

test('another shop\'s customers never count', async () => {
  const { figures, notSeen } = (await returning('period=last-12-months', other)).body;
  assert.deepEqual(figures.customers, { count: 1, beforeCount: 1, diff: 0 });
  assert.deepEqual(notSeen.customers.map((c) => c.name), []);
});

test('Staff are refused, and signed out is 401', async () => {
  for (const path of ['/api/reports/returning', '/api/reports/returning.csv']) {
    const staff = await as(jo)(path);
    assert.equal(staff.status, 403, path);
    assert.equal(staff.body.error, "Only the shop's owner can see reports");
    const out = await staffRequest(server.baseUrl, null, path);
    assert.equal(out.status, 401, path);
  }
});
