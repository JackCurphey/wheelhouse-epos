// Staff sign-up, sign-in and sign-out: /api/auth/*.
// They run under the dispatcher's /api/ branch (server.js), but before its
// session check and outside runWithShop: a handler gets (req, res, params,
// query) only, with no shop bound and no session required.
// Moved out of server.js unchanged (split plan §4.1, WP-0.4).
import { dbExec, prepare, runWithShop } from '../db.js';
import { AuthError, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSession, createShop, destroySession, getSessionContext, verifyLogin } from '../auth.js';
import { badRequest, makeRateLimiter, parseCookies, readJsonBody, sendJson } from '../lib/http.js';
import { currentSession } from '../lib/session.js';
import { clientIp, isHttpsRequest } from '../proxy-trust.js';

// The same shim server.js uses: each call reads the request's client.
const db = { prepare, exec: dbExec };

function setSessionCookie(req, res, token) {
  const secure = isHttpsRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

const loginLimiter = makeRateLimiter(10, 15 * 60 * 1000); // 10 attempts / 15 min / IP

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

  route('POST', '/api/auth/login', async (req, res) => {
    const ip = clientIp(req);
    if (!loginLimiter.check(ip)) return sendJson(res, 429, { error: 'Too many login attempts - please wait a few minutes and try again.' });
    const body = await readJsonBody(req);
    let login;
    try {
      login = await verifyLogin(body.email, body.password);
    } catch (err) {
      if (err instanceof AuthError) return sendJson(res, 401, { error: err.message });
      throw err;
    }
    loginLimiter.reset(ip);
    const token = await createSession(login.id);
    setSessionCookie(req, res, token);
    sendJson(res, 200, serializeSession(await getSessionContext(token)));
  });

  route('POST', '/api/auth/logout', async (req, res) => {
    const { [SESSION_COOKIE]: token } = parseCookies(req);
    await destroySession(token);
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true });
  });

  route('GET', '/api/auth/me', async (req, res) => {
    const ctx = await currentSession(req);
    if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
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
