// Staff sign-up, sign-in and sign-out: /api/auth/*.
// They run under the dispatcher's /api/ branch (server.js), but before its
// session check and outside runWithShop: a handler gets (req, res, params,
// query) only, with no shop bound and no session required.
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { dbExec, prepare, runWithShop } from '../db.js';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { AuthError, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSession, createShop, destroySession, getSessionContext, loginForWorkosUser } from '../auth.js';
import { badRequest, makeRateLimiter, notFound, parseCookies, readJsonBody, readRawBody, sendJson } from '../lib/http.js';
import { currentSession } from '../lib/session.js';
import { clientIp, isHttpsRequest } from '../proxy-trust.js';
import { staffSigninProvider } from '../staff-signin/provider.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

function sessionCookie(req, token) {
  const secure = isHttpsRequest(req) ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

function setSessionCookie(req, res, token) {
  res.setHeader('Set-Cookie', sessionCookie(req, token));
}

// The state a WorkOS sign-in started with, kept by this browser for 10
// minutes, so a link back from WorkOS that this browser didn't start signs
// nobody in (staff-signin-workos design 3).
const STATE_COOKIE = 'wh_signin_state';
function stateCookie(req, value, maxAge, name = STATE_COOKIE) {
  const secure = isHttpsRequest(req) ? '; Secure' : '';
  return `${name}=${value}; HttpOnly; Path=/api/auth/workos; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
// The staff-app page to come back to after signing in (staff-signin-workos-screens
// design 3): only /workshop or a page under it, never anywhere else. Read the
// way a browser would (dot segments, %2e, tabs and line breaks gone, other
// characters %-encoded), so what is checked is where the browser would go and
// nothing in it can break the reply (review).
const FROM_COOKIE = 'wh_signin_from';
const HERE = 'http://wheelhouse.invalid';
function staffAppPage(from) {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//') || from.includes('\\')) return null;
  let url;
  try {
    url = new URL(from, HERE);
  } catch {
    return null;
  }
  if (url.origin !== HERE) return null;
  return url.pathname === '/workshop' || url.pathname.startsWith('/workshop/') ? url.pathname + url.search : null;
}

function sameState(a, b) {
  if (!a || !b) return false;
  const [x, y] = [Buffer.from(a), Buffer.from(b)];
  return x.length === y.length && timingSafeEqual(x, y);
}

function redirect(res, location, cookies = []) {
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.writeHead(302, { Location: location });
  res.end();
}
// Where a failed WorkOS sign-in goes: the staff app, whose signed-out page
// links to WorkOS and will show the reason (staff-signin-workos-screens).
// off, failed, unchecked, not-on-staff, busy.
const signinFailed = (req, res, reason) =>
  redirect(res, `/workshop?signin=${reason}`, [stateCookie(req, '', 0), stateCookie(req, '', 0, FROM_COOKIE)]);

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

const callbackLimiter = makeRateLimiter(10, 15 * 60 * 1000); // 10 attempts / 15 min / IP

const signupLimiter = makeRateLimiter(5, 60 * 60 * 1000); // 5 new shops / hour / IP

function serializeSession({ login, shop }) {
  return {
    id: login.id,
    name: login.name,
    email: login.email,
    isOwner: !!login.is_owner,
    shopName: shop.name,
    shopSlug: shop.slug,
  };
}

// Unlike every other staff route, everything under /api/auth/ doesn't run
// inside runWithShop (see the request handler at the bottom of server.js) - it
// only ever touches the shop/login registry (auth.js), never a specific shop's
// data, and each handler resolves its own session via currentSession().

export function register(route) {
  // Closed by default (no SIGNUP_CODE set): the app is reachable from the open
  // internet now, and without this, anyone who finds the URL could create a
  // shop account. Set SIGNUP_CODE in the environment and share it privately
  // with whoever you actually want to be able to sign up.
  route('POST', '/api/auth/signup', async (req, res) => {
    const ip = clientIp(req);
    if (!signupLimiter.check(ip)) return sendJson(res, 429, { error: 'Too many accounts created from this network - please try again later.' });
    const body = await readJsonBody(req);
    if (!process.env.SIGNUP_CODE || body.signupCode !== process.env.SIGNUP_CODE) {
      return sendJson(res, 403, { error: process.env.SIGNUP_CODE ? 'Invalid invite code' : 'Signups are currently closed' });
    }
    let created;
    try {
      created = await createShop({ shopName: body.shopName, ownerName: body.ownerName, email: body.email, password: body.password });
    } catch (err) {
      if (err instanceof AuthError) return badRequest(res, err.message);
      throw err;
    }
    const token = await createSession(created.login.id);
    setSessionCookie(req, res, token);
    sendJson(res, 201, serializeSession(await getSessionContext(token)));
  });

  // WorkOS only (Jack, 25 Oct; staff-signin-workos design 7): the route stays
  // so the old app and the print helper get a clear answer. The body is still
  // read, so a request is answered only once it has all arrived.
  route('POST', '/api/auth/login', async (req, res) => {
    await readJsonBody(req);
    sendJson(res, 410, { error: 'Staff sign in through WorkOS now' });
  });

  route('GET', '/api/auth/workos/start', async (req, res, params, query) => {
    const provider = staffSigninProvider();
    if (!provider) return signinFailed(req, res, 'off');
    const state = randomBytes(24).toString('hex');
    const from = staffAppPage(query.get('from'));
    redirect(res, provider.authorizeUrl({ state, redirectUri: provider.redirectUri() }), [
      stateCookie(req, state, 600),
      stateCookie(req, from ? encodeURIComponent(from) : '', from ? 600 : 0, FROM_COOKIE),
    ]);
  });

  // The pretend WorkOS's own page, only while it is the one connected.
  route('GET', '/api/auth/workos/pretend', async (req, res, params, query) => {
    const provider = staffSigninProvider();
    if (provider?.name !== 'pretend') return notFound(res);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(provider.page({ state: query.get('state') || '' }));
  });
  route('POST', '/api/auth/workos/pretend', async (req, res) => {
    const provider = staffSigninProvider();
    if (provider?.name !== 'pretend') return notFound(res);
    const form = new URLSearchParams((await readRawBody(req, 10_000)).toString('utf8'));
    redirect(res, provider.issue({
      email: form.get('email'), verified: form.get('verified') === 'on', user: form.get('user'), state: form.get('state'),
    }));
  });

  route('GET', '/api/auth/workos/callback', async (req, res, params, query) => {
    const ip = clientIp(req);
    if (!callbackLimiter.check(ip)) return signinFailed(req, res, 'busy');
    const provider = staffSigninProvider();
    if (!provider) return signinFailed(req, res, 'off');
    const { [STATE_COOKIE]: expected, [SESSION_COOKIE]: earlier, [FROM_COOKIE]: from } = parseCookies(req);
    if (!sameState(query.get('state'), expected)) return signinFailed(req, res, 'failed');
    const signedIn = await provider.authenticate({ code: query.get('code') || '' });
    if (!signedIn) return signinFailed(req, res, 'failed');
    // An email WorkOS hasn't checked is never linked: anyone could make a
    // WorkOS account with a shop owner's email (design 4).
    if (!signedIn.user.emailVerified) return signinFailed(req, res, 'unchecked');
    const login = await loginForWorkosUser(signedIn.user);
    if (!login) return signinFailed(req, res, 'not-on-staff');
    callbackLimiter.reset(ip);
    // Whoever was signed in on this browser before is signed out (review).
    await destroySession(earlier);
    const token = await createSession(login.id, { workosSessionId: signedIn.sessionId });
    // parseCookies has already decoded it (review: not twice).
    const back = staffAppPage(from) ?? '/workshop';
    redirect(res, back, [sessionCookie(req, token), stateCookie(req, '', 0), stateCookie(req, '', 0, FROM_COOKIE)]);
  });

  route('POST', '/api/auth/logout', async (req, res) => {
    const { [SESSION_COOKIE]: token } = parseCookies(req);
    const workosSessionId = await destroySession(token);
    clearSessionCookie(res);
    // A WorkOS sign-in ends at WorkOS too, so the next person at this
    // computer signs in again rather than pressing Continue (design 3).
    const signOutUrl = workosSessionId ? staffSigninProvider()?.logoutUrl({ sessionId: workosSessionId }) : null;
    sendJson(res, 200, signOutUrl ? { ok: true, signOutUrl } : { ok: true });
  });

  route('GET', '/api/auth/me', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) {
      // A session cookie that isn't live any more has run out (or was ended
      // elsewhere): the staff app shows auth-expired, not a fresh sign-in
      // (staff-signin-workos-screens design 2). Signing out clears the cookie.
      const sent = parseCookies(req)[SESSION_COOKIE];
      return sendJson(res, 401, sent ? { error: 'Not signed in', reason: 'expired' } : { error: 'Not signed in' });
    }
    // The staff member this login is (migration 013), so the till knows who
    // is serving. Read here, not in serializeSession, which login and signup
    // share. This route runs outside a shop's scope, so it opens one.
    const employee = ctx.login.employee_id
      ? await runWithShop(ctx.shop.id, () =>
          db.prepare('SELECT id, name, is_cashier FROM employees WHERE id = ? AND active = 1').get(ctx.login.employee_id))
      : null;
    sendJson(res, 200, {
      ...serializeSession(ctx),
      employee: employee ? { id: employee.id, name: employee.name, isCashier: !!employee.is_cashier } : null,
    });
  });
}
