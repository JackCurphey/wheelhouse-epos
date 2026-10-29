// Till PINs and the PIN check-in (openspec/changes/pins-and-checkin; drawn as
// pin-change, till-checkin and till-pin-wrong in signin.mjs; signing in
// decisions 4, 6, 7, 8 and 9; roles and switches 5; opening the shop
// decision 2 with Jack's answer 3 of 27 Oct). Wheelhouse picks each PIN and
// the person keeps it; the Owner clears someone else's; a PIN alone checks a
// person in on the till's browser; a wrong PIN says so, with no lock; and the
// float check is made by the person checked in. The server's clock is
// pinned to 1 Sep 2026.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { createSession, SESSION_COOKIE } from '../server/auth.js';
import { hashPin, verifyPin } from '../server/till/pin.js';
import { pickPin } from '../server/routes/till-pins.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { readCookie } from './helpers/http.js';
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

const call = (cookie, path, options) => staffRequest(server.baseUrl, cookie, path, options);
const post = (cookie, path, body) => call(cookie, path, { method: 'POST', body });
const WRONG = 'That PIN isn’t anyone’s — try again';

async function shop({ float = 15000 } = {}) {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  if (float !== null) assert.equal((await call(owner.cookie, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: float } })).status, 200);
  return owner;
}
async function member(owner, name, { isCashier = true } = {}) {
  const made = await post(owner.cookie, '/api/team', { name, isCashier, isMechanic: !isCashier, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  return { cookie: await staffFreshCookie(made.body.loginId), employeeId: made.body.employeeId, loginId: made.body.loginId };
}
// Ask for a PIN and keep it, as Your settings does.
async function givePin(who) {
  const offer = await post(who.cookie, '/api/your-settings/till-pin/offer');
  assert.equal(offer.status, 201, JSON.stringify(offer.body));
  const kept = await post(who.cookie, '/api/your-settings/till-pin', { pin: offer.body.pin });
  assert.equal(kept.status, 200, JSON.stringify(kept.body));
  return offer.body.pin;
}
// Check in on a till signed in as `till`, carrying that browser's check-in cookie.
async function checkIn(till, pin, browser = '') {
  const res = await fetch(`${server.baseUrl}/api/till-checkin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: [till.cookie, browser].filter(Boolean).join('; ') },
    body: JSON.stringify({ pin }),
  });
  const body = await res.json();
  return { status: res.status, body, cookie: readCookie(res, 'wh_till_checkin') };
}
const withCheckin = (till, browser) => [till.cookie, browser].filter(Boolean).join('; ');
const row = (owner, sql, ...args) => runWithShop(owner.shop.id, () => prepare(sql).get(...args));

test('Wheelhouse picks a four-digit PIN nobody else has; only its hash is kept', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  assert.deepEqual((await call(jo.cookie, '/api/your-settings/till-pin')).body, { canHavePin: true, hasPin: false });
  const offer = await post(jo.cookie, '/api/your-settings/till-pin/offer');
  assert.equal(offer.status, 201);
  assert.match(offer.body.pin, /^[0-9]{4}$/);
  const offered = await row(owner, 'SELECT pin_hash, pin_offer_hash FROM employees WHERE id = ?', jo.employeeId);
  assert.equal(offered.pin_hash, null, 'nothing kept until Keep this PIN');
  assert.match(offered.pin_offer_hash, /^pbkdf2-sha256\$100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/, 'a slow, salted hash');
  assert.equal(verifyPin(offer.body.pin, offered.pin_offer_hash), true, 'the offer is kept hashed');
  const kept = await post(jo.cookie, '/api/your-settings/till-pin', { pin: offer.body.pin });
  assert.deepEqual([kept.status, kept.body], [200, { hasPin: true }]);
  const after = await row(owner, 'SELECT pin_hash, pin_offer_hash FROM employees WHERE id = ?', jo.employeeId);
  assert.equal(verifyPin(offer.body.pin, after.pin_hash), true);
  assert.equal(after.pin_offer_hash, null);
  assert.match(after.pin_hash, /^pbkdf2-sha256\$100000\$/);
  assert.deepEqual((await call(jo.cookie, '/api/your-settings/till-pin')).body, { canHavePin: true, hasPin: true });
});

test('the picker never gives a PIN someone else has', async () => {
  const draws = [1234, 1234, 7305];
  const taken = new Set(['1234']);
  const pin = await pickPin(async (p) => taken.has(p), () => draws.shift());
  assert.equal(pin, '7305');
  assert.equal(draws.length, 0);
  assert.equal(await pickPin(async () => false, () => 42), '0042', 'four digits, leading zeros kept');
});

test('only the PIN offered can be kept, and a new offer replaces the last', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const none = await post(jo.cookie, '/api/your-settings/till-pin', { pin: '1234' });
  assert.deepEqual([none.status, none.body.code], [400, 'no_offer']);
  const first = (await post(jo.cookie, '/api/your-settings/till-pin/offer')).body.pin;
  let second = first;
  while (second === first) second = (await post(jo.cookie, '/api/your-settings/till-pin/offer')).body.pin;
  const old = await post(jo.cookie, '/api/your-settings/till-pin', { pin: first });
  assert.deepEqual([old.status, old.body.code], [400, 'offer_replaced'], 'Give me a different one replaced it');
  for (const bad of ['12345', '12a4', 1234, null]) {
    assert.equal((await post(jo.cookie, '/api/your-settings/till-pin', { pin: bad })).status, 400, JSON.stringify(bad));
  }
  // An offer lasts 15 minutes.
  await runWithShop(owner.shop.id, () => prepare("UPDATE employees SET pin_offer_at = now() - interval '16 minutes' WHERE id = ?").run(jo.employeeId));
  assert.equal((await post(jo.cookie, '/api/your-settings/till-pin', { pin: second })).body.code, 'no_offer');
});

test('keeping a PIN someone else kept meanwhile is refused', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const alex = await member(owner, 'Alex Morgan', { isCashier: false });
  const pin = (await post(jo.cookie, '/api/your-settings/till-pin/offer')).body.pin;
  await runWithShop(owner.shop.id, () => prepare('UPDATE employees SET pin_hash = ? WHERE id = ?').run(hashPin(pin), alex.employeeId));
  const kept = await post(jo.cookie, '/api/your-settings/till-pin', { pin });
  assert.deepEqual([kept.status, kept.body.code], [409, 'pin_taken']);
});

test('a new PIN stops the old one working', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const old = await givePin(jo);
  let fresh = old;
  while (fresh === old) fresh = await givePin(jo);
  assert.equal((await checkIn(owner, old)).body.code, 'wrong_pin');
  assert.equal((await checkIn(owner, fresh)).status, 201);
});

test('the Owner with no team member gets one for their PIN; another sign-in without one cannot', async () => {
  const owner = await shop();
  assert.deepEqual((await call(owner.cookie, '/api/your-settings/till-pin')).body, { canHavePin: true, hasPin: false });
  const pin = await givePin(owner);
  const link = await row(owner, 'SELECT e.name, e.is_cashier FROM logins l JOIN employees e ON e.id = l.employee_id WHERE l.id = ?', owner.loginId);
  assert.deepEqual(link, { name: 'Jack Lewis', is_cashier: 1 });
  const checked = await checkIn(owner, pin);
  assert.equal(checked.body.serving.name, 'Jack Lewis');
  // A staff sign-in with no team member (made before the link existed).
  const login = await row(owner, "INSERT INTO logins (shop_id, name, email, password_hash) VALUES (?, 'Sam', ?, 'x') RETURNING id", owner.shop.id, `${randomUUID().slice(0, 8)}@example.test`);
  const sam = `${SESSION_COOKIE}=${await createSession(login.id)}`;
  assert.deepEqual((await call(sam, '/api/your-settings/till-pin')).body, { canHavePin: false, hasPin: false });
  const refused = await post(sam, '/api/your-settings/till-pin/offer');
  assert.deepEqual([refused.status, refused.body.code], [409, 'no_team_member']);
});

test('the Owner clears someone else’s forgotten PIN; nobody clears their own', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const alex = await member(owner, 'Alex Morgan', { isCashier: false });
  const pin = await givePin(jo);
  await givePin(owner);
  const ownerEmployee = (await row(owner, 'SELECT employee_id FROM logins WHERE id = ?', owner.loginId)).employee_id;
  assert.equal((await post(alex.cookie, `/api/team/${jo.employeeId}/clear-pin`)).status, 403, 'not until roles');
  assert.equal((await post(owner.cookie, `/api/team/${ownerEmployee}/clear-pin`)).status, 403, 'not their own');
  assert.equal((await post(owner.cookie, '/api/team/999999/clear-pin')).status, 404);
  const cleared = await post(owner.cookie, `/api/team/${jo.employeeId}/clear-pin`);
  assert.deepEqual([cleared.status, cleared.body], [200, { ok: true }]);
  assert.equal((await row(owner, 'SELECT pin_hash FROM employees WHERE id = ?', jo.employeeId)).pin_hash, null);
  assert.equal((await checkIn(owner, pin)).body.code, 'wrong_pin');
  assert.deepEqual((await call(jo.cookie, '/api/your-settings/till-pin')).body, { canHavePin: true, hasPin: false });
});

test('a PIN alone checks someone in on that browser, and Switch checks them out', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const alex = await member(owner, 'Alex Morgan', { isCashier: false });
  const joPin = await givePin(jo);
  const alexPin = await givePin(alex);
  assert.deepEqual((await call(owner.cookie, '/api/till-checkin')).body, { serving: null, checkedInToday: [], givePin: [], till: null, workshop: null });

  const joIn = await checkIn(owner, joPin);
  assert.equal(joIn.status, 201);
  assert.deepEqual(joIn.body.serving, { id: jo.employeeId, name: 'Jo Taylor' });
  assert.ok(joIn.cookie, 'a check-in cookie');
  const token = joIn.cookie.split('=')[1];
  const stored = await row(owner, 'SELECT token_hash, day::text AS day FROM pin_checkins WHERE employee_id = ?', jo.employeeId);
  assert.notEqual(stored.token_hash, token, 'only the hash is kept');
  assert.equal(stored.day, '2026-09-01');
  assert.deepEqual((await call(withCheckin(owner, joIn.cookie), '/api/till-checkin')).body, { serving: { id: jo.employeeId, name: 'Jo Taylor' }, checkedInToday: [{ id: jo.employeeId, name: 'Jo Taylor' }], givePin: [], till: null, workshop: null });
  // Without the cookie, another browser has nobody serving, but sees who's in.
  assert.deepEqual((await call(owner.cookie, '/api/till-checkin')).body, { serving: null, checkedInToday: [{ id: jo.employeeId, name: 'Jo Taylor' }], givePin: [], till: null, workshop: null });

  // Alex takes over on the same browser: Jo's check-in there ends.
  const alexIn = await checkIn(owner, alexPin, joIn.cookie);
  assert.equal(alexIn.body.serving.name, 'Alex Morgan');
  assert.equal((await call(withCheckin(owner, joIn.cookie), '/api/till-checkin')).body.serving, null, 'the old cookie no longer serves');
  const now = await call(withCheckin(owner, alexIn.cookie), '/api/till-checkin');
  assert.deepEqual(now.body.checkedInToday.map((p) => p.name), ['Alex Morgan', 'Jo Taylor']);

  // Switch.
  const res = await fetch(`${server.baseUrl}/api/till-checkin/end`, { method: 'POST', headers: { cookie: withCheckin(owner, alexIn.cookie) } });
  assert.equal(res.status, 200);
  assert.match(res.headers.getSetCookie().join(';'), /wh_till_checkin=;.*Max-Age=0/);
  assert.equal((await call(withCheckin(owner, alexIn.cookie), '/api/till-checkin')).body.serving, null);
});

test('a check-in counts only for its own sign-in, its own shop and its own day', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const pin = await givePin(jo);
  const { cookie } = await checkIn(owner, pin);
  // Jo signs in on that browser instead of the Owner: the check-in was the Owner's till's.
  assert.equal((await call(withCheckin(jo, cookie), '/api/till-checkin')).body.serving, null);
  // Another shop's till with the same cookie.
  const other = await shop();
  assert.equal((await call(withCheckin(other, cookie), '/api/till-checkin')).body.serving, null);
  // Yesterday's check-in.
  await runWithShop(owner.shop.id, () => prepare("UPDATE pin_checkins SET day = '2026-08-31'").run());
  assert.deepEqual((await call(withCheckin(owner, cookie), '/api/till-checkin')).body, { serving: null, checkedInToday: [], givePin: [], till: null, workshop: null });
  // Not signed in at all.
  assert.equal((await call('', '/api/till-checkin')).status, 401);
  assert.equal((await checkIn({ cookie: '' }, pin)).status, 401);
});

test('a wrong PIN says so and never locks; after 10 wrong, guessing is slowed', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const pin = await givePin(jo);
  const wrong = pin === '0000' ? '0001' : '0000';
  const first = await checkIn(owner, wrong);
  assert.deepEqual([first.status, first.body], [400, { error: WRONG, code: 'wrong_pin' }]);
  for (const bad of ['123', '12345', 'abcd', 1234]) {
    const res = await checkIn(owner, bad);
    assert.equal(res.status, 400, JSON.stringify(bad));
    assert.notEqual(res.body.code, undefined);
  }
  for (let i = 0; i < 9; i += 1) assert.equal((await checkIn(owner, wrong)).body.code, 'wrong_pin');
  let started = Date.now();
  assert.equal((await checkIn(owner, wrong)).body.code, 'wrong_pin', 'still the same answer: no lock');
  assert.ok(Date.now() - started >= 2900, `the 11th wrong PIN waited (${Date.now() - started}ms)`);
  started = Date.now();
  const right = await checkIn(owner, pin);
  assert.equal(right.status, 201, 'the right PIN still works');
  assert.ok(Date.now() - started >= 2900, 'and waits its turn too');
  // One try waits at a time; a second meanwhile is turned away, never queued.
  const both = await Promise.all([checkIn(owner, wrong), checkIn(owner, wrong)]);
  assert.deepEqual(both.map((r) => r.body.code).sort(), ['slow_down', 'wrong_pin']);
  assert.equal(both.find((r) => r.body.code === 'slow_down').status, 429);
  // Another shop isn't slowed.
  const other = await shop();
  const sam = await member(other, 'Jo Taylor');
  const samPin = await givePin(sam);
  started = Date.now();
  assert.equal((await checkIn(other, samPin)).status, 201);
  assert.ok(Date.now() - started < 2500);
});

// Review, 28 Oct, item 4: each try is counted before its PIN is checked, so a
// burst sent at once can't all slip in under the limit.
test('a burst of 60 wrong PINs gets no more than the limit through', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const pin = await givePin(jo);
  const wrong = pin === '0000' ? '0001' : '0000';
  const burst = await Promise.all(Array.from({ length: 60 }, () => checkIn(owner, wrong)));
  const checked = burst.filter((r) => r.body.code === 'wrong_pin').length;
  // The 10 the limit allows, and at most the one try that waited its turn.
  assert.ok(checked <= 11, `${checked} were checked`);
  assert.equal(burst.filter((r) => r.status === 429).length, 60 - checked);
});

// Review, 28 Oct, item 4: the waiting turn is per sign-in and browser, so one
// person guessing can't hold up another till.
test('someone guessing on one till does not block another till’s right PIN', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const pin = await givePin(jo);
  const wrong = pin === '0000' ? '0001' : '0000';
  for (let i = 0; i < 10; i += 1) await checkIn(owner, wrong);
  // The guesser has a try waiting its turn; Jo, on her own till, types hers.
  const guessing = checkIn(owner, wrong);
  await new Promise((r) => setTimeout(r, 200));
  const right = await checkIn(jo, pin);
  assert.equal(right.status, 201, JSON.stringify(right.body));
  assert.equal((await guessing).body.code, 'wrong_pin');
});

// Review, 28 Oct, item 5: "Give me a different one" can't be pressed for ever.
test('PIN offers are limited per sign-in, and never kept by a browser cache', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const first = await fetch(`${server.baseUrl}/api/your-settings/till-pin/offer`, { method: 'POST', headers: { cookie: jo.cookie } });
  assert.equal(first.status, 201);
  assert.equal(first.headers.get('cache-control'), 'no-store');
  for (let i = 0; i < 9; i += 1) assert.equal((await post(jo.cookie, '/api/your-settings/till-pin/offer')).status, 201);
  const refused = await post(jo.cookie, '/api/your-settings/till-pin/offer');
  assert.deepEqual([refused.status, refused.body.code], [429, 'slow_down']);
  // Another person's sign-in isn't affected.
  assert.equal((await post(owner.cookie, '/api/your-settings/till-pin/offer')).status, 201);
});

// Review, 28 Oct, item 6: two offers at once never make the Owner twice.
test('two offers at once give the Owner one team member', async () => {
  const owner = await shop();
  const both = await Promise.all([post(owner.cookie, '/api/your-settings/till-pin/offer'), post(owner.cookie, '/api/your-settings/till-pin/offer')]);
  assert.deepEqual(both.map((r) => r.status), [201, 201], JSON.stringify(both.map((r) => r.body)));
  const people = await runWithShop(owner.shop.id, () => prepare("SELECT count(*)::int AS n FROM employees WHERE name = 'Jack Lewis'").get());
  assert.equal(people.n, 1);
});

// Review, 28 Oct, item 9.
test('clearing a PIN ends that person’s check-in, and a made-up id is not found', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const pin = await givePin(jo);
  const { cookie } = await checkIn(owner, pin);
  assert.equal((await call(withCheckin(owner, cookie), '/api/till-checkin')).body.serving.name, 'Jo Taylor');
  assert.equal((await post(owner.cookie, `/api/team/${jo.employeeId}/clear-pin`)).status, 200);
  assert.equal((await call(withCheckin(owner, cookie), '/api/till-checkin')).body.serving, null);
  assert.equal((await post(owner.cookie, '/api/team/abc/clear-pin')).status, 404);
});

test('the float check waits for a check-in and is made by the person checked in', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const alex = await member(owner, 'Alex Morgan', { isCashier: false });
  const joPin = await givePin(jo);
  const alexPin = await givePin(alex);
  // Signed in as the Owner, nobody checked in: the morning check waits.
  const refused = await post(owner.cookie, '/api/float-check', { countedPence: 15000 });
  assert.deepEqual([refused.status, refused.body.code], [409, 'check_in_first']);
  // Alex, who doesn't take payments, is checked in on the Owner's till: not asked.
  const alexIn = await checkIn(owner, alexPin);
  assert.equal((await call(withCheckin(owner, alexIn.cookie), '/api/float-check')).body.takesPayments, false);
  assert.equal((await post(withCheckin(owner, alexIn.cookie), '/api/float-check', { countedPence: 15000 })).body.code, 'not_taking_payments');
  // Jo checks in on the same till and counts it.
  const joIn = await checkIn(owner, joPin, alexIn.cookie);
  assert.equal((await call(withCheckin(owner, joIn.cookie), '/api/float-check')).body.takesPayments, true);
  const made = await post(withCheckin(owner, joIn.cookie), '/api/float-check', { countedPence: 15000 });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.equal(made.body.check.checkedByName, 'Jo Taylor');
  const stored = await row(owner, 'SELECT employee_id, login_id FROM float_checks');
  assert.deepEqual(stored, { employee_id: jo.employeeId, login_id: owner.loginId });
});
