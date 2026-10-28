// Giving a PIN at the till (openspec/changes/give-pin-at-till; drawn as
// till-serving-menu, till-serving-menu-several, till-give-pin-pick and
// till-give-pin in signin.mjs; Jack's answers 28 Oct, 3 to 5). The Owner,
// checked in at the till with his PIN, gives a PIN Wheelhouse picked to
// someone at the shop who has none, with the screen turned to them; keeping
// it takes the till back to Enter your PIN. The same offer, keep, lock,
// limit and hash as Your settings. The server's clock is pinned to 1 Sep 2026.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { hashPin, verifyPin } from '../server/till/pin.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, checkInAtTill, checkInWithPin } from './helpers/staff.js';
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
const offerTo = (cookie, id) => post(cookie, `/api/till-checkin/give-pin/${id}/offer`);
const keepFor = (cookie, id, pin) => post(cookie, `/api/till-checkin/give-pin/${id}`, { pin });
const row = (owner, sql, ...args) => runWithShop(owner.shop.id, () => prepare(sql).get(...args));

// A shop whose Owner has a PIN and is checked in on the till: `till` is the
// cookie of that browser (the sign-in and the check-in together).
async function shop() {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  const { cookie: till, pin } = await checkInAtTill(server.baseUrl, owner.cookie);
  const ownerEmployee = (await row(owner, 'SELECT employee_id FROM logins WHERE id = ?', owner.loginId)).employee_id;
  return { ...owner, till, pin, ownerEmployee };
}
// Someone on the team with a sign-in (as the team's own route adds them).
async function member(owner, name, { isCashier = true } = {}) {
  const made = await post(owner.cookie, '/api/team', { name, isCashier, isMechanic: !isCashier, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  return { cookie: await staffFreshCookie(made.body.loginId), employeeId: made.body.employeeId, loginId: made.body.loginId };
}
// Someone "till only": on the team, with no sign-in (set-staff-invite-till-only).
async function tillOnly(owner, name, { mechanic = false } = {}) {
  return runWithShop(owner.shop.id, async () => {
    const { lastInsertRowid } = await prepare('INSERT INTO employees (name, is_mechanic, is_cashier) VALUES (?, ?, 1)').run(name, mechanic ? 1 : 0);
    return lastInsertRowid;
  });
}
const givePinList = async (cookie) => {
  const res = await call(cookie, '/api/till-checkin');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.givePin;
};

test('the Owner serving sees who has no PIN: not himself, not anyone with one, not someone inactive', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const alex = await member(owner, 'Alex Morgan', { isCashier: false });
  const sam = await tillOnly(owner, 'Sam Till');
  const gone = await tillOnly(owner, 'Old Hand');
  await runWithShop(owner.shop.id, () => prepare('UPDATE employees SET active = 0 WHERE id = ?').run(gone));
  // Alex has a PIN already.
  await runWithShop(owner.shop.id, () => prepare('UPDATE employees SET pin_hash = ? WHERE id = ?').run(hashPin(owner.pin === '1111' ? '2222' : '1111'), alex.employeeId));
  assert.deepEqual(await givePinList(owner.till), [
    { id: jo.employeeId, name: 'Jo Taylor', role: 'Staff', tillOnly: false },
    { id: sam, name: 'Sam Till', role: 'Staff', tillOnly: true },
  ]);
});

test('a till-only mechanic is listed as a Mechanic', async () => {
  const owner = await shop();
  const id = await tillOnly(owner, 'Alex Morgan', { mechanic: true });
  assert.deepEqual(await givePinList(owner.till), [{ id, name: 'Alex Morgan', role: 'Mechanic', tillOnly: true }]);
});

test('nobody is listed unless the Owner is the one checked in on this browser', async () => {
  const owner = await shop();
  await tillOnly(owner, 'Sam Till');
  // Signed in as the Owner, but nobody checked in.
  assert.deepEqual(await givePinList(owner.cookie), []);
  // Jo checked in on the Owner's own sign-in.
  const jo = await member(owner, 'Jo Taylor');
  const { pin: joPin } = await checkInAtTill(server.baseUrl, jo.cookie);
  const joOnOwnersTill = await checkInWithPin(server.baseUrl, owner.cookie, joPin);
  assert.deepEqual(await givePinList(joOnOwnersTill), []);
});

test('the Owner never lists himself for a PIN, even after his is cleared', async () => {
  const owner = await shop();
  await runWithShop(owner.shop.id, () => prepare('UPDATE employees SET pin_hash = NULL WHERE id = ?').run(owner.ownerEmployee));
  // His check-in stands (clearing it by hand doesn't end it), and he is not listed.
  assert.deepEqual(await givePinList(owner.till), []);
  const self = await offerTo(owner.till, owner.ownerEmployee);
  assert.equal(self.status, 403, JSON.stringify(self.body));
});

test('the Owner gives a till-only person their PIN: offered once, kept hashed, and the till goes back to Enter your PIN', async () => {
  const owner = await shop();
  const sam = await tillOnly(owner, 'Sam Till');
  const res = await fetch(`${server.baseUrl}/api/till-checkin/give-pin/${sam}/offer`, { method: 'POST', headers: { cookie: owner.till, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('cache-control'), 'no-store', 'shown once: never kept by a cache');
  const { pin } = await res.json();
  assert.match(pin, /^[0-9]{4}$/);
  assert.notEqual(pin, owner.pin, 'nobody else at the shop has it');
  const offered = await row(owner, 'SELECT pin_hash, pin_offer_hash FROM employees WHERE id = ?', sam);
  assert.equal(offered.pin_hash, null, 'nothing kept until Keep this PIN');
  assert.equal(verifyPin(pin, offered.pin_offer_hash), true, 'the offer is kept hashed');

  const kept = await fetch(`${server.baseUrl}/api/till-checkin/give-pin/${sam}`, { method: 'POST', headers: { cookie: owner.till, 'content-type': 'application/json' }, body: JSON.stringify({ pin }) });
  assert.equal(kept.status, 200);
  assert.deepEqual(await kept.json(), { serving: null });
  assert.equal(readCookie(kept, 'wh_till_checkin'), 'wh_till_checkin=', 'the check-in cookie is cleared');
  const after = await row(owner, 'SELECT pin_hash, pin_offer_hash FROM employees WHERE id = ?', sam);
  assert.equal(verifyPin(pin, after.pin_hash), true);
  assert.equal(after.pin_offer_hash, null);
  assert.match(after.pin_hash, /^pbkdf2-sha256\$100000\$/);
  // The Owner's check-in on this browser ended: nobody is serving.
  assert.equal((await call(owner.till, '/api/till-checkin')).body.serving, null);
  // And the PIN checks Sam in.
  const samIn = await post(owner.cookie, '/api/till-checkin', { pin });
  assert.deepEqual([samIn.status, samIn.body.serving?.name], [201, 'Sam Till']);
});

test('Give me a different one replaces the offer; only the last one shown can be kept, within 15 minutes', async () => {
  const owner = await shop();
  const sam = await tillOnly(owner, 'Sam Till');
  const first = (await offerTo(owner.till, sam)).body.pin;
  assert.match(String(first), /^[0-9]{4}$/);
  let second = first;
  for (let i = 0; i < 5 && second === first; i += 1) second = (await offerTo(owner.till, sam)).body.pin;
  assert.notEqual(second, first);
  assert.deepEqual([(await keepFor(owner.till, sam, first)).status, (await keepFor(owner.till, sam, first)).body.code], [400, 'no_offer']);
  for (const bad of ['12345', '12a4', 1234, null]) assert.equal((await keepFor(owner.till, sam, bad)).status, 400, JSON.stringify(bad));
  await runWithShop(owner.shop.id, () => prepare("UPDATE employees SET pin_offer_at = now() - interval '16 minutes' WHERE id = ?").run(sam));
  assert.equal((await keepFor(owner.till, sam, second)).body.code, 'no_offer');
  assert.equal((await row(owner, 'SELECT pin_hash FROM employees WHERE id = ?', sam)).pin_hash, null);
});

test('only the checked-in Owner can give a PIN: not Jo checked in, not the Owner without a check-in', async () => {
  const owner = await shop();
  const sam = await tillOnly(owner, 'Sam Till');
  const jo = await member(owner, 'Jo Taylor');
  const { cookie: joTill } = await checkInAtTill(server.baseUrl, jo.cookie);
  for (const cookie of [joTill, owner.cookie, jo.cookie]) {
    const offer = await offerTo(cookie, sam);
    assert.deepEqual([offer.status, offer.body.code], [403, 'not_giver'], cookie);
    assert.equal(offer.body.pin, undefined);
    const keep = await keepFor(cookie, sam, '1234');
    assert.deepEqual([keep.status, keep.body.code], [403, 'not_giver']);
  }
  // Jo on the Owner's sign-in is still Jo.
  const { pin: joPin } = await checkInAtTill(server.baseUrl, jo.cookie);
  const joOnOwnersTill = await checkInWithPin(server.baseUrl, owner.cookie, joPin);
  assert.equal((await offerTo(joOnOwnersTill, sam)).status, 403);
  // And an offer made by the Owner can't be kept by Jo.
  const pin = (await offerTo(owner.till, sam)).body.pin;
  assert.equal((await keepFor(joTill, sam, pin)).status, 403);
  assert.equal((await row(owner, 'SELECT pin_hash FROM employees WHERE id = ?', sam)).pin_hash, null);
});

test('nobody with a PIN is given one, and nobody is given the Owner’s', async () => {
  const owner = await shop();
  const alex = await member(owner, 'Alex Morgan', { isCashier: false });
  const alexPin = owner.pin === '1111' ? '2222' : '1111';
  await runWithShop(owner.shop.id, () => prepare('UPDATE employees SET pin_hash = ? WHERE id = ?').run(hashPin(alexPin), alex.employeeId));
  const has = await offerTo(owner.till, alex.employeeId);
  assert.deepEqual([has.status, has.body.code], [409, 'has_pin']);
  assert.equal(has.body.pin, undefined);
  assert.equal((await keepFor(owner.till, alex.employeeId, alexPin)).body.code, 'has_pin');
  // Alex's PIN still works.
  assert.equal((await post(owner.cookie, '/api/till-checkin', { pin: alexPin })).status, 201);
  // The Owner's own PIN, given by himself: refused as his own.
  const own = await offerTo(owner.till, owner.ownerEmployee);
  assert.deepEqual([own.status, own.body.code], [403, 'own_pin']);
});

test('a PIN given meanwhile by another way stops the keep', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const pin = (await offerTo(owner.till, jo.employeeId)).body.pin;
  // Jo gets her own PIN in Your settings meanwhile.
  const own = (await post(jo.cookie, '/api/your-settings/till-pin/offer')).body.pin;
  assert.equal((await post(jo.cookie, '/api/your-settings/till-pin', { pin: own })).status, 200);
  const kept = await keepFor(owner.till, jo.employeeId, pin);
  assert.ok([400, 409].includes(kept.status), JSON.stringify(kept.body));
  assert.equal(verifyPin(own, (await row(owner, 'SELECT pin_hash FROM employees WHERE id = ?', jo.employeeId)).pin_hash), true, 'her own PIN stands');
});

test('keeping a PIN someone else kept meanwhile is refused', async () => {
  const owner = await shop();
  const sam = await tillOnly(owner, 'Sam Till');
  const kim = await tillOnly(owner, 'Kim Till');
  const pin = (await offerTo(owner.till, sam)).body.pin;
  await runWithShop(owner.shop.id, () => prepare('UPDATE employees SET pin_hash = ? WHERE id = ?').run(hashPin(pin), kim));
  const kept = await keepFor(owner.till, sam, pin);
  assert.deepEqual([kept.status, kept.body.code], [409, 'pin_taken']);
  assert.equal((await row(owner, 'SELECT pin_hash FROM employees WHERE id = ?', sam)).pin_hash, null);
  // The Owner is still serving: nothing was given.
  assert.notEqual((await call(owner.till, '/api/till-checkin')).body.serving, null);
});

test('two keeps of the same PIN for two people at once give it to one only', async () => {
  const owner = await shop();
  const sam = await tillOnly(owner, 'Sam Till');
  const kim = await tillOnly(owner, 'Kim Till');
  const pin = (await offerTo(owner.till, sam)).body.pin;
  // Kim is offered the same digits (as two tills could be): put the same offer on her row.
  await runWithShop(owner.shop.id, () => prepare("UPDATE employees SET pin_offer_hash = ?, pin_offer_at = now() WHERE id = ?").run(hashPin(pin), kim));
  const second = await checkInWithPin(server.baseUrl, await staffFreshCookie(owner.loginId), owner.pin);
  const [a, b] = await Promise.all([keepFor(owner.till, sam, pin), keepFor(second, kim, pin)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409], `${JSON.stringify(a.body)} ${JSON.stringify(b.body)}`);
  const holders = await runWithShop(owner.shop.id, () => prepare('SELECT pin_hash FROM employees WHERE id IN (?, ?) AND pin_hash IS NOT NULL').all(sam, kim));
  assert.equal(holders.length, 1);
});

test('someone in another shop is not found', async () => {
  const owner = await shop();
  const other = await shop();
  const theirs = await tillOnly(other, 'Sam Till');
  const offer = await offerTo(owner.till, theirs);
  assert.deepEqual([offer.status, offer.body.error], [404, 'Team member not found'], 'the route answers, and finds nobody');
  assert.equal(offer.body.pin, undefined);
  assert.deepEqual((await keepFor(owner.till, theirs, '1234')).body, { error: 'Team member not found' });
  assert.equal((await row(other, 'SELECT pin_offer_hash FROM employees WHERE id = ?', theirs)).pin_offer_hash, null);
  assert.equal((await offerTo(owner.till, 999999)).status, 404);
});

test('someone no longer active is not found', async () => {
  const owner = await shop();
  const gone = await tillOnly(owner, 'Old Hand');
  await runWithShop(owner.shop.id, () => prepare('UPDATE employees SET active = 0 WHERE id = ?').run(gone));
  assert.deepEqual([(await offerTo(owner.till, gone)).status, (await offerTo(owner.till, gone)).body.error], [404, 'Team member not found']);
});

test('offers given at the till share Your settings’ limit of 10 a sign-in in 10 minutes', async () => {
  const owner = await shop();
  const sam = await tillOnly(owner, 'Sam Till');
  // checkInAtTill used one offer of the Owner's sign-in.
  for (let i = 0; i < 9; i += 1) assert.equal((await offerTo(owner.till, sam)).status, 201, `offer ${i + 2}`);
  const limited = await offerTo(owner.till, sam);
  assert.deepEqual([limited.status, limited.body.code], [429, 'slow_down']);
  assert.equal(limited.body.pin, undefined);
  assert.equal((await post(owner.cookie, '/api/your-settings/till-pin/offer')).status, 429, 'the same count');
});

test('signed out: refused', async () => {
  const owner = await shop();
  const sam = await tillOnly(owner, 'Sam Till');
  assert.equal((await offerTo('', sam)).status, 401);
  assert.equal((await keepFor('', sam, '1234')).status, 401);
});
