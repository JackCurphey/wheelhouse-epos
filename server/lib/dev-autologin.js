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
// - no matching login means not signed in, never someone else.
// The compose gateway binds 127.0.0.1 only, so a request can't reach it from
// another machine anyway; the Host check is a second line, not the first.
import { pool } from '../db.js';

export function devAutologinOn(env = process.env) {
  return env.WHEELHOUSE_DEV_AUTOLOGIN === '1' && env.NODE_ENV !== 'production' && env.WHEELHOUSE_HOSTED_COPY !== '1';
}

/** Why the server mustn't start, or null: the switch is set where it must never be. */
export function devAutologinRefusal(env = process.env) {
  if (env.WHEELHOUSE_DEV_AUTOLOGIN !== '1') return null;
  if (env.NODE_ENV === 'production') return 'WHEELHOUSE_DEV_AUTOLOGIN=1 would let anyone in without signing in: remove it (NODE_ENV is production).';
  if (env.WHEELHOUSE_HOSTED_COPY === '1') return 'WHEELHOUSE_DEV_AUTOLOGIN=1 would let anyone in without signing in: remove it (this is the hosted test copy).';
  return null;
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i;
export function isLocalHost(req) {
  return LOCAL_HOST.test(String(req.headers?.host ?? ''));
}

/** The dev login's { login, shop }, or null. */
export async function devSession(req, env = process.env) {
  if (!devAutologinOn(env) || !isLocalHost(req)) return null;
  const email = (env.WHEELHOUSE_DEV_LOGIN_EMAIL || '').trim().toLowerCase();
  const { rows: [login] } = email
    ? await pool.query('SELECT * FROM logins WHERE email = $1 AND active', [email])
    : await pool.query('SELECT * FROM logins WHERE is_owner AND active ORDER BY id LIMIT 1');
  if (!login) return null;
  const { rows: [shop] } = await pool.query('SELECT * FROM shops WHERE id = $1', [login.shop_id]);
  return shop ? { login, shop } : null;
}
