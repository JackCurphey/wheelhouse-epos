// Who is asking: the staff session or the online-booking customer session
// behind a request's cookie, or null (split plan §4.1, WP-0.4). Each reads its
// own cookie, so a customer and a staff session can share a browser. Moved
// out of server.js unchanged.
import { getSessionContext, SESSION_COOKIE } from '../auth.js';
import { getCustomerSessionContext, CUSTOMER_SESSION_COOKIE, CUSTOMER_SESSION_MAX_AGE_SECONDS } from '../customer-auth.js';
import { isHttpsRequest } from '../proxy-trust.js';
import { parseCookies } from './http.js';
import { devSession } from './dev-autologin.js';
import { dbContext } from '../db.js';
import { ownerHere } from './workshop-owner.js';

// The staff session the dispatcher in server.js looked up for this request,
// BEFORE it took the request's pooled connection (runWithShop). A handler
// asking again from inside runWithShop gets this answer back instead of
// running getSessionContext, whose pool.query would need a second connection
// from the same pool while this request still holds its first: ten requests
// doing that at once held all ten and waited for an eleventh until the
// 5-second connection wait failed them all
// (openspec/changes/server-connection-per-request). Keyed by the request
// object itself, so an answer can never reach another request, and it goes
// when the request does.
const remembered = new WeakMap();

export function rememberSession(req, ctx) {
  remembered.set(req, ctx);
}

/** The sign-in as stored, whatever browser it is on. */
export async function signedInSession(req) {
  if (remembered.has(req)) return remembered.get(req);
  const { [SESSION_COOKIE]: token } = parseCookies(req);
  // A real session wins; with none, local development may sign in by itself (dev-autologin.js).
  return (await getSessionContext(token)) ?? (await devSession(req));
}

/**
 * The sign-in a route acts on. Inside the request's shop scope, on a
 * workshop computer the Owner's sign-in counts as the Owner only while the
 * Owner is the person checked in by PIN, and as staff otherwise
 * (workshop-owner.js; openspec/changes/workshop-computer design 9), so every
 * Owner-only check, ownerOnly or a route's own, refuses there. Outside a shop
 * scope (the dispatcher's early lookup) it is the sign-in as stored.
 */
export async function currentSession(req) {
  const ctx = await signedInSession(req);
  if (!ctx?.login.is_owner || !dbContext.getStore()) return ctx;
  if (await ownerHere(req, ctx)) return ctx;
  return { ...ctx, login: { ...ctx.login, is_owner: false } };
}

// The same for a customer on the shop's website: the dispatcher's portal
// branch in server.js looks the customer up here, before runWithShop takes the
// request's connection, and only when the request carries the cookie (with no
// cookie there is nothing to look up and no query is run). Without this, ten
// requests with any cookie at all, even a made-up one, held all ten
// connections waiting for an eleventh (openspec/changes/
// portal-connection-per-request). The answer, a session or null, is kept per
// request object, exactly as for staff; each route still checks that it
// belongs to the shop it asked.
const rememberedCustomers = new WeakMap();

// A lookup that fails stores nothing: a route that needs the customer looks
// them up itself as before, and a public page (/services, /terms) that never
// asks is not failed by a lookup it didn't need (review, 26 Oct).
export async function rememberCustomerSession(req) {
  try {
    const { [CUSTOMER_SESSION_COOKIE]: token } = parseCookies(req);
    if (token) rememberedCustomers.set(req, await getCustomerSessionContext(token));
  } catch (err) {
    console.error('The customer sign-in lookup failed; the route will look again if it needs it', err);
  }
}

/** The customer's session cookie, for the full 30 days from now. */
export function setCustomerSessionCookie(req, res, token) {
  const secure = isHttpsRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${CUSTOMER_SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${CUSTOMER_SESSION_MAX_AGE_SECONDS}${secure}`
  );
}

/**
 * The signed-in customer, or null. With `res`, a session renewed by this visit
 * (30 days from the last visit, ask-the-shop-server design 6) gets its cookie
 * set again for the full 30 days.
 */
export async function currentCustomerSession(req, res = null) {
  const { [CUSTOMER_SESSION_COOKIE]: token } = parseCookies(req);
  // The dispatcher's early lookup, when there was one; it renewed the session
  // if this visit did, so its cookie is set again here all the same.
  const ctx = rememberedCustomers.has(req) ? rememberedCustomers.get(req) : await getCustomerSessionContext(token);
  if (ctx?.renewed && res && !res.headersSent) setCustomerSessionCookie(req, res, token);
  return ctx;
}
