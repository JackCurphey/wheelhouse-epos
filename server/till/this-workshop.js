// This browser's workshop computer (openspec/changes/workshop-computer,
// design 1; walk-through 8 decision 1): "Make this computer a workshop
// computer" keeps a key of the browser's own in a cookie, apart from the
// sign-in and from a till's, so the computer stays a workshop computer
// whoever signs in. Only its hash is stored (workshop_computers,
// migration 101). Like a till's browser key, it only says which workshop
// computer a signed-in browser is and opens nothing by itself. Row-level
// security keeps the lookup to the request's shop.
import { prepare } from '../db.js';
import { hashLinkCode } from '../booking-link.js';
import { isHttpsRequest } from '../proxy-trust.js';
import { parseCookies } from '../lib/http.js';

export const WORKSHOP_COOKIE = 'wh_workshop';
// The longest a browser keeps a cookie (400 days), as the till's.
const MAX_AGE = 400 * 24 * 60 * 60;
/** Left alone this long, a workshop computer's check-in stops counting (build plan Q6). */
export const IDLE_MINUTES = 10;

/**
 * The request's shop's trust PIN and how long its workshop computers wait
 * (openspec/changes/trust-pin-workshop; roles and switches 9): with trust
 * PIN off, always 10 minutes; with it on, the time chosen, or null for
 * never (Off).
 */
export async function trustPinHere() {
  const shop = await prepare("SELECT trust_pin, workshop_idle_minutes FROM shops WHERE id = current_setting('app.current_shop_id')::int").get();
  const trustPin = shop?.trust_pin === true;
  return { trustPin, idleMinutes: trustPin ? shop.workshop_idle_minutes : IDLE_MINUTES };
}

/** The active workshop computer this browser was made, or null. */
export async function thisWorkshop(req) {
  const token = workshopCookieToken(req);
  if (!token) return null;
  const row = await prepare(
    `SELECT w.id, w.name, s.name AS site_name FROM workshop_computers w JOIN sites s ON s.id = w.site_id
      WHERE w.browser_token_hash = ? AND w.active = true`
  ).get(hashLinkCode(token));
  return row ?? null;
}

export const serializeThisWorkshop = (w) => ({ id: w.id, name: w.name, siteName: w.site_name });

/** This browser's own key from its cookie, as sent, or null. */
export function workshopCookieToken(req) {
  const token = parseCookies(req)[WORKSHOP_COOKIE];
  return token && /^[0-9a-f]{64}$/.test(token) ? token : null;
}

export const workshopCookie = (req, token) =>
  `${WORKSHOP_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE}${isHttpsRequest(req) ? '; Secure' : ''}`;
