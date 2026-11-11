// VAT, the server (openspec/changes/reports-ready-made, designs 4 and 5;
// rp-vat, rp-vat-first). The clock is pinned to Thursday 17 September 2026:
// with calendar quarters this VAT quarter is July to September, against April
// to June. Times are noon UTC, well inside the shop's day.
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
const vat = (query = '', who = owner) => as(who)(`/api/reports/vat?${query}`);

async function seeder(shop) {
  const inShop = (fn) => runWithShop(shop.shop.id, fn);
  const one = (sql, ...args) => inShop(() => prepare(sql).get(...args));
  const { site, till } = await inShop(async () => {
    const siteRow = await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get();
    const tillRow = await prepare('INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, ?, ?) RETURNING id').get(siteRow.id, 'V1', 'Till 1', randomUUID());
    return { site: siteRow, till: tillRow };
  });
  let receipt = 0;
  const noon = (day) => (day.includes('T') ? day : `${day}T12:00:00Z`);
  return {
    // A sale in the old record, in pounds: no VAT kept.
    old: (day, pounds) => one(
      "INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount) VALUES (?, ?, ?, 'Cash', ?) RETURNING id",
      noon(day), pounds, pounds, pounds
    ),
    // A sale on the new till, each line [total pence, VAT rate bp, VAT pence].
    till: async (day, lines) => {
      const total = lines.reduce((sum, [t]) => sum + t, 0);
      const vatPence = lines.reduce((sum, [, , v]) => sum + v, 0);
      const sale = await one(
        `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, received_at, total_pence, vat_pence)
         VALUES (?, ?, ?, ?, false, ?, ?, ?, ?) RETURNING id`,
        randomUUID(), till.id, site.id, ++receipt, noon(day), noon(day), total, vatPence
      );
      for (const [t, rate, v] of lines) {
        await one(
          `INSERT INTO till_sale_lines (till_sale_id, description, qty, unit_price_pence, line_total_pence, vat_rate_bp, vat_pence)
           VALUES (?, 'Item', 1, ?, ?, ?, ?) RETURNING id`, sale.id, t, t, rate, v
        );
      }
    },
  };
}

before(async () => {
  server = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2027-09-17T11:00:00Z' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  await firstShopIsBolton(owner);
  other = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  const made = await as(owner)('/api/team', { method: 'POST', body: { name: 'Jo Cashier', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };

  const s = await seeder(owner);
  // A till sale at two rates: a 20% line and a 0% line.
  await s.till('2027-08-10', [[1200, 2000, 200], [500, 0, 0]]);
  // A 5% line and a rate with no name of its own.
  await s.till('2027-07-05', [[1050, 500, 50], [1125, 1250, 125]]);
  // The quarter before (April to June).
  await s.till('2027-05-20', [[600, 2000, 100]]);
  // Old-record sales: their VAT wasn't kept.
  await s.old('2027-08-01', 30);
  await s.old('2027-04-10', 10);
  // Another shop's sales never count here.
  const o = await seeder(other);
  await o.till('2027-08-10', [[99900, 2000, 16650]]);
  await o.old('2027-08-01', 500);
});

after(async () => {
  for (const s of [owner, other]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const row = (report, label) => report.rows.find((r) => r.label === label);

test('VAT opens on this VAT quarter, calendar quarters while the shop has not said, and asks', async () => {
  const res = await vat();
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.needsQuarter, true);
  assert.equal(res.body.quarterStartMonth, null);
  assert.equal(res.body.period.period, 'this-vat-quarter');
  assert.equal(res.body.period.from, '2027-07-01');
  assert.equal(res.body.period.to, '2027-09-30');
  assert.deepEqual(res.body.before, { from: '2027-04-01', to: '2027-06-30' });
});

test('till lines are grouped by rate: sales before VAT, VAT charged, and the quarter before', async () => {
  const { body } = await vat('period=this-vat-quarter');
  assert.deepEqual(body.rows.map((r) => r.label), ['Standard 20%', '12.5%', 'Reduced rate 5%', 'Zero rate 0%']);
  assert.deepEqual(row(body, 'Standard 20%'), { rateBp: 2000, label: 'Standard 20%', salesPence: 1000, vatPence: 200, beforeVatPence: 100 });
  assert.deepEqual(row(body, 'Reduced rate 5%'), { rateBp: 500, label: 'Reduced rate 5%', salesPence: 1000, vatPence: 50, beforeVatPence: 0 });
  assert.deepEqual(row(body, 'Zero rate 0%'), { rateBp: 0, label: 'Zero rate 0%', salesPence: 500, vatPence: 0, beforeVatPence: 0 });
  assert.deepEqual(row(body, '12.5%'), { rateBp: 1250, label: '12.5%', salesPence: 1000, vatPence: 125, beforeVatPence: 0 });
  assert.deepEqual(body.total, { label: 'Total', salesPence: 3500, vatPence: 375, beforeVatPence: 100 });
  assert.ok(!body.rows.some((r) => /refund/i.test(r.label)), 'no Refunds row until refunds are recorded with their money');
});

test('old-record sales are on their own, with their takings including VAT, in no rate row', async () => {
  const { body } = await vat();
  assert.deepEqual(body.notRecorded, { label: 'VAT not recorded', takingsPence: 3000, beforeTakingsPence: 1000 });
});

test('Last VAT quarter, and the three named rates shown even with nothing sold', async () => {
  const { body } = await vat('period=last-vat-quarter');
  assert.equal(body.period.from, '2027-04-01');
  assert.equal(body.period.to, '2027-06-30');
  assert.deepEqual(body.rows.map((r) => [r.label, r.salesPence, r.vatPence]), [['Standard 20%', 500, 100], ['Reduced rate 5%', 0, 0], ['Zero rate 0%', 0, 0]]);
  assert.deepEqual(body.notRecorded, { label: 'VAT not recorded', takingsPence: 1000, beforeTakingsPence: 0 });
});

test('Pick dates, and a period it does not know is refused', async () => {
  const picked = await vat('period=dates&from=2027-08-01&to=2027-08-31');
  assert.equal(picked.status, 200, JSON.stringify(picked.body));
  assert.deepEqual(row(picked.body, 'Standard 20%'), { rateBp: 2000, label: 'Standard 20%', salesPence: 1000, vatPence: 200, beforeVatPence: 0 });
  assert.equal(picked.body.notRecorded.takingsPence, 3000);
  const bad = await vat('period=this-week');
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /This VAT quarter, Last VAT quarter or Pick dates/);
});

test('the download has the Sales table by rate with its Total row, as on screen', async () => {
  const res = await fetch(`${server.baseUrl}/api/reports/vat.csv?period=this-vat-quarter`, { headers: { cookie: owner.cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /filename="vat-[a-z0-9-]+-2027-07-01-to-2027-09-17\.csv"/);
  const text = (await res.text()).replace(/^﻿/, '');
  assert.deepEqual(text.trim().split('\r\n'), [
    'VAT on sales by rate',
    'Rate,Sales before VAT,VAT charged,Quarter before',
    'Standard 20%,10.00,2.00,1.00',
    '12.5%,10.00,1.25,0.00',
    'Reduced rate 5%,10.00,0.50,0.00',
    'Zero rate 0%,5.00,0.00,0.00',
    'Total,35.00,3.75,1.00',
    '',
    'Sales without their VAT,Takings including VAT,Quarter before',
    'VAT not recorded,30.00,10.00',
    'These sales were made before Wheelhouse kept VAT on each sale. Take their VAT from your accounts software or ask your accountant.',
  ]);
});

test('Staff are refused, and signed out is 401', async () => {
  const staff = await vat('', jo);
  assert.equal(staff.status, 403);
  const csv = await fetch(`${server.baseUrl}/api/reports/vat.csv`, { headers: { cookie: jo.cookie } });
  assert.equal(csv.status, 403);
  const out = await fetch(`${server.baseUrl}/api/reports/vat`);
  assert.equal(out.status, 401);
});

// Last, as it changes the shop: once saved, the quarters follow it.
test('once the quarter is saved it is not asked again, and the quarters follow it', async () => {
  const saved = await as(owner)('/api/shop-details', { method: 'PUT', body: { vatQuarterStartMonth: 3 } });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const { body } = await vat();
  assert.equal(body.needsQuarter, false);
  assert.equal(body.quarterStartMonth, 3);
  assert.equal(body.period.from, '2027-09-01');
  assert.equal(body.period.to, '2027-11-30');
  assert.deepEqual(body.before, { from: '2027-06-01', to: '2027-08-31' });
  assert.deepEqual(body.rows.map((r) => [r.label, r.salesPence, r.beforeVatPence]), [['Standard 20%', 0, 200], ['12.5%', 0, 125], ['Reduced rate 5%', 0, 50], ['Zero rate 0%', 0, 0]]);
  assert.deepEqual(body.notRecorded, { label: 'VAT not recorded', takingsPence: 0, beforeTakingsPence: 3000 });
});

test('a sale is placed in its quarter by the shop’s own day, in summer time too', async () => {
  // A shop of its own, so the edges are all that's in it. Last VAT quarter (calendar) is
  // 1 April to 30 June; in summer time the shop's day starts at 23:00 UTC the day before.
  const edge = await staffSignup(server.baseUrl, { shopName: 'Edge Cycles' });
  await firstShopIsBolton(edge);
  const s = await seeder(edge);
  await s.till('2027-03-31T22:30:00Z', [[3600, 2000, 600]]); // 31 March, 23:30: the quarter before that
  await s.till('2027-03-31T23:30:00Z', [[2400, 2000, 400]]); // 1 April, 00:30: in
  await s.till('2027-06-30T22:30:00Z', [[1200, 2000, 200]]); // 30 June, 23:30: in
  await s.till('2027-06-30T23:30:00Z', [[600, 2000, 100]]);  // 1 July, 00:30: out
  await s.old('2027-03-31T22:30:00Z', 80);
  await s.old('2027-03-31T23:30:00Z', 20);
  await s.old('2027-06-30T22:30:00Z', 10);
  await s.old('2027-06-30T23:30:00Z', 40);
  try {
    const { body } = await vat('period=last-vat-quarter', edge);
    assert.deepEqual(body.rows[0], { rateBp: 2000, label: 'Standard 20%', salesPence: 3000, vatPence: 600, beforeVatPence: 600 });
    assert.equal(body.notRecorded.takingsPence, 3000);
    assert.equal(body.notRecorded.beforeTakingsPence, 8000);
    // And this quarter so far holds only the 1 July sale.
    const now = await vat('', edge);
    assert.equal(now.body.rows[0].vatPence, 100);
    assert.equal(now.body.notRecorded.takingsPence, 4000);
  } finally {
    await deleteTestShop(edge.shop.id);
  }
});
