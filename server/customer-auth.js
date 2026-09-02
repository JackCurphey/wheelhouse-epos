// Customer accounts & sessions - a second, parallel account system to
// auth.js's staff one, for the online booking portal (server/server.js's
// /api/portal/* routes, public-portal/). Deliberately separate rather than
// reusing logins/sessions: customers and staff are different audiences with
// different trust levels, and keeping them in different tables means a bug
// here can't accidentally grant portal code staff-level access or vice
// versa.
//
// customer_logins/customer_sessions carry no shop_id-defaulted columns and
// no RLS, for the same reason logins/sessions don't: resolving which shop a
// session belongs to has to happen before any shop context exists. Once
// resolved, portal routes in server.js go through the normal
// runWithShop(shop.id, ...) - same as staff routes - so everything they
// touch afterward (customers, customer_bikes, workshop_jobs) is RLS-scoped
// exactly like it already is for staff.
import { randomBytes } from 'node:crypto';
import { pool, prepare } from './db.js';
import { hashPassword, verifyPassword, EMAIL_RE } from './auth.js';

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class CustomerAuthError extends Error {}

export function serializeCustomerLogin(login) {
  return { id: login.id, email: login.email, customerId: login.customer_id, active: !!login.active };
}

// Signs a customer up for a specific shop's portal. Matches them to an
// existing customers row by email if the shop already has one on file
// (e.g. from an in-store purchase), otherwise creates a new one - either
// way, customer_id is the link from then on, so later edits to a
// customer's email in the Office UI never re-run this match or break the
// connection to their login.
export async function signupCustomer({ shopSlug, email, password, name }) {
  email = (email || '').trim().toLowerCase();
  name = (name || '').trim();
  if (!name) throw new CustomerAuthError('Name is required');
  if (!EMAIL_RE.test(email)) throw new CustomerAuthError('A valid email is required');
  if (!password || password.length < 8) throw new CustomerAuthError('Password must be at least 8 characters');

  const { rows: [shop] } = await pool.query('SELECT * FROM shops WHERE slug = $1', [shopSlug]);
  if (!shop) throw new CustomerAuthError('Shop not found');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // customers is RLS-protected; this client needs shop context for the
    // duration of this transaction to read/write it, same as
    // auth.js's createShop().
    await client.query("SELECT set_config('app.current_shop_id', $1, true)", [String(shop.id)]);

    const { rows: [existingLogin] } = await client.query(
      'SELECT id FROM customer_logins WHERE shop_id = $1 AND email = $2',
      [shop.id, email]
    );
    if (existingLogin) throw new CustomerAuthError('An account with that email already exists');

    let { rows: [customer] } = await client.query('SELECT * FROM customers WHERE email = $1', [email]);
    if (!customer) {
      ({ rows: [customer] } = await client.query(
        'INSERT INTO customers (name, email, updated_at) VALUES ($1, $2, now()) RETURNING *',
        [name, email]
      ));
    }

    const { rows: [login] } = await client.query(
      'INSERT INTO customer_logins (shop_id, customer_id, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING *',
      [shop.id, customer.id, email, hashPassword(password)]
    );
    await client.query('COMMIT');
    return { shop, customer, login };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Resolves a guest booking (no account, no login) to a customers row,
// matched by phone within the current shop - reusing signupCustomer's "match
// an existing customer if we can, otherwise create one" idea, but simpler:
// no customer_logins row is ever created, and this always runs from inside a
// route that's already resolved shop context (via runWithShop), so it can
// use the plain RLS-scoped `prepare` shim instead of opening its own
// transaction and set_config like signupCustomer must.
export async function resolveGuestCustomer({ name, phone }) {
  name = (name || '').trim();
  phone = (phone || '').trim();
  if (!name) throw new CustomerAuthError('Name is required');
  if (!phone) throw new CustomerAuthError('Phone number is required');

  // A phone number typed into a public booking form is not proof that the
  // person typing it owns that number. Matching on it alone attached a
  // stranger's booking - and, through the portal, that customer's job
  // history - to whoever's number they entered. Every guest booking now
  // gets its own customers row; merging duplicates is a staff decision made
  // in the Office UI, where the shop can actually verify who is who.
  const info = await prepare(
    'INSERT INTO customers (name, phone, updated_at) VALUES (?, ?, ?)'
  ).run(name, phone, new Date().toISOString());
  return await prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid);
}

export async function verifyCustomerLogin(shopSlug, email, password) {
  email = (email || '').trim().toLowerCase();
  const { rows: [shop] } = await pool.query('SELECT * FROM shops WHERE slug = $1', [shopSlug]);
  if (!shop) throw new CustomerAuthError('Invalid email or password');
  const { rows: [login] } = await pool.query(
    'SELECT * FROM customer_logins WHERE shop_id = $1 AND email = $2',
    [shop.id, email]
  );
  if (!login || !login.active || !verifyPassword(password || '', login.password_hash)) {
    throw new CustomerAuthError('Invalid email or password');
  }
  return login;
}

export async function createCustomerSession(customerLoginId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();
  await pool.query(
    'INSERT INTO customer_sessions (token, customer_login_id, expires_at) VALUES ($1, $2, $3)',
    [token, customerLoginId, expiresAt]
  );
  return token;
}

// Resolves a customer session cookie to the login and their shop - mirrors
// auth.js's getSessionContext exactly, including NOT fetching the full
// customers row here (that table is RLS-protected; route handlers fetch it
// themselves once inside runWithShop, same as staff routes already do for
// whatever data they need).
export async function getCustomerSessionContext(token) {
  if (!token) return null;
  const { rows: [session] } = await pool.query('SELECT * FROM customer_sessions WHERE token = $1', [token]);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await pool.query('DELETE FROM customer_sessions WHERE token = $1', [token]);
    return null;
  }
  const { rows: [login] } = await pool.query('SELECT * FROM customer_logins WHERE id = $1', [session.customer_login_id]);
  if (!login || !login.active) return null;
  const { rows: [shop] } = await pool.query('SELECT * FROM shops WHERE id = $1', [login.shop_id]);
  if (!shop) return null;
  return { login, shop };
}

export async function destroyCustomerSession(token) {
  if (!token) return;
  await pool.query('DELETE FROM customer_sessions WHERE token = $1', [token]);
}

export const CUSTOMER_SESSION_COOKIE = 'wh_customer_session';
export const CUSTOMER_SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_MS / 1000;
