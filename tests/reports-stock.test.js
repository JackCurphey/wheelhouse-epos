// Stock value and stock written off, the server (openspec/changes/reports-ready-made,
// design 6; rp-margin's stock half). The clock is pinned to Thursday 17
// September 2026, so "this week" is Mon 14 to Thu 17 so far. Times are UTC;
// the shop is on British Summer Time, an hour ahead.
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

const as = (who) => (path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const stock = (query = '', who = owner) => as(who)(`/api/reports/margin?${query}`);

function seeder(shop) {
  const one = (sql, ...args) => runWithShop(shop.shop.id, () => prepare(sql).get(...args));
  const moved = (productId, change, type, reason, valuePence, at, takeId = null) => one(
    'INSERT INTO stock_movements (product_id, change_qty, type, reason, value_pence, created_at, stock_take_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
    productId, change, type, reason, valuePence, at, takeId
  );
  return {
    product: (category, cost, qty) => one(
      "INSERT INTO products (name, category, price, cost, stock_qty) VALUES ('Item', ?, 0, ?, ?) RETURNING id", category, cost, qty
    ),
    adjusted: (productId, change, reason, valuePence, at) => moved(productId, change, 'adjustment', reason, valuePence, at),
    sold: (productId, change, at) => moved(productId, change, 'sale', null, null, at),
    // A stock take and its counted lines, [product, difference, cost when counted],
    // each with the "Counted" stock-history line applying it wrote.
    take: async (status, appliedAt, lines) => {
      const applied = status === 'applied';
      const t = await one(
        "INSERT INTO stock_takes (kind, status, started_by_login_id, applied_by_login_id, applied_at) VALUES ('whole_shop', ?, ?, ?, ?) RETURNING id",
        status, shop.loginId, applied ? shop.loginId : null, appliedAt
      );
      for (const [productId, difference, costPence] of lines) {
        const m = difference === 0 ? null : await moved(productId, difference, 'count', null, null, appliedAt ?? '2026-09-16T09:00:00Z', t.id);
        await one(
          'INSERT INTO stock_take_results (stock_take_id, product_id, expected, counted, difference, cost_pence, stock_movement_id) VALUES (?, ?, 10, ?, ?, ?, ?) RETURNING stock_take_id',
          t.id, productId, 10 + difference, difference, costPence, m?.id ?? null
        );
      }
    },
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

  const s = seeder(owner);
  const chain = await s.product('Drivetrain › Chains', 10, 3); // £30.00
  const cassette = await s.product('Drivetrain › Cassettes', 25.5, 2); // £51.00
  const bearing = await s.product('Bearings', 4, 5); // £20.00
  await s.product('Bearings › Headset', 0, 4); // in stock, no cost
  await s.product('Bearings', 8, 0); // none in stock
  await s.product('Tyres', 3, -2); // below zero

  // This week: a take counted 2 chains under at their cost then (£9), a bearing over, a cassette right.
  await s.take('applied', '2026-09-15T10:00:00Z', [[chain.id, -2, 900], [bearing.id, 1, 400], [cassette.id, 0, 2550]]);
  // Still counting, and applied last week: neither counts this week.
  await s.take('counting', null, [[chain.id, -5, 1000]]);
  await s.take('applied', '2026-09-08T10:00:00Z', [[bearing.id, -1, 400]]);

  await s.adjusted(chain.id, -2, 'damaged', 2000, '2026-09-16T09:00:00Z');
  await s.adjusted(bearing.id, 1, 'found', 1000, '2026-09-16T09:00:00Z');
  await s.adjusted(bearing.id, 1, 'other', 300, '2026-09-16T09:00:00Z');
  await s.adjusted(chain.id, -2, 'other', 800, '2026-09-16T09:00:00Z');
  // Sunday 13th, 23:30 UTC is Monday 14th, 00:30 in the shop: this week.
  await s.adjusted(chain.id, -1, 'used_workshop', 500, '2026-09-13T23:30:00Z');
  await s.adjusted(chain.id, -1, 'lost_stolen', 1000, '2026-09-09T09:00:00Z');
  await s.sold(chain.id, -1, '2026-09-16T09:00:00Z');

  const o = seeder(other);
  const theirs = await o.product('Drivetrain › Chains', 99, 50);
  await o.adjusted(theirs.id, -9, 'damaged', 89100, '2026-09-16T09:00:00Z');
});

after(async () => {
  for (const s of [owner, other]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const written = (report) => Object.fromEntries(report.writtenOff.rows.map((r) => [r.label, [r.items, r.valuePence]]));

test('on the shelves today: stock at today’s cost by the top of its category, with an All row', async () => {
  const res = await stock();
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.stock.rows, [
    { label: 'Bearings', items: 5, valuePence: 2000 },
    { label: 'Drivetrain', items: 5, valuePence: 8100 },
  ]);
  assert.deepEqual(res.body.stock.all, { items: 10, valuePence: 10100 });
  assert.equal(res.body.stock.noCostProducts, 1, 'the headset is in stock with no cost, so it is counted apart');
});

test('stock written off this week: takes under and over at their kept cost, and each adjustment reason signed by its change', async () => {
  const res = await stock('period=this-week');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.period.from, '2026-09-14');
  assert.deepEqual(written(res.body), {
    'Stock takes · counted under': [2, -1800],
    'Stock takes · counted over': [1, 400],
    'Adjusted · Damaged': [2, -2000],
    'Adjusted · Lost or stolen': [0, 0],
    'Adjusted · Used in the workshop': [1, -500],
    'Adjusted · Faulty — to return to supplier': [0, 0],
    'Adjusted · Found': [1, 1000],
    'Adjusted · Other': [3, -500],
  });
  assert.deepEqual(res.body.writtenOff.all, { items: 10, valuePence: -3400 });
  assert.deepEqual(res.body.writtenOff.rows.map((r) => r.key), ['counted-under', 'counted-over', 'damaged', 'lost_stolen', 'used_workshop', 'faulty_return', 'found', 'other']);
});

test('picked dates count only what happened on them', async () => {
  const res = await stock('period=dates&from=2026-09-08&to=2026-09-09');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const w = written(res.body);
  assert.deepEqual(w['Stock takes · counted under'], [1, -400]);
  assert.deepEqual(w['Adjusted · Lost or stolen'], [1, -1000]);
  assert.deepEqual(w['Adjusted · Damaged'], [0, 0]);
  assert.deepEqual(res.body.writtenOff.all, { items: 2, valuePence: -1400 });
});

test('the download gives both tables under their titles, and the line about products with no cost', async () => {
  const res = await fetch(`${server.baseUrl}/api/reports/margin.csv?period=this-week`, { headers: { cookie: owner.cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /filename="margin-[a-z0-9-]+-2026-09-14-to-2026-09-17\.csv"/);
  const lines = (await res.text()).replace(/^﻿/, '').split('\r\n');
  assert.deepEqual(lines.slice(0, 6), [
    'Stock value by category', 'Category,Items,What it cost you', 'Bearings,5,20.00', 'Drivetrain,5,81.00', 'All,10,101.00',
    '"1 product on the shelves has no cost, so it isn’t in this"',
  ]);
  const at = lines.indexOf('Stock written off');
  assert.ok(at > 6, 'the second table follows');
  assert.equal(lines[at + 1], 'Why,Items,At cost');
  assert.equal(lines[at + 2], 'Stock takes · counted under,2,-18.00');
  assert.ok(lines.includes('All,10,-34.00'));
});

test('Staff are refused, and signed out is 401', async () => {
  assert.equal((await stock('', jo)).status, 403);
  assert.equal((await fetch(`${server.baseUrl}/api/reports/margin.csv`, { headers: { cookie: jo.cookie } })).status, 403);
  assert.equal((await fetch(`${server.baseUrl}/api/reports/margin`)).status, 401);
});
