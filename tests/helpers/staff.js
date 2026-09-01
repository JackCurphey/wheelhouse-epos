// Staff-side helpers: a real shop with a real owner session, for tests that
// have to call the staff API over raw HTTP.
//
// Goes through POST /api/auth/signup rather than inserting rows, because
// createShop() also seeds workshop_settings and the customer groups a shop
// needs before the diary works at all. The signup route is invite-gated, so
// the server under test must be started with SIGNUP_CODE set - see
// TEST_SIGNUP_CODE below.
import { randomUUID } from 'node:crypto';
import { SESSION_COOKIE } from '../../server/auth.js';
import { pool, runWithShop, prepare } from '../../server/db.js';
import { jsonRequest, readCookie } from './http.js';

export const TEST_SIGNUP_CODE = 'test-signup-code';

// Creates a shop with an owner and returns their session cookie.
export async function staffSignup(baseUrl, overrides = {}) {
  const suffix = randomUUID().slice(0, 8);
  const payload = {
    shopName: overrides.shopName || `Test Shop ${suffix}`,
    ownerName: overrides.ownerName || 'Test Owner',
    email: overrides.email || `owner-${suffix}@example.com`,
    password: overrides.password || 'password123',
    signupCode: TEST_SIGNUP_CODE,
  };

  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (res.status !== 201) throw new Error(`staff signup failed (${res.status}): ${JSON.stringify(body)}`);

  const cookie = readCookie(res, SESSION_COOKIE);
  if (!cookie) throw new Error('staff signup issued no session cookie');

  // The session response carries the shop's slug but not its id, and tests
  // need the id to seed rows under the right RLS context.
  const { rows: [shop] } = await pool.query('SELECT * FROM shops WHERE slug = $1', [body.shopSlug]);
  return { cookie, shop, email: payload.email };
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
