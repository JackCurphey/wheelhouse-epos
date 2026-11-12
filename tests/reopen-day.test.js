// Reopening a closed day (openspec/changes/reports-accounts-and-reopen, close-the-day and reports specs;
// design decisions 1 to 3; rp-reopen, rp-takings-reopened; Jack's answers 1 and 4 of 12 Nov). The Owner
// reopens the latest closed day with a reason; the first close is kept as history; a reopened day counts as
// not closed everywhere; its sales stay marked with it; closing it again from a new count makes one close for
// the day. The live server's clock is pinned to 07:00 on 1 Sep 2026 in London, so "today" is 2026-09-01.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, checkInAtTill } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
const shops = [];
before(async () => { server = await startLiveServer(); });
after(async () => {
  for (const s of shops) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
});

const FLOAT = 15000;
const TODAY = '2026-09-01';
const YESTERDAY = '2026-08-31';
const call = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const post = (who, path, body) => call(who, path, { method: 'POST', body });
const sql = (owner, text, ...args) => runWithShop(owner.shop.id, () => prepare(text).get(...args));
const rows = (owner, text, ...args) => runWithShop(owner.shop.id, () => prepare(text).all(...args));

// A shop checked in at the till, float set, and this morning's float check at 07:00 London; 31 Aug opened.
async function shop() {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  const till = await checkInAtTill(server.baseUrl, owner.cookie);
  Object.assign(owner, { session: owner.cookie, cookie: till.cookie });
  assert.equal((await call(owner, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: FLOAT } })).status, 200);
  owner.yesterdayCheck = await sql(owner,
    'INSERT INTO float_checks (day, login_id, expected_pence, counted_pence, checked_at) VALUES (?, ?, ?, ?, ?) RETURNING id', YESTERDAY, owner.loginId, FLOAT, FLOAT, `${YESTERDAY}T06:00:00Z`);
  const res = await post(owner, '/api/float-check', { countedPence: null });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  await sql(owner, "UPDATE float_checks SET checked_at = '2026-09-01T06:00:00Z' WHERE id = ? RETURNING id", res.body.check.id);
  return owner;
}
// 31 Aug closed already (the shop's earlier close), at 17:00.
const closedYesterday = (owner) => sql(owner,
  `INSERT INTO day_closes (day, login_id, closed_at, float_check_id, float_start_pence, cash_pence, paid_outs_pence, expected_pence, counted_pence,
     float_pence, banked_pence, takings_pence, card_pence, other_pence)
   VALUES (?, ?, ?, ?, 15000, 0, 0, 15000, 15000, 15000, 0, 0, 0, 0) RETURNING id`, YESTERDAY, owner.loginId, `${YESTERDAY}T17:00:00Z`, owner.yesterdayCheck.id);
const oldSale = (owner, at, { cash = 0, card = 0 }) => sql(owner,
  "INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, card_amount) VALUES (?, ?, ?, 'Split', ?, ?) RETURNING id", at, cash + card, cash + card, cash, card);
const closeToday = async (owner, countedPence, extra = {}) => {
  const res = await post(owner, '/api/close-the-day', { countedPence, ...extra });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.close;
};
const reopen = (owner, id, reason = 'a card payment was counted as cash') => post(owner, `/api/reports/days/${id}/reopen`, { reason });
const dayRow = (owner, day) => sql(owner, 'SELECT * FROM day_closes WHERE day = ?', day);
const history = (owner) => rows(owner, 'SELECT * FROM day_close_history ORDER BY id');
const teamMember = async (owner) => {
  const made = await post(owner, '/api/team', { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  return { cookie: await staffFreshCookie(made.body.loginId) };
};

test('reopening today\'s close saves who, when and why, keeps the first close as history, and the day is not closed', async () => {
  const owner = await shop();
  await oldSale(owner, '2026-09-01T10:00:00Z', { cash: 74, card: 20 });
  const first = await closeToday(owner, FLOAT + 7400);
  const res = await reopen(owner, first.id, '  a card payment was counted as cash ');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.reopened.day, TODAY);
  assert.equal(res.body.reopened.reason, 'a card payment was counted as cash');
  const row = await dayRow(owner, TODAY);
  assert.ok(row.reopened_at);
  assert.equal(row.reopened_by, owner.loginId);
  assert.equal(row.reopen_reason, 'a card payment was counted as cash');
  const kept = await history(owner);
  assert.equal(kept.length, 1);
  assert.deepEqual(
    [kept[0].day_close_id, kept[0].counted_pence, kept[0].takings_pence, kept[0].card_pence, kept[0].cash_pence, kept[0].banked_pence, kept[0].reopened_by, kept[0].reopen_reason],
    [first.id, FLOAT + 7400, 9400, 2000, 7400, 7400, owner.loginId, 'a card payment was counted as cash'],
    'the first close\'s figures, who reopened it and why'
  );
  const state = (await call(owner, '/api/close-the-day')).body;
  assert.equal(state.close, null, 'a reopened day is not closed');
  assert.equal(state.reopened.reason, 'a card payment was counted as cash');
  assert.equal((await call(owner, `/api/reports/days/${first.id}`)).status, 404, 'and its report is not there until it is closed again');
});

test('a reason is needed, and only the Owner can reopen', async () => {
  const owner = await shop();
  const first = await closeToday(owner, FLOAT);
  for (const reason of [undefined, '', '   ', 7, 'x'.repeat(501)]) {
    const res = await post(owner, `/api/reports/days/${first.id}/reopen`, reason === undefined ? {} : { reason });
    assert.equal(res.status, 400, String(reason).slice(0, 10));
    assert.equal(res.body.error, 'Say why you are reopening it (up to 500 characters)');
  }
  const jo = await teamMember(owner);
  const staff = await post(jo, `/api/reports/days/${first.id}/reopen`, { reason: 'x' });
  assert.equal(staff.status, 403);
  const signedOut = await fetch(`${server.baseUrl}/api/reports/days/${first.id}/reopen`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"reason":"x"}' });
  assert.equal(signedOut.status, 401);
  assert.equal((await dayRow(owner, TODAY)).reopened_at, null, 'nothing changed');
  assert.equal((await history(owner)).length, 0);
});

test('only the latest closed day can be reopened, and another shop\'s close is not found', async () => {
  const owner = await shop();
  const yesterday = await closedYesterday(owner);
  const today = await closeToday(owner, FLOAT);
  const earlier = await reopen(owner, yesterday.id);
  assert.deepEqual([earlier.status, earlier.body.error, earlier.body.code], [409, 'Only the latest closed day can be reopened', 'not_latest']);
  assert.equal((await dayRow(owner, YESTERDAY)).reopened_at, null);
  assert.equal((await reopen(owner, 999999999)).status, 404);
  const stranger = await shop();
  assert.equal((await reopen(stranger, today.id)).status, 404, 'another shop\'s close is not there');
  assert.equal((await dayRow(owner, TODAY)).reopened_at, null);
  const again = await reopen(owner, today.id);
  assert.equal(again.status, 200);
  const twice = await reopen(owner, today.id);
  assert.deepEqual([twice.status, twice.body.code], [409, 'already_reopened']);
});

test('closing it again makes one close for the day from a new count, from the same sales, and keeps the first as history', async () => {
  const owner = await shop();
  const s1 = await oldSale(owner, '2026-09-01T10:00:00Z', { cash: 74, card: 20 });
  const first = await closeToday(owner, FLOAT + 7400 - 500, { reason: 'short' });
  await reopen(owner, first.id);
  const again = await closeToday(owner, FLOAT + 7400);
  assert.equal(again.id, first.id, 'the same close, updated, so the day stays one close');
  assert.equal(again.countedPence, FLOAT + 7400);
  assert.equal(again.differencePence, 0, 'the new count against the same expected figure');
  assert.deepEqual([again.takingsPence, again.cardPence, again.cashPence], [9400, 2000, 7400], 'the same sales');
  assert.equal(again.reason, '');
  const row = await dayRow(owner, TODAY);
  assert.deepEqual([row.reopened_at, row.reopened_by, row.reopen_reason], [null, null, null]);
  assert.equal((await rows(owner, 'SELECT id FROM day_closes WHERE day = ?', TODAY)).length, 1);
  const kept = await history(owner);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].counted_pence, FLOAT + 7400 - 500, 'the first close\'s count is kept');
  assert.equal((await sql(owner, 'SELECT day_close_id FROM sales WHERE id = ?', s1.id)).day_close_id, first.id, 'its sale is still marked with it');
  assert.equal((await call(owner, '/api/close-the-day')).body.close.id, first.id);
  assert.equal((await call(owner, `/api/reports/days/${first.id}`)).status, 200, 'its report is back');
  // Reopened and closed again a second time: a second history row.
  await reopen(owner, first.id, 'again');
  await closeToday(owner, FLOAT + 7400);
  assert.equal((await history(owner)).length, 2);
});

test('a sale saved after the first close is left for the next close, not taken by the reopened day', async () => {
  const owner = await shop();
  await oldSale(owner, '2026-09-01T10:00:00Z', { cash: 74 });
  const first = await closeToday(owner, FLOAT + 7400);
  const late = await oldSale(owner, '2026-09-01T11:00:00Z', { cash: 30 });
  await reopen(owner, first.id);
  const again = await closeToday(owner, FLOAT + 7400);
  assert.equal(again.cashPence, 7400, 'the first close\'s sales only');
  assert.equal((await sql(owner, 'SELECT day_close_id FROM sales WHERE id = ?', late.id)).day_close_id, null, 'it is still waiting for the next close');
});

test('cash taken out while the day is reopened is counted when it is closed again', async () => {
  const owner = await shop();
  await oldSale(owner, '2026-09-01T10:00:00Z', { cash: 74 });
  const first = await closeToday(owner, FLOAT + 7400);
  await reopen(owner, first.id);
  const out = await post(owner, '/api/paid-outs', { amountPence: 1000, reason: 'milk' });
  assert.equal(out.status, 201, JSON.stringify(out.body));
  const again = await closeToday(owner, FLOAT + 7400 - 1000);
  assert.equal(again.paidOutsPence, 1000);
  assert.equal(again.expectedPence, FLOAT + 7400 - 1000);
  assert.equal(again.differencePence, 0);
  // A closed day takes no cash out again.
  assert.equal((await post(owner, '/api/paid-outs', { amountPence: 100, reason: 'x' })).status, 409);
});

test('a reopened past day is closed again from a new count, and Today shows it with Close it', async () => {
  const owner = await shop();
  const yesterday = await closedYesterday(owner);
  const res = await reopen(owner, yesterday.id, 'miscounted');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const lines = (await call(owner, '/api/needs-attention')).body.items.filter((i) => i.kind === 'day_reopened');
  assert.equal(lines.length, 1);
  assert.deepEqual({ ...lines[0], reopenedAt: 0 }, { kind: 'day_reopened', day: YESTERDAY, closeId: yesterday.id, reason: 'miscounted', reopenedByName: 'Jack Lewis', reopenedAt: 0 });
  const entry = await call(owner, `/api/close-the-day?day=${YESTERDAY}`);
  assert.equal(entry.status, 200, JSON.stringify(entry.body));
  assert.equal(entry.body.close, null);
  assert.equal(entry.body.reopened.reason, 'miscounted');
  assert.equal(entry.body.expectedPence, FLOAT);
  assert.equal(entry.body.floatPence, FLOAT);
  const closed = await post(owner, '/api/close-the-day', { day: YESTERDAY, countedPence: FLOAT + 200, expectedPence: FLOAT, reason: 'two pound coins found' });
  assert.equal(closed.status, 201, JSON.stringify(closed.body));
  assert.equal(closed.body.close.id, yesterday.id);
  assert.equal(closed.body.close.countedPence, FLOAT + 200);
  assert.equal(closed.body.close.differencePence, 200);
  assert.equal((await rows(owner, 'SELECT id FROM day_closes WHERE day = ?', YESTERDAY)).length, 1);
  assert.equal((await history(owner)).length, 1);
  assert.equal((await call(owner, '/api/needs-attention')).body.items.filter((i) => i.kind === 'day_reopened').length, 0, 'it goes once it is closed again');
});

test('a reopened day is left out of Takings and cash-ups and said so, and counts again once closed', async () => {
  const owner = await shop();
  await oldSale(owner, '2026-09-01T10:00:00Z', { cash: 74, card: 20 });
  const first = await closeToday(owner, FLOAT + 7400);
  const before = (await call(owner, '/api/reports/takings?period=this-week')).body;
  assert.equal(before.figures.takings.pence, 9400);
  assert.equal(before.reopened, null);
  await reopen(owner, first.id, 'wrong tender');
  const during = (await call(owner, '/api/reports/takings?period=this-week')).body;
  assert.equal(during.status, undefined);
  assert.equal(during.figures.takings.pence, 0, 'its figures are left out');
  assert.deepEqual(during.reopened, { day: TODAY, label: 'Tue 1 Sep', reason: 'wrong tender', reopenedByName: 'Jack Lewis' });
  const row = during.rows.find((r) => r.key === TODAY && r.kind === 'day');
  assert.deepEqual([row.closed, row.reopened, row.closeDay], [false, true, TODAY]);
  assert.ok(!during.rows.some((r) => r.kind === 'online' && r.key === TODAY && !r.soFar) || during.rows.find((r) => r.kind === 'online').soFar);
  await closeToday(owner, FLOAT + 7400);
  const after = (await call(owner, '/api/reports/takings?period=this-week')).body;
  assert.equal(after.figures.takings.pence, 9400);
  assert.equal(after.reopened, null);
});

test('a reopened day does not stand in as the previous close, and the next day starts from the one before', async () => {
  const owner = await shop();
  await closedYesterday(owner);
  await oldSale(owner, '2026-09-01T10:00:00Z', { cash: 50 });
  const today = await closeToday(owner, FLOAT + 5000);
  await reopen(owner, today.id);
  // Closing again works the day out from the morning check and the same sales, as the first close did.
  const again = await closeToday(owner, FLOAT + 5000);
  assert.equal(again.expectedPence, FLOAT + 5000);
  assert.equal(again.differencePence, 0);
});

test('with an earlier day reopened, today can\'t be closed until it is closed again', async () => {
  const owner = await shop();
  const yesterday = await closedYesterday(owner);
  await reopen(owner, yesterday.id);
  const res = await post(owner, '/api/close-the-day', { countedPence: FLOAT });
  assert.deepEqual([res.status, res.body.code, res.body.day], [409, 'earlier_day_open', YESTERDAY]);
  assert.equal(await sql(owner, 'SELECT id FROM day_closes WHERE day = ?', TODAY), undefined, 'nothing was saved');
  const closed = await post(owner, '/api/close-the-day', { day: YESTERDAY, countedPence: FLOAT });
  assert.equal(closed.status, 201, JSON.stringify(closed.body));
  assert.equal((await post(owner, '/api/close-the-day', { countedPence: FLOAT })).status, 201);
});

test('a day closed from a later morning\'s count is not reopened', async () => {
  const owner = await shop();
  const yesterday = await closedYesterday(owner);
  // A later morning's float check counted 31 Aug (a day nobody closed then): its count is the day's count.
  await sql(owner, "UPDATE float_checks SET for_day = ?, counted_pence = ?, expected_pence = ? WHERE day = ? RETURNING id", YESTERDAY, FLOAT, FLOAT, TODAY);
  const res = await reopen(owner, yesterday.id);
  assert.deepEqual([res.status, res.body.code], [409, 'closed_late']);
});

test('closing it again leaves the close at the time it was first made, so later days\' carry-over is unchanged', async () => {
  const owner = await shop();
  await oldSale(owner, '2026-09-01T10:00:00Z', { cash: 74 });
  const first = await closeToday(owner, FLOAT + 7400);
  const at = (await dayRow(owner, TODAY)).closed_at.toISOString();
  await reopen(owner, first.id);
  await closeToday(owner, FLOAT + 7000);
  const row = await dayRow(owner, TODAY);
  assert.equal(row.closed_at.toISOString(), at, 'closed_at is the first close\'s');
  assert.equal(row.counted_pence, FLOAT + 7000);
  assert.equal(row.login_id, owner.loginId, 'who closed it again');
});

test('a reopened today shows what it should hold with the day\'s own sales, and closes again with the figure the screen sent', async () => {
  const owner = await shop();
  await oldSale(owner, '2026-09-01T10:00:00Z', { cash: 74 });
  const first = await closeToday(owner, FLOAT + 7400);
  await oldSale(owner, '2026-09-01T11:00:00Z', { cash: 30 });
  await reopen(owner, first.id);
  const state = (await call(owner, '/api/close-the-day')).body;
  assert.equal(state.cashPence, 7400, 'the sales its close counted, not the later one');
  assert.equal(state.expectedPence, FLOAT + 7400);
  const again = await post(owner, '/api/close-the-day', { countedPence: FLOAT + 7400, expectedPence: state.expectedPence });
  assert.equal(again.status, 201, JSON.stringify(again.body));
  assert.equal(again.body.close.differencePence, 0);
});

test('a day can\'t be reopened while a later day waits to be closed, and a late close is refused while an earlier day is reopened', async () => {
  const owner = await shop();
  // 30 Aug closed, 31 Aug opened and not closed, this morning's count made for 31 Aug.
  const check30 = await sql(owner, 'INSERT INTO float_checks (day, login_id, expected_pence, counted_pence, checked_at) VALUES (?, ?, ?, ?, ?) RETURNING id', '2026-08-30', owner.loginId, FLOAT, FLOAT, '2026-08-30T06:00:00Z');
  const close30 = await sql(owner,
    `INSERT INTO day_closes (day, login_id, closed_at, float_check_id, float_start_pence, cash_pence, paid_outs_pence, expected_pence, counted_pence,
       float_pence, banked_pence, takings_pence, card_pence, other_pence)
     VALUES (?, ?, ?, ?, 15000, 0, 0, 15000, 15000, 15000, 0, 0, 0, 0) RETURNING id`, '2026-08-30', owner.loginId, '2026-08-30T17:00:00Z', check30.id);
  // Reopened first, then a morning count makes 31 Aug a day waiting: closing it late would leave the reopened day stuck.
  assert.equal((await reopen(owner, close30.id)).status, 200);
  await sql(owner, 'UPDATE float_checks SET for_day = ?, counted_pence = ?, expected_pence = ? WHERE day = ? RETURNING id', YESTERDAY, FLOAT, FLOAT, TODAY);
  const late = await post(owner, '/api/close-the-day', { day: YESTERDAY });
  assert.deepEqual([late.status, late.body.code, late.body.day], [409, 'earlier_day_open', '2026-08-30']);
  assert.equal(await sql(owner, 'SELECT id FROM day_closes WHERE day = ?', YESTERDAY), undefined);
  // The other order: close it again, and the later day waiting then stops it being reopened.
  assert.equal((await post(owner, '/api/close-the-day', { day: '2026-08-30', countedPence: FLOAT })).status, 201);
  const refused = await reopen(owner, close30.id);
  assert.deepEqual([refused.status, refused.body.code], [409, 'later_day_waiting']);
});

test('closing a past day again checks its reason and expected figure like today\'s close', async () => {
  const owner = await shop();
  const yesterday = await closedYesterday(owner);
  await reopen(owner, yesterday.id);
  assert.equal((await post(owner, '/api/close-the-day', { day: YESTERDAY, countedPence: FLOAT, reason: 'x'.repeat(501) })).status, 400);
  assert.equal((await post(owner, '/api/close-the-day', { day: YESTERDAY, countedPence: FLOAT, expectedPence: 1.5 })).status, 400);
  assert.equal((await post(owner, '/api/close-the-day', { day: YESTERDAY, countedPence: FLOAT, expectedPence: FLOAT + 5 })).status, 409);
  assert.equal((await post(owner, '/api/close-the-day', { day: YESTERDAY })).status, 400, 'a count is needed');
});
