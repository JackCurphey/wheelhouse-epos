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
  const created = await createShop({
    shopName: overrides.shopName || `Test Shop ${suffix}`,
    ownerName: overrides.ownerName || 'Test Owner',
    email: overrides.email || `owner-${suffix}@example.com`,
    password: overrides.password || 'password123',
  });
  const token = await createSession(created.login.id);
  return { cookie: `${SESSION_COOKIE}=${token}`, shop: created.shop, email: created.login.email };
}

export function staffRequest(baseUrl, cookie, path, options) {
  return jsonRequest(baseUrl, cookie, path, options);
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
