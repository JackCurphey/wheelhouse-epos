// A day nobody closed (openspec/changes/unclosed-day; op-float-check-unclosed,
// op-today-unclosed, op-close-yesterday, op-today-two; Jack's 29 Oct answer
// 5, UX walk-through 2 H1(b)). The morning after, the float check expects
// the float plus that day's cash and must be counted; the count is that
// day's count; Today says it wasn't closed; Close it closes it at banking
// with its own sales; and tonight's close starts from the count less what
// was banked for it. Amounts are whole pence. The live server's clock is
// pinned to 07:00 on Tuesday 1 Sep 2026 in London: "Wednesday" here is
// Monday 31 Aug, the day nobody closed, and 30 Aug was closed.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare, pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, checkInAtTill } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
const shops = [];
before(async () => {
  server = await startLiveServer();
});
after(async () => {
  for (const s of shops) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
});

const FLOAT = 15000;
const YESTERDAY = '2026-08-31';
const call = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const post = (who, path, body) => call(who, path, { method: 'POST', body });
const sql = (owner, text, ...args) => runWithShop(owner.shop.id, () => prepare(text).get(...args));

// A float check on an earlier day at 06:00 UTC (07:00 in London) by the
// Owner checked in at the till, looked right unless counted, and optionally
// the count for a day before it.
const check = (owner, d, counted = null, forDay = null) => sql(owner,
  `INSERT INTO float_checks (day, login_id, employee_id, expected_pence, counted_pence, for_day, checked_at)
   VALUES (?, ?, (SELECT employee_id FROM logins WHERE id = ?), ?, ?, ?, ?) RETURNING id`,
  d, owner.loginId, owner.loginId, FLOAT, counted, forDay, `${d}T06:00:00Z`);
const closed = (owner, d, checkId) => sql(owner,
  `INSERT INTO day_closes (day, login_id, closed_at, float_check_id, float_start_pence, cash_pence, paid_outs_pence, expected_pence, counted_pence,
     float_pence, banked_pence, takings_pence, card_pence, other_pence)
   VALUES (?, ?, ?, ?, 15000, 0, 0, 15000, 15000, 15000, 0, 0, 0, 0) RETURNING id`, d, owner.loginId, `${d}T17:00:00Z`, checkId);
// The float check is saved at the database's own time; put this morning's at 07:00 in London.
const morning = (owner, checkId) => sql(owner, "UPDATE float_checks SET checked_at = '2026-09-01T06:00:00Z' WHERE id = ? RETURNING id", checkId);

// A shop checked in at the till with its float set. `history`: 'closed'
// (30 Aug closed, 31 Aug opened and not closed), 'never' (31 Aug opened, no
// close ever), or 'yesterday' (31 Aug opened and closed).
async function shop(history = 'closed') {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  const till = await checkInAtTill(server.baseUrl, owner.cookie);
  Object.assign(owner, { session: owner.cookie, cookie: till.cookie });
  assert.equal((await call(owner, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: FLOAT } })).status, 200);
  if (history === 'closed') await closed(owner, '2026-08-30', (await check(owner, '2026-08-30')).id);
  const y = await check(owner, YESTERDAY);
  if (history === 'yesterday') await closed(owner, YESTERDAY, y.id);
  return owner;
}

// A sale in the old record (pounds) at a moment.
const oldSale = (owner, at, { cash = 0, card = 0 }) => sql(owner,
  "INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, card_amount) VALUES (?, ?, ?, 'Split', ?, ?) RETURNING id",
  at, cash + card, cash + card, cash, card);
// A sale in the till record (pence): received by the server at `received`
// (now, unless given), on the till's clock at `at`.
async function tillSale(owner, at, payments, { offline = false, received = null } = {}) {
  return runWithShop(owner.shop.id, async () => {
    await prepare("INSERT INTO sites (name, code) VALUES ('Bolton', 'B') ON CONFLICT (shop_id, code) DO NOTHING").run();
    const site = await prepare("SELECT id FROM sites WHERE code = 'B'").get();
    await prepare("INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, 'B1', 'Till B1', ?) ON CONFLICT (shop_id, code) DO NOTHING").run(site.id, randomUUID());
    const till = await prepare("SELECT id FROM tills WHERE code = 'B1'").get();
    const total = payments.reduce((n, p) => n + p.pence, 0);
    const { id } = await prepare(
      `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, received_at, total_pence, vat_pence)
       VALUES (?, ?, ?, 1, ?, ?, COALESCE(?::timestamptz, now()), ?, 0) RETURNING id`
    ).get(randomUUID(), till.id, site.id, offline, at, received, total);
    for (const p of payments) await prepare('INSERT INTO till_sale_payments (till_sale_id, method, amount_pence) VALUES (?, ?, ?)').run(id, p.method, p.pence);
    return { id };
  });
}

// Wednesday's day: £74.00 cash and £20.00 card, and £10.00 cash at the till,
// after its float check; £5.00 taken out; and £3.00 cash after 30 Aug's
// close but before Wednesday's check (in its report, not its drawer figure).
async function wednesday(owner) {
  await oldSale(owner, '2026-08-30T18:00:00Z', { cash: 3 });
  await oldSale(owner, '2026-08-31T10:00:00Z', { cash: 74, card: 20 });
  await tillSale(owner, '2026-08-31T12:00:00Z', [{ method: 'cash', pence: 1000 }], { received: '2026-08-31T12:00:01Z' });
  await sql(owner, "INSERT INTO paid_outs (day, login_id, amount_pence, reason, created_at) VALUES (?, ?, 500, 'Other', '2026-08-31T15:00:00Z') RETURNING id", YESTERDAY, owner.loginId);
}
const WED_CASH = 7400 + 1000 - 500;

async function countThisMorning(owner, countedPence, reason) {
  const res = await post(owner, '/api/float-check', reason ? { countedPence, reason } : { countedPence });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  await morning(owner, res.body.check.id);
  return res.body.check;
}
const floatToday = async (owner) => {
  const res = await call(owner, '/api/float-check');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
};
const closeDay = async (owner, query = '') => {
  const res = await call(owner, `/api/close-the-day${query}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
};
const notClosedLines = async (owner) => (await call(owner, '/api/needs-attention')).body.items.filter((i) => i.kind === 'day_not_closed');

test('the morning after a day nobody closed expects the float plus its cash, and must be counted', async () => {
  const owner = await shop();
  await wednesday(owner);
  const t = await floatToday(owner);
  assert.deepEqual(t.unclosed, { day: YESTERDAY, startPence: FLOAT, cashPence: WED_CASH, expectedPence: FLOAT + WED_CASH });
  const look = await post(owner, '/api/float-check', { countedPence: null });
  assert.deepEqual([look.status, look.body.code], [400, 'count_needed']);
  const c = await countThisMorning(owner, FLOAT + WED_CASH - 100, 'a pound coin short');
  assert.deepEqual([c.how, c.expectedPence, c.countedPence], ['counted', FLOAT + WED_CASH, FLOAT + WED_CASH - 100]);
  const row = await sql(owner, "SELECT to_char(for_day, 'YYYY-MM-DD') AS for_day FROM float_checks WHERE id = ?", c.id);
  assert.equal(row.for_day, YESTERDAY);
  // Checked: nothing more to ask today.
  assert.equal((await floatToday(owner)).unclosed, null);
});

test('after a closed day, or before a shop\'s first close, the morning is a normal check', async () => {
  for (const history of ['yesterday', 'never']) {
    const owner = await shop(history);
    await oldSale(owner, '2026-08-31T10:00:00Z', { cash: 74 });
    assert.equal((await floatToday(owner)).unclosed, null, history);
    const res = await post(owner, '/api/float-check', { countedPence: null });
    assert.equal(res.status, 201, `${history}: ${JSON.stringify(res.body)}`);
    assert.equal((await notClosedLines(owner)).length, 0, history);
  }
});

test('Today lists the day nobody closed with the morning\'s count, until it is closed', async () => {
  const owner = await shop();
  await wednesday(owner);
  const c = await countThisMorning(owner, FLOAT + WED_CASH);
  const [line, ...more] = await notClosedLines(owner);
  assert.equal(more.length, 0);
  assert.deepEqual({ ...line, checkedAt: 0 }, { kind: 'day_not_closed', day: YESTERDAY, checkId: c.id, checkDay: '2026-09-01', countedByName: 'Jack Lewis', checkedAt: 0, tillCode: null });
  assert.equal((await post(owner, '/api/close-the-day', { day: YESTERDAY })).status, 201);
  assert.equal((await notClosedLines(owner)).length, 0);
});

test('Close it: the day closes from the morning\'s count, with its own sales, cash taken out and banking', async () => {
  const owner = await shop();
  await wednesday(owner);
  await countThisMorning(owner, FLOAT + WED_CASH - 100, 'a pound coin short');
  // This morning's own sales, after the count: tonight's.
  await oldSale(owner, '2026-09-01T10:00:00Z', { cash: 30 });
  await tillSale(owner, '2026-09-01T11:00:00Z', [{ method: 'cash', pence: 500 }]);
  // A sale made offline on Wednesday evening, received only now: Wednesday's.
  await tillSale(owner, '2026-08-31T19:00:00Z', [{ method: 'cash', pence: 600 }], { offline: true });
  // Today's close waits for Wednesday, and the page says which day.
  const today = await closeDay(owner);
  assert.equal(today.earlierDay, YESTERDAY);
  const refused = await post(owner, '/api/close-the-day', { countedPence: FLOAT });
  assert.deepEqual([refused.status, refused.body.code, refused.body.day], [409, 'earlier_day_open', YESTERDAY]);
  // Wednesday's page, at banking.
  const w = await closeDay(owner, `?day=${YESTERDAY}`);
  const counted = FLOAT + WED_CASH - 100;
  assert.deepEqual([w.day, w.floatStart.pence, w.cashPence, w.paidOutsPence, w.expectedPence], [YESTERDAY, FLOAT, 9000, 500, FLOAT + 9000 - 500]);
  assert.deepEqual({ ...w.countedBy, at: 0 }, { pence: counted, byName: 'Jack Lewis', at: 0, day: '2026-09-01' });
  assert.deepEqual([w.bankPence, w.topUpPence, w.carriedPence, w.close], [counted - FLOAT, 0, 0, null]);
  // Cash taken out on Wednesday, added now: Wednesday's, not today's.
  const po = await post(owner, '/api/paid-outs', { amountPence: 200, reason: 'Other', day: YESTERDAY });
  assert.equal(po.status, 201, JSON.stringify(po.body));
  assert.deepEqual((await closeDay(owner, `?day=${YESTERDAY}`)).paidOuts.map((p) => p.amountPence), [500, 200]);
  assert.equal((await closeDay(owner)).paidOutsPence, 0);
  const res = await post(owner, '/api/close-the-day', { day: YESTERDAY });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const c = res.body.close;
  assert.deepEqual(
    [c.day, c.countedPence, c.expectedPence, c.differencePence, c.reason, c.bankedPence, c.leftPence, c.topUpPence, c.carriedPence],
    [YESTERDAY, counted, FLOAT + 9000 - 700, counted - (FLOAT + 9000 - 700), 'a pound coin short', counted - FLOAT, FLOAT, 0, 0]
  );
  assert.deepEqual([c.cashPence, c.drawerCashPence, c.cardPence, c.takingsPence, c.paidOutsPence], [300 + 9000, 9000, 2000, 300 + 9000 + 2000, 700]);
  assert.equal(c.countedBy.byName, 'Jack Lewis');
  // Tonight: this morning's count, less Wednesday's banking, plus today's cash.
  const t = await closeDay(owner);
  assert.deepEqual([t.earlierDay, t.cashPence, t.expectedPence], [null, 3500, counted - (counted - FLOAT) + 3500]);
  const tonight = await post(owner, '/api/close-the-day', { countedPence: FLOAT + 3500, expectedPence: FLOAT + 3500 });
  assert.equal(tonight.status, 201, JSON.stringify(tonight.body));
  assert.deepEqual([tonight.body.close.cashPence, tonight.body.close.differencePence, tonight.body.close.bankedPence], [3500, 0, 3500]);
  // Every sale is in exactly one close.
  const left = await sql(owner, `SELECT (SELECT count(*) FROM sales WHERE day_close_id IS NULL)::int + (SELECT count(*) FROM till_sales WHERE day_close_id IS NULL)::int AS n`);
  assert.equal(left.n, 0);
});

test('Close it for a day with no count waiting, or one already closed, is refused', async () => {
  const owner = await shop();
  // Today's own date is today's close, which needs a count.
  for (const d of ['2026-08-29', '2026-09-02', 'nonsense', '2026-02-31', '2026-09-01']) {
    const res = await post(owner, '/api/close-the-day', { day: d });
    assert.equal(res.status, ['nonsense', '2026-02-31', '2026-09-01'].includes(d) ? 400 : 404, `${d}: ${JSON.stringify(res.body)}`);
  }
  // Nobody has counted for Wednesday yet.
  assert.equal((await post(owner, '/api/close-the-day', { day: YESTERDAY })).status, 404);
  assert.equal((await call(owner, `/api/close-the-day?day=${YESTERDAY}`)).status, 404);
  assert.equal((await post(owner, '/api/paid-outs', { amountPence: 100, reason: 'Other', day: YESTERDAY })).status, 404);
  await countThisMorning(owner, FLOAT);
  assert.equal((await post(owner, '/api/close-the-day', { day: YESTERDAY })).status, 201);
  const again = await post(owner, '/api/close-the-day', { day: YESTERDAY });
  assert.deepEqual([again.status, again.body.code, again.body.close?.day], [409, 'already_closed', YESTERDAY]);
  assert.equal((await post(owner, '/api/paid-outs', { amountPence: 100, reason: 'Other', day: YESTERDAY })).status, 409);
  // A closed earlier day still shows its close.
  assert.equal((await closeDay(owner, `?day=${YESTERDAY}`)).close.day, YESTERDAY);
});

test('two Close its at the same moment keep one', async () => {
  const owner = await shop();
  await wednesday(owner);
  await countThisMorning(owner, FLOAT + WED_CASH);
  const both = await Promise.all([post(owner, '/api/close-the-day', { day: YESTERDAY }), post(owner, '/api/close-the-day', { day: YESTERDAY })]);
  assert.deepEqual(both.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await sql(owner, 'SELECT count(*)::int AS n FROM day_closes WHERE day = ?', YESTERDAY)).n, 1);
});

test('two days nobody closed close oldest first, and nothing is banked twice', async () => {
  const owner = await shop('never');
  // 29 Aug closed; 30 Aug opened and not closed, counted on 31 Aug with its
  // £40.00; 31 Aug took £25.00 and wasn't closed either.
  await closed(owner, '2026-08-29', (await check(owner, '2026-08-29')).id);
  await sql(owner, "DELETE FROM float_checks WHERE day = '2026-08-31'");
  await check(owner, '2026-08-30');
  await oldSale(owner, '2026-08-30T10:00:00Z', { cash: 40 });
  await check(owner, YESTERDAY, FLOAT + 4000, '2026-08-30');
  await oldSale(owner, '2026-08-31T10:00:00Z', { cash: 25 });
  // This morning the drawer should have the 31st's start (the float and the
  // 30th's £40.00, not banked yet) plus its £25.00.
  assert.deepEqual((await floatToday(owner)).unclosed, { day: YESTERDAY, startPence: FLOAT + 4000, cashPence: 2500, expectedPence: FLOAT + 6500 });
  await countThisMorning(owner, FLOAT + 6500);
  const early = await post(owner, '/api/close-the-day', { day: YESTERDAY });
  assert.deepEqual([early.status, early.body.code, early.body.day], [409, 'earlier_day_open', '2026-08-30']);
  const first = await post(owner, '/api/close-the-day', { day: '2026-08-30' });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.deepEqual([first.body.close.bankedPence, first.body.close.takingsPence], [4000, 4000]);
  // The 31st's count held the 30th's £40.00 too, banked since: its bag is its own £25.00.
  const w = await closeDay(owner, `?day=${YESTERDAY}`);
  assert.deepEqual([w.carriedPence, w.bankPence, w.expectedPence], [4000, 2500, FLOAT + 6500]);
  const second = await post(owner, '/api/close-the-day', { day: YESTERDAY });
  assert.equal(second.status, 201, JSON.stringify(second.body));
  assert.deepEqual([second.body.close.bankedPence, second.body.close.carriedPence, second.body.close.leftPence, second.body.close.differencePence], [2500, 4000, FLOAT, 0]);
  // Tonight starts from the float.
  assert.equal((await closeDay(owner)).expectedPence, FLOAT);
});

test('a count below the float banks nothing and says how much to put in, and tonight counts it in', async () => {
  const owner = await shop();
  await countThisMorning(owner, FLOAT - 1000);
  const w = await closeDay(owner, `?day=${YESTERDAY}`);
  assert.deepEqual([w.bankPence, w.topUpPence], [0, 1000]);
  const res = await post(owner, '/api/close-the-day', { day: YESTERDAY });
  assert.deepEqual([res.body.close.bankedPence, res.body.close.topUpPence, res.body.close.leftPence], [0, 1000, FLOAT]);
  assert.equal((await closeDay(owner)).expectedPence, FLOAT);
});

test('at closing, the Owner\'s look at a float nobody checked stays a look, and the day counts the earlier day\'s sales', async () => {
  const owner = await shop();
  await wednesday(owner);
  // 1 Sep is a Tuesday; open Monday only, so Close the day shows all day.
  assert.equal((await call(owner, '/api/workshop-settings', { method: 'PUT', body: { openingHours: [{ weekday: 1, open: '09:00', close: '17:00' }] } })).status, 200);
  const signedIn = { cookie: owner.session };
  const look = await post(signedIn, '/api/float-check', { countedPence: null, atClose: true });
  assert.equal(look.status, 201, JSON.stringify(look.body));
  assert.equal((await sql(owner, 'SELECT for_day FROM float_checks WHERE id = ?', look.body.check.id)).for_day, null);
  assert.equal((await notClosedLines(owner)).length, 0);
  const d = await closeDay(owner);
  assert.equal(d.earlierDay, null);
  const res = await post(owner, '/api/close-the-day', { countedPence: FLOAT, expectedPence: d.expectedPence });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.close.cashPence, 300 + 7400 + 1000);
});

test('Close it and its cash taken out are for the Owner, until roles', async () => {
  const owner = await shop();
  await countThisMorning(owner, FLOAT);
  const made = await post(owner, '/api/team', { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const jo = { cookie: await staffFreshCookie(made.body.loginId) };
  assert.equal((await call(jo, `/api/close-the-day?day=${YESTERDAY}`)).status, 403);
  assert.equal((await post(jo, '/api/close-the-day', { day: YESTERDAY })).status, 403);
  assert.equal((await post(jo, '/api/paid-outs', { amountPence: 100, reason: 'Other', day: YESTERDAY })).status, 403);
  assert.equal((await notClosedLines(owner)).length, 1);
});

// ---- The money review, 29 Oct ----

// Review 1: cash taken out between Monday's check and this morning's count is
// Monday's, whatever date it carries; and so is a sale before the count.
test('a sale and cash taken out before this morning\'s count are the day nobody closed\'s', async () => {
  const owner = await shop();
  await wednesday(owner);
  // 06:00 and 06:30 in London on the 1st, before the 07:00 count: a £12.00
  // cash sale, and £20.00 taken out, dated the 1st.
  await oldSale(owner, '2026-09-01T05:00:00Z', { cash: 12 });
  await sql(owner, "INSERT INTO paid_outs (day, login_id, amount_pence, reason, created_at) VALUES ('2026-09-01', ?, 2000, 'Other', '2026-09-01T05:30:00Z') RETURNING id", owner.loginId);
  assert.deepEqual((await floatToday(owner)).unclosed, { day: YESTERDAY, startPence: FLOAT, cashPence: WED_CASH + 1200 - 2000, expectedPence: FLOAT + WED_CASH - 800 });
  await countThisMorning(owner, FLOAT + WED_CASH - 800);
  const res = await post(owner, '/api/close-the-day', { day: YESTERDAY });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const c = res.body.close;
  assert.deepEqual([c.paidOutsPence, c.differencePence, c.drawerCashPence], [2500, 0, 7400 + 1000 + 1200]);
  // Tonight has neither the sale nor the £20.00 again.
  const tonight = await closeDay(owner);
  assert.deepEqual([tonight.cashPence, tonight.paidOutsPence, tonight.expectedPence], [0, 0, FLOAT]);
});

// Review 2: the Owner's look at closing, on a day that then wasn't closed,
// doesn't start that day's cash: the cash before the look was in the drawer.
test('a look at closing and then no close: the next morning still expects the whole day\'s cash', async () => {
  const owner = await shop('never');
  await closed(owner, '2026-08-30', (await check(owner, '2026-08-30')).id);
  await sql(owner, "DELETE FROM float_checks WHERE day = '2026-08-31' RETURNING id");
  await oldSale(owner, '2026-08-31T10:00:00Z', { cash: 400 });
  // 16:30 in London, nobody checked in at a till: the look at closing.
  await sql(owner, "INSERT INTO float_checks (day, login_id, expected_pence, checked_at) VALUES ('2026-08-31', ?, ?, '2026-08-31T15:30:00Z') RETURNING id", owner.loginId, FLOAT);
  assert.deepEqual((await floatToday(owner)).unclosed, { day: YESTERDAY, startPence: FLOAT, cashPence: 40000, expectedPence: FLOAT + 40000 });
  await countThisMorning(owner, FLOAT + 40000);
  const res = await post(owner, '/api/close-the-day', { day: YESTERDAY });
  assert.deepEqual([res.body.close.differencePence, res.body.close.bankedPence], [0, 40000]);
});

// Review 3: cash taken out for the day nobody closed, added at Close it,
// updates this morning's short float on Today.
test('cash taken out added at Close it updates this morning\'s short float', async () => {
  const owner = await shop();
  await wednesday(owner);
  await countThisMorning(owner, FLOAT + WED_CASH - 1000);
  const shortLine = async () => (await call(owner, '/api/needs-attention')).body.items.find((i) => i.kind === 'float_short');
  assert.equal((await shortLine()).shortPence, 1000);
  assert.equal((await post(owner, '/api/paid-outs', { amountPence: 600, reason: 'Other', day: YESTERDAY })).status, 201);
  assert.equal((await shortLine())?.shortPence, 400);
  assert.equal((await post(owner, '/api/paid-outs', { amountPence: 400, reason: 'Other', day: YESTERDAY })).status, 201);
  assert.equal(await shortLine(), undefined);
});

test('a sale between midnight and this morning\'s count is in the day nobody closed\'s report', async () => {
  const owner = await shop();
  await oldSale(owner, '2026-08-31T23:30:00Z', { card: 15 }); // 00:30 in London on the 1st
  await countThisMorning(owner, FLOAT);
  const res = await post(owner, '/api/close-the-day', { day: YESTERDAY });
  assert.equal(res.body.close.cardPence, 1500);
  const tonight = await post(owner, '/api/close-the-day', { countedPence: FLOAT });
  assert.equal(tonight.status, 201, JSON.stringify(tonight.body));
  assert.equal(tonight.body.close.cardPence, 0);
});

// Sat 29 closed; Sun 30 missed, counted on Mon 31 and closed late on Mon at
// 14:00 in London; Mon missed too. This morning's figure for Monday takes
// off Sunday's banking, made between the two counts.
test('the next morning takes off cash banked for an earlier day between the two counts', async () => {
  const owner = await shop('never');
  await closed(owner, '2026-08-29', (await check(owner, '2026-08-29')).id);
  await sql(owner, "DELETE FROM float_checks WHERE day = '2026-08-31' RETURNING id");
  const sun = await check(owner, '2026-08-30');
  await oldSale(owner, '2026-08-30T10:00:00Z', { cash: 40 });
  await check(owner, YESTERDAY, FLOAT + 4000, '2026-08-30');
  await sql(owner,
    `INSERT INTO day_closes (day, login_id, closed_at, float_check_id, float_start_pence, cash_pence, paid_outs_pence, expected_pence, counted_pence,
       float_pence, banked_pence, takings_pence, card_pence, other_pence)
     VALUES ('2026-08-30', ?, '2026-08-31T13:00:00Z', ?, ?, 4000, 0, ?, ?, ?, 4000, 4000, 0, 0) RETURNING id`,
    owner.loginId, sun.id, FLOAT, FLOAT + 4000, FLOAT + 4000, FLOAT);
  await oldSale(owner, '2026-08-31T14:00:00Z', { cash: 30 });
  assert.deepEqual((await floatToday(owner)).unclosed, { day: YESTERDAY, startPence: FLOAT + 4000, cashPence: 3000 - 4000, expectedPence: FLOAT + 3000 });
});

// Close it and tonight's close at the same moment: each waits for the shop's
// row, which another connection holds here, so they go in a known order.
// Tonight's first is refused; Close it first, then tonight's counts only
// tonight's sales. Monday's sales are always Monday's.
test('Close it racing tonight\'s close: each sale in one close, Monday\'s in Monday\'s', async () => {
  for (const tonightFirst of [true, false]) {
    const owner = await shop();
    await wednesday(owner);
    await countThisMorning(owner, FLOAT + WED_CASH);
    await oldSale(owner, '2026-09-01T10:00:00Z', { cash: 30 });
    const closeIt = () => post(owner, '/api/close-the-day', { day: YESTERDAY });
    const closeTonight = () => post(owner, '/api/close-the-day', { countedPence: FLOAT + 3000 });
    const other = await pool.connect();
    let late;
    let tonight;
    try {
      await other.query('BEGIN');
      await other.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
      await other.query('SELECT id FROM shops WHERE id = $1 FOR NO KEY UPDATE', [owner.shop.id]);
      const first = tonightFirst ? closeTonight() : closeIt();
      await new Promise((r) => setTimeout(r, 300));
      const second = tonightFirst ? closeIt() : closeTonight();
      await new Promise((r) => setTimeout(r, 300));
      await other.query('COMMIT');
      [late, tonight] = tonightFirst ? [await second, await first] : [await first, await second];
    } finally {
      await other.query('ROLLBACK').catch(() => {});
      other.release();
    }
    assert.equal(late.status, 201, JSON.stringify(late.body));
    assert.equal(late.body.close.drawerCashPence, 7400 + 1000, `tonight first: ${tonightFirst}`);
    if (tonightFirst) assert.deepEqual([tonight.status, tonight.body.code], [409, 'earlier_day_open']);
    else assert.deepEqual([tonight.status, tonight.body.close?.cashPence], [201, 3000]);
    const left = await sql(owner, 'SELECT (SELECT count(*) FROM sales WHERE day_close_id IS NULL)::int + (SELECT count(*) FROM till_sales WHERE day_close_id IS NULL)::int AS n');
    assert.equal(left.n, tonightFirst ? 1 : 0);
  }
});
