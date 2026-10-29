// Set up this till, check-ins per till, and the till's name
// (openspec/changes/till-setup; drawn as till-setup in signin.mjs and
// set-till-tills-owner in setup.mjs; signing in 9; roles and switches 2;
// stage-1 gaps 4). The Owner makes a computer a till; the browser keeps it in
// a cookie of its own, the server only its hash; a check-in belongs to the
// till it was made on; the float check records its till; Today has a line
// per till. The server's clock is pinned to 1 Sep 2026.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { hashLinkCode } from '../server/booking-link.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { tillRequest } from './helpers/till.js';

let server;
const shops = [];
before(async () => {
  // Trusting the proxy's x-forwarded-proto, so a cookie over HTTPS can be checked for Secure.
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
});
after(async () => {
  for (const s of shops) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
});

const call = (cookie, path, options) => staffRequest(server.baseUrl, cookie, path, options);
const post = (cookie, path, body) => call(cookie, path, { method: 'POST', body });
const row = (owner, sql, ...args) => runWithShop(owner.shop.id, () => prepare(sql).get(...args));

async function shop({ site = true } = {}) {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  assert.equal((await call(owner.cookie, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: 15000 } })).status, 200);
  if (site) owner.site = (await post(owner.cookie, '/api/sites', { name: 'Bolton', code: 'B' })).body;
  return owner;
}
async function member(owner, name) {
  const made = await post(owner.cookie, '/api/team', { name, isCashier: true, isMechanic: false, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const cookie = await staffFreshCookie(made.body.loginId);
  const offer = await post(cookie, '/api/your-settings/till-pin/offer');
  assert.equal((await post(cookie, '/api/your-settings/till-pin', { pin: offer.body.pin })).status, 200);
  return { cookie, pin: offer.body.pin, loginId: made.body.loginId };
}

// A browser: the Owner's sign-in plus whatever cookies the server gives it.
function browser(owner) {
  const jar = new Map();
  const cookie = () => [owner.cookie, ...[...jar].map(([k, v]) => `${k}=${v}`)].join('; ');
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
const setUp = (b, owner, number, name = '') => b.send('/api/till-setup', { method: 'POST', body: { siteId: owner.site.id, number, name } });

test('Set up this till is the Owner\'s, with the shop\'s sites and the numbers in use', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  assert.equal((await call(jo.cookie, '/api/till-setup')).status, 403);
  assert.deepEqual((await post(jo.cookie, '/api/till-setup', { siteId: owner.site.id, number: 1 })).body.code, 'owner_only');
  assert.deepEqual((await call(owner.cookie, '/api/till-setup')).body, {
    sites: [{ id: owner.site.id, name: 'Bolton', code: 'B', taken: [] }], thisTill: null, thisWorkshop: null, tills: [],
  });
  // A till switched off keeps its number.
  const old = (await post(owner.cookie, '/api/tills', { siteId: owner.site.id, number: 2, name: 'Back office' })).body.till;
  assert.equal((await post(owner.cookie, `/api/tills/${old.id}/deactivate`)).status, 200);
  await setUp(browser(owner), owner, 1, 'Front counter');
  const later = (await call(owner.cookie, '/api/till-setup')).body;
  assert.deepEqual(later.sites[0].taken, [1, 2]);
  assert.deepEqual(later.tills, ['B1']);
});

test('Make this computer a till: the cookie holds the till, the server only its hash', async () => {
  const owner = await shop();
  const b = browser(owner);
  const made = await setUp(b, owner, 1, '  Front counter ');
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.deepEqual({ ...made.body.till, id: 0 }, { id: 0, code: 'B1', name: 'Front counter', siteName: 'Bolton' });
  const line = made.setCookie.find((l) => l.startsWith('wh_till='));
  assert.match(line, /HttpOnly/);
  assert.match(line, /SameSite=Lax/);
  const token = b.jar.get('wh_till');
  assert.match(token, /^[0-9a-f]{64}$/);
  const stored = await row(owner, 'SELECT token_hash, browser_token_hash FROM tills WHERE id = ?', made.body.till.id);
  assert.equal(stored.browser_token_hash, hashLinkCode(token));
  assert.notEqual(stored.token_hash, hashLinkCode(token), 'the browser\'s token is not the offline till\'s');
  assert.ok(!JSON.stringify(made.body).includes(token), 'the token is never in the reply');
  assert.deepEqual((await b.send('/api/till-setup')).body.thisTill, { id: made.body.till.id, code: 'B1', name: 'Front counter', siteName: 'Bolton' });
  // Signing in as someone else on that computer leaves it the till.
  const jo = await member(owner, 'Jo Taylor');
  const asJo = await fetch(`${server.baseUrl}/api/till-checkin`, { headers: { cookie: `${jo.cookie}; wh_till=${token}` } });
  assert.deepEqual((await asJo.json()).till, { code: 'B1', name: 'Front counter', siteName: 'Bolton' });
});

test('a computer is one till; a number in use, a blank name and bad details', async () => {
  const owner = await shop();
  const b1 = browser(owner);
  assert.equal((await setUp(b1, owner, 1)).status, 201);
  assert.equal((await row(owner, "SELECT name FROM tills WHERE code = 'B1'")).name, null, 'a blank name is none');
  const again = await setUp(b1, owner, 2);
  assert.deepEqual([again.status, again.body.code], [409, 'already_a_till']);
  assert.equal((await row(owner, "SELECT count(*)::int AS n FROM tills")).n, 1);
  const other = browser(owner);
  const taken = await setUp(other, owner, 1);
  assert.deepEqual([taken.status, taken.body.code], [409, 'taken']);
  assert.equal((await setUp(other, owner, 0)).status, 400);
  assert.equal((await setUp(other, owner, 100)).status, 400);
  assert.equal((await setUp(other, owner, 2, 'x'.repeat(61))).status, 400);
  const elsewhere = await shop();
  assert.equal((await other.send('/api/till-setup', { method: 'POST', body: { siteId: elsewhere.site.id, number: 2 } })).status, 400, 'not another shop\'s site');
  assert.equal(other.jar.has('wh_till'), false, 'nothing refused sets a till');
});

test('a check-in counts only on the till it was made on, and Checked in today is that till\'s', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const alex = await member(owner, 'Alex Morgan');
  const b1 = browser(owner);
  const b2 = browser(owner);
  const plain = browser(owner);
  await setUp(b1, owner, 1);
  await setUp(b2, owner, 2);
  assert.equal((await b1.send('/api/till-checkin', { method: 'POST', body: { pin: jo.pin } })).status, 201);
  assert.equal((await plain.send('/api/till-checkin', { method: 'POST', body: { pin: alex.pin } })).status, 201);
  const onB1 = (await b1.send('/api/till-checkin')).body;
  assert.deepEqual([onB1.serving.name, onB1.checkedInToday.map((p) => p.name), onB1.till.code], ['Jo Taylor', ['Jo Taylor'], 'B1']);
  const onB2 = (await b2.send('/api/till-checkin')).body;
  assert.deepEqual([onB2.serving, onB2.checkedInToday, onB2.till.code], [null, [], 'B2']);
  const onPlain = (await plain.send('/api/till-checkin')).body;
  assert.deepEqual([onPlain.serving.name, onPlain.checkedInToday.map((p) => p.name), onPlain.till], ['Alex Morgan', ['Alex Morgan'], null]);
  // Jo's check-in, carried to Till B2, doesn't count there.
  b2.jar.set('wh_till_checkin', b1.jar.get('wh_till_checkin'));
  assert.equal((await b2.send('/api/till-checkin')).body.serving, null);
  assert.equal((await row(owner, 'SELECT t.code FROM pin_checkins c JOIN tills t ON t.id = c.till_id WHERE c.employee_id = (SELECT employee_id FROM logins WHERE id = ?)', jo.loginId)).code, 'B1');
  // The browser checked in before it was a till: after setup, nobody is
  // serving. (The Owner takes over first: nobody else sets up a till.)
  assert.equal((await plain.send('/api/till-checkin', { method: 'POST', body: { pin: await ownerPin(owner) } })).status, 201);
  assert.equal((await plain.send('/api/till-checkin')).body.serving.name, 'Jack Lewis');
  assert.equal((await setUp(plain, owner, 3)).status, 201);
  assert.equal((await plain.send('/api/till-checkin')).body.serving, null);
});

test('another shop\'s till, or one switched off, is no till', async () => {
  const owner = await shop();
  const b = browser(owner);
  const made = (await setUp(b, owner, 1)).body.till;
  const elsewhere = await shop();
  const there = await fetch(`${server.baseUrl}/api/till-checkin`, { headers: { cookie: `${elsewhere.cookie}; wh_till=${b.jar.get('wh_till')}` } });
  assert.equal((await there.json()).till, null);
  assert.equal((await post(owner.cookie, `/api/tills/${made.id}/deactivate`)).status, 200);
  assert.equal((await b.send('/api/till-checkin')).body.till, null);
  assert.equal((await b.send('/api/till-setup')).body.thisTill, null);
});

test('the float check records its till; Today has a line per till, and the short float names it', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const alex = await member(owner, 'Alex Morgan');
  const b1 = browser(owner);
  const b2 = browser(owner);
  await setUp(b1, owner, 1);
  await setUp(b2, owner, 2);
  const lines = async () => (await call(owner.cookie, '/api/today/tills')).body.tills;
  assert.deepEqual(await lines(), [
    { code: 'B1', openedAt: null, openedBy: null, floatCheck: null },
    { code: 'B2', openedAt: null, openedBy: null, floatCheck: null },
  ]);
  await b1.send('/api/till-checkin', { method: 'POST', body: { pin: jo.pin } });
  const checked = await b1.send('/api/float-check', { method: 'POST', body: { countedPence: 14000, reason: '' } });
  assert.equal(checked.status, 201);
  assert.equal(checked.body.check.tillCode, 'B1');
  // One a shop a day: Till B2 is not asked again.
  await b2.send('/api/till-checkin', { method: 'POST', body: { pin: alex.pin } });
  assert.equal((await b2.send('/api/float-check')).body.check.tillCode, 'B1');
  assert.equal((await b2.send('/api/float-check', { method: 'POST', body: { countedPence: null } })).body.code, 'already_checked');
  const [l1, l2] = await lines();
  assert.deepEqual([l1.code, l1.openedBy, l1.floatCheck.byName, l1.floatCheck.short], ['B1', 'Jo Taylor', 'Jo Taylor', true]);
  assert.deepEqual([l2.code, l2.openedBy, l2.floatCheck], ['B2', 'Alex Morgan', null]);
  const short = (await call(owner.cookie, '/api/needs-attention')).body.items.find((i) => i.kind === 'float_short');
  assert.equal(short.tillCode, 'B1');
  // A check-in on a browser that isn't a till adds the line with no number.
  const plain = browser(owner);
  await plain.send('/api/till-checkin', { method: 'POST', body: { pin: jo.pin } });
  assert.deepEqual((await lines()).map((l) => [l.code, l.openedBy]), [['B1', 'Jo Taylor'], ['B2', 'Alex Morgan'], [null, 'Jo Taylor']]);
});

test('with no till set up, Tills is one line with no number, as before', async () => {
  const owner = await shop({ site: false });
  assert.deepEqual((await call(owner.cookie, '/api/today/tills')).body, { tills: [{ code: null, openedAt: null, openedBy: null, floatCheck: null }] });
  assert.deepEqual((await call(owner.cookie, '/api/till-setup')).body, { sites: [], thisTill: null, thisWorkshop: null, tills: [] });
});

// Review, 28 Oct (the lead's independent review of jack/till-setup).
async function ownerPin(owner) {
  const offer = await post(owner.cookie, '/api/your-settings/till-pin/offer');
  assert.equal(offer.status, 201, JSON.stringify(offer.body));
  assert.equal((await post(owner.cookie, '/api/your-settings/till-pin', { pin: offer.body.pin })).status, 200);
  return offer.body.pin;
}

test('the browser\'s cookie is never the offline till\'s token, and the other way round', async () => {
  const owner = await shop();
  const b = browser(owner);
  assert.equal((await setUp(b, owner, 1)).status, 201);
  const cookieToken = b.jar.get('wh_till');
  // Copied out of the browser, it opens neither the till's copy nor its sync.
  assert.equal((await tillRequest(server.baseUrl, owner.shop.slug, cookieToken, '/snapshot')).status, 401);
  assert.equal((await tillRequest(server.baseUrl, owner.shop.slug, cookieToken, '/sync', { method: 'POST', body: { items: [] } })).status, 401);
  // The offline till's own token, put in the cookie, is no till.
  const offline = (await post(owner.cookie, '/api/tills', { siteId: owner.site.id, number: 2, name: 'Back office' })).body;
  assert.equal((await tillRequest(server.baseUrl, owner.shop.slug, offline.token, '/snapshot')).status, 200, 'the offline token still works as a Bearer');
  const asCookie = await fetch(`${server.baseUrl}/api/till-checkin`, { headers: { cookie: `${owner.cookie}; wh_till=${offline.token}` } });
  assert.equal((await asCookie.json()).till, null);
});

test('the cookie is renewed whenever it matches, and is Secure over HTTPS', async () => {
  const owner = await shop();
  const b = browser(owner);
  const made = await setUp(b, owner, 1);
  assert.ok(!made.setCookie.find((l) => l.startsWith('wh_till=')).includes('Secure'), 'plain HTTP: not Secure');
  const token = b.jar.get('wh_till');
  const https = { 'x-forwarded-proto': 'https' };
  const read = await b.send('/api/till-checkin', { headers: https });
  const renewed = read.setCookie.find((l) => l.startsWith('wh_till='));
  assert.ok(renewed, 'renewed on reading the till');
  assert.match(renewed, new RegExp(`^wh_till=${token};`));
  assert.match(renewed, /Max-Age=34560000/);
  assert.match(renewed, /; Secure/);
  const other = browser(owner);
  const setUpOverHttps = await other.send('/api/till-setup', { method: 'POST', body: { siteId: owner.site.id, number: 2 }, headers: https });
  assert.match(setUpOverHttps.setCookie.find((l) => l.startsWith('wh_till=')), /; Secure/);
  // A browser that isn't a till gets no till cookie.
  const plain = browser(owner);
  assert.equal((await plain.send('/api/till-checkin')).setCookie.some((l) => l.startsWith('wh_till=')), false);
});

test('the Owner re-claims a till number on this computer; the old browser stops being that till', async () => {
  const owner = await shop();
  const old = browser(owner);
  await setUp(old, owner, 1, 'Front counter');
  const fresh = browser(owner);
  const refused = await setUp(fresh, owner, 1);
  assert.deepEqual([refused.status, refused.body.code], [409, 'taken'], 'not without asking to re-claim');
  const claimed = await fresh.send('/api/till-setup', { method: 'POST', body: { siteId: owner.site.id, number: 1, reclaim: true } });
  assert.equal(claimed.status, 200, JSON.stringify(claimed.body));
  assert.deepEqual([claimed.body.till.code, claimed.body.till.name], ['B1', 'Front counter']);
  assert.equal((await fresh.send('/api/till-checkin')).body.till.code, 'B1');
  assert.equal((await old.send('/api/till-checkin')).body.till, null, 'the lost or old browser is no till');
  assert.equal((await row(owner, "SELECT count(*)::int AS n FROM tills WHERE code = 'B1'")).n, 1);
  const jo = await member(owner, 'Jo Taylor');
  assert.equal((await post(jo.cookie, '/api/till-setup', { siteId: owner.site.id, number: 1, reclaim: true })).status, 403);
});

test('nobody but the Owner checked in on that browser can set up a till there', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const b = browser(owner);
  assert.equal((await b.send('/api/till-checkin', { method: 'POST', body: { pin: jo.pin } })).status, 201);
  const refused = await setUp(b, owner, 1);
  assert.deepEqual([refused.status, refused.body.code], [403, 'not_owner_checked_in']);
  assert.equal(b.jar.has('wh_till'), false);
  // The Owner checked in by PIN may.
  assert.equal((await b.send('/api/till-checkin', { method: 'POST', body: { pin: await ownerPin(owner) } })).status, 201);
  assert.equal((await setUp(b, owner, 1)).status, 201);
});

test('Today: a till switched off today keeps its line, and each line takes its earliest check-in', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const alex = await member(owner, 'Alex Morgan');
  const b1 = browser(owner);
  const b2 = browser(owner);
  const madeB1 = (await setUp(b1, owner, 1)).body.till;
  await setUp(b2, owner, 2);
  await b2.send('/api/till-checkin', { method: 'POST', body: { pin: jo.pin } });
  await b2.send('/api/till-checkin', { method: 'POST', body: { pin: alex.pin } });
  await runWithShop(owner.shop.id, () => prepare("UPDATE pin_checkins SET checked_in_at = checked_in_at - interval '1 hour' WHERE employee_id = (SELECT employee_id FROM logins WHERE id = ?)").run(alex.loginId));
  await b1.send('/api/till-checkin', { method: 'POST', body: { pin: jo.pin } });
  assert.equal((await post(owner.cookie, `/api/tills/${madeB1.id}/deactivate`)).status, 200);
  const lines = (await call(owner.cookie, '/api/today/tills')).body.tills;
  assert.deepEqual(lines.map((l) => [l.code, l.openedBy]), [['B1', 'Jo Taylor'], ['B2', 'Alex Morgan']]);
});

test('the Owner\'s look at closing records no till, even checked in on one', async () => {
  const owner = await shop();
  const b = browser(owner);
  await setUp(b, owner, 1);
  assert.equal((await b.send('/api/till-checkin', { method: 'POST', body: { pin: await ownerPin(owner) } })).status, 201);
  // Shut on Tuesdays (1 Sep 2026), so "Close the day" shows all day.
  assert.equal((await call(owner.cookie, '/api/workshop-settings', { method: 'PUT', body: { openingHours: [{ weekday: 1, open: '09:00', close: '17:00' }] } })).status, 200);
  const look = await b.send('/api/float-check', { method: 'POST', body: { countedPence: null, atClose: true } });
  assert.equal(look.status, 201, JSON.stringify(look.body));
  assert.equal(look.body.check.tillCode, null);
  // Today: no stray "Till · Not open yet" line for it when every till is set up (second review).
  assert.deepEqual((await call(owner.cookie, '/api/today/tills')).body.tills.map((l) => l.code), ['B1']);
  // The same with nobody checked in: the look alone adds no line.
  const quiet = await shop();
  await setUp(browser(quiet), quiet, 1);
  assert.equal((await call(quiet.cookie, '/api/workshop-settings', { method: 'PUT', body: { openingHours: [{ weekday: 1, open: '09:00', close: '17:00' }] } })).status, 200);
  assert.equal((await post(quiet.cookie, '/api/float-check', { countedPence: null, atClose: true })).status, 201);
  assert.deepEqual((await call(quiet.cookie, '/api/today/tills')).body.tills.map((l) => [l.code, l.openedAt]), [['B1', null]]);
});

test('re-claiming: not a switched-off till, not another shop\'s site; a switched-off till\'s cookie isn\'t renewed (second review)', async () => {
  const owner = await shop();
  const old = browser(owner);
  const made = (await setUp(old, owner, 1)).body.till;
  assert.equal((await post(owner.cookie, `/api/tills/${made.id}/deactivate`)).status, 200);
  const off = await old.send('/api/till-checkin');
  assert.equal(off.body.till, null);
  assert.equal(off.setCookie.some((l) => l.startsWith('wh_till=')), false, 'a switched-off till\'s cookie is not renewed');
  const fresh = browser(owner);
  const switchedOff = await fresh.send('/api/till-setup', { method: 'POST', body: { siteId: owner.site.id, number: 1, reclaim: true } });
  assert.deepEqual([switchedOff.status, switchedOff.body.code], [409, 'taken']);
  const elsewhere = await shop();
  const foreign = await fresh.send('/api/till-setup', { method: 'POST', body: { siteId: elsewhere.site.id, number: 1, reclaim: true } });
  assert.equal(foreign.status, 400);
  assert.equal(fresh.jar.has('wh_till'), false);
});

test('tills go in number order: B2 before B10', async () => {
  const owner = await shop();
  await setUp(browser(owner), owner, 10);
  await setUp(browser(owner), owner, 2);
  assert.deepEqual((await call(owner.cookie, '/api/till-setup')).body.tills, ['B2', 'B10']);
  assert.deepEqual((await call(owner.cookie, '/api/today/tills')).body.tills.map((l) => l.code), ['B2', 'B10']);
});

test('two set-ups racing for one number: one is made, the other is told it is taken', async () => {
  const owner = await shop();
  const answers = await Promise.all([setUp(browser(owner), owner, 1), setUp(browser(owner), owner, 1)]);
  assert.deepEqual(answers.map((a) => a.status).sort(), [201, 409]);
  assert.equal(answers.find((a) => a.status === 409).body.code, 'taken');
  assert.equal((await row(owner, "SELECT count(*)::int AS n FROM tills WHERE code = 'B1'")).n, 1);
});
