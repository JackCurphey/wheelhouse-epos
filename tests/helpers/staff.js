// Staff-side helpers: a real shop with a real owner session, for tests that
// have to call the staff API over raw HTTP.
//
// Calls createShop() and createSession() directly rather than POSTing to
// /api/auth/signup. Two reasons: the signup route is invite-gated and
// rate-limited to five new shops an hour per IP, which a test file trips
// long before it runs out of cases, and weakening a real abuse control to
// suit tests is the wrong trade. The session token still comes from
// createSession(), the same function the route calls, so the cookie a test
// carries is a genuine one - only the shop's creation skips the HTTP hop.
//
// createShop() is what matters here anyway: it seeds workshop_settings and
// the customer groups a shop needs before the diary works at all.
import { randomUUID } from 'node:crypto';
import { createShop, createSession, SESSION_COOKIE } from '../../server/auth.js';
import { runWithShop, prepare } from '../../server/db.js';
import { jsonRequest } from './http.js';

// Creates a shop with an owner and returns their session cookie.
export async function staffSignup(baseUrl, overrides = {}) {
  const suffix = randomUUID().slice(0, 8);
  // A name a test asks for still gets the suffix. The shop's web address
  // comes from its name and must be unique across every shop, and two test
  // runs can share one database: two "Till Cycles" made at the same moment
  // both passed createShop's free-address check, and the second failed.
  const created = await createShop({
    shopName: overrides.shopName ? `${overrides.shopName} ${suffix}` : `Test Shop ${suffix}`,
    ownerName: overrides.ownerName || 'Test Owner',
    email: overrides.email || `owner-${suffix}@example.com`,
    password: overrides.password || 'password123',
  });
  const token = await createSession(created.login.id);
  return { cookie: `${SESSION_COOKIE}=${token}`, shop: created.shop, email: created.login.email, loginId: created.login.id };
}

export function staffRequest(baseUrl, cookie, path, options) {
  return jsonRequest(baseUrl, cookie, path, options);
}

// A second, independent session cookie for a login staffSignup already
// created. Logging this one out (destroySession deletes by token, not by
// login) leaves the original cookie - and any other test still using it -
// signed in.
export async function staffFreshCookie(loginId) {
  const token = await createSession(loginId);
  return `${SESSION_COOKIE}=${token}`;
}

// A mechanic to hang jobs on. createShop() seeds settings but no staff.
export async function seedMechanic(shopId, { name = 'Test Mechanic', workingDays = null } = {}) {
  return runWithShop(shopId, async () => {
    const sql = workingDays
      ? 'INSERT INTO employees (name, is_mechanic, working_days) VALUES (?, 1, ?)'
      : 'INSERT INTO employees (name, is_mechanic) VALUES (?, 1)';
    const params = workingDays ? [name, JSON.stringify(workingDays)] : [name];
    const { lastInsertRowid } = await prepare(sql).run(...params);
    return lastInsertRowid;
  });
}

export async function setOpeningDays(shopId, days) {
  return runWithShop(shopId, () =>
    prepare('UPDATE workshop_settings SET opening_days = ?, updated_at = now()').run(JSON.stringify(days))
  );
}

// Gives a signed-in person a till PIN, as Your settings does (Wheelhouse
// picks it, they keep it), and checks them in at the till on their own
// sign-in (openspec/changes/pins-and-checkin). Returns the cookie to send
// from then on, the sign-in's and the check-in's together, and the PIN.
export async function checkInAtTill(baseUrl, cookie) {
  const offer = await jsonRequest(baseUrl, cookie, '/api/your-settings/till-pin/offer', { method: 'POST' });
  if (offer.status !== 201) throw new Error(`no PIN offered: ${offer.status} ${JSON.stringify(offer.body)}`);
  const kept = await jsonRequest(baseUrl, cookie, '/api/your-settings/till-pin', { method: 'POST', body: { pin: offer.body.pin } });
  if (kept.status !== 200) throw new Error(`PIN not kept: ${kept.status} ${JSON.stringify(kept.body)}`);
  return { cookie: await checkInWithPin(baseUrl, cookie, offer.body.pin), pin: offer.body.pin };
}

// Checks in with a PIN the person already has; the cookie to send from then on.
export async function checkInWithPin(baseUrl, cookie, pin) {
  const res = await fetch(`${baseUrl}/api/till-checkin`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ pin }) });
  if (res.status !== 201) throw new Error(`not checked in: ${res.status} ${await res.text()}`);
  const pair = res.headers.getSetCookie().map((line) => line.split(';')[0]).find((p) => p.startsWith('wh_till_checkin='));
  return `${cookie}; ${pair}`;
}

// A browser's cookies for someone signed in and checked in at the till, ready
// for Playwright's context.addCookies (openspec/changes/pins-and-checkin).
export async function tillCookies(baseUrl, cookie) {
  const { cookie: both } = await checkInAtTill(baseUrl, cookie);
  return both.split('; ').map((pair) => {
    const at = pair.indexOf('=');
    return { name: pair.slice(0, at), value: pair.slice(at + 1), url: baseUrl };
  });
}
