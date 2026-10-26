// Who is asking: the staff session or the online-booking customer session
// behind a request's cookie, or null (split plan §4.1, WP-0.4). Each reads its
// own cookie, so a customer and a staff session can share a browser. Moved
// out of server.js unchanged.
import { getSessionContext, SESSION_COOKIE } from '../auth.js';
import { getCustomerSessionContext, CUSTOMER_SESSION_COOKIE, CUSTOMER_SESSION_MAX_AGE_SECONDS } from '../customer-auth.js';
import { isHttpsRequest } from '../proxy-trust.js';
import { parseCookies } from './http.js';
import { devSession } from './dev-autologin.js';

export async function currentSession(req) {
  const { [SESSION_COOKIE]: token } = parseCookies(req);
  // A real session wins; with none, local development may sign in by itself (dev-autologin.js).
  return (await getSessionContext(token)) ?? (await devSession(req));
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
  const ctx = await getCustomerSessionContext(token);
  if (ctx?.renewed && res && !res.headersSent) setCustomerSessionCookie(req, res, token);
  return ctx;
}
