// Opening the shop with a float check (openspec/changes/opening-float-check;
// op-float-check, op-float-short, op-today-short, set-eod; opening the shop
// decisions 2, 4 and 8; cash-up decision 4). The shop's float, one float
// check a shop a day, and a short float on Today until the Owner marks it
// Seen. Amounts are whole pence. The live server's clock is pinned to
// 1 Sep 2026, so "today" is 2026-09-01 in the shop's time zone.
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

// A shop of its own for each test, since a shop has one float check a day.
async function shop({ float = FLOAT } = {}) {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  if (float !== null) assert.equal((await call(owner, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: float } })).status, 200);
  // Checked in at the till with a PIN: the float check follows the check-in (pins-and-checkin).
  owner.cookie = (await checkInAtTill(server.baseUrl, owner.cookie)).cookie;
  return owner;
}
async function teamMember(owner, name, { isCashier }) {
  const made = await post(owner, '/api/team', { name, isCashier, isMechanic: !isCashier, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  return { cookie: (await checkInAtTill(server.baseUrl, await staffFreshCookie(made.body.loginId))).cookie };
}
// A float check on an earlier day, as the till would have saved it then.
const earlier = (owner, day, expected, counted) => runWithShop(owner.shop.id, () => prepare(
  'INSERT INTO float_checks (day, login_id, expected_pence, counted_pence) VALUES (?, ?, ?, ?)'
).run(day, owner.loginId, expected, counted));
const shortLines = async (owner) => {
  const res = await call(owner, '/api/needs-attention');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.items.filter((i) => i.kind === 'float_short');
};

test('the Owner sets the float in whole pence; until then it is not set', async () => {
  const owner = await shop({ float: null });
  assert.deepEqual((await call(owner, '/api/end-of-day-settings')).body, { floatPence: null });
  const saved = await call(owner, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: FLOAT } });
  assert.deepEqual([saved.status, saved.body], [200, { floatPence: FLOAT }]);
  assert.deepEqual((await call(owner, '/api/end-of-day-settings')).body, { floatPence: FLOAT });
  for (const bad of [12.5, -1, '15000', null, 10_000_001]) {
    const res = await call(owner, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: bad } });
    assert.equal(res.status, 400, `${JSON.stringify(bad)}: ${JSON.stringify(res.body)}`);
  }
  assert.equal((await call(owner, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: 0 } })).status, 200);
  const jo = await teamMember(owner, 'Jo Taylor', { isCashier: true });
  assert.equal((await call(jo, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: FLOAT } })).status, 403);
  assert.deepEqual((await call(jo, '/api/end-of-day-settings')).body, { floatPence: 0 });
});

test('on the first day the float must be counted; the count is kept with who and when', async () => {
  const owner = await shop();
  const before = await call(owner, '/api/float-check');
  assert.deepEqual(before.body, { day: '2026-09-01', floatPence: FLOAT, takesPayments: true, firstDay: true, check: null });
  const look = await post(owner, '/api/float-check', { countedPence: null });
  assert.deepEqual([look.status, look.body.code], [400, 'count_needed']);
  const counted = await post(owner, '/api/float-check', { countedPence: FLOAT });
  assert.equal(counted.status, 201, JSON.stringify(counted.body));
  const { check } = counted.body;
  assert.deepEqual({ ...check, id: 0, checkedAt: 0 }, { id: 0, how: 'counted', expectedPence: FLOAT, countedPence: FLOAT, reason: '', checkedByName: 'Jack Lewis', checkedAt: 0, tillCode: null });
  assert.ok(Number.isInteger(check.id));
  assert.ok(!Number.isNaN(Date.parse(check.checkedAt)));
  const after = (await call(owner, '/api/float-check')).body;
  assert.deepEqual(after.check, check);
  assert.equal(after.firstDay, false);
});

// Jack's answer 8 (27 Oct): a float nobody checked is looked at when the
// Owner closes the day, even on the first day, never counted.
test('at closing the Owner can look at a float nobody checked, even on the first day', async () => {
  const owner = await shop();
  const jo = await teamMember(owner, 'Jo Taylor', { isCashier: true });
  // Only while "Close the day" is showing (second review, item 3): at 07:00,
  // with the shop closing at 18:00, it isn't, so the first day is counted.
  const early = await post(owner, '/api/float-check', { countedPence: null, atClose: true });
  assert.deepEqual([early.status, early.body.code], [400, 'count_needed']);
  // Shut on Tuesdays, "Close the day" shows all day.
  assert.equal((await call(owner, '/api/workshop-settings', { method: 'PUT', body: { openingHours: [{ weekday: 1, open: '09:00', close: '17:00' }] } })).status, 200);
  const refused = await post(jo, '/api/float-check', { countedPence: null, atClose: true });
  assert.deepEqual([refused.status, refused.body.code], [400, 'count_needed']);
  const res = await post(owner, '/api/float-check', { countedPence: null, atClose: true });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.check.how, 'looked');
});

test('after the first day, Looks right is kept as a look with no count', async () => {
  const owner = await shop();
  await earlier(owner, '2026-08-31', FLOAT, FLOAT);
  assert.equal((await call(owner, '/api/float-check')).body.firstDay, false);
  const res = await post(owner, '/api/float-check', { countedPence: null });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.check.how, 'looked');
  assert.equal(res.body.check.countedPence, null);
  assert.equal(res.body.check.expectedPence, FLOAT);
});

test('a second float check the same day is refused, with the first one', async () => {
  const owner = await shop();
  const first = await post(owner, '/api/float-check', { countedPence: FLOAT });
  assert.equal(first.status, 201);
  const again = await post(owner, '/api/float-check', { countedPence: 1 });
  assert.deepEqual([again.status, again.body.code, again.body.check], [409, 'already_checked', first.body.check]);
});

test('two float checks at the same moment keep one', async () => {
  const owner = await shop();
  const jo = await teamMember(owner, 'Jo Taylor', { isCashier: true });
  const both = await Promise.all([post(owner, '/api/float-check', { countedPence: FLOAT }), post(jo, '/api/float-check', { countedPence: FLOAT - 100 })]);
  assert.deepEqual(both.map((r) => r.status).sort(), [201, 409]);
  const n = await runWithShop(owner.shop.id, () => prepare('SELECT count(*)::int AS n FROM float_checks').get());
  assert.equal(n.n, 1);
});

test('someone who does not take payments is not asked and cannot check the float', async () => {
  const owner = await shop();
  const alex = await teamMember(owner, 'Alex Morgan', { isCashier: false });
  assert.equal((await call(alex, '/api/float-check')).body.takesPayments, false);
  const res = await post(alex, '/api/float-check', { countedPence: FLOAT });
  assert.deepEqual([res.status, res.body.code], [403, 'not_taking_payments']);
  const jo = await teamMember(owner, 'Jo Taylor', { isCashier: true });
  assert.equal((await call(jo, '/api/float-check')).body.takesPayments, true);
});

test('with no float set there is nothing to check', async () => {
  const owner = await shop({ float: null });
  assert.equal((await call(owner, '/api/float-check')).body.floatPence, null);
  const res = await post(owner, '/api/float-check', { countedPence: 0 });
  assert.deepEqual([res.status, res.body.code], [409, 'no_float']);
});

test('a count must be whole pence and a reason short text', async () => {
  const owner = await shop();
  for (const bad of [-1, 1.5, '15000', 10_000_001, undefined]) {
    const res = await post(owner, '/api/float-check', { countedPence: bad });
    assert.equal(res.status, 400, `${JSON.stringify(bad)}: ${JSON.stringify(res.body)}`);
  }
  for (const reason of ['x'.repeat(501), 42]) {
    const res = await post(owner, '/api/float-check', { countedPence: FLOAT, reason });
    assert.equal(res.status, 400, JSON.stringify(res.body));
  }
  assert.equal((await call(owner, '/api/float-check')).body.check, null, 'nothing kept');
});

test('a short float is on the Owner\'s Needs attention until Seen, by the Owner only', async () => {
  const owner = await shop();
  const jo = await teamMember(owner, 'Jo Taylor', { isCashier: true });
  const res = await post(jo, '/api/float-check', { countedPence: FLOAT - 420, reason: '  change given wrong ' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.check.reason, 'change given wrong');
  const [line, ...more] = await shortLines(owner);
  assert.equal(more.length, 0);
  assert.deepEqual({ ...line, checkedAt: 0 }, { kind: 'float_short', checkId: res.body.check.id, day: '2026-09-01', shortPence: 420, countedByName: 'Jo Taylor', reason: 'change given wrong', checkedAt: 0, tillCode: null });
  assert.equal(line.checkedAt, res.body.check.checkedAt);
  assert.equal((await post(jo, `/api/float-check/${line.checkId}/seen`, {})).status, 403);
  assert.equal((await shortLines(owner)).length, 1);
  const seen = await post(owner, `/api/float-check/${line.checkId}/seen`, {});
  assert.deepEqual([seen.status, seen.body], [200, { ok: true }]);
  assert.equal((await shortLines(owner)).length, 0);
  const row = await runWithShop(owner.shop.id, () => prepare('SELECT seen_by_login_id, seen_at FROM float_checks WHERE id = ?').get(line.checkId));
  assert.equal(row.seen_by_login_id, owner.loginId);
  assert.ok(row.seen_at);
  const twice = await post(owner, `/api/float-check/${line.checkId}/seen`, {});
  assert.deepEqual([twice.status, twice.body.code], [409, 'not_short']);
});

test('an over float and a right one are not listed', async () => {
  const over = await shop();
  const res = await post(over, '/api/float-check', { countedPence: FLOAT + 100 });
  assert.equal(res.status, 201);
  assert.equal((await shortLines(over)).length, 0);
  assert.equal((await post(over, `/api/float-check/${res.body.check.id}/seen`, {})).body.code, 'not_short');
  assert.equal((await post(over, '/api/float-check/abc/seen', {})).status, 404);
});

// Decision 8 H3, "one click clears it": a short float stays until it's Seen,
// whatever day it was counted (review, 27 Oct), oldest first, each with its day.
test('an earlier day\'s short float stays on Today until Seen', async () => {
  const old = await shop();
  await earlier(old, '2026-08-30', FLOAT, FLOAT - 500);
  await earlier(old, '2026-08-31', FLOAT, FLOAT);
  const res = await post(old, '/api/float-check', { countedPence: FLOAT - 20 });
  assert.equal(res.status, 201);
  const lines = await shortLines(old);
  assert.deepEqual(lines.map((l) => [l.day, l.shortPence]), [['2026-08-30', 500], ['2026-09-01', 20]]);
  assert.equal((await post(old, `/api/float-check/${lines[0].checkId}/seen`, {})).status, 200);
  assert.deepEqual((await shortLines(old)).map((l) => l.day), ['2026-09-01']);
});

// The dispatcher refuses an id that isn't 1 to 2,147,483,647 before any
// route runs (server.js idParamsWellFormed), so it's never a server error.
test('Seen with an id out of range is refused as not found, never a server error', async () => {
  const owner = await shop();
  for (const id of [0, -3, 2_147_483_648, 99_999_999_999]) {
    const r = await post(owner, `/api/float-check/${id}/seen`, {});
    assert.equal(r.status, 404, `${id} ${JSON.stringify(r.body)}`);
  }
});

test('each shop sees and clears only its own float checks', async () => {
  const mine = await shop();
  const theirs = await shop();
  const res = await post(mine, '/api/float-check', { countedPence: FLOAT - 1 });
  assert.equal(res.status, 201);
  assert.equal((await call(theirs, '/api/float-check')).body.check, null);
  assert.equal((await shortLines(theirs)).length, 0);
  assert.equal((await post(theirs, `/api/float-check/${res.body.check.id}/seen`, {})).status, 409);
  assert.equal((await shortLines(mine)).length, 1);
});
