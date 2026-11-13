// Takings and cash-ups, the server (openspec/changes/reports-sales-and-takings,
// design 4, tasks 3.1; rp-takings, rp-day; Jack's answers 4, 5 and 9 of 10 Nov):
// each closed day as it was saved at the close, and its report. The clock is
// pinned to Thursday 17 September 2026.
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
let joLoginId;
const ids = {};

const as = (who) => (path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const takings = (query, who = owner) => as(who)(`/api/reports/takings?${query}`);

// A close as the Close the day screen saves it, written straight in: the
// figures are the saved ones, whatever the sales say now.
async function close(shop, day, loginId, f) {
  return runWithShop(shop.shop.id, async () => {
    const check = await prepare('INSERT INTO float_checks (day, login_id, expected_pence, counted_pence) VALUES (?, ?, 15000, 15000) RETURNING id').get(day, loginId);
    return (await prepare(
      `INSERT INTO day_closes (day, login_id, closed_at, float_check_id, float_start_pence, cash_pence, drawer_cash_pence, paid_outs_pence, expected_pence, counted_pence,
         float_pence, banked_pence, takings_pence, card_pence, other_pence, online_pence, c2w_pence)
       VALUES (?, ?, ?, ?, 15000, ?, ?, 0, ?, ?, 15000, ?, ?, ?, ?, ?, ?) RETURNING id`
    ).get(day, loginId, `${day}T17:30:00Z`, check.id, f.cash, f.cash, f.expected, f.counted, f.banked, f.takings, f.card, f.other, f.online, f.c2w ?? 0)).id;
  });
}

before(async () => {
  server = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2026-09-17T11:00:00Z' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  await firstShopIsBolton(owner);
  other = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  const made = await as(owner)('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  joLoginId = made.body.loginId;
  jo = { cookie: await staffFreshCookie(joLoginId) };

  // This week: Monday (Jo, exact), Tuesday (Jack, £5.00 short), Wednesday (Jo, exact).
  ids.mon = await close(owner, '2026-09-14', joLoginId, { takings: 20000, card: 12000, cash: 7000, other: 1000, online: 3000, expected: 7000, counted: 7000, banked: 5000 });
  ids.tue = await close(owner, '2026-09-15', owner.loginId, { takings: 30000, card: 15000, cash: 14000, other: 1000, online: 2500, c2w: 1500, expected: 14000, counted: 13500, banked: 11500 });
  ids.wed = await close(owner, '2026-09-16', joLoginId, { takings: 10000, card: 6000, cash: 3500, other: 500, online: 0, expected: 3500, counted: 3500, banked: 2500 });
  // The same days last week (Mon 7, Tue 8, Thu 10), and the Friday after them.
  // Online money taken today, not yet in any close: £12.50 paid through Shopify.
  await runWithShop(owner.shop.id, async () => {
    const sale = await prepare("INSERT INTO sales (created_at, subtotal, total, payment_method) VALUES ('2026-09-17T09:30:00Z', 12.5, 12.5, 'Shopify') RETURNING id").get();
    await prepare("INSERT INTO sale_payments (sale_id, tender_type, amount) VALUES (?, 'Shopify', 12.5)").run(sale.id);
  });
  // Saturday 12 September was never closed: it was counted with Sunday's morning float (for_day), and £20.00 of cash was taken on it.
  await runWithShop(owner.shop.id, async () => {
    await prepare("INSERT INTO float_checks (day, login_id, expected_pence, counted_pence, for_day, checked_at) VALUES ('2026-09-13', ?, 15000, 15000, '2026-09-12', '2026-09-13T06:00:00Z')").run(owner.loginId);
    await prepare("INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount) VALUES ('2026-09-12T10:00:00Z', 20, 20, 'Cash', 20)").run();
    // £30.00 paid online on that unclosed Saturday: it belongs to Saturday's close, not to today's "so far".
    const online = await prepare("INSERT INTO sales (created_at, subtotal, total, payment_method) VALUES ('2026-09-12T11:00:00Z', 30, 30, 'Shopify') RETURNING id").get();
    await prepare("INSERT INTO sale_payments (sale_id, tender_type, amount) VALUES (?, 'Shopify', 30)").run(online.id);
    // Wednesday 9 September was never closed either, counted on Saturday morning: £15.00 of cash on it.
    await prepare("INSERT INTO float_checks (day, login_id, expected_pence, counted_pence, for_day, checked_at) VALUES ('2026-09-12', ?, 15000, 15000, '2026-09-09', '2026-09-12T06:00:00Z')").run(owner.loginId);
    await prepare("INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount) VALUES ('2026-09-09T10:00:00Z', 15, 15, 'Cash', 15)").run();
  });
  await close(owner, '2026-09-07', joLoginId, { takings: 15000, card: 9000, cash: 5000, other: 1000, online: 2000, expected: 5000, counted: 5000, banked: 3000 });
  await close(owner, '2026-09-08', joLoginId, { takings: 25000, card: 14000, cash: 10000, other: 1000, online: 0, c2w: 500, expected: 10000, counted: 9800, banked: 8000 });
  await close(owner, '2026-09-10', joLoginId, { takings: 5000, card: 3000, cash: 1500, other: 500, online: 100, expected: 1500, counted: 1500, banked: 500 });
  await close(owner, '2026-09-11', joLoginId, { takings: 99900, card: 99900, cash: 0, other: 0, online: 0, expected: 0, counted: 0, banked: 0 });
  // Another shop, the same day.
  ids.theirs = await close(other, '2026-09-15', other.loginId, { takings: 77700, card: 77700, cash: 0, other: 0, online: 0, expected: 0, counted: 0, banked: 0 });
});

after(async () => {
  for (const s of [owner, other]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

test('this week lists the closed days newest first, today as "Not closed yet", and each day\'s online money as its own row', async () => {
  const res = await takings('period=this-week');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.period.label, 'So far: Mon 14 – Thu 17 September');
  assert.equal(res.body.today, '2026-09-17');
  const shape = res.body.rows.map((r) => [r.kind, r.key, r.label]);
  assert.deepEqual(shape, [
    ['day', '2026-09-17', 'Thu 17 Sep'], ['online', '2026-09-17', 'Thu 17 Sep · Online'],
    ['day', '2026-09-16', 'Wed 16 Sep'], ['online', '2026-09-16', 'Wed 16 Sep · Online'],
    ['day', '2026-09-15', 'Tue 15 Sep'], ['online', '2026-09-15', 'Tue 15 Sep · Online'],
    ['day', '2026-09-14', 'Mon 14 Sep'], ['online', '2026-09-14', 'Mon 14 Sep · Online'],
  ]);
  const [today, todayOnline, wed, wedOnline, tue] = res.body.rows;
  assert.equal(today.closed, false);
  // Today's online money so far, from the sales no close has counted yet (rp-takings: "[£] so far").
  // Not Saturday's £30.00 online: that is Saturday's, still waiting to be closed.
  assert.deepEqual([todayOnline.onlinePence, todayOnline.soFar], [1250, true]);
  assert.equal(wedOnline.soFar, undefined, 'a closed day\'s is as saved');
  assert.equal(today.takingsPence, undefined);
  assert.deepEqual([wed.closeId, wed.closed, wed.takingsPence, wed.bankedPence, wed.differencePence, wed.closedByName], [ids.wed, true, 10000, 2500, 0, 'Jo Taylor']);
  assert.deepEqual([tue.takingsPence, tue.bankedPence, tue.differencePence, tue.closedByName], [30000, 11500, -500, 'Jack Lewis']);
  assert.equal(wedOnline.onlinePence, 0);
  assert.equal(res.body.rows[5].onlinePence, 2500);
});

test('a past day nobody closed is its own row, "Not closed", with its takings so far and where to close it', async () => {
  const res = await takings('period=dates&from=2026-09-09&to=2026-09-17');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const days = res.body.rows.filter((r) => r.kind === 'day').map((r) => [r.key, r.closed, r.past ?? false]);
  assert.deepEqual(days, [['2026-09-17', false, false], ['2026-09-16', true, false], ['2026-09-15', true, false], ['2026-09-14', true, false], ['2026-09-12', false, true], ['2026-09-11', true, false], ['2026-09-10', true, false], ['2026-09-09', false, true]]);
  // Wednesday 9th was never closed either: its £15.00 is its own, and Saturday's row doesn't count it again (£20.00).
  const wed = res.body.rows.find((r) => r.key === '2026-09-09');
  assert.deepEqual([wed.past, wed.takingsPence], [true, 1500]);
  const sunday = res.body.rows.find((r) => r.key === '2026-09-12');
  assert.deepEqual([sunday.label, sunday.takingsPence, sunday.closeDay], ['Sat 12 Sep', 2000, '2026-09-12']);
  // It has no Online row: nothing was closed to keep one.
  assert.equal(res.body.rows.some((r) => r.kind === 'online' && r.key === '2026-09-12'), false);
  // A day nobody closed isn't a closed day: the figures still add up closes only.
  assert.equal(res.body.figures.takings.pence, 20000 + 30000 + 10000 + 5000 + 99900);
  // This week has no such day.
  assert.equal((await takings('period=this-week')).body.rows.some((r) => r.past), false);
});

test('the headline figures add up the closes and compare with the same closed days last week', async () => {
  const { figures, before } = (await takings('period=this-week')).body;
  // Thursday isn't closed yet, so last Thursday (10 Sep, £50.00) isn't in the comparison: Mon 7 to Wed 9.
  assert.deepEqual(before, { from: '2026-09-07', to: '2026-09-09' });
  assert.deepEqual(figures.takings, { pence: 60000, beforePence: 40000, diffPence: 20000 });
  assert.deepEqual(figures.card, { pence: 33000, beforePence: 23000, diffPence: 10000 });
  assert.deepEqual(figures.cash, { pence: 24500, beforePence: 15000, diffPence: 9500 });
  assert.deepEqual(figures.other, { pence: 2500, beforePence: 2000, diffPence: 500 });
  assert.deepEqual(figures.online, { pence: 5500, beforePence: 2000, diffPence: 3500 });
  // Cycle to Work money is a figure of its own: owed by the providers, not in the drawer (UX walk-through 5 H3).
  assert.deepEqual(figures.c2w, { pence: 1500, beforePence: 500, diffPence: 1000 });
  assert.deepEqual(figures.cashDifference, { pence: -500, beforePence: -200, diffPence: -300 });
});

test('Today is the one day against the same weekday last week, as one bar', async () => {
  const res = await takings('period=today');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.period.unit, 'day');
  assert.equal(res.body.bars.length, 1);
  assert.deepEqual([res.body.bars[0].key, res.body.bars[0].takingsPence, res.body.bars[0].beforeTakingsPence], ['2026-09-17', 0, 5000]);
  assert.deepEqual(res.body.rows.map((r) => r.kind), ['day', 'online']);
  assert.equal(res.body.rows[0].closed, false);
  assert.equal(res.body.figures.takings.beforePence, 5000, 'a single day against a single day');
});

test('the graph has a bar per day with the same day last week behind it', async () => {
  const { bars } = (await takings('period=this-week')).body;
  assert.equal(bars.length, 7);
  assert.deepEqual([bars[0].takingsPence, bars[0].beforeTakingsPence], [20000, 15000]);
  assert.deepEqual([bars[3].takingsPence, bars[3].notReached], [0, false]); // Thursday: not closed yet
  assert.deepEqual([bars[4].takingsPence, bars[4].notReached], [null, true]);
});

test('a sale saved after a close changes nothing in that close\'s figures', async () => {
  await runWithShop(owner.shop.id, async () => {
    const site = await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get();
    const till = await prepare('INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, ?, ?) RETURNING id').get(site.id, 'B1', 'Till 1', randomUUID());
    await prepare('INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, received_at, total_pence, vat_pence) VALUES (?, ?, ?, 1, false, ?, ?, 9999, 0)')
      .run(randomUUID(), till.id, site.id, '2026-09-16T12:00:00Z', '2026-09-16T19:00:00Z');
  });
  const wed = (await takings('period=this-week')).body.rows.find((r) => r.key === '2026-09-16' && r.kind === 'day');
  assert.equal(wed.takingsPence, 10000);
  const day = await as(owner)(`/api/reports/days/${ids.wed}`);
  assert.equal(day.body.close.takingsPence, 10000);
});

test('a month of closed days is one row per month beyond 62 days, opening nothing', async () => {
  const res = await takings('period=dates&from=2026-06-30&to=2026-09-17');
  assert.equal(res.body.period.unit, 'month');
  const sept = res.body.rows.find((r) => r.key === '2026-09');
  assert.equal(sept.kind, 'month');
  assert.equal(sept.closeId, undefined);
  assert.equal(sept.takingsPence, 20000 + 30000 + 10000 + 15000 + 25000 + 5000 + 99900);
  assert.equal(sept.closedDays, 7);
});

test('no closes in the period says so, and nothing is before the shop\'s first close', async () => {
  const quiet = await takings('period=dates&from=2026-09-01&to=2026-09-03');
  assert.equal(quiet.body.empty, true);
  const first = await takings('period=dates&from=2026-09-07&to=2026-09-09');
  assert.equal(first.body.nothingBefore, true);
  assert.equal(first.body.firstCloseOn, '2026-09-07');
  assert.equal(first.body.figures.takings.diffPence, null);
});

test('GET /api/reports/days/:id gives the close as saved, and 404 for another shop\'s', async () => {
  const res = await as(owner)(`/api/reports/days/${ids.tue}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const c = res.body.close;
  assert.deepEqual([c.day, c.closedByName, c.takingsPence, c.cardPence, c.cashPence, c.otherPence, c.c2wPence, c.onlinePence, c.differencePence, c.bankedPence],
    ['2026-09-15', 'Jack Lewis', 30000, 15000, 14000, 1000, 1500, 2500, -500, 11500]);
  assert.ok(c.closedAt);
  assert.equal((await as(owner)(`/api/reports/days/${ids.theirs}`)).status, 404);
  assert.equal((await as(owner)('/api/reports/days/999999999')).status, 404);
  assert.equal((await as(owner)('/api/reports/days/abc')).status, 404);
});

test('another shop\'s closes never count', async () => {
  const res = await takings('period=this-week', other);
  assert.equal(res.body.figures.takings.pence, 77700);
  assert.equal(res.body.rows.filter((r) => r.kind === 'day' && r.closed).length, 1);
});

test('Staff are refused and signed out is 401', async () => {
  for (const path of ['/api/reports/takings?period=this-week', `/api/reports/days/${ids.wed}`]) {
    const staff = await as(jo)(path);
    assert.equal(staff.status, 403, path);
    assert.equal(staff.body.error, "Only the shop's owner can see reports");
    assert.equal(staff.body.close, undefined);
    assert.equal((await staffRequest(server.baseUrl, null, path)).status, 401, path);
  }
});
