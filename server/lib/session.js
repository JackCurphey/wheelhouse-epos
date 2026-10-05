// Who is asking: the staff session or the online-booking customer session
// behind a request's cookie, or null (split plan §4.1, WP-0.4). Each reads its
// own cookie, so a customer and a staff session can share a browser. Moved
// out of server.js unchanged.
import { getSessionContext, SESSION_COOKIE } from '../auth.js';
import { getCustomerSessionContext, CUSTOMER_SESSION_COOKIE } from '../customer-auth.js';
import { parseCookies } from './http.js';

export async function currentSession(req) {
  const { [SESSION_COOKIE]: token } = parseCookies(req);
  return getSessionContext(token);
}

export async function currentCustomerSession(req) {
  const { [CUSTOMER_SESSION_COOKIE]: token } = parseCookies(req);
  return getCustomerSessionContext(token);
}
