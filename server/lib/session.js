// Who is asking: the staff session or the online-booking customer session
// behind a request's cookie, or null (split plan §4.1, WP-0.4). Each reads its
// own cookie, so a customer and a staff session can share a browser. Moved
// out of server.js unchanged.
import { getSessionContext, SESSION_COOKIE } from '../auth.js';
import { getCustomerSessionContext, CUSTOMER_SESSION_COOKIE } from '../customer-auth.js';
import { parseCookies } from './http.js';
import { devSession } from './dev-autologin.js';

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

export async function currentSession(req) {
  if (remembered.has(req)) return remembered.get(req);
  const { [SESSION_COOKIE]: token } = parseCookies(req);
  // A real session wins; with none, local development may sign in by itself (dev-autologin.js).
  return (await getSessionContext(token)) ?? (await devSession(req));
}

export async function currentCustomerSession(req) {
  const { [CUSTOMER_SESSION_COOKIE]: token } = parseCookies(req);
  return getCustomerSessionContext(token);
}
