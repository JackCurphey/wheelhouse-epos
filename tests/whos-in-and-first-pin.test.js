// Who's in and Tills on Today, and the first PIN by itself
// (openspec/changes/whos-in-and-first-pin; drawn as op-today, op-today-staff,
// op-today-late, op-today-short, op-today-seen in opening.mjs and pin-first,
// pin-cleared in signin.mjs; opening the shop decisions 3 to 6; UX
// walk-through 4 H1). The server's clock is pinned to 1 Sep 2026, a Tuesday.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { readCookie } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
const shops = [];
before(async () => { server = await startLiveServer(); });
after(async () => {
  for (const s of shops) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
});

const call = (cookie, path, options) => staffRequest(server.baseUrl, cookie, path, options);
const post = (cookie, path, body) => call(cookie, path, { method: 'POST', body });
const TUESDAY = 2;

async function shop() {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  assert.equal((await call(owner.cookie, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: 15000 } })).status, 200);
  return owner;
}
async function member(owner, name, { mechanic = false } = {}) {
  const made = await post(owner.cookie, '/api/team', { name, isCashier: !mechanic, isMechanic: mechanic, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  return { cookie: await staffFreshCookie(made.body.loginId), employeeId: made.body.employeeId, loginId: made.body.loginId };
}
async function givePin(who) {
  const offer = await post(who.cookie, '/api/your-settings/till-pin/offer');
  assert.equal((await post(who.cookie, '/api/your-settings/till-pin', { pin: offer.body.pin })).status, 200);
  return offer.body.pin;
}
async function checkIn(till, pin) {
  const res = await fetch(`${server.baseUrl}/api/till-checkin`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: till.cookie }, body: JSON.stringify({ pin }),
  });
  assert.equal(res.status, 201);
  return `${till.cookie}; ${readCookie(res, 'wh_till_checkin')}`;
}
const opens = async (owner) => (await call(owner.cookie, '/api/workshop-settings')).body.openingHours.find((h) => h.weekday === TUESDAY)?.open;

test('Who\'s in lists today\'s check-ins first in first, with each role, and the mechanics due who haven\'t come', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const alex = await member(owner, 'Alex Morgan', { mechanic: true });
  const sam = await member(owner, 'Sam Reed', { mechanic: true });
  const pat = await member(owner, 'Pat Evans', { mechanic: true });
  // Pat has today off; Sam works only on Saturdays.
  await runWithShop(owner.shop.id, async () => {
    await prepare("INSERT INTO workshop_unavailability (employee_id, kind, start_date, end_date) VALUES (?, 'dates', '2026-09-01', '2026-09-01')").run(pat.employeeId);
    await prepare("UPDATE employees SET working_days = '[6]' WHERE id = ?").run(sam.employeeId);
  });
  const joPin = await givePin(jo);
  const ownerPin = await givePin(owner);
  const till = await checkIn(owner, joPin);
  // Switch, then the Owner checks in: Jo is still in today, from her first check-in.
  assert.equal((await post(till, '/api/till-checkin/end')).status, 200);
  await checkIn(owner, ownerPin);
  await checkIn(owner, joPin);
  await runWithShop(owner.shop.id, () => prepare("UPDATE pin_checkins SET checked_in_at = checked_in_at - interval '1 hour' WHERE id = (SELECT min(id) FROM pin_checkins)").run());

  const res = await call(jo.cookie, '/api/today/whos-in');
  assert.equal(res.status, 200, 'anyone who can open Today sees Who\'s in');
  const people = res.body.people;
  assert.deepEqual(people.map((p) => [p.name, p.role]), [['Jo Taylor', 'Staff'], ['Jack Lewis', 'Owner'], ['Alex Morgan', 'Mechanic']]);
  const first = await runWithShop(owner.shop.id, () => prepare('SELECT min(checked_in_at) AS at FROM pin_checkins WHERE employee_id = ?').get(jo.employeeId));
  assert.equal(people[0].checkedInAt, new Date(first.at).toISOString(), 'the time of her first check-in today');
  assert.equal(people[2].checkedInAt, undefined);
  assert.equal(people[2].dueAt, await opens(owner), 'due from the start of his working day');
  assert.ok(!JSON.stringify(res.body).match(/pin|token|hash/i), 'nothing about PINs');
  // Alex checks in: he is In, not due.
  await checkIn(owner, await givePin(alex));
  const after = (await call(jo.cookie, '/api/today/whos-in')).body.people;
  assert.deepEqual(after.map((p) => [p.name, Boolean(p.checkedInAt)]), [['Jo Taylor', true], ['Jack Lewis', true], ['Alex Morgan', true]]);
});

test('Who\'s in is the shop\'s own, today\'s only, and needs a sign-in', async () => {
  const owner = await shop();
  const other = await shop();
  const jo = await member(owner, 'Jo Taylor');
  await checkIn(owner, await givePin(jo));
  // Yesterday's check-in isn't today's.
  const kim = await member(owner, 'Kim Shaw');
  await checkIn(owner, await givePin(kim));
  await runWithShop(owner.shop.id, () => prepare("UPDATE pin_checkins SET day = day - 1 WHERE employee_id = ?").run(kim.employeeId));
  assert.deepEqual((await call(owner.cookie, '/api/today/whos-in')).body.people.map((p) => p.name), ['Jo Taylor']);
  assert.deepEqual((await call(other.cookie, '/api/today/whos-in')).body.people, []);
  assert.equal((await fetch(`${server.baseUrl}/api/today/whos-in`)).status, 401);
});

test('Tills is the Owner\'s: not open, open, float checked, short, and seen', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  assert.equal((await call(jo.cookie, '/api/today/tills')).status, 403, 'Staff never get the till\'s line');
  assert.deepEqual((await call(owner.cookie, '/api/today/tills')).body, { tills: [{ code: null, openedAt: null, openedBy: null, floatCheck: null }] });
  const till = await checkIn(owner, await givePin(jo));
  const open = (await call(owner.cookie, '/api/today/tills')).body.tills[0];
  assert.match(open.openedAt, /^2026-/);
  assert.deepEqual(open.openedBy, 'Jo Taylor');
  assert.equal(open.floatCheck, null);
  assert.equal((await post(till, '/api/float-check', { countedPence: 14000, reason: '' })).status, 201);
  const checked = (await call(owner.cookie, '/api/today/tills')).body.tills[0].floatCheck;
  assert.deepEqual([checked.byName, checked.short, checked.seenByName], ['Jo Taylor', true, null]);
  const id = (await call(owner.cookie, '/api/needs-attention')).body.items.find((i) => i.kind === 'float_short').checkId;
  assert.equal((await post(owner.cookie, `/api/float-check/${id}/seen`)).status, 200);
  assert.equal((await call(owner.cookie, '/api/today/tills')).body.tills[0].floatCheck.seenByName, 'Jack Lewis');
});

test('a team member\'s first sign-in is asked for a PIN once; Skip or Keep stops it', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  assert.deepEqual((await call(jo.cookie, '/api/your-settings/till-pin/ask')).body, { ask: 'first' });
  assert.deepEqual((await post(jo.cookie, '/api/your-settings/till-pin/ask')).body, { ask: null });
  assert.deepEqual((await call(jo.cookie, '/api/your-settings/till-pin/ask')).body, { ask: null }, 'Skip for now: not asked again');
  // Keep: someone who has a PIN is never asked.
  const alex = await member(owner, 'Alex Morgan', { mechanic: true });
  await givePin(alex);
  assert.deepEqual((await call(alex.cookie, '/api/your-settings/till-pin/ask')).body, { ask: null });
  // The Owner made the shop: not asked, even once on the team without a PIN
  // (an offer made the Owner's team member, then nothing was kept).
  assert.deepEqual((await call(owner.cookie, '/api/your-settings/till-pin/ask')).body, { ask: null });
  assert.equal((await post(owner.cookie, '/api/your-settings/till-pin/offer')).status, 201);
  assert.ok(await runWithShop(owner.shop.id, () => prepare('SELECT 1 AS yes FROM logins l JOIN employees e ON e.id = l.employee_id WHERE l.shop_id = ? AND l.is_owner AND e.pin_hash IS NULL').get(owner.shop.id)), 'the Owner is on the team with no PIN');
  assert.deepEqual((await call(owner.cookie, '/api/your-settings/till-pin/ask')).body, { ask: null });
  assert.equal((await fetch(`${server.baseUrl}/api/your-settings/till-pin/ask`)).status, 401);
});

test('after the Owner clears a PIN, the next sign-in is asked again, in the cleared words', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  await givePin(jo);
  await post(jo.cookie, '/api/your-settings/till-pin/ask');
  assert.equal((await post(owner.cookie, `/api/team/${jo.employeeId}/clear-pin`)).status, 200);
  assert.deepEqual((await call(jo.cookie, '/api/your-settings/till-pin/ask')).body, { ask: 'cleared' });
  await post(jo.cookie, '/api/your-settings/till-pin/ask');
  assert.deepEqual((await call(jo.cookie, '/api/your-settings/till-pin/ask')).body, { ask: null });
  // Never asked before, then cleared: still the cleared words.
  const kim = await member(owner, 'Kim Shaw');
  await givePin(kim);
  await post(owner.cookie, `/api/team/${kim.employeeId}/clear-pin`);
  assert.deepEqual((await call(kim.cookie, '/api/your-settings/till-pin/ask')).body, { ask: 'cleared' });
});

test('another shop\'s mechanics due today never appear in Who\'s in', async () => {
  const owner = await shop();
  const other = await shop();
  await member(owner, 'Alex Morgan', { mechanic: true });
  await member(other, 'Sam Reed', { mechanic: true });
  assert.deepEqual((await call(owner.cookie, '/api/today/whos-in')).body.people.map((p) => p.name), ['Alex Morgan']);
  assert.deepEqual((await call(other.cookie, '/api/today/whos-in')).body.people.map((p) => p.name), ['Sam Reed']);
});

test('Keep refused after the PIN was offered again in another window says so', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const first = (await post(jo.cookie, '/api/your-settings/till-pin/offer')).body.pin;
  let second = first;
  while (second === first) second = (await post(jo.cookie, '/api/your-settings/till-pin/offer')).body.pin;
  const kept = await post(jo.cookie, '/api/your-settings/till-pin', { pin: first });
  assert.deepEqual([kept.status, kept.body], [400, { error: 'Your PIN was offered in another window. Pick again.', code: 'offer_replaced' }]);
  // With no offer at all (or an old one) it is still "Ask for a new PIN".
  await runWithShop(owner.shop.id, () => prepare("UPDATE employees SET pin_offer_at = now() - interval '16 minutes' WHERE id = ?").run(jo.employeeId));
  assert.equal((await post(jo.cookie, '/api/your-settings/till-pin', { pin: second })).body.code, 'no_offer');
});
