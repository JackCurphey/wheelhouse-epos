// Staff sign in through WorkOS (openspec/changes/staff-signin-workos; signing-in
// decision 2; WorkOS only, Jack 25 Oct): start, WorkOS's page, back to the
// callback, against the pretend WorkOS, which answers as WorkOS does.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let off;
const shops = [];

before(async () => {
  // TRUST_PROXY so each test can be its own network, and the callback's limit
  // in one doesn't spill into the next.
  [server, off] = await Promise.all([
    startLiveServer({ env: { TRUST_PROXY: '1', STAFF_SIGNIN_PROVIDER: 'pretend', SIGNUP_CODE: 'let-me-in' } }),
    startLiveServer({ env: { STAFF_SIGNIN_PROVIDER: '' } }),
  ]);
});

after(async () => {
  for (const id of shops) await deleteTestShop(id);
  await Promise.all([server?.stop(), off?.stop()]);
});

async function owner() {
  const made = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  shops.push(made.shop.id);
  return made;
}

let network = 0;
const newNetwork = () => `198.51.100.${++network}`;

// One trip, redirects not followed: the status, where it goes, and its cookies.
async function hop(url, { cookie = '', ip, method = 'GET', form } = {}) {
  const res = await fetch(new URL(url, server.baseUrl), {
    method,
    redirect: 'manual',
    headers: {
      cookie,
      ...(ip ? { 'x-forwarded-for': ip } : {}),
      ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  return { status: res.status, location: res.headers.get('location'), cookies: res.headers.getSetCookie(), body: await res.text() };
}
const cookieValue = (cookies, name) => cookies.map((c) => c.split(';')[0]).find((c) => c.startsWith(`${name}=`));

// Start, sign in on the pretend WorkOS page, and come back. Returns the
// callback's answer and the session cookie it set, if any.
async function signIn(email, { user, verified = true, ip = newNetwork(), state } = {}) {
  const start = await hop('/api/auth/workos/start', { ip });
  assert.equal(start.status, 302, start.body);
  const stateCookie = cookieValue(start.cookies, 'wh_signin_state');
  assert.ok(stateCookie, 'start sets the state cookie');
  const page = new URL(start.location, server.baseUrl);
  assert.equal(page.pathname, '/api/auth/workos/pretend');
  const form = { email, state: page.searchParams.get('state'), redirect_uri: page.searchParams.get('redirect_uri') };
  if (verified) form.verified = 'on';
  if (user) form.user = user;
  const back = await hop('/api/auth/workos/pretend', { method: 'POST', form, ip });
  assert.equal(back.status, 302, back.body);
  const callback = new URL(back.location, server.baseUrl);
  assert.equal(callback.pathname, '/api/auth/workos/callback', 'the pretend page only ever goes back to the callback');
  if (state !== undefined) callback.searchParams.set('state', state);
  const done = await hop(callback.pathname + callback.search, { cookie: stateCookie, ip });
  return { ...done, session: cookieValue(done.cookies, 'wh_session'), callback: callback.pathname + callback.search, stateCookie, ip };
}

async function me(session) {
  const res = await fetch(`${server.baseUrl}/api/auth/me`, { headers: { cookie: session } });
  return { status: res.status, body: await res.json() };
}

test('an owner signs in on WorkOS’s page and is back, signed in to their shop', async () => {
  const { shop, email } = await owner();
  const done = await signIn(email);
  assert.equal(done.status, 302, done.body);
  assert.equal(done.location, '/workshop');
  assert.match(done.session, /^wh_session=[0-9a-f]{64}$/);
  assert.ok(done.cookies.some((c) => /^wh_session=[0-9a-f]{64}; HttpOnly; Path=\/; SameSite=Lax; Max-Age=2592000/.test(c)), done.cookies.join(' | '));
  assert.ok(done.cookies.some((c) => /^wh_signin_state=; .*Max-Age=0/.test(c)), 'the state cookie is cleared');
  const who = await me(done.session);
  assert.equal(who.status, 200);
  assert.equal(who.body.shopName, shop.name);
  assert.equal(who.body.email, email);
});

test('the first sign-in links the WorkOS account; later ones use the link after the email changes', async () => {
  const { shop, email, loginId } = await owner();
  const user = `user_${randomUUID()}`;
  assert.ok((await signIn(email, { user })).session);
  const { rows: [linked] } = await pool.query('SELECT workos_user_id FROM logins WHERE id = $1', [loginId]);
  assert.equal(linked.workos_user_id, user);
  const again = await signIn(`changed-${randomUUID().slice(0, 8)}@example.com`, { user });
  assert.ok(again.session, again.location);
  assert.equal((await me(again.session)).body.shopName, shop.name);
});

test('an email on no staff list, a turned-off login, and one linked to someone else are all refused alike', async () => {
  const nobody = await signIn(`nobody-${randomUUID().slice(0, 8)}@example.com`);
  assert.equal(nobody.location, '/workshop?signin=not-on-staff');
  assert.equal(nobody.session, undefined);

  const off1 = await owner();
  await pool.query('UPDATE logins SET active = false WHERE id = $1', [off1.loginId]);
  const turnedOff = await signIn(off1.email);
  assert.equal(turnedOff.location, '/workshop?signin=not-on-staff');
  assert.equal(turnedOff.session, undefined);

  const taken = await owner();
  await pool.query('UPDATE logins SET workos_user_id = $1 WHERE id = $2', [`user_${randomUUID()}`, taken.loginId]);
  const someoneElse = await signIn(taken.email, { user: `user_${randomUUID()}` });
  assert.equal(someoneElse.location, '/workshop?signin=not-on-staff');
  assert.equal(someoneElse.session, undefined);
});

test('an email WorkOS hasn’t checked is refused, and nothing is linked', async () => {
  const { email, loginId } = await owner();
  const done = await signIn(email, { verified: false });
  assert.equal(done.location, '/workshop?signin=unchecked');
  assert.equal(done.session, undefined);
  const { rows: [login] } = await pool.query('SELECT workos_user_id FROM logins WHERE id = $1', [loginId]);
  assert.equal(login.workos_user_id, null);
});

test('a return this browser didn’t start signs nobody in', async () => {
  const { email } = await owner();
  const wrong = await signIn(email, { state: 'not-the-one-we-made' });
  assert.equal(wrong.location, '/workshop?signin=failed');
  assert.equal(wrong.session, undefined);

  // The right link, but without the browser's state cookie.
  const ok = await signIn(email);
  assert.ok(ok.session);
  const noCookie = await hop(ok.callback, { ip: newNetwork() });
  assert.equal(noCookie.location, '/workshop?signin=failed');
  assert.equal(cookieValue(noCookie.cookies, 'wh_session'), undefined);
});

test('a state that isn’t plain letters and digits is refused, not a server error', async () => {
  const { email } = await owner();
  // 48 characters like ours, but one of them two bytes long.
  const odd = await signIn(email, { state: `é${'a'.repeat(47)}` });
  assert.equal(odd.status, 302, odd.body);
  assert.equal(odd.location, '/workshop?signin=failed');
});

test('signing in where someone is already signed in ends their session', async () => {
  const { email, cookie } = await owner();
  const start = await hop('/api/auth/workos/start');
  const page = new URL(start.location, server.baseUrl);
  const back = await hop('/api/auth/workos/pretend', { method: 'POST', form: { email, verified: 'on', state: page.searchParams.get('state') } });
  const done = await hop(back.location, { cookie: `${cookieValue(start.cookies, 'wh_signin_state')}; ${cookie}` });
  assert.ok(cookieValue(done.cookies, 'wh_session'));
  assert.equal((await me(cookie)).status, 401, 'the earlier session is gone');
});

test('a code from WorkOS’s page works once', async () => {
  const { email } = await owner();
  const first = await signIn(email);
  assert.ok(first.session);
  const replay = await hop(first.callback, { cookie: first.stateCookie, ip: newNetwork() });
  assert.equal(replay.location, '/workshop?signin=failed');
  assert.equal(cookieValue(replay.cookies, 'wh_session'), undefined);
});

test('the callback is limited to 10 tries per network every 15 minutes', async () => {
  const ip = newNetwork();
  for (let i = 0; i < 10; i++) {
    const r = await hop('/api/auth/workos/callback?code=nope&state=nope', { ip });
    assert.equal(r.location, '/workshop?signin=failed', `try ${i + 1}`);
  }
  const eleventh = await hop('/api/auth/workos/callback?code=nope&state=nope', { ip });
  assert.equal(eleventh.location, '/workshop?signin=busy');
});

test('signing out of a WorkOS sign-in gives WorkOS’s sign-out address; a session made otherwise doesn’t', async () => {
  const { email, cookie } = await owner();
  const done = await signIn(email);
  const out = await fetch(`${server.baseUrl}/api/auth/logout`, { method: 'POST', headers: { cookie: done.session } });
  const body = await out.json();
  assert.equal(out.status, 200);
  assert.equal(body.ok, true);
  assert.equal(typeof body.signOutUrl, 'string');
  assert.equal((await me(done.session)).status, 401);

  const plain = await fetch(`${server.baseUrl}/api/auth/logout`, { method: 'POST', headers: { cookie } });
  assert.deepEqual(await plain.json(), { ok: true });
});

test('WorkOS only: a right email and password are refused, pointing to WorkOS', async () => {
  const { email } = await owner();
  const res = await fetch(`${server.baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': newNetwork() },
    body: JSON.stringify({ email, password: 'password123' }),
  });
  assert.equal(res.status, 410);
  assert.deepEqual(await res.json(), { error: 'Staff sign in through WorkOS now' });
  assert.equal(res.headers.get('set-cookie'), null);
});

test('shop sign-up still signs the new owner straight in', async () => {
  const email = `new-owner-${randomUUID().slice(0, 8)}@example.com`;
  const res = await fetch(`${server.baseUrl}/api/auth/signup`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': newNetwork() },
    body: JSON.stringify({ signupCode: 'let-me-in', shopName: `North Street Cycles ${randomUUID().slice(0, 8)}`, ownerName: 'Owner', email, password: 'password123' }),
  });
  const body = await res.json();
  assert.equal(res.status, 201, JSON.stringify(body));
  const { rows: [login] } = await pool.query('SELECT shop_id FROM logins WHERE email = $1', [email]);
  shops.push(login.shop_id);
  assert.match(res.headers.get('set-cookie'), /^wh_session=[0-9a-f]{64};/);
});

test('with nothing connected, starting to sign in says it isn’t switched on', async () => {
  const res = await fetch(`${off.baseUrl}/api/auth/workos/start`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/workshop?signin=off');
  const page = await fetch(`${off.baseUrl}/api/auth/workos/pretend?state=x&redirect_uri=x`, { redirect: 'manual' });
  assert.equal(page.status, 404, 'the pretend page only exists when the pretend WorkOS is connected');
});
