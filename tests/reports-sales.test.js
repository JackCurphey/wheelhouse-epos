// The Reports page's figures and the Sales report, the server
// (openspec/changes/reports-sales-and-takings, design 1 to 3; rp-home,
// rp-sales, rp-sales-year, rp-sales-empty, rp-pick-dates). The clock is
// pinned to Thursday 17 September 2026, so "this week" is Mon 14 to Sun 20.
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
let fresh;
let jo;

const as = (who) => (path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const sales = (query, who = owner) => as(who)(`/api/reports/sales?${query}`);

// A till and its site, then sales in either record. Times are UTC; the shop
// is on British Summer Time until 25 October, so 22:30Z is 23:30 the same day.
async function seed(shop) {
  const inShop = (fn) => runWithShop(shop.shop.id, fn);
  const { site, till } = await inShop(async () => {
    const siteRow = await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get();
    const tillRow = await prepare('INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, ?, ?) RETURNING id').get(siteRow.id, 'B1', 'Till 1', randomUUID());
    return { site: siteRow, till: tillRow };
  });
  let receipt = 0;
  return {
    old: (at, pounds) => inShop(() => prepare("INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount) VALUES (?, ?, ?, 'Cash', ?)").run(at, pounds, pounds, pounds)),
    till: (at, pence, { offline = false, received = at } = {}) => inShop(() => prepare(
      `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, received_at, total_pence, vat_pence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).run(randomUUID(), till.id, site.id, ++receipt, offline, at, received, pence)),
  };
}

before(async () => {
  server = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2026-09-17T11:00:00Z' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  await firstShopIsBolton(owner);
  other = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  fresh = await staffSignup(server.baseUrl, { shopName: 'New Cycles' });
  const made = await as(owner)('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };

  const mine = await seed(owner);
  // This week (Mon 14 to Thu 17 Sep).
  await mine.old('2026-09-14T23:30:00Z', 1);        // 00:30 on Tuesday 15th in the shop: Tuesday
  await mine.old('2026-09-15T10:00:00Z', 10);       // Tuesday, old record
  await mine.till('2026-09-15T08:00:00Z', 2500);    // Tuesday, till record (09:00)
  await mine.till('2026-09-15T17:55:00Z', 900, { offline: true, received: '2026-09-16T06:00:00Z' }); // offline, Tuesday
  await mine.till('2026-09-16T22:30:00Z', 300);     // 23:30 Wednesday
  await mine.till('2026-09-17T08:00:00Z', 4000);    // Thursday 09:00
  // The same days last week, Mon 7 to Thu 10 Sep, and Friday after them.
  await mine.till('2026-09-07T10:00:00Z', 10000);
  await mine.till('2026-09-08T10:00:00Z', 5000);
  await mine.till('2026-09-10T10:00:00Z', 2000);
  await mine.till('2026-09-11T10:00:00Z', 99900);   // Friday: not "the same days"
  // Last Thursday (10 Sep) also had a sale at 20:30 local, after closing time.
  await mine.till('2026-09-10T19:30:00Z', 1000);
  // Pennies for the rounding test, after the shop's first sale: 3p, 3p and 4p on 25 Aug, 2p and 3p on 26 Aug.
  await mine.till('2026-08-25T10:00:00Z', 3);
  await mine.till('2026-08-25T11:00:00Z', 3);
  await mine.till('2026-08-25T12:00:00Z', 4);
  await mine.till('2026-08-26T10:00:00Z', 2);
  await mine.till('2026-08-26T11:00:00Z', 3);
  // The shop's first sale, in August.
  await mine.old('2026-08-20T10:00:00Z', 5);
  // Another shop, on the same days.
  const theirs = await seed(other);
  await theirs.till('2026-09-15T10:00:00Z', 77700);
  await theirs.till('2026-07-02T10:00:00Z', 700);
});

after(async () => {
  for (const s of [owner, other, fresh]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

test('the Reports page gives the date, the shop and this week\'s takings so far', async () => {
  const res = await as(owner)('/api/reports/home');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.today, '2026-09-17');
  assert.equal(res.body.dateLine, 'Thursday 17 September');
  assert.match(res.body.shopLine, /^North Street Cycles [0-9a-f]{8}, Bolton$/); // the test shop's name carries a suffix
  assert.equal(res.body.strip.heading, 'So far: Mon 14 – Thu 17 September');
  assert.equal(res.body.strip.takingsPence, 8800);
});

test('This week counts each sale once, from both records, on the shop\'s day', async () => {
  const res = await sales('period=this-week');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { period, rows, total, figures } = res.body;
  assert.equal(res.body.today, '2026-09-17', 'the screen needs the shop\'s today to limit Pick dates');
  assert.equal(period.label, 'So far: Mon 14 – Thu 17 September');
  assert.equal(period.against, 'the same days last week');
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.deepEqual(rows.map((r) => r.key), ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20']);
  // Tuesday: the 00:30 sale, the old £10, the till £25 and the offline £9.
  assert.deepEqual([by['2026-09-15'].takingsPence, by['2026-09-15'].sales], [4500, 4]);
  // Wednesday: the 23:30 sale is on Wednesday, not Thursday.
  assert.deepEqual([by['2026-09-16'].takingsPence, by['2026-09-16'].sales], [300, 1]);
  assert.deepEqual([by['2026-09-17'].takingsPence, by['2026-09-17'].sales], [4000, 1]);
  assert.deepEqual([by['2026-09-14'].takingsPence, by['2026-09-14'].sales, by['2026-09-14'].averagePence], [0, 0, null]);
  assert.equal(by['2026-09-18'].notReached, true);
  assert.equal(by['2026-09-18'].takingsPence, null);
  // Last week's same day sits beside each row.
  assert.deepEqual([by['2026-09-14'].beforeTakingsPence, by['2026-09-14'].beforeSales], [10000, 1]);
  // The figures and the table's total are one set of numbers.
  assert.equal(figures.takings.pence, 8800);
  assert.equal(figures.sales.count, 6);
  assert.equal(figures.average.pence, 1467); // 8800 / 6 = 1466.67, to the penny
  assert.deepEqual({ ...total }, { label: 'So far', takingsPence: 8800, sales: 6, averagePence: 1467 });
  assert.equal(rows.reduce((n, r) => n + (r.takingsPence ?? 0), 0), figures.takings.pence);
});

test('each figure is compared with the same days last week', async () => {
  const { figures } = (await sales('period=this-week')).body;
  // Last week, Mon to Thu: £100 + £50 + £20 + £10 = £180 in 4 sales, average £45. The Friday is left out.
  assert.deepEqual(figures.takings, { pence: 8800, beforePence: 18000, diffPence: -9200 });
  assert.deepEqual(figures.sales, { count: 6, beforeCount: 4, diff: 2 });
  assert.deepEqual(figures.average, { pence: 1467, beforePence: 4500, diffPence: -3033 });
});

test('Last 12 months is by month, with the same figures in the table', async () => {
  const res = await sales('period=last-12-months');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { rows, total, period } = res.body;
  assert.equal(period.label, 'October 2025 – September 2026');
  assert.equal(rows.length, 12);
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.equal(by['2026-08'].takingsPence, 500 + 15);
  assert.equal(by['2026-09'].takingsPence, 8800 + 18000 + 99900);
  assert.equal(total.label, '12 months');
  assert.equal(total.takingsPence, 515 + 8800 + 18000 + 99900);
  assert.equal(res.body.figures.takings.pence, total.takingsPence);
});

test('Today is by hour on the shop\'s clock', async () => {
  const res = await sales('period=today');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const nine = res.body.rows.find((r) => r.key === 9);
  assert.deepEqual([nine.takingsPence, nine.sales], [4000, 1]);
  assert.equal(res.body.figures.takings.pence, 4000);
  assert.equal(res.body.period.against, 'last Thursday');
  assert.equal(res.body.figures.takings.beforePence, 3000); // last Thursday, 10 Sep: £20 and the £10 after closing
});

test('Pick dates shows the range against the same number of days before it', async () => {
  const res = await sales('period=dates&from=2026-09-07&to=2026-09-10');
  assert.equal(res.body.figures.takings.pence, 18000);
  assert.equal(res.body.rows.length, 4);
  const wrong = await sales('period=dates&from=2026-09-10&to=2026-09-07');
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.error, /To is before From/);
  assert.equal((await sales('period=dates&from=2026-09-10&to=2026-09-18')).status, 400);
});

test('a period with no sales says so, and the shop\'s first sale is named when nothing is before it', async () => {
  const quiet = await sales('period=dates&from=2026-09-01&to=2026-09-03');
  assert.equal(quiet.body.empty, true);
  assert.equal(quiet.body.nothingBefore, false);
  assert.equal(quiet.body.figures.sales.count, 0);
  // 10 to 20 August: nothing before the 10th, and the first sale was on the 20th.
  const first = await sales('period=dates&from=2026-08-10&to=2026-08-20');
  assert.equal(first.body.empty, false);
  assert.equal(first.body.nothingBefore, true);
  assert.equal(first.body.firstSaleOn, '2026-08-20');
  assert.equal(first.body.figures.takings.diffPence, null, 'no comparison with nothing');
  // A shop with no sales at all.
  await pool.query("UPDATE shops SET created_at = '2026-08-30T23:30:00Z' WHERE id = $1", [fresh.shop.id]);
  const none = await sales('period=today', fresh);
  assert.equal(none.body.empty, true);
  // The day the shop started on Wheelhouse, for "The shop started on Wheelhouse on [date]" (rp-sales-empty).
  assert.equal(none.body.startedOn, '2026-08-31', '23:30 UTC is already the 31st on the shop\'s clock');
  assert.equal(none.body.nothingBefore, true);
  assert.equal(none.body.firstSaleOn, null);
});

test('another shop\'s sales never count', async () => {
  const res = await sales('period=this-week', other);
  assert.equal(res.body.figures.takings.pence, 77700);
  assert.equal(res.body.figures.sales.count, 1);
});

test('Staff are refused, and signed out is 401', async () => {
  for (const path of ['/api/reports/home', '/api/reports/sales?period=this-week']) {
    const staff = await as(jo)(path);
    assert.equal(staff.status, 403, path);
    assert.equal(staff.body.error, "Only the shop's owner can see reports");
    assert.equal(staff.body.figures, undefined);
    const out = await staffRequest(server.baseUrl, null, path);
    assert.equal(out.status, 401, path);
  }
});

test('Average sale is rounded to the penny, half up', async () => {
  // 25 Aug: 3p + 3p + 4p = 10p over 3 sales is 3.33p, which rounds down to 3p.
  const down = await sales('period=dates&from=2026-08-25&to=2026-08-25');
  assert.deepEqual([down.body.figures.takings.pence, down.body.figures.average.pence], [10, 3]);
  // 26 Aug: 2p + 3p = 5p over 2 sales is 2.5p, which rounds up to 3p.
  const half = await sales('period=dates&from=2026-08-26&to=2026-08-26');
  assert.equal(half.body.figures.average.pence, 3);
});

test('This month and Last month are served, each against its comparison', async () => {
  const month = await sales('period=this-month');
  assert.equal(month.body.period.against, 'the same days last month');
  assert.equal(month.body.figures.takings.pence, 8800 + 18000 + 99900);
  assert.equal(month.body.figures.takings.beforePence, 0, 'nothing sold on 1 to 17 August');
  const last = await sales('period=last-month');
  assert.equal(last.body.rows.length, 31);
  assert.equal(last.body.figures.takings.pence, 515);
});

test('a picked range over 62 days is by month and keeps every sale of the period before', async () => {
  // 5 Jul to 17 Sep is 75 days: the 75 days before run from 21 Apr to 4 Jul and
  // touch four calendar months, though the range has three (review).
  const res = await sales('period=dates&from=2026-07-05&to=2026-09-17', other);
  assert.equal(res.body.period.unit, 'month');
  assert.deepEqual(res.body.rows.map((r) => r.key), ['2026-07', '2026-08', '2026-09']);
  assert.equal(res.body.figures.takings.pence, 77700);
  assert.equal(res.body.figures.takings.beforePence, 700, 'the 2 July sale is in the period before');
});

test('another shop\'s sales never set this shop\'s first-sale day', async () => {
  const res = await sales('period=today', other);
  assert.equal(res.body.firstSaleOn, '2026-07-02');
  assert.equal((await sales('period=today')).body.firstSaleOn, '2026-08-20');
});
