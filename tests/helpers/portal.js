// Raw-HTTP helpers for the customer booking portal (/api/portal/*).
//
// Signup and login go over real HTTP rather than seeding customer_sessions
// directly, so the cookie a test carries is one the server actually issued.
// A test that hand-rolled a session row would still pass if the real login
// path broke.
import { randomUUID } from 'node:crypto';
import { CUSTOMER_SESSION_COOKIE } from '../../server/customer-auth.js';

function readSessionCookie(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const [pair] = line.split(';');
    const [name, value] = pair.split('=');
    if (name.trim() === CUSTOMER_SESSION_COOKIE) return `${CUSTOMER_SESSION_COOKIE}=${value}`;
  }
  return null;
}

// Creates a portal account for `shopSlug` and returns the issued cookie
// alongside the customers row id the session resolves to.
export async function portalSignup(baseUrl, shopSlug, overrides = {}) {
  const email = overrides.email || `portal-${randomUUID().slice(0, 8)}@example.com`;
  const password = overrides.password || 'password123';
  const name = overrides.name || 'Portal Customer';

  const res = await fetch(`${baseUrl}/api/portal/${shopSlug}/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  const body = await res.json();
  if (res.status !== 201) throw new Error(`portal signup failed (${res.status}): ${JSON.stringify(body)}`);

  const cookie = readSessionCookie(res);
  if (!cookie) throw new Error('portal signup issued no session cookie');
  return { cookie, email, password, name, loginId: body.id };
}

// fetch() against the portal carrying a session cookie. Returns
// { status, body } - every portal route answers JSON.
export async function portalRequest(baseUrl, cookie, path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.cookie = cookie;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: res.status, body: await res.json() };
}
