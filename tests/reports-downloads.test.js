// Download as spreadsheet, the server (openspec/changes/reports-sales-and-takings,
// design 7, tasks 4.1; Jack's answer 10 of 10 Nov): each report's table as shown,
// for the period chosen, as a CSV that opens in Excel or Google Sheets. The clock
// is pinned to Thursday 17 September 2026.
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
let jo;
let evilLoginId;
const ids = {};

const as = (who) => (path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
async function file(path, who = owner) {
  const res = await fetch(`${server.baseUrl}${path}`, { headers: { cookie: who.cookie } });
  const bytes = Buffer.from(await res.arrayBuffer());
  return { res, bytes, text: bytes.toString('utf8') };
}
// The cells of a CSV, a row at a time (the test's cells hold no commas).
const cells = (text) => text.replace(/^﻿/, '').split('\r\n').filter(Boolean).map((r) => r.split(','));

async function seedClose(shop, day, loginId, f) {
  return runWithShop(shop.shop.id, async () => {
    const check = await prepare('INSERT INTO float_checks (day, login_id, expected_pence, counted_pence) VALUES (?, ?, 15000, 15000) RETURNING id').get(day, loginId);
    return (await prepare(
      `INSERT INTO day_closes (day, login_id, closed_at, float_check_id, float_start_pence, cash_pence, drawer_cash_pence, paid_outs_pence, expected_pence, counted_pence,
         float_pence, banked_pence, takings_pence, card_pence, other_pence, online_pence)
       VALUES (?, ?, ?, ?, 15000, ?, ?, 0, ?, ?, 15000, ?, ?, ?, ?, ?) RETURNING id`
    ).get(day, loginId, `${day}T17:30:00Z`, check.id, f.cash, f.cash, f.expected, f.counted, f.banked, f.takings, f.card, f.other, f.online)).id;
  });
}

before(async () => {
  server = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2026-09-17T11:00:00Z' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  await firstShopIsBolton(owner);
  const joMade = await as(owner)('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  jo = { cookie: await staffFreshCookie(joMade.body.loginId) };
  // Someone whose name a spreadsheet would read as a formula.
  const evil = await as(owner)('/api/team', { method: 'POST', body: { name: '=SUM(1+1)', isCashier: true, email: `ev-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(evil.status, 201, JSON.stringify(evil.body));
  evilLoginId = evil.body.loginId;

  ids.mon = await seedClose(owner, '2026-09-14', owner.loginId, { takings: 20000, card: 12000, cash: 7000, other: 1000, online: 3000, expected: 7000, counted: 7000, banked: 5000 });
  ids.tue = await seedClose(owner, '2026-09-15', evilLoginId, { takings: 30000, card: 15000, cash: 14000, other: 1000, online: 2500, expected: 14000, counted: 13500, banked: 11500 });
  await runWithShop(owner.shop.id, async () => {
    const site = await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get();
    const till = await prepare('INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, ?, ?) RETURNING id').get(site.id, 'B1', 'Till 1', randomUUID());
    let receipt = 0;
    for (const [at, pence] of [['2026-09-15T08:00:00Z', 2550], ['2026-09-16T09:00:00Z', 1500], ['2026-09-17T08:00:00Z', 4000]]) {
      await prepare('INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, received_at, total_pence, vat_pence) VALUES (?, ?, ?, ?, false, ?, ?, ?, 0)')
        .run(randomUUID(), till.id, site.id, ++receipt, at, at, pence);
    }
  });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

test('sales.csv is the Sales table as shown: header, a row a day, the total, in pounds and pence, in a file named for the shop and dates', async () => {
  const { res, text, bytes } = await file('/api/reports/sales.csv?period=this-week');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/csv; charset=utf-8/);
  assert.match(res.headers.get('content-disposition'), /^attachment; filename="sales-north-street-cycles-[0-9a-f]{8}-2026-09-14-to-2026-09-17\.csv"$/);
  assert.ok(text.startsWith('﻿'), 'the UTF-8 mark, so Excel shows £');
  const rows = cells(text);
  assert.deepEqual(rows[0], ['Day', 'Takings', 'Sales', 'Average']);
  assert.deepEqual(rows[2], ['Tue 15 Sep', '25.50', '1', '25.50']);
  assert.deepEqual(rows[5], ['Fri 18 Sep', '—', '—', '—'], 'days to come, as on screen');
  assert.deepEqual(rows.at(-1), ['So far', '80.50', '3', '26.83']);
  // The same figures as the JSON the screen reads.
  const json = (await as(owner)('/api/reports/sales?period=this-week')).body;
  const pounds = (p) => (p === null ? '—' : (p / 100).toFixed(2));
  assert.deepEqual(rows.slice(1, 1 + json.rows.length), json.rows.map((r) => [r.label, pounds(r.takingsPence), r.sales === null ? '—' : String(r.sales), pounds(r.averagePence)]));
  assert.deepEqual(rows.at(-1), [json.total.label, pounds(json.total.takingsPence), String(json.total.sales), pounds(json.total.averagePence)]);
});

test('sales.csv for 12 months is by month and a bad period is refused', async () => {
  const { text } = await file('/api/reports/sales.csv?period=last-12-months');
  assert.deepEqual(cells(text)[0], ['Month', 'Takings', 'Sales', 'Average']);
  assert.equal(cells(text).at(-1)[0], '12 months');
  const bad = await file('/api/reports/sales.csv?period=dates&from=2026-09-10&to=2026-09-07');
  assert.equal(bad.res.status, 400);
});

test('takings.csv is the closed-days table as shown, with each day\'s Online row, and a name that looks like a formula is text', async () => {
  const { res, text } = await file('/api/reports/takings.csv?period=this-week');
  assert.match(res.headers.get('content-disposition'), /filename="takings-north-street-cycles-[0-9a-f]{8}-2026-09-14-to-2026-09-17\.csv"/);
  const rows = cells(text);
  assert.deepEqual(rows[0], ['Day', 'Takings', 'Cash banked', 'Cash difference', 'Closed by']);
  assert.deepEqual(rows[1], ['Thu 17 Sep', '—', '—', '—', 'Not closed yet']);
  // The name starts with an apostrophe, so a spreadsheet shows it as text, not a formula.
  assert.deepEqual(rows[2], ['Tue 15 Sep', '300.00', '115.00', '-5.00', "'=SUM(1+1)"]);
  assert.deepEqual(rows[3], ['Tue 15 Sep · Online', '25.00', '—', '—', 'Not a till']);
  assert.deepEqual(rows[4], ['Mon 14 Sep', '200.00', '50.00', '0.00', 'Jack Lewis']);
  assert.deepEqual(rows[5], ['Mon 14 Sep · Online', '30.00', '—', '—', 'Not a till']);
});

test('the closed day\'s .csv is that day\'s report as saved', async () => {
  const { res, text } = await file(`/api/reports/days/${ids.tue}/csv`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /filename="day-north-street-cycles-[0-9a-f]{8}-2026-09-15\.csv"/);
  assert.ok(text.includes('Takings,300.00'));
  assert.ok(text.includes('Card,150.00'));
  assert.ok(text.includes('Cash,140.00'));
  assert.ok(text.includes('Cash difference,-5.00'));
  assert.ok(text.includes('Banked,115.00'));
  assert.ok(text.includes('Online,25.00'));
  assert.ok(text.includes("Closed by,'=SUM(1+1)"), 'a formula-looking name is text');
  assert.equal((await file('/api/reports/days/999999999/csv')).res.status, 404);
});

test('Staff are refused each file, and signed out is 401', async () => {
  for (const path of ['/api/reports/sales.csv?period=this-week', '/api/reports/takings.csv?period=this-week', `/api/reports/days/${ids.mon}/csv`]) {
    const staff = await file(path, jo);
    assert.equal(staff.res.status, 403, path);
    assert.ok(!staff.text.includes('Tue 15 Sep'), 'no figures sent');
    assert.equal((await fetch(`${server.baseUrl}${path}`)).status, 401, path);
  }
});
