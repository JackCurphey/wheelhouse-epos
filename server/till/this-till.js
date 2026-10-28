// This browser's till (openspec/changes/till-setup, design 1): "Make this
// computer Till B1" keeps the till's token in a cookie of its own, apart
// from the sign-in, so the computer stays the till whoever signs in. Only
// the token's hash is stored (migration 036). Row-level security keeps the
// lookup to the request's shop, so another shop's till is no till here.
import { prepare } from '../db.js';
import { hashLinkCode } from '../booking-link.js';
import { isHttpsRequest } from '../proxy-trust.js';
import { parseCookies } from '../lib/http.js';

export const TILL_COOKIE = 'wh_till';
// The longest a browser keeps a cookie (400 days).
const MAX_AGE = 400 * 24 * 60 * 60;

/** The active till this browser was made, or null. */
export async function thisTill(req) {
  const token = parseCookies(req)[TILL_COOKIE];
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await prepare(
    `SELECT t.id, t.code, t.name, s.name AS site_name FROM tills t JOIN sites s ON s.id = t.site_id
      WHERE t.token_hash = ? AND t.active = true`
  ).get(hashLinkCode(token));
  return row ?? null;
}

export const serializeThisTill = (t) => ({ id: t.id, code: t.code, name: t.name, siteName: t.site_name });

export const tillCookie = (req, token) =>
  `${TILL_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE}${isHttpsRequest(req) ? '; Secure' : ''}`;
