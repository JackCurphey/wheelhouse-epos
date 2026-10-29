// The workshop computer's Owner lock, held on the server
// (openspec/changes/workshop-lock-server; 29 Oct answer 4; walk-through 8
// decision 3; workshop computer design 9). A signed-in session used on a
// workshop computer is recorded as that computer's; it counts as the Owner
// only while the Owner is checked in by PIN there, whatever cookies the
// browser sends, until it signs out. The server's clock is pinned to 1 Sep 2026.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
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

async function shop() {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  owner.site = (await post(owner.cookie, '/api/sites', { name: 'Bolton', code: 'B' })).body;
  const offer = await post(owner.cookie, '/api/your-settings/till-pin/offer');
  assert.equal((await post(owner.cookie, '/api/your-settings/till-pin', { pin: offer.body.pin })).status, 200);
  owner.pin = offer.body.pin;
  return owner;
}

// A browser with its own sign-in (a session of the Owner's own), plus
// whatever cookies the server gives it; `jar` can be changed by hand, as
// developer tools would.
async function browser(owner) {
  const session = await staffFreshCookie(owner.loginId);
  const jar = new Map();
  const cookie = () => [session, ...[...jar].filter(([, v]) => v).map(([k, v]) => `${k}=${v}`)].join('; ');
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
  return { send, jar, session };
}
const ownerPages = async (b) => (await b.send('/api/till-setup/list')).status;
const isOwner = async (b) => (await b.send('/api/auth/me')).body.isOwner;
async function workshop(owner) {
  const b = await browser(owner);
  assert.equal((await b.send('/api/till-setup/workshop', { method: 'POST', body: { siteId: owner.site.id } })).status, 201);
  return b;
}

test('deleting or changing the workshop computer\'s cookie leaves the Owner\'s sign-in locked there', async () => {
  const owner = await shop();
  const w = await workshop(owner);
  // Setting up records the session as the workshop computer's at once.
  const marked = await pool.query('SELECT workshop_computer_id FROM sessions WHERE token = $1', [w.session.split('=')[1]]);
  assert.ok(Number.isInteger(marked.rows[0].workshop_computer_id), 'the session is the workshop computer\'s');
  // Nobody working: locked, as before.
  assert.equal(await ownerPages(w), 403);
  // The cookie deleted, as developer tools could.
  w.jar.delete('wh_workshop');
  assert.equal(await ownerPages(w), 403);
  assert.equal(await isOwner(w), false);
  assert.equal((await w.send('/api/end-of-day-settings', { method: 'PUT', body: { floatPence: 100 } })).status, 403);
  // Or changed to something else.
  w.jar.set('wh_workshop', 'f'.repeat(64));
  assert.equal(await ownerPages(w), 403);
  // The Owner's other browser, an ordinary one, is the Owner as before.
  assert.equal((await call(owner.cookie, '/api/till-setup/list')).status, 200);
});

test('a session that signs in on the workshop computer later is locked by its first request there', async () => {
  const owner = await shop();
  const w = await workshop(owner);
  const later = await browser(owner);
  later.jar.set('wh_workshop', w.jar.get('wh_workshop'));
  assert.equal(await ownerPages(later), 403);
  later.jar.delete('wh_workshop');
  assert.equal(await ownerPages(later), 403);
});

test('a till\'s key in place of the workshop computer\'s doesn\'t open it', async () => {
  const owner = await shop();
  const t = await browser(owner);
  assert.equal((await t.send('/api/till-setup', { method: 'POST', body: { siteId: owner.site.id, number: 1 } })).status, 201);
  // A till browser is the Owner as before.
  assert.equal(await ownerPages(t), 200);
  const w = await workshop(owner);
  w.jar.delete('wh_workshop');
  w.jar.set('wh_till', t.jar.get('wh_till'));
  assert.equal(await ownerPages(w), 403);
});

test('the Owner\'s own PIN on that computer still opens it; without the cookie it can\'t', async () => {
  const owner = await shop();
  const w = await workshop(owner);
  assert.equal((await w.send('/api/till-checkin', { method: 'POST', body: { pin: owner.pin } })).status, 201);
  assert.equal(await ownerPages(w), 200);
  w.jar.delete('wh_workshop');
  assert.equal(await ownerPages(w), 403);
  // The Owner's PIN typed with the cookie gone is a check-in on no workshop
  // computer, so it doesn't open the workshop computer's session either.
  assert.equal((await w.send('/api/till-checkin', { method: 'POST', body: { pin: owner.pin } })).status, 201);
  assert.equal(await ownerPages(w), 403);
});

test('signing out ends it: the session is gone, and the next sign-in on an ordinary browser is the Owner', async () => {
  const owner = await shop();
  const w = await workshop(owner);
  w.jar.delete('wh_workshop');
  assert.equal(await ownerPages(w), 403);
  assert.equal((await w.send('/api/auth/logout', { method: 'POST' })).status, 200);
  const token = w.session.split('=')[1];
  assert.equal((await pool.query('SELECT 1 FROM sessions WHERE token = $1', [token])).rowCount, 0);
  const next = await browser(owner);
  assert.equal(await ownerPages(next), 200);
});

// The review of #578, 1: the sign-in's own PIN and settings follow the same
// rule (ownAccountHere): with the cookie deleted, whoever is at the workshop
// computer can't get the sign-in a new PIN, the Owner's or a staff member's.
test('with the cookie deleted, the sign-in\'s own PIN and settings are refused there', async () => {
  const owner = await shop();
  const w = await workshop(owner);
  w.jar.delete('wh_workshop');
  for (const [method, path, body] of [
    ['POST', '/api/your-settings/till-pin/offer', {}],
    ['POST', '/api/your-settings/till-pin', { pin: '1234' }],
    ['GET', '/api/your-settings/till-pin', undefined],
  ]) {
    const res = await w.send(path, { method, body });
    assert.deepEqual([res.status, res.body?.code], [403, 'not_your_account_here'], `${method} ${path}`);
  }
  // The float check's look at closing, too.
  const look = await w.send('/api/float-check', { method: 'POST', body: { countedPence: null, atClose: true } });
  assert.deepEqual([look.status, look.body?.code], [403, 'not_your_account_here']);
  // The Owner's other browser keeps its own settings.
  assert.equal((await call(owner.cookie, '/api/your-settings/till-pin')).status, 200);
});

test('a staff member\'s sign-in on a workshop computer is held the same way', async () => {
  const owner = await shop();
  const w = await workshop(owner);
  const made = await post(owner.cookie, '/api/team', { name: 'Alex Morgan', isCashier: false, isMechanic: true, email: `alex-${Date.now()}@example.test`, password: 'password123' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const alexSession = await staffFreshCookie(made.body.loginId);
  const send = (cookie, path, method = 'GET', body) => fetch(`${server.baseUrl}${path}`, { method, headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  // Alex's sign-in used on the workshop computer, nobody working: not his own account there.
  assert.equal((await send(`${alexSession}; wh_workshop=${w.jar.get('wh_workshop')}`, '/api/your-settings/till-pin')).status, 403);
  // The cookie deleted: still not.
  assert.equal((await send(alexSession, '/api/your-settings/till-pin/offer', 'POST', {})).status, 403);
});
