// Trust PIN on the workshop computer (openspec/changes/trust-pin-workshop;
// roles and switches 3 and 9; stage-1 gaps 9; the lines on set-till-quick;
// till-checkin-workshop-names). The Owner switches trust PIN on and sets how
// long a workshop computer waits; the server ends a check-in at that time.
// The server's clock is pinned to 1 Sep 2026.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { hashLinkCode } from '../server/booking-link.js';
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

const call = (cookie, path, options) => staffRequest(server.baseUrl, cookie, path, options);
const post = (cookie, path, body) => call(cookie, path, { method: 'POST', body });
const put = (cookie, body) => call(cookie, '/api/signing-in-settings', { method: 'PUT', body });
const run = (owner, sql, ...args) => runWithShop(owner.shop.id, () => prepare(sql).run(...args));

async function shop() {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  owner.site = (await post(owner.cookie, '/api/sites', { name: 'Bolton', code: 'B' })).body;
  return owner;
}
async function newPin(cookie) {
  const offer = await post(cookie, '/api/your-settings/till-pin/offer');
  assert.equal((await post(cookie, '/api/your-settings/till-pin', { pin: offer.body.pin })).status, 200);
  return offer.body.pin;
}
async function member(owner, name, { mechanic = false } = {}) {
  const made = await post(owner.cookie, '/api/team', { name, isCashier: !mechanic, isMechanic: mechanic, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const cookie = await staffFreshCookie(made.body.loginId);
  return { cookie, pin: await newPin(cookie) };
}

// A browser: the Owner's sign-in plus whatever cookies the server gives it.
function browser(owner) {
  const jar = new Map();
  const cookie = () => [owner.cookie, ...[...jar].filter(([, v]) => v).map(([k, v]) => `${k}=${v}`)].join('; ');
  async function send(path, { method = 'GET', body } = {}) {
    const res = await fetch(`${server.baseUrl}${path}`, {
      method, headers: { cookie: cookie(), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }
  return { send, jar };
}
async function workshop(owner) {
  const b = browser(owner);
  assert.equal((await b.send('/api/till-setup/workshop', { method: 'POST', body: { siteId: owner.site.id } })).status, 201);
  return b;
}
const checkIn = async (b, pin) => {
  const res = await b.send('/api/till-checkin', { method: 'POST', body: { pin } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.serving;
};
const checkin = async (b) => (await b.send('/api/till-checkin')).body;
// The check-in on this browser was last used `minutes` ago.
const idleFor = (owner, b, minutes) => run(owner, `UPDATE pin_checkins SET last_active_at = now() - interval '${minutes} minutes' WHERE token_hash = ?`, hashLinkCode(b.jar.get('wh_till_checkin')));

test('Signing in: trust PIN off and 10 minutes to start; the Owner only; only the drawn choices', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  assert.deepEqual((await call(owner.cookie, '/api/signing-in-settings')).body, { trustPin: false, workshopIdleMinutes: 10 });
  // Anyone signed in reads it; only the Owner changes it.
  assert.equal((await call(jo.cookie, '/api/signing-in-settings')).status, 200);
  const refused = await put(jo.cookie, { trustPin: true });
  assert.deepEqual([refused.status, refused.body.code], [403, 'owner_only']);
  assert.deepEqual((await put(owner.cookie, { trustPin: true })).body, { trustPin: true, workshopIdleMinutes: 10 });
  assert.deepEqual((await put(owner.cookie, { workshopIdleMinutes: 5 })).body, { trustPin: true, workshopIdleMinutes: 5 });
  // Off is null.
  assert.deepEqual((await put(owner.cookie, { workshopIdleMinutes: null })).body, { trustPin: true, workshopIdleMinutes: null });
  for (const body of [{ workshopIdleMinutes: 7 }, { workshopIdleMinutes: '10' }, { workshopIdleMinutes: 60 }, { trustPin: 'yes' }, { trustPin: null }, {}]) {
    assert.equal((await put(owner.cookie, body)).status, 400, JSON.stringify(body));
  }
  assert.deepEqual((await call(owner.cookie, '/api/signing-in-settings')).body, { trustPin: true, workshopIdleMinutes: null });
  // Another shop's settings are its own.
  const other = await shop();
  assert.deepEqual((await call(other.cookie, '/api/signing-in-settings')).body, { trustPin: false, workshopIdleMinutes: 10 });
});

test('the workshop computer waits the shop’s time: always 10 minutes with trust PIN off, the chosen time with it on, never with Off', async () => {
  const owner = await shop();
  const alex = await member(owner, 'Alex Morgan', { mechanic: true });
  const w = await workshop(owner);
  // Trust PIN off: 5 minutes chosen still means 10.
  await run(owner, 'UPDATE shops SET workshop_idle_minutes = 5 WHERE id = ?', owner.shop.id);
  assert.equal((await checkin(w)).idleMinutes, 10);
  await checkIn(w, alex.pin);
  await idleFor(owner, w, 9);
  assert.equal((await checkin(w)).serving?.name, 'Alex Morgan');
  await idleFor(owner, w, 10);
  assert.equal((await checkin(w)).serving, null);
  // Trust PIN on with 5 minutes.
  await put(owner.cookie, { trustPin: true });
  assert.equal((await checkin(w)).idleMinutes, 5);
  await checkIn(w, alex.pin);
  await idleFor(owner, w, 4);
  assert.equal((await checkin(w)).serving?.name, 'Alex Morgan');
  await idleFor(owner, w, 5);
  assert.equal((await checkin(w)).serving, null);
  // Off: never.
  await put(owner.cookie, { workshopIdleMinutes: null });
  assert.equal((await checkin(w)).idleMinutes, null);
  await checkIn(w, alex.pin);
  await idleFor(owner, w, 600);
  assert.equal((await checkin(w)).serving?.name, 'Alex Morgan');
  // Trust PIN off again: back to 10 minutes.
  await put(owner.cookie, { trustPin: false });
  assert.equal((await checkin(w)).serving, null);
});

test('the Owner’s own check-in on a workshop computer ends after 10 minutes at most, whatever the setting (until Owner pages ask for a PIN)', async () => {
  const owner = await shop();
  const ownerPin = await newPin(owner.cookie);
  const alex = await member(owner, 'Alex Morgan', { mechanic: true });
  const w = await workshop(owner);
  await put(owner.cookie, { trustPin: true, workshopIdleMinutes: null });
  // Off: Alex stays, but the Owner goes after 10 minutes, and the screen is told 10.
  await checkIn(w, ownerPin);
  assert.equal((await checkin(w)).idleMinutes, 10);
  await idleFor(owner, w, 9);
  assert.equal((await checkin(w)).serving?.name, 'Jack Lewis');
  await idleFor(owner, w, 10);
  assert.equal((await checkin(w)).serving, null, 'the Owner gone after 10 minutes with Off');
  await checkIn(w, alex.pin);
  assert.equal((await checkin(w)).idleMinutes, null);
  await idleFor(owner, w, 600);
  assert.equal((await checkin(w)).serving?.name, 'Alex Morgan');
  // 30 minutes: still 10 for the Owner.
  await put(owner.cookie, { workshopIdleMinutes: 30 });
  await checkIn(w, ownerPin);
  await idleFor(owner, w, 10);
  assert.equal((await checkin(w)).serving, null, 'the Owner gone after 10 minutes with 30 chosen');
  // 5 minutes: shorter, so 5 for the Owner too.
  await put(owner.cookie, { workshopIdleMinutes: 5 });
  await checkIn(w, ownerPin);
  assert.equal((await checkin(w)).idleMinutes, 5);
  await idleFor(owner, w, 5);
  assert.equal((await checkin(w)).serving, null, 'the Owner gone after 5 minutes with 5 chosen');
});
