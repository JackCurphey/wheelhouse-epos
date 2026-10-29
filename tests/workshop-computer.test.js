// The shared workshop computer, first part (openspec/changes/workshop-computer;
// drawn as till-checkin-workshop in signin.mjs; walk-through 8 decisions 1
// and 3; build plan Q6; stage-1 gaps 4). The Owner makes a computer a
// workshop computer; the browser keeps it in a cookie of its own, the server
// only its hash; a check-in belongs to the workshop computer it was made on;
// and the server stops counting it 10 minutes after it was last used.
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
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
});
after(async () => {
  for (const s of shops) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
});

const call = (cookie, path, options) => staffRequest(server.baseUrl, cookie, path, options);
const post = (cookie, path, body) => call(cookie, path, { method: 'POST', body });
const row = (owner, sql, ...args) => runWithShop(owner.shop.id, () => prepare(sql).get(...args));
const run = (owner, sql, ...args) => runWithShop(owner.shop.id, () => prepare(sql).run(...args));

async function shop() {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  owner.site = (await post(owner.cookie, '/api/sites', { name: 'Bolton', code: 'B' })).body;
  return owner;
}
async function member(owner, name, { mechanic = false } = {}) {
  const made = await post(owner.cookie, '/api/team', { name, isCashier: !mechanic, isMechanic: mechanic, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const cookie = await staffFreshCookie(made.body.loginId);
  const offer = await post(cookie, '/api/your-settings/till-pin/offer');
  assert.equal((await post(cookie, '/api/your-settings/till-pin', { pin: offer.body.pin })).status, 200);
  return { cookie, pin: offer.body.pin, loginId: made.body.loginId };
}

// A browser: the Owner's sign-in plus whatever cookies the server gives it.
function browser(owner) {
  const jar = new Map();
  const cookie = () => [owner.cookie, ...[...jar].filter(([, v]) => v).map(([k, v]) => `${k}=${v}`)].join('; ');
  async function send(path, { method = 'GET', body, headers = {} } = {}) {
    const res = await fetch(`${server.baseUrl}${path}`, {
      method, headers: { cookie: cookie(), ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const lines = res.headers.getSetCookie();
    for (const line of lines) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, setCookie: lines };
  }
  return { send, jar, cookie };
}
const makeWorkshop = (b, owner, name = '') => b.send('/api/till-setup/workshop', { method: 'POST', body: { siteId: owner.site.id, name } });
const checkIn = (b, pin) => b.send('/api/till-checkin', { method: 'POST', body: { pin } });
const serving = async (b) => (await b.send('/api/till-checkin')).body.serving;
// The check-in on this browser was last used `minutes` ago.
const idleFor = (owner, b, minutes) => run(owner, `UPDATE pin_checkins SET last_active_at = now() - interval '${minutes} minutes' WHERE token_hash = ?`, hashLinkCode(b.jar.get('wh_till_checkin')));

test('make this computer a workshop computer: the Owner only, the cookie holds it, the server only its hash', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const refused = await post(jo.cookie, '/api/till-setup/workshop', { siteId: owner.site.id });
  assert.deepEqual([refused.status, refused.body.code], [403, 'owner_only']);
  const b = browser(owner);
  const made = await makeWorkshop(b, owner, '  Back bench ');
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.deepEqual({ ...made.body.workshop, id: 0 }, { id: 0, name: 'Back bench', siteName: 'Bolton' });
  const line = made.setCookie.find((l) => l.startsWith('wh_workshop='));
  assert.match(line, /HttpOnly/);
  assert.match(line, /SameSite=Lax/);
  assert.match(line, /Max-Age=34560000/);
  const token = b.jar.get('wh_workshop');
  assert.match(token, /^[0-9a-f]{64}$/);
  const stored = await row(owner, 'SELECT browser_token_hash, site_id FROM workshop_computers WHERE id = ?', made.body.workshop.id);
  assert.equal(stored.browser_token_hash, hashLinkCode(token));
  assert.equal(stored.site_id, owner.site.id);
  assert.ok(!JSON.stringify(made.body).includes(token), 'the key is never in the reply');
  // The check-in knows it; it is no till. The setup is the Owner's, and with
  // nobody working here the Owner's sign-in isn't the Owner (design 9).
  assert.equal((await b.send('/api/till-setup')).status, 403);
  const checkin = (await b.send('/api/till-checkin')).body;
  assert.deepEqual([checkin.workshop, checkin.till], [{ name: 'Back bench', siteName: 'Bolton' }, null]);
  // Signing in as someone else on that computer leaves it a workshop computer.
  const asJo = await fetch(`${server.baseUrl}/api/till-checkin`, { headers: { cookie: `${jo.cookie}; wh_workshop=${token}` } });
  assert.deepEqual((await asJo.json()).workshop, { name: 'Back bench', siteName: 'Bolton' });
  // Who's signed in says it is a workshop computer, so a screen that can't
  // read the check-in still shows no pages (the review, 29 Oct).
  assert.equal((await b.send('/api/auth/me')).body.workshopComputer, true);
  assert.equal((await call(owner.cookie, '/api/auth/me')).body.workshopComputer, false);
  // A blank name is none.
  const other = browser(owner);
  assert.equal((await makeWorkshop(other, owner, '   ')).body.workshop.name, null);
});

test('a computer is one till or one workshop computer; bad details are refused', async () => {
  const owner = await shop();
  const b = browser(owner);
  assert.equal((await makeWorkshop(b, owner)).status, 201);
  // With nobody working there, the Owner's sign-in can't set up anything on it.
  const again = await makeWorkshop(b, owner);
  assert.deepEqual([again.status, again.body.code], [403, 'owner_only']);
  const t = browser(owner);
  assert.equal((await t.send('/api/till-setup', { method: 'POST', body: { siteId: owner.site.id, number: 1 } })).status, 201);
  const onTill = await makeWorkshop(t, owner);
  assert.deepEqual([onTill.status, onTill.body.code], [409, 'already_a_till']);
  const fresh = browser(owner);
  assert.equal((await fresh.send('/api/till-setup/workshop', { method: 'POST', body: { siteId: 999999 } })).status, 400);
  assert.equal((await makeWorkshop(fresh, owner, 'x'.repeat(61))).status, 400);
  assert.equal((await row(owner, 'SELECT count(*)::int AS n FROM workshop_computers')).n, 1);
  // Another shop's workshop computer is no workshop computer here.
  const elsewhere = await shop();
  const theirs = await fetch(`${server.baseUrl}/api/till-checkin`, { headers: { cookie: `${elsewhere.cookie}; wh_workshop=${b.jar.get('wh_workshop')}` } });
  assert.equal((await theirs.json()).workshop, null);
});

test('nobody but the Owner checked in on that computer sets up a workshop computer there', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const b = browser(owner);
  assert.equal((await checkIn(b, jo.pin)).status, 201);
  const refused = await makeWorkshop(b, owner);
  assert.deepEqual([refused.status, refused.body.code], [403, 'not_owner_checked_in']);
});

test('a check-in counts only on the workshop computer it was made on; Checked in today is its own; no giving a PIN there', async () => {
  const owner = await shop();
  const alex = await member(owner, 'Alex Morgan', { mechanic: true });
  const jo = await member(owner, 'Jo Taylor');
  const ownerPin = (await post(owner.cookie, '/api/your-settings/till-pin/offer')).body.pin;
  assert.equal((await post(owner.cookie, '/api/your-settings/till-pin', { pin: ownerPin })).status, 200);
  const w = browser(owner);
  await makeWorkshop(w, owner);
  const plain = browser(owner);
  assert.equal((await checkIn(plain, jo.pin)).status, 201);
  assert.equal(await serving(w), null, 'a check-in on a browser that is neither doesn\'t count here');
  assert.equal((await checkIn(w, alex.pin)).status, 201);
  assert.equal((await serving(w)).name, 'Alex Morgan');
  assert.deepEqual((await w.send('/api/till-checkin')).body.checkedInToday.map((p) => p.name), ['Alex Morgan']);
  assert.ok((await row(owner, 'SELECT workshop_computer_id FROM pin_checkins WHERE employee_id = (SELECT id FROM employees WHERE name = ?)', 'Alex Morgan')).workshop_computer_id);
  // The workshop computer's check-in cookie, carried to a browser that is neither, counts for nobody.
  const moved = await fetch(`${server.baseUrl}/api/till-checkin`, { headers: { cookie: `${owner.cookie}; wh_till_checkin=${w.jar.get('wh_till_checkin')}` } });
  assert.equal((await moved.json()).serving, null);
  // The Owner checked in on the workshop computer gives no PIN here: that is the till's.
  await member(owner, 'Sam Price');
  await run(owner, "UPDATE employees SET pin_hash = NULL WHERE name = 'Sam Price'");
  assert.equal((await checkIn(w, ownerPin)).status, 201);
  assert.deepEqual((await w.send('/api/till-checkin')).body.givePin, []);
  const sam = await row(owner, "SELECT id FROM employees WHERE name = 'Sam Price'");
  assert.equal((await w.send(`/api/till-checkin/give-pin/${sam.id}/offer`, { method: 'POST' })).status, 403);
});

test('left alone for 10 minutes, the server stops counting the check-in; using it keeps it', async () => {
  const owner = await shop();
  const alex = await member(owner, 'Alex Morgan', { mechanic: true });
  const w = browser(owner);
  await makeWorkshop(w, owner);
  assert.equal((await checkIn(w, alex.pin)).status, 201);
  // Used 9 minutes ago: still Alex; and using it now starts the 10 minutes again.
  await idleFor(owner, w, 9);
  const used = await w.send('/api/till-checkin/active', { method: 'POST' });
  assert.deepEqual([used.status, used.body.serving?.name], [200, 'Alex Morgan']);
  const last = await row(owner, 'SELECT last_active_at > now() - interval \'1 minute\' AS fresh FROM pin_checkins WHERE token_hash = ?', hashLinkCode(w.jar.get('wh_till_checkin')));
  assert.equal(last.fresh, true);
  // Reading the check-in is not using it.
  await idleFor(owner, w, 9);
  assert.equal((await serving(w)).name, 'Alex Morgan');
  const after9 = await row(owner, 'SELECT last_active_at < now() - interval \'8 minutes\' AS old FROM pin_checkins WHERE token_hash = ?', hashLinkCode(w.jar.get('wh_till_checkin')));
  assert.equal(after9.old, true, 'reading it didn\'t move the time');
  // 10 minutes: nobody, and it is ended for good; using it now brings nobody back.
  await idleFor(owner, w, 10);
  assert.equal(await serving(w), null);
  const ended = await row(owner, 'SELECT ended_at FROM pin_checkins WHERE token_hash = ?', hashLinkCode(w.jar.get('wh_till_checkin')));
  assert.ok(ended.ended_at, 'the check-in is ended');
  await run(owner, 'UPDATE pin_checkins SET last_active_at = now() WHERE token_hash = ?', hashLinkCode(w.jar.get('wh_till_checkin')));
  const late = await w.send('/api/till-checkin/active', { method: 'POST' });
  assert.deepEqual([late.status, late.body.serving], [200, null]);
  assert.equal(await serving(w), null);
});

// Owner pages on a workshop computer (the lead, 28 Oct, standing in for
// stage-1 gaps 1 until roles): the Owner's sign-in counts as the Owner there
// only while the person checked in by PIN is the Owner (giverHere's rule).
test('on a workshop computer the Owner\'s sign-in is the Owner only while the Owner is checked in', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const ownerPin = (await post(owner.cookie, '/api/your-settings/till-pin/offer')).body.pin;
  assert.equal((await post(owner.cookie, '/api/your-settings/till-pin', { pin: ownerPin })).status, 200);
  const w = browser(owner);
  assert.equal((await makeWorkshop(w, owner)).status, 201);
  // An Owner-only route (ownerOnly), one checked inline (the setup), and /api/auth/me.
  const owners = async () => {
    const service = await w.send('/api/workshop-services', { method: 'POST', body: {} });
    const setup = await w.send('/api/till-setup');
    const me = await w.send('/api/auth/me');
    return { service: service.status === 403 ? service.body.code : 'allowed', setup: setup.status === 403 ? setup.body.code : 'allowed', isOwner: me.body.isOwner };
  };
  const refused = { service: 'owner_only', setup: 'owner_only', isOwner: false };
  const allowed = { service: 'allowed', setup: 'allowed', isOwner: true };
  assert.deepEqual(await owners(), refused, 'nobody working');
  assert.equal((await checkIn(w, jo.pin)).status, 201);
  assert.deepEqual(await owners(), refused, 'Jo working');
  assert.equal((await checkIn(w, ownerPin)).status, 201);
  assert.deepEqual(await owners(), allowed, 'Jack Lewis, the Owner, working');
  // The Owner working there: the setup knows it, and it is one workshop computer.
  assert.equal((await w.send('/api/till-setup')).body.thisWorkshop.siteName, 'Bolton');
  const again = await makeWorkshop(w, owner);
  assert.deepEqual([again.status, again.body.code], [409, 'already_a_workshop']);
  const till = await w.send('/api/till-setup', { method: 'POST', body: { siteId: owner.site.id, number: 1 } });
  assert.deepEqual([till.status, till.body.code], [409, 'already_a_workshop']);
  // Left alone 10 minutes: nobody working, so no Owner pages.
  await idleFor(owner, w, 11);
  assert.deepEqual(await owners(), refused, 'the Owner gone idle');
  // Elsewhere nothing changes: a till with Jo serving, and a plain browser.
  const t = browser(owner);
  assert.equal((await t.send('/api/till-setup', { method: 'POST', body: { siteId: owner.site.id, number: 1 } })).status, 201);
  assert.equal((await checkIn(t, jo.pin)).status, 201);
  assert.equal((await t.send('/api/auth/me')).body.isOwner, true, 'a till');
  assert.equal((await call(owner.cookie, '/api/auth/me')).body.isOwner, true, 'a plain browser');
  // Staff signed in on the workshop computer stay staff, whoever is working.
  const asJo = await fetch(`${server.baseUrl}/api/workshop-services`, { method: 'POST', headers: { cookie: `${jo.cookie}; wh_workshop=${w.jar.get('wh_workshop')}`, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(asJo.status, 403);
});

// The review, 29 Oct (high): staff working on a workshop computer the Owner
// signed in could get the Owner a new PIN, then check in as the Owner. On a
// workshop computer the sign-in's own PIN and settings are the sign-in's
// only while its own team member is the person working.
test('the reviewer\'s steps: Jo working on the Owner\'s workshop computer can\'t give the Owner a new PIN', async () => {
  const owner = await shop();
  const ownerPin = (await post(owner.cookie, '/api/your-settings/till-pin/offer')).body.pin;
  assert.equal((await post(owner.cookie, '/api/your-settings/till-pin', { pin: ownerPin })).status, 200);
  const jo = await member(owner, 'Jo Taylor');
  const b = browser(owner);
  assert.equal((await makeWorkshop(b, owner)).status, 201);
  assert.equal((await checkIn(b, jo.pin)).status, 201);
  const offer = await b.send('/api/your-settings/till-pin/offer', { method: 'POST' });
  assert.deepEqual([offer.status, offer.body.code, offer.body.pin], [403, 'not_your_account_here', undefined]);
  // Even with a PIN guessed at, keeping is refused, and nothing was offered.
  const keep = await b.send('/api/your-settings/till-pin', { method: 'POST', body: { pin: '1234' } });
  assert.deepEqual([keep.status, keep.body.code], [403, 'not_your_account_here']);
  assert.equal((await row(owner, 'SELECT pin_offer_hash FROM employees e JOIN logins l ON l.employee_id = e.id WHERE l.id = ?', owner.loginId)).pin_offer_hash, null);
  // "Your till PIN" never pops up for whoever is working, and Your settings aren't theirs to change.
  assert.equal((await b.send('/api/your-settings/till-pin/ask')).status, 403);
  assert.equal((await b.send('/api/your-settings/till-pin/ask', { method: 'POST' })).status, 403);
  assert.equal((await b.send('/api/your-settings/till-pin')).status, 403);
  assert.equal((await b.send('/api/your-settings', { method: 'PUT', body: { accessibility: { largerText: true } } })).status, 403);
  // Switch, then the PIN that was offered (none): nobody becomes the Owner; the Owner's own PIN still works.
  await b.send('/api/till-checkin/end', { method: 'POST', body: {} });
  assert.equal(await serving(b), null);
  assert.equal((await b.send('/api/till-setup')).status, 403);
  assert.equal((await checkIn(b, ownerPin)).status, 201);
  assert.equal((await serving(b)).name, 'Jack Lewis');
  // The Owner working there is his own team member: his PIN and settings are his.
  assert.equal((await b.send('/api/your-settings/till-pin')).status, 200);
  assert.equal((await b.send('/api/your-settings/till-pin/offer', { method: 'POST' })).status, 201);
  assert.equal((await b.send('/api/your-settings', { method: 'PUT', body: { accessibility: { largerText: true } } })).status, 200);
  // Nobody working: not his either.
  await b.send('/api/till-checkin/end', { method: 'POST', body: {} });
  assert.equal((await b.send('/api/your-settings/till-pin/offer', { method: 'POST' })).status, 403);
  // Off a workshop computer nothing changes: Jo's own sign-in, and the Owner's plain browser.
  assert.equal((await post(jo.cookie, '/api/your-settings/till-pin/offer')).status, 201);
  assert.equal((await post(owner.cookie, '/api/your-settings/till-pin/offer')).status, 201);
});

test('a staff sign-in on a workshop computer: their own PIN only while they are the one working', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const alex = await member(owner, 'Alex Morgan', { mechanic: true });
  const w = browser(owner);
  await makeWorkshop(w, owner);
  const token = w.jar.get('wh_workshop');
  // Jo's sign-in on the workshop computer, Alex working.
  const asJo = (path, method, cookie) => fetch(`${server.baseUrl}${path}`, { method, headers: { cookie } });
  const login = await fetch(`${server.baseUrl}/api/till-checkin`, { method: 'POST', headers: { cookie: `${jo.cookie}; wh_workshop=${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ pin: alex.pin }) });
  const checkinCookie = login.headers.getSetCookie().map((l) => l.split(';')[0]).find((p) => p.startsWith('wh_till_checkin='));
  const alexWorking = `${jo.cookie}; wh_workshop=${token}; ${checkinCookie}`;
  assert.equal((await asJo('/api/your-settings/till-pin/offer', 'POST', alexWorking)).status, 403);
  const joIn = await fetch(`${server.baseUrl}/api/till-checkin`, { method: 'POST', headers: { cookie: alexWorking, 'content-type': 'application/json' }, body: JSON.stringify({ pin: jo.pin }) });
  const joCookie = joIn.headers.getSetCookie().map((l) => l.split(';')[0]).find((p) => p.startsWith('wh_till_checkin='));
  assert.equal((await asJo('/api/your-settings/till-pin/offer', 'POST', `${jo.cookie}; wh_workshop=${token}; ${joCookie}`)).status, 201);
});

// The review, 29 Oct (medium): a workshop computer is no till, so its
// check-ins never make Today's "Till" line with no number; they stay in Who's in.
test('Today: a check-in on the workshop computer is in Who\'s in, not a till line', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const t = browser(owner);
  assert.equal((await t.send('/api/till-setup', { method: 'POST', body: { siteId: owner.site.id, number: 1 } })).status, 201);
  const w = browser(owner);
  await makeWorkshop(w, owner);
  assert.equal((await checkIn(w, jo.pin)).status, 201);
  const tills = (await call(owner.cookie, '/api/today/tills')).body.tills;
  assert.deepEqual(tills.map((l) => [l.code, l.openedBy]), [['B1', null]]);
  const whosIn = (await call(owner.cookie, '/api/today/whos-in')).body;
  assert.ok(JSON.stringify(whosIn).includes('Jo Taylor'), JSON.stringify(whosIn));
});

// The second review, 29 Oct: with nobody checked in on a workshop computer,
// the float check is refused there, by ownAccountHere's rule, even at closing.
test('the float check on a workshop computer with nobody working is refused', async () => {
  const owner = await shop();
  assert.equal((await call(owner.cookie, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: 15000 } })).status, 200);
  // Shut on Tuesdays, so "Close the day" shows all day and the Owner's look at closing would count.
  assert.equal((await call(owner.cookie, '/api/workshop-settings', { method: 'PUT', body: { openingHours: [{ weekday: 1, open: '09:00', close: '17:00' }] } })).status, 200);
  const w = browser(owner);
  await makeWorkshop(w, owner);
  const look = await w.send('/api/float-check', { method: 'POST', body: { countedPence: null, atClose: true } });
  assert.deepEqual([look.status, look.body.code], [403, 'not_your_account_here']);
  const count = await w.send('/api/float-check', { method: 'POST', body: { countedPence: 15000 } });
  assert.deepEqual([count.status, count.body.code], [403, 'not_your_account_here']);
  assert.equal((await row(owner, 'SELECT count(*)::int AS n FROM float_checks')).n, 0);
  // Off a workshop computer the Owner's look at closing still works.
  assert.equal((await post(owner.cookie, '/api/float-check', { countedPence: null, atClose: true })).status, 201);
});

// The second review, 29 Oct: a browser carrying a till's cookie and a
// workshop computer's is the till (a till's key wins), so /me says so.
test('a browser with both a till\'s and a workshop computer\'s cookie is not a workshop computer to /me', async () => {
  const owner = await shop();
  const w = browser(owner);
  await makeWorkshop(w, owner);
  const t = browser(owner);
  assert.equal((await t.send('/api/till-setup', { method: 'POST', body: { siteId: owner.site.id, number: 1 } })).status, 201);
  t.jar.set('wh_workshop', w.jar.get('wh_workshop'));
  assert.equal((await t.send('/api/auth/me')).body.workshopComputer, false);
  assert.equal((await t.send('/api/till-checkin')).body.till.code, 'B1');
});

test('a till never goes back by itself', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const t = browser(owner);
  assert.equal((await t.send('/api/till-setup', { method: 'POST', body: { siteId: owner.site.id, number: 1 } })).status, 201);
  assert.equal((await checkIn(t, jo.pin)).status, 201);
  await idleFor(owner, t, 120);
  assert.equal((await serving(t)).name, 'Jo Taylor');
  const plain = browser(owner);
  assert.equal((await checkIn(plain, jo.pin)).status, 201);
  await idleFor(owner, plain, 120);
  assert.equal((await serving(plain)).name, 'Jo Taylor');
});

test('the workshop computer\'s cookie is renewed whenever it matches, and is Secure over HTTPS', async () => {
  const owner = await shop();
  const b = browser(owner);
  const made = await b.send('/api/till-setup/workshop', { method: 'POST', body: { siteId: owner.site.id }, headers: { 'x-forwarded-proto': 'https' } });
  assert.match(made.setCookie.find((l) => l.startsWith('wh_workshop=')), /; Secure/);
  const read = await b.send('/api/till-checkin');
  assert.ok(read.setCookie.some((l) => l.startsWith(`wh_workshop=${b.jar.get('wh_workshop')}`)), 'renewed');
  const none = await browser(owner).send('/api/till-checkin');
  assert.ok(!none.setCookie.some((l) => l.startsWith('wh_workshop=')), 'no cookie for a browser that isn\'t one');
});
