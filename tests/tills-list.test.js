// The Tills list, with Rename and Remove (openspec/changes/tills-list; drawn
// as set-till-tills-owner and set-till-remove in setup.mjs; owner setup 17;
// roles and switches 2; workshop computer task 2.7). The Owner sees every
// till and workshop computer that's on, with who registered it and when,
// renames one, and switches one off. The server's clock is pinned to 1 Sep 2026.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { registerTill, tillRequest } from './helpers/till.js';

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
const row = (owner, sql, ...args) => runWithShop(owner.shop.id, () => prepare(sql).get(...args));

async function shop() {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  owner.site = (await post(owner.cookie, '/api/sites', { name: 'Bolton', code: 'B' })).body;
  return owner;
}
async function member(owner, name) {
  const made = await post(owner.cookie, '/api/team', { name, isCashier: true, isMechanic: false, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const cookie = await staffFreshCookie(made.body.loginId);
  const offer = await post(cookie, '/api/your-settings/till-pin/offer');
  assert.equal((await post(cookie, '/api/your-settings/till-pin', { pin: offer.body.pin })).status, 200);
  return { cookie, pin: offer.body.pin };
}

// A browser: the Owner's sign-in plus whatever cookies the server gives it.
function browser(owner) {
  const jar = new Map();
  const cookie = () => [owner.cookie, ...[...jar].map(([k, v]) => `${k}=${v}`)].join('; ');
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
  return { send };
}
const makeTill = async (owner, number, name = '') => {
  const b = browser(owner);
  const made = await b.send('/api/till-setup', { method: 'POST', body: { siteId: owner.site.id, number, name } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  return { b, id: made.body.till.id };
};
const makeWorkshop = async (owner, name = '') => {
  const b = browser(owner);
  const made = await b.send('/api/till-setup/workshop', { method: 'POST', body: { siteId: owner.site.id, name } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  return { b, id: made.body.workshop.id };
};
const iso = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

test('the list is the Owner\'s: tills in number order, then workshop computers, with who and when, only those switched on', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  assert.deepEqual([(await call(jo.cookie, '/api/till-setup/list')).status, (await call(jo.cookie, '/api/till-setup/list')).body.code], [403, 'owner_only']);
  assert.deepEqual((await call(owner.cookie, '/api/till-setup/list')).body, { tills: [], workshopComputers: [] });
  const b2 = await makeTill(owner, 2);
  const b1 = await makeTill(owner, 1, 'Front counter');
  const b3 = await makeTill(owner, 3);
  const w = await makeWorkshop(owner, 'Back bench');
  // A till from before 104 has no one recorded.
  await runWithShop(owner.shop.id, () => prepare('UPDATE tills SET registered_by_login_id = NULL WHERE id = ?').run(b2.id));
  await post(owner.cookie, `/api/till-setup/tills/${b3.id}/remove`);
  const list = (await call(owner.cookie, '/api/till-setup/list')).body;
  assert.ok(list.tills.every((t) => iso(t.registeredAt)) && list.workshopComputers.every((t) => iso(t.registeredAt)));
  const strip = ({ registeredAt, ...rest }) => rest;
  assert.deepEqual(list.tills.map(strip), [
    { id: b1.id, code: 'B1', name: 'Front counter', siteName: 'Bolton', registeredBy: 'Jack Lewis' },
    { id: b2.id, code: 'B2', name: null, siteName: 'Bolton', registeredBy: null },
  ]);
  assert.deepEqual(list.workshopComputers.map(strip), [{ id: w.id, name: 'Back bench', siteName: 'Bolton', registeredBy: 'Jack Lewis' }]);
  // Another shop sees none of them.
  const other = await shop();
  assert.deepEqual((await call(other.cookie, '/api/till-setup/list')).body, { tills: [], workshopComputers: [] });
});

test('renaming a till or a workshop computer: trimmed, blank is none, up to 60, the Owner\'s only', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const t = await makeTill(owner, 1);
  const w = await makeWorkshop(owner);
  const put = (cookie, path, body) => call(cookie, path, { method: 'PUT', body });
  assert.deepEqual((await put(owner.cookie, `/api/till-setup/tills/${t.id}`, { name: '  Front counter ' })).body, { id: t.id, code: 'B1', name: 'Front counter' });
  assert.equal((await row(owner, 'SELECT name FROM tills WHERE id = ?', t.id)).name, 'Front counter');
  assert.deepEqual((await put(owner.cookie, `/api/till-setup/tills/${t.id}`, { name: '  ' })).body, { id: t.id, code: 'B1', name: null });
  assert.deepEqual((await put(owner.cookie, `/api/till-setup/workshop/${w.id}`, { name: 'Back bench' })).body, { id: w.id, name: 'Back bench' });
  assert.equal((await row(owner, 'SELECT name FROM workshop_computers WHERE id = ?', w.id)).name, 'Back bench');
  assert.deepEqual((await put(owner.cookie, `/api/till-setup/workshop/${w.id}`, { name: null })).body, { id: w.id, name: null });
  assert.equal((await put(owner.cookie, `/api/till-setup/tills/${t.id}`, { name: 'x'.repeat(61) })).status, 400);
  assert.equal((await put(owner.cookie, `/api/till-setup/workshop/${w.id}`, { name: 7 })).status, 400);
  assert.equal((await put(owner.cookie, '/api/till-setup/tills/999999', { name: 'A' })).status, 404);
  const refused = await put(jo.cookie, `/api/till-setup/tills/${t.id}`, { name: 'Mine' });
  assert.deepEqual([refused.status, refused.body.code], [403, 'owner_only']);
  assert.equal((await put(jo.cookie, `/api/till-setup/workshop/${w.id}`, { name: 'Mine' })).status, 403);
  // Another shop's is missing to them.
  const other = await shop();
  assert.equal((await put(other.cookie, `/api/till-setup/tills/${t.id}`, { name: 'Theirs' })).status, 404);
  assert.equal((await put(other.cookie, `/api/till-setup/workshop/${w.id}`, { name: 'Theirs' })).status, 404);
  assert.equal((await row(owner, 'SELECT name FROM tills WHERE id = ?', t.id)).name, null);
});

test('removing switches it off: the browser stops being it, the number stays in use, and it can\'t be renamed after', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const t = await makeTill(owner, 1);
  const w = await makeWorkshop(owner);
  assert.equal((await post(jo.cookie, `/api/till-setup/tills/${t.id}/remove`)).status, 403);
  assert.equal((await post(jo.cookie, `/api/till-setup/workshop/${w.id}/remove`)).status, 403);
  assert.equal((await t.b.send('/api/till-checkin')).body.till.code, 'B1');
  assert.deepEqual((await post(owner.cookie, `/api/till-setup/tills/${t.id}/remove`)).body, { id: t.id, active: false });
  assert.equal((await t.b.send('/api/till-checkin')).body.till, null, 'that computer is no longer Till B1');
  assert.deepEqual((await call(owner.cookie, '/api/till-setup')).body.sites[0].taken, [1], 'B1 stays in use');
  assert.equal((await post(owner.cookie, `/api/till-setup/tills/${t.id}/remove`)).status, 404, 'already off');
  assert.equal((await call(owner.cookie, `/api/till-setup/tills/${t.id}`, { method: 'PUT', body: { name: 'A' } })).status, 404);
  assert.notEqual((await w.b.send('/api/till-checkin')).body.workshop, null);
  assert.deepEqual((await post(owner.cookie, `/api/till-setup/workshop/${w.id}/remove`)).body, { id: w.id, active: false });
  assert.equal((await w.b.send('/api/till-checkin')).body.workshop, null, 'that computer is no longer a workshop computer');
  assert.equal((await post(owner.cookie, `/api/till-setup/workshop/${w.id}/remove`)).status, 404);
  assert.deepEqual((await call(owner.cookie, '/api/till-setup/list')).body, { tills: [], workshopComputers: [] });
  const other = await shop();
  const t2 = await makeTill(owner, 2);
  assert.equal((await post(other.cookie, `/api/till-setup/tills/${t2.id}/remove`)).status, 404);
  assert.equal((await row(owner, 'SELECT active FROM tills WHERE id = ?', t2.id)).active, true);
});

test('nobody but the Owner checked in on that browser can rename or remove there', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const t = await makeTill(owner, 1);
  // Jo checks in on the till itself; the Owner's sign-in is still the browser's.
  assert.equal((await t.b.send('/api/till-checkin', { method: 'POST', body: { pin: jo.pin } })).status, 201);
  const renamed = await t.b.send(`/api/till-setup/tills/${t.id}`, { method: 'PUT', body: { name: 'Mine' } });
  assert.deepEqual([renamed.status, renamed.body.code], [403, 'not_owner_checked_in']);
  const removed = await t.b.send(`/api/till-setup/tills/${t.id}/remove`, { method: 'POST' });
  assert.deepEqual([removed.status, removed.body.code], [403, 'not_owner_checked_in']);
  assert.deepEqual(await row(owner, 'SELECT name, active FROM tills WHERE id = ?', t.id), { name: null, active: true });
});

// The review, 29 Oct: what a removed till or workshop computer can still do.
const checkIn = async (b, pin) => {
  const res = await b.send('/api/till-checkin', { method: 'POST', body: { pin } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.serving;
};

test('a removed workshop computer still signed in as the Owner is not the Owner: Owner pages refuse it (review 1)', async () => {
  const owner = await shop();
  const w = await makeWorkshop(owner);
  // With nobody working it already counts as staff (workshop-computer design 9).
  assert.equal((await w.b.send('/api/till-setup/list')).status, 403);
  assert.equal((await post(owner.cookie, `/api/till-setup/workshop/${w.id}/remove`)).status, 200);
  // Removed, the browser still carries its old key: still not the Owner.
  const refused = await w.b.send('/api/till-setup/list');
  assert.deepEqual([refused.status, refused.body.code], [403, 'owner_only']);
  assert.equal((await w.b.send('/api/end-of-day-settings', { method: 'PUT', body: { floatPence: 100 } })).status, 403);
  assert.equal((await w.b.send('/api/auth/me')).body.isOwner, false);
  // Another browser of the Owner's is the Owner as before.
  assert.equal((await call(owner.cookie, '/api/till-setup/list')).status, 200);
});

test('the older switch-off route follows the same rules: not while someone else is checked in, and not twice (review 2)', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  const t = await makeTill(owner, 1);
  await checkIn(t.b, jo.pin);
  const refused = await t.b.send(`/api/tills/${t.id}/deactivate`, { method: 'POST' });
  assert.deepEqual([refused.status, refused.body.code], [403, 'not_owner_checked_in']);
  assert.equal((await row(owner, 'SELECT active FROM tills WHERE id = ?', t.id)).active, true);
  assert.deepEqual((await post(owner.cookie, `/api/tills/${t.id}/deactivate`)).body, { id: t.id, active: false });
  assert.equal((await post(owner.cookie, `/api/tills/${t.id}/deactivate`)).status, 404, 'already off');
});

test('after a remove the till\'s offline key is refused, and check-ins made there no longer count', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  // A till registered with an offline key.
  const offline = await registerTill(server.baseUrl, owner, { siteCode: 'B', number: 5 });
  const snapshot = () => tillRequest(server.baseUrl, owner.shop.slug, offline.token, '/snapshot');
  assert.equal((await snapshot()).status, 200);
  assert.equal((await post(owner.cookie, `/api/till-setup/tills/${offline.till.id}/remove`)).status, 200);
  assert.equal((await snapshot()).status, 401);
  // An open check-in on a till, and on a workshop computer.
  const t = await makeTill(owner, 1);
  const w = await makeWorkshop(owner);
  await checkIn(t.b, jo.pin);
  await checkIn(w.b, jo.pin);
  assert.equal((await t.b.send('/api/till-checkin')).body.serving?.name, 'Jo Taylor');
  assert.equal((await w.b.send('/api/till-checkin')).body.serving?.name, 'Jo Taylor');
  await post(owner.cookie, `/api/till-setup/tills/${t.id}/remove`);
  await post(owner.cookie, `/api/till-setup/workshop/${w.id}/remove`);
  assert.equal((await t.b.send('/api/till-checkin')).body.serving, null);
  assert.equal((await w.b.send('/api/till-checkin')).body.serving, null);
});

test('with trust PIN on, a tap on a removed workshop computer is refused', async () => {
  const owner = await shop();
  const jo = await member(owner, 'Jo Taylor');
  assert.equal((await call(owner.cookie, '/api/signing-in-settings', { method: 'PUT', body: { trustPin: true } })).status, 200);
  const w = await makeWorkshop(owner);
  const serving = await checkIn(w.b, jo.pin);
  assert.equal((await w.b.send('/api/till-checkin/end', { method: 'POST', body: {} })).status, 200);
  // Jo typed her PIN here today, so a tap works while it is a workshop computer.
  assert.equal((await w.b.send('/api/till-checkin/tap', { method: 'POST', body: { employeeId: serving.id } })).status, 201);
  assert.equal((await w.b.send('/api/till-checkin/end', { method: 'POST', body: {} })).status, 200);
  await post(owner.cookie, `/api/till-setup/workshop/${w.id}/remove`);
  const tapped = await w.b.send('/api/till-checkin/tap', { method: 'POST', body: { employeeId: serving.id } });
  assert.ok(tapped.status >= 400 && tapped.status < 500, `refused: ${tapped.status}`);
  assert.equal((await w.b.send('/api/till-checkin')).body.serving, null);
});
