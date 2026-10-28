// This browser's till (openspec/changes/till-setup, design 1): "Make this
// computer Till B1" keeps a token of the browser's own in a cookie, apart
// from the sign-in, so the computer stays the till whoever signs in. Only
// its hash is stored (tills.browser_token_hash, migration 100). It is never
// the offline till's token (token_hash, the Bearer for /api/till/:slug/*):
// it only says which till a signed-in browser is, so copying it out of the
// browser opens nothing by itself (review, 28 Oct). Row-level security keeps
// the lookup to the request's shop, so another shop's till is no till here.
import { prepare } from '../db.js';
import { hashLinkCode } from '../booking-link.js';
import { isHttpsRequest } from '../proxy-trust.js';
import { parseCookies } from '../lib/http.js';

export const TILL_COOKIE = 'wh_till';
// The longest a browser keeps a cookie (400 days).
const MAX_AGE = 400 * 24 * 60 * 60;

/** The active till this browser was made, or null. */
export async function thisTill(req) {
  const token = tillCookieToken(req);
  if (!token) return null;
  const row = await prepare(
    `SELECT t.id, t.code, t.name, s.name AS site_name FROM tills t JOIN sites s ON s.id = t.site_id
      WHERE t.browser_token_hash = ? AND t.active = true`
  ).get(hashLinkCode(token));
  return row ?? null;
}

export const serializeThisTill = (t) => ({ id: t.id, code: t.code, name: t.name, siteName: t.site_name });

// Tills in number order, so B2 comes before B10 (review, 28 Oct): the site's
// letters, then the number.
export const TILL_ORDER = "substring(code from '^[A-Z]+'), substring(code from '[0-9]+$')::int";

/** This browser's own token from its cookie, as sent, or null. */
export function tillCookieToken(req) {
  const token = parseCookies(req)[TILL_COOKIE];
  return token && /^[0-9a-f]{64}$/.test(token) ? token : null;
}

export const tillCookie = (req, token) =>
  `${TILL_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE}${isHttpsRequest(req) ? '; Secure' : ''}`;
