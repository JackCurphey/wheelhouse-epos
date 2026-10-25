// Local development without signing in. With WHEELHOUSE_DEV_AUTOLOGIN=1, a
// request that carries no session and is addressed to localhost is treated as
// the dev login: the owner whose email is WHEELHOUSE_DEV_LOGIN_EMAIL, else the
// oldest active owner. A real session cookie still wins.
//
// It is for a developer's own machine and fails closed:
// - off unless the variable is exactly "1";
// - never when NODE_ENV is production or WHEELHOUSE_HOSTED_COPY=1, and the
//   server refuses to start with the variable set in either (devAutologinRefusal);
// - only for a request whose Host is localhost, 127.0.0.1 or [::1], so a
//   request through any other name is signed out as usual;
// - a write (anything but GET or HEAD) only from the app's own origin: a web
//   page the developer visits can make the browser call localhost with no
//   cookie, and reading the answer is blocked but a write would land;
// - signing out sticks (a wh_dev_signed_out cookie) until someone signs in;
// - no matching login means not signed in, never someone else.
// - only over a connection from this machine: anyone on the same network can
//   write "Host: localhost" themselves, so the real address of the connection
//   must be loopback. Behind the compose gateway (TRUST_PROXY=1) the app sees
//   the gateway's address; that gateway publishes 127.0.0.1 only, so it counts.
import { pool } from '../db.js';
import { parseCookies } from './http.js';

const inProduction = (env) => String(env.NODE_ENV ?? '').trim().toLowerCase() === 'production';

export function devAutologinOn(env = process.env) {
  return env.WHEELHOUSE_DEV_AUTOLOGIN === '1' && !inProduction(env) && env.WHEELHOUSE_HOSTED_COPY !== '1';
}

/** Why the server mustn't start, or null: the switch is set where it must never be. */
export function devAutologinRefusal(env = process.env) {
  if (env.WHEELHOUSE_DEV_AUTOLOGIN !== '1') return null;
  if (inProduction(env)) return 'WHEELHOUSE_DEV_AUTOLOGIN=1 would let anyone in without signing in: remove it (NODE_ENV is production).';
  if (env.WHEELHOUSE_HOSTED_COPY === '1') return 'WHEELHOUSE_DEV_AUTOLOGIN=1 would let anyone in without signing in: remove it (this is the hosted test copy).';
  return null;
}

/** The connection is from this machine, or from the compose gateway that only listens on 127.0.0.1. */
export function remoteIsLocal(req, env = process.env) {
  if (env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true') return true;
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.remoteAddress);
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i;
export function isLocalHost(req) {
  return LOCAL_HOST.test(String(req.headers?.host ?? ''));
}

/**
 * A write must come from the app's own origin. Browsers say where a request
 * came from: Sec-Fetch-Site (same-site, which another localhost port is, is
 * not enough) or Origin. A tool that sends neither (curl, a test) is fine: it
 * isn't a web page acting for the developer.
 */
export function sameOriginEnough(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const site = req.headers?.['sec-fetch-site'];
  if (site !== undefined) return site === 'same-origin' || site === 'none';
  const origin = req.headers?.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export const DEV_SIGNED_OUT_COOKIE = 'wh_dev_signed_out';

/**
 * The dev login's { login, shop }, or null. With no email named, the oldest
 * active owner of any shop (fine for one developer database); with one, that
 * login, owner or not.
 */
export async function devSession(req, env = process.env) {
  if (!devAutologinOn(env) || !remoteIsLocal(req, env) || !isLocalHost(req) || !sameOriginEnough(req)) return null;
  if (parseCookies(req)[DEV_SIGNED_OUT_COOKIE]) return null;
  const email = (env.WHEELHOUSE_DEV_LOGIN_EMAIL || '').trim().toLowerCase();
  const { rows: [login] } = email
    ? await pool.query('SELECT * FROM logins WHERE email = $1 AND active', [email])
    : await pool.query('SELECT * FROM logins WHERE is_owner AND active ORDER BY id LIMIT 1');
  if (!login) return null;
  const { rows: [shop] } = await pool.query('SELECT * FROM shops WHERE id = $1', [login.shop_id]);
  return shop ? { login, shop } : null;
}
