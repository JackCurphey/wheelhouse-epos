// Close the day (openspec/changes/close-the-day; eod-count, eod-count-result,
// eod-banking, eod-paidout, eod-finish, eod-z; cash-up decisions 2 to 6;
// walk-through 2 M2). What the drawer should hold, cash taken out, one close
// a shop a day with its report, and an over float on Today once yesterday
// was closed (opening the shop decision 8 H1). Amounts are whole pence. The
// live server's clock is pinned to 07:00 on 1 Sep 2026 in London, so
// "today" is 2026-09-01.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { entryFor } from '../server/routes/close-the-day.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
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
const call = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const post = (who, path, body) => call(who, path, { method: 'POST', body });
const day = async (who) => {
  const res = await call(who, '/api/close-the-day');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
};

// A shop of its own for each test, since a shop closes once a day.
async function shop({ float = FLOAT, check = 'looked' } = {}) {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  if (float !== null) assert.equal((await call(owner, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: float } })).status, 200);
  // Not the first day, so the float can be looked at; on an earlier day that wasn't closed.
  if (check) {
    await earlierCheck(owner, '2026-08-31', FLOAT, FLOAT);
    const res = await post(owner, '/api/float-check', { countedPence: check === 'looked' ? null : check });
    assert.equal(res.status, 201, JSON.stringify(res.body));
  }
  return owner;
}
async function teamMember(owner, name) {
  const made = await post(owner, '/api/team', { name, isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  return { cookie: await staffFreshCookie(made.body.loginId) };
}
const earlierCheck = (owner, d, expected, counted) => runWithShop(owner.shop.id, () => prepare(
  'INSERT INTO float_checks (day, login_id, expected_pence, counted_pence) VALUES (?, ?, ?, ?) RETURNING id'
).get(d, owner.loginId, expected, counted));
const earlierClose = (owner, d, checkId) => runWithShop(owner.shop.id, () => prepare(
  `INSERT INTO day_closes (day, login_id, float_check_id, float_start_pence, cash_pence, paid_outs_pence, expected_pence, counted_pence,
     float_pence, banked_pence, takings_pence, card_pence, other_pence)
   VALUES (?, ?, ?, 15000, 0, 0, 15000, 15000, 15000, 0, 0, 0, 0)`
).run(d, owner.loginId, checkId));

// A sale in the old record (pounds, as the till's /api/sales saves it), with
// extra tenders, at a moment.
async function oldSale(owner, at, { cash = 0, card = 0, extra = [] }) {
  const total = cash + card + extra.reduce((n, e) => n + e.amount, 0);
  await runWithShop(owner.shop.id, async () => {
    const { id } = await prepare(
      "INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, card_amount) VALUES (?, ?, ?, 'Split', ?, ?) RETURNING id"
    ).get(at, total, total, cash, card);
    for (const e of extra) await prepare('INSERT INTO sale_payments (sale_id, tender_type, amount) VALUES (?, ?, ?)').run(id, e.tenderType, e.amount);
  });
}
// A sale in the till record (pence), with its payments, on the till's clock.
async function tillSale(owner, at, payments) {
  await runWithShop(owner.shop.id, async () => {
    await prepare("INSERT INTO sites (name, code) VALUES ('Bolton', 'B') ON CONFLICT (shop_id, code) DO NOTHING").run();
    const site = await prepare("SELECT id FROM sites WHERE code = 'B'").get();
    await prepare("INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, 'B1', 'Till B1', ?) ON CONFLICT (shop_id, code) DO NOTHING").run(site.id, randomUUID());
    const till = await prepare("SELECT id FROM tills WHERE code = 'B1'").get();
    const total = payments.reduce((n, p) => n + p.pence, 0);
    const { id } = await prepare(
      `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, total_pence, vat_pence)
       VALUES (?, ?, ?, 1, false, ?, ?, 0) RETURNING id`
    ).get(randomUUID(), till.id, site.id, at, total);
    for (const p of payments) await prepare('INSERT INTO till_sale_payments (till_sale_id, method, amount_pence) VALUES (?, ?, ?)').run(id, p.method, p.pence);
  });
}

test('the entry shows from an hour before closing, all day when the shop is shut, never once closed', () => {
  const hours = { open: '09:00', close: '17:30' };
  assert.deepEqual(entryFor(hours, 16 * 60 + 29, false), { show: false, closesAt: '17:30' });
  assert.deepEqual(entryFor(hours, 16 * 60 + 30, false), { show: true, closesAt: '17:30' });
  assert.deepEqual(entryFor(hours, 23 * 60, false), { show: true, closesAt: '17:30' });
  assert.deepEqual(entryFor(null, 7 * 60, false), { show: true, closesAt: null });
  assert.deepEqual(entryFor(hours, 17 * 60, true), { show: false, closesAt: '17:30' });
});

test('the day: cash sales from both records on the shop\'s own date, and this morning\'s float', async () => {
  const owner = await shop();
  // Today in London: £74.00 cash and £20.00 card in the old record; £10.00
  // cash and £5.00 on a gift card in the till record.
  await oldSale(owner, '2026-09-01T10:00:00Z', { cash: 74, card: 20 });
  await tillSale(owner, '2026-09-01T12:00:00Z', [{ method: 'cash', pence: 1000 }, { method: 'gift_card', pence: 500 }]);
  // Not today: 23:30 on 31 Aug and 00:30 on 2 Sep, London time.
  await oldSale(owner, '2026-08-31T22:30:00Z', { cash: 9 });
  await tillSale(owner, '2026-09-01T23:30:00Z', [{ method: 'cash', pence: 900 }]);
  const d = await day(owner);
  assert.equal(d.day, '2026-09-01');
  assert.equal(d.floatPence, FLOAT);
  assert.deepEqual({ ...d.floatStart, at: 0 }, { pence: FLOAT, how: 'looked', expectedPence: FLOAT, byName: 'Jack Lewis', at: 0 });
  assert.equal(d.cashPence, 8400);
  assert.equal(d.paidOutsPence, 0);
  assert.deepEqual(d.paidOuts, []);
  assert.equal(d.expectedPence, FLOAT + 8400);
  assert.equal(d.close, null);
  assert.deepEqual(d.entry, { show: false, closesAt: '18:00' });
});

test('a counted float starts the day from what was counted', async () => {
  const owner = await shop({ check: FLOAT - 420 });
  await oldSale(owner, '2026-09-01T10:00:00Z', { cash: 74 });
  const d = await day(owner);
  assert.deepEqual([d.floatStart.how, d.floatStart.pence, d.floatStart.expectedPence], ['counted', FLOAT - 420, FLOAT]);
  assert.equal(d.expectedPence, FLOAT - 420 + 7400);
});

test('with no float check there is no expected figure, and the day can\'t close', async () => {
  const owner = await shop({ check: false });
  const d = await day(owner);
  assert.equal(d.floatStart, null);
  assert.equal(d.expectedPence, null);
  const res = await post(owner, '/api/close-the-day', { countedPence: FLOAT });
  assert.deepEqual([res.status, res.body.code], [409, 'float_not_checked']);
});

test('with no float set the day can\'t close', async () => {
  const owner = await shop({ float: null, check: false });
  const res = await post(owner, '/api/close-the-day', { countedPence: 0 });
  assert.deepEqual([res.status, res.body.code], [409, 'no_float']);
});

test('cash taken out is kept in whole pence with what it was for, who and when, and comes off what the drawer should hold', async () => {
  const owner = await shop();
  await oldSale(owner, '2026-09-01T10:00:00Z', { cash: 74 });
  for (const bad of [{ amountPence: 0, reason: 'x' }, { amountPence: 1.5, reason: 'x' }, { amountPence: '500', reason: 'x' }, { amountPence: 10_000_001, reason: 'x' },
    { amountPence: 500 }, { amountPence: 500, reason: '  ' }, { amountPence: 500, reason: 'x'.repeat(101) }, { amountPence: 500, reason: 'x', note: 'x'.repeat(501) }, { amountPence: 500, reason: 'x', note: 4 }]) {
    const res = await post(owner, '/api/paid-outs', bad);
    assert.equal(res.status, 400, `${JSON.stringify(bad)}: ${JSON.stringify(res.body)}`);
  }
  const made = await post(owner, '/api/paid-outs', { amountPence: 500, reason: ' [Shop’s reason] ', note: ' receipt 12 ' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const { paidOut } = made.body;
  assert.deepEqual({ ...paidOut, id: 0, at: 0 }, { id: 0, amountPence: 500, reason: '[Shop’s reason]', note: 'receipt 12', byName: 'Jack Lewis', at: 0 });
  assert.equal((await post(owner, '/api/paid-outs', { amountPence: 250, reason: 'Other' })).status, 201);
  const d = await day(owner);
  assert.deepEqual(d.paidOuts.map((p) => p.amountPence), [500, 250]);
  assert.equal(d.paidOutsPence, 750);
  assert.equal(d.expectedPence, FLOAT + 7400 - 750);
});

test('closing the day keeps its figures: the count, the difference, the banking and the takings', async () => {
  const owner = await shop();
  await oldSale(owner, '2026-09-01T10:00:00Z', { cash: 74, card: 20, extra: [{ tenderType: 'Cyclescheme', amount: 6 }] });
  await tillSale(owner, '2026-09-01T12:00:00Z', [{ method: 'cash', pence: 1000 }, { method: 'card', pence: 300 }, { method: 'gift_card', pence: 500 }]);
  assert.equal((await post(owner, '/api/paid-outs', { amountPence: 500, reason: 'Other' })).status, 201);
  // Expected: 150.00 + 84.00 − 5.00 = 229.00; counted £2.10 short.
  const res = await post(owner, '/api/close-the-day', { countedPence: 22690, reason: '  change given wrongly ' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const { close } = res.body;
  assert.deepEqual({ ...close, id: 0, closedAt: 0, floatStart: { ...close.floatStart, at: 0 } }, {
    id: 0, day: '2026-09-01', closedByName: 'Jack Lewis', closedAt: 0,
    floatStart: { pence: FLOAT, how: 'looked', expectedPence: FLOAT, byName: 'Jack Lewis', at: 0 },
    cashPence: 8400, paidOutsPence: 500, expectedPence: 22900, countedPence: 22690, differencePence: -210, reason: 'change given wrongly',
    floatPence: FLOAT, bankedPence: 7690, leftPence: FLOAT,
    takingsPence: 7400 + 2000 + 600 + 1000 + 300 + 500, cardPence: 2300, otherPence: 1100,
  });
  assert.equal(close.floatStart.at, (await day(owner)).floatStart.at);
  // Today now shows the close; the figures stay as they were after a later sale.
  await oldSale(owner, '2026-09-01T16:00:00Z', { cash: 30 });
  const d = await day(owner);
  assert.deepEqual(d.close, close);
  assert.equal(d.entry.show, false);
  const again = await post(owner, '/api/close-the-day', { countedPence: 1 });
  assert.deepEqual([again.status, again.body.code, again.body.close], [409, 'already_closed', close]);
  const late = await post(owner, '/api/paid-outs', { amountPence: 100, reason: 'Other' });
  assert.deepEqual([late.status, late.body.code], [409, 'day_closed']);
});

test('a count below the float banks nothing and leaves what was counted', async () => {
  const owner = await shop();
  const res = await post(owner, '/api/close-the-day', { countedPence: FLOAT - 1000 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual([res.body.close.bankedPence, res.body.close.leftPence, res.body.close.differencePence], [0, FLOAT - 1000, -1000]);
});

test('a count must be whole pence and a reason short text', async () => {
  const owner = await shop();
  for (const bad of [-1, 1.5, '15000', 10_000_001, undefined, null]) {
    const res = await post(owner, '/api/close-the-day', { countedPence: bad });
    assert.equal(res.status, 400, `${JSON.stringify(bad)}: ${JSON.stringify(res.body)}`);
  }
  for (const reason of ['x'.repeat(501), 42]) {
    const res = await post(owner, '/api/close-the-day', { countedPence: FLOAT, reason });
    assert.equal(res.status, 400, JSON.stringify(res.body));
  }
  assert.equal((await day(owner)).close, null, 'nothing kept');
});

test('two closes at the same moment keep one', async () => {
  const owner = await shop();
  const both = await Promise.all([post(owner, '/api/close-the-day', { countedPence: FLOAT }), post(owner, '/api/close-the-day', { countedPence: FLOAT + 1 })]);
  assert.deepEqual(both.map((r) => r.status).sort(), [201, 409]);
  const n = await runWithShop(owner.shop.id, () => prepare('SELECT count(*)::int AS n FROM day_closes').get());
  assert.equal(n.n, 1);
});

test('cash taken out at the moment of closing is in the close or refused, never lost', async () => {
  for (let round = 0; round < 4; round += 1) {
    const owner = await shop();
    const [closed, out] = await Promise.all([post(owner, '/api/close-the-day', { countedPence: FLOAT }), post(owner, '/api/paid-outs', { amountPence: 300, reason: 'Other' })]);
    assert.equal(closed.status, 201, JSON.stringify(closed.body));
    if (out.status === 201) assert.equal(closed.body.close.paidOutsPence, 300, `round ${round}: a paid-out kept after the close was counted`);
    else assert.deepEqual([out.status, out.body.code, closed.body.close.paidOutsPence], [409, 'day_closed', 0]);
  }
});

test('closing the day and cash taken out are for the Owner, until roles', async () => {
  const owner = await shop();
  const jo = await teamMember(owner, 'Jo Taylor');
  assert.equal((await call(jo, '/api/close-the-day')).status, 403);
  assert.equal((await post(jo, '/api/close-the-day', { countedPence: FLOAT })).status, 403);
  assert.equal((await post(jo, '/api/paid-outs', { amountPence: 100, reason: 'Other' })).status, 403);
  assert.equal((await day(owner)).close, null);
});

test('on a day the opening hours say the shop is shut, the entry shows all day', async () => {
  const owner = await shop();
  // 1 Sep 2026 is a Tuesday (weekday 2); open Monday only.
  const res = await call(owner, '/api/workshop-settings', { method: 'PUT', body: { openingHours: [{ weekday: 1, open: '09:00', close: '17:00' }] } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual((await day(owner)).entry, { show: true, closesAt: null });
});

test('each shop sees and closes only its own day', async () => {
  const mine = await shop();
  const theirs = await shop();
  assert.equal((await post(mine, '/api/paid-outs', { amountPence: 100, reason: 'Other' })).status, 201);
  assert.equal((await post(mine, '/api/close-the-day', { countedPence: FLOAT })).status, 201);
  const d = await day(theirs);
  assert.deepEqual([d.paidOuts, d.close], [[], null]);
  assert.equal((await post(theirs, '/api/close-the-day', { countedPence: FLOAT })).status, 201);
});

// ---- An over float on Today (opening the shop decision 8 H1) ----
const overLines = async (owner) => {
  const res = await call(owner, '/api/needs-attention');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.items.filter((i) => i.kind === 'float_over');
};

test('an over float goes to Needs attention when yesterday was closed, until Seen', async () => {
  const owner = await shop({ check: false });
  const yesterday = await earlierCheck(owner, '2026-08-31', FLOAT, null);
  await earlierClose(owner, '2026-08-31', yesterday.id);
  const res = await post(owner, '/api/float-check', { countedPence: FLOAT + 300, reason: 'a £5 note found' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const [line, ...more] = await overLines(owner);
  assert.equal(more.length, 0);
  assert.deepEqual({ ...line, checkedAt: 0 }, { kind: 'float_over', checkId: res.body.check.id, day: '2026-09-01', overPence: 300, countedByName: 'Jack Lewis', reason: 'a £5 note found', checkedAt: 0 });
  // Not a short float as well.
  assert.equal((await call(owner, '/api/needs-attention')).body.items.filter((i) => i.kind === 'float_short').length, 0);
  assert.deepEqual((await post(owner, `/api/float-check/${line.checkId}/seen`, {})).status, 200);
  assert.equal((await overLines(owner)).length, 0);
});

test('an over float after a day nobody closed is not listed, and nor is one on the first day', async () => {
  const unclosed = await shop({ check: FLOAT + 300 });
  assert.equal((await overLines(unclosed)).length, 0);
  // The last day the till opened counts as yesterday, however long ago: a
  // closed Saturday before an unclosed Monday still isn't "yesterday".
  const gap = await shop({ check: false });
  const sat = await earlierCheck(gap, '2026-08-29', FLOAT, null);
  await earlierClose(gap, '2026-08-29', sat.id);
  assert.equal((await post(gap, '/api/float-check', { countedPence: FLOAT + 50 })).status, 201);
  assert.equal((await overLines(gap)).length, 1, 'Saturday closed, Sunday shut: listed');
  const first = await staffSignup(server.baseUrl, { shopName: 'First Day Cycles', ownerName: 'Jack Lewis' });
  shops.push(first);
  assert.equal((await call(first, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: FLOAT } })).status, 200);
  assert.equal((await post(first, '/api/float-check', { countedPence: FLOAT + 50 })).status, 201);
  assert.equal((await overLines(first)).length, 0);
});
