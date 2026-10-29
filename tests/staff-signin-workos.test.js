// Staff sign in through WorkOS (openspec/changes/staff-signin-workos; signing-in
// decision 2; WorkOS only, Jack 25 Oct): start, WorkOS's page, back to the
// callback, against the pretend WorkOS, which answers as WorkOS does.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffFreshCookie } from './helpers/staff.js';
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
async function signIn(email, { user, verified = true, ip = newNetwork(), state, cookie = '' } = {}) {
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
  const done = await hop(callback.pathname + callback.search, { cookie: [stateCookie, cookie].filter(Boolean).join('; '), ip });
  return { ...done, session: cookieValue(done.cookies, 'wh_session'), callback: callback.pathname + callback.search, stateCookie, ip };
}

// The revoke runs on its own after the request: wait for it, or a moment.
const settle = () => new Promise((r) => setTimeout(r, 300));
async function eventually(check, what, ms = 5000) {
  for (const until = Date.now() + ms; Date.now() < until; await settle()) if (await check()) return;
  assert.fail(`never happened: ${what}`);
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

// staff-signin-workos-screens: the server's part of the drawn pages.

test('/me says a session has run out when the browser sent one that isn’t live, and not otherwise', async () => {
  const gone = await fetch(`${server.baseUrl}/api/auth/me`, { headers: { cookie: `wh_session=${'0'.repeat(64)}` } });
  assert.equal(gone.status, 401);
  assert.deepEqual(await gone.json(), { error: 'Not signed in', reason: 'expired' });
  const none = await fetch(`${server.baseUrl}/api/auth/me`);
  assert.equal(none.status, 401);
  assert.deepEqual(await none.json(), { error: 'Not signed in' });
});

// Start with ?from=, then the pretend page, then the callback with both cookies.
async function signInFrom(email, from) {
  const ip = newNetwork();
  const start = await hop(`/api/auth/workos/start${from === undefined ? '' : `?from=${encodeURIComponent(from)}`}`, { ip });
  const cookies = ['wh_signin_state', 'wh_signin_from'].map((n) => cookieValue(start.cookies, n)).filter(Boolean).join('; ');
  const page = new URL(start.location, server.baseUrl);
  const back = await hop('/api/auth/workos/pretend', { method: 'POST', form: { email, verified: 'on', state: page.searchParams.get('state') }, ip });
  return hop(back.location, { cookie: cookies, ip });
}

test('signing in from a staff-app page comes back to it', async () => {
  const { email } = await owner();
  const done = await signInFrom(email, '/workshop/diary');
  assert.equal(done.location, '/workshop/diary');
  assert.ok(cookieValue(done.cookies, 'wh_session'));
  assert.ok(done.cookies.some((c) => /^wh_signin_from=; .*Max-Age=0/.test(c)), 'the from cookie is cleared');
});

test('anywhere outside the staff app, or nothing, lands on the staff app’s front page', async () => {
  const { email } = await owner();
  for (const from of ['//evil.example', 'https://evil.example/workshop', '/\\evil.example', '/book/north-street', '/workshopper', undefined]) {
    const done = await signInFrom(email, from);
    assert.equal(done.location, '/workshop', String(from));
  }
});

test('a failed sign-in clears the from cookie too', async () => {
  const done = await signInFrom(`nobody-${randomUUID().slice(0, 8)}@example.com`, '/workshop/diary');
  assert.equal(done.location, '/workshop?signin=not-on-staff');
  assert.ok(done.cookies.some((c) => /^wh_signin_from=; .*Max-Age=0/.test(c)), done.cookies.join(' | '));
});

test('the pretend WorkOS’s sign-out comes back to the signed-out page', async () => {
  const { email } = await owner();
  const done = await signIn(email);
  const out = await fetch(`${server.baseUrl}/api/auth/logout`, { method: 'POST', headers: { cookie: done.session } });
  assert.equal((await out.json()).signOutUrl, '/workshop/signed-out');
});

// Review of staff-signin-workos-screens: from is resolved as a URL, then kept
// only as a staff-app page, so nothing in it can break the reply or leave the app.
test('a from with line breaks or other characters still signs in, onto a staff-app page', async () => {
  const { email } = await owner();
  for (const from of ['/workshop/\r\nX: y', '/workshop/中', '/workshop/\tdiary']) {
    const done = await signInFrom(email, from);
    assert.equal(done.status, 302, `${JSON.stringify(from)}: ${done.body}`);
    assert.match(done.location, /^\/workshop(\/|$)/, JSON.stringify(from));
    assert.doesNotMatch(done.location, /[\r\n\t]/);
    assert.ok(cookieValue(done.cookies, 'wh_session'), JSON.stringify(from));
  }
});

test('/workshop/../ is outside the staff app, and a page’s own %-codes come back as they were', async () => {
  const { email } = await owner();
  assert.equal((await signInFrom(email, '/workshop/../book/x')).location, '/workshop');
  assert.equal((await signInFrom(email, '/workshop/%2e%2e/book/x')).location, '/workshop');
  assert.equal((await signInFrom(email, '/workshop/customers?q=a%26b')).location, '/workshop/customers?q=a%26b');
});

// staff-signin-google: "Continue with Google" starts with provider=google,
// which goes straight to Google's chooser (WorkOS's provider=GoogleOAuth).
test('provider=google asks WorkOS for Google; anything else for its own page; from still comes back', async () => {
  const google = await hop('/api/auth/workos/start?provider=google&from=%2Fworkshop%2Fdiary', { ip: newNetwork() });
  const at = new URL(google.location, server.baseUrl);
  assert.equal(at.searchParams.get('provider'), 'GoogleOAuth');
  const page = await hop(at.pathname + at.search);
  assert.match(page.body, /Pretend WorkOS · Google/);
  for (const other of ['', '?provider=apple', '?provider=']) {
    const r = await hop(`/api/auth/workos/start${other}`, { ip: newNetwork() });
    assert.equal(new URL(r.location, server.baseUrl).searchParams.get('provider'), 'authkit', other);
  }
  const { email } = await owner();
  const ip = newNetwork();
  const start = await hop('/api/auth/workos/start?provider=google&from=%2Fworkshop%2Fdiary', { ip });
  const cookies = ['wh_signin_state', 'wh_signin_from'].map((n) => cookieValue(start.cookies, n)).join('; ');
  const back = await hop('/api/auth/workos/pretend', { method: 'POST', form: { email, verified: 'on', state: new URL(start.location, server.baseUrl).searchParams.get('state') }, ip });
  const done = await hop(back.location, { cookie: cookies, ip });
  assert.equal(done.location, '/workshop/diary');
  assert.ok(cookieValue(done.cookies, 'wh_session'));
});

// The way back for a removed workshop computer (openspec/changes/tills-list,
// the reviews, 29 Oct): its old key keeps the Owner's sign-in from counting
// as the Owner there. Signing in leaves the key (WorkOS may offer a one-press
// Continue to whoever is at the computer); signing out clears it, and ends
// the WorkOS session, so getting back in needs the Owner's own sign-in.
test('a removed workshop computer: signing in leaves it staff; signing out clears its key, and the next sign-in is the Owner', async () => {
  const { email, cookie: ownerCookie, loginId } = await owner();
  const post = (cookie, path, body) => fetch(`${server.baseUrl}${path}`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  const site = await (await post(ownerCookie, '/api/sites', { name: 'Bolton', code: 'B' })).json();
  const keyOf = (res) => cookieValue(res.headers.getSetCookie(), 'wh_workshop');
  // Each set up from its own computer's sign-in (a session used on a
  // workshop computer stays that computer's: workshop-lock-server).
  const stays = await post(await staffFreshCookie(loginId), '/api/till-setup/workshop', { siteId: site.id });
  const gone = await post(await staffFreshCookie(loginId), '/api/till-setup/workshop', { siteId: site.id });
  const [stayKey, goneKey] = [keyOf(stays), keyOf(gone)];
  assert.ok(stayKey && goneKey);
  assert.equal((await post(ownerCookie, `/api/till-setup/workshop/${(await gone.json()).workshop.id}/remove`)).status, 200);
  const touchesKey = (cookies) => cookies.some((c) => c.startsWith('wh_workshop='));

  // Signing in on the removed computer leaves its key: still staff there.
  const signedIn = await signIn(email, { cookie: goneKey });
  assert.ok(signedIn.session);
  assert.ok(!touchesKey(signedIn.cookies), signedIn.cookies.join(' | '));
  assert.equal((await me(`${signedIn.session}; ${goneKey}`)).body.isOwner, false);

  // Signing out there clears the key; the next sign-in is the Owner.
  const out = await fetch(`${server.baseUrl}/api/auth/logout`, { method: 'POST', headers: { cookie: `${signedIn.session}; ${goneKey}` } });
  assert.equal(out.status, 200);
  assert.ok(out.headers.getSetCookie().some((c) => /^wh_workshop=; .*Max-Age=0/.test(c)), out.headers.getSetCookie().join(' | '));
  const back = await signIn(email);
  assert.equal((await me(back.session)).body.isOwner, true);

  // On a workshop computer still on, and on an ordinary browser, signing in and out leave the key as before.
  const onStill = await signIn(email, { cookie: stayKey });
  assert.ok(!touchesKey(onStill.cookies));
  const outStill = await fetch(`${server.baseUrl}/api/auth/logout`, { method: 'POST', headers: { cookie: `${onStill.session}; ${stayKey}` } });
  assert.ok(!touchesKey(outStill.headers.getSetCookie()), outStill.headers.getSetCookie().join(' | '));
  const plain = await signIn(email);
  const outPlain = await fetch(`${server.baseUrl}/api/auth/logout`, { method: 'POST', headers: { cookie: plain.session } });
  assert.equal(outPlain.status, 200);
  assert.ok(!touchesKey(outPlain.headers.getSetCookie()));
});

// A workshop computer keeps no remembered WorkOS session
// (openspec/changes/workshop-lock-server, the review of #578, 2): when a
// WorkOS sign-in becomes a workshop computer's, at setup or its first request
// there, its WorkOS session is ended at WorkOS, so whoever is at the computer
// can't press Continue for a fresh Owner sign-in. Wheelhouse's own session
// stays; signing out there then has no WorkOS session left to end.
test('a WorkOS sign-in that becomes a workshop computer\'s has its WorkOS session ended, and stays signed in', async () => {
  const { email, cookie: ownerCookie } = await owner();
  const json = { 'content-type': 'application/json' };
  const site = await (await fetch(`${server.baseUrl}/api/sites`, { method: 'POST', headers: { cookie: ownerCookie, ...json }, body: JSON.stringify({ name: 'Bolton', code: 'B' }) })).json();
  const workosOf = async (session) => (await pool.query('SELECT workos_session_id FROM sessions WHERE token = $1', [session.split('=')[1]])).rows[0]?.workos_session_id;

  // At setup.
  const atSetup = await signIn(email);
  assert.match(await workosOf(atSetup.session), /^session_pretend_/);
  const made = await fetch(`${server.baseUrl}/api/till-setup/workshop`, { method: 'POST', headers: { cookie: atSetup.session, ...json }, body: JSON.stringify({ siteId: site.id }) });
  assert.equal(made.status, 201);
  const key = cookieValue(made.headers.getSetCookie(), 'wh_workshop');
  await eventually(async () => (await workosOf(atSetup.session)) === null, 'its WorkOS session is ended');
  assert.equal((await me(atSetup.session)).status, 200, 'still signed in to Wheelhouse');

  // A WorkOS sign-in made on the workshop computer later: its first request there.
  const later = await signIn(email, { cookie: key });
  assert.match(await workosOf(later.session), /^session_pretend_/);
  assert.equal((await me(`${later.session}; ${key}`)).status, 200);
  await eventually(async () => (await workosOf(later.session)) === null, 'ended at its first request there');

  // An ordinary browser's WorkOS sign-in is left alone.
  const plain = await signIn(email);
  assert.equal((await me(plain.session)).status, 200);
  await settle();
  assert.match(await workosOf(plain.session), /^session_pretend_/);
});

// The re-review of #578: a revoke that failed is tried again on a later
// request, at most once a minute for a session, so a WorkOS outage doesn't
// add a call to every request.
test('a workshop computer\'s WorkOS session still set is ended on a later request, at most once a minute', async () => {
  const { email, cookie: ownerCookie } = await owner();
  const json = { 'content-type': 'application/json' };
  const site = await (await fetch(`${server.baseUrl}/api/sites`, { method: 'POST', headers: { cookie: ownerCookie, ...json }, body: JSON.stringify({ name: 'Bolton', code: 'B' }) })).json();
  const signedIn = await signIn(email);
  const token = signedIn.session.split('=')[1];
  const workos = async () => (await pool.query('SELECT workos_session_id FROM sessions WHERE token = $1', [token])).rows[0].workos_session_id;
  const setWorkos = (id) => pool.query('UPDATE sessions SET workos_session_id = $1 WHERE token = $2', [id, token]);
  // Tied at setup, its WorkOS session ended.
  assert.equal((await fetch(`${server.baseUrl}/api/till-setup/workshop`, { method: 'POST', headers: { cookie: signedIn.session, ...json }, body: JSON.stringify({ siteId: site.id }) })).status, 201);
  await eventually(async () => (await workos()) === null, 'ended at setup');
  // As if that revoke had failed: WorkOS couldn't be reached (the pretend
  // one answers so for an id starting session_down_).
  await setWorkos('session_down_1');
  assert.equal((await me(signedIn.session)).status, 200);
  await settle();
  assert.equal(await workos(), 'session_down_1', 'not reached, so kept');
  // Within the minute, not tried again, even for one WorkOS would take.
  await setWorkos('session_pretend_retry');
  assert.equal((await me(signedIn.session)).status, 200);
  await settle();
  assert.equal(await workos(), 'session_pretend_retry', 'not tried again within the minute');
  // Another tied session whose revoke failed: its first later request tries again.
  const other = await signIn(email);
  const otherToken = other.session.split('=')[1];
  const key = (await pool.query('SELECT workshop_computer_id FROM sessions WHERE token = $1', [token])).rows[0].workshop_computer_id;
  await pool.query("UPDATE sessions SET workshop_computer_id = $1, workos_session_id = 'session_pretend_later' WHERE token = $2", [key, otherToken]);
  assert.equal((await me(other.session)).status, 200);
  await eventually(async () => (await pool.query('SELECT workos_session_id FROM sessions WHERE token = $1', [otherToken])).rows[0].workos_session_id === null, 'tried again and ended');
});

// The review of the retry (#578): the revoke runs on its own, never inside
// the request, so a slow WorkOS neither delays the answer nor holds the
// request's database connection; and WorkOS answering that the session is
// already gone (a 4xx other than 429) counts as ended, with no more retries.
test('a slow WorkOS doesn\'t hold up the request, and its revoke still ends the session', async () => {
  const { email, cookie: ownerCookie } = await owner();
  const json = { 'content-type': 'application/json' };
  const site = await (await fetch(`${server.baseUrl}/api/sites`, { method: 'POST', headers: { cookie: ownerCookie, ...json }, body: JSON.stringify({ name: 'Bolton', code: 'B' }) })).json();
  const signedIn = await signIn(email);
  const token = signedIn.session.split('=')[1];
  const workos = async () => (await pool.query('SELECT workos_session_id FROM sessions WHERE token = $1', [token])).rows[0].workos_session_id;
  // The pretend WorkOS takes 1.5 seconds to answer for an id starting session_slow_.
  await pool.query("UPDATE sessions SET workos_session_id = 'session_slow_1' WHERE token = $1", [token]);
  const started = Date.now();
  const made = await fetch(`${server.baseUrl}/api/till-setup/workshop`, { method: 'POST', headers: { cookie: signedIn.session, ...json }, body: JSON.stringify({ siteId: site.id }) });
  assert.equal(made.status, 201);
  assert.ok(Date.now() - started < 1000, `answered without waiting for WorkOS (${Date.now() - started} ms)`);
  assert.equal(await workos(), 'session_slow_1', 'not ended yet');
  await eventually(async () => (await workos()) === null, 'ended once WorkOS answered');
});

test('WorkOS saying the session is already gone counts as ended: no more tries', async () => {
  const { email, cookie: ownerCookie } = await owner();
  const json = { 'content-type': 'application/json' };
  const site = await (await fetch(`${server.baseUrl}/api/sites`, { method: 'POST', headers: { cookie: ownerCookie, ...json }, body: JSON.stringify({ name: 'Bolton', code: 'B' }) })).json();
  const signedIn = await signIn(email);
  const token = signedIn.session.split('=')[1];
  // The pretend WorkOS answers as WorkOS does for a session it doesn't have (404).
  await pool.query("UPDATE sessions SET workos_session_id = 'session_gone_1' WHERE token = $1", [token]);
  assert.equal((await fetch(`${server.baseUrl}/api/till-setup/workshop`, { method: 'POST', headers: { cookie: signedIn.session, ...json }, body: JSON.stringify({ siteId: site.id }) })).status, 201);
  await eventually(async () => (await pool.query('SELECT workos_session_id FROM sessions WHERE token = $1', [token])).rows[0].workos_session_id === null, 'cleared');
});
