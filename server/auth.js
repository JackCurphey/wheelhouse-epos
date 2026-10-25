// Shop accounts & sessions - the "who is logged in" layer sitting in front of
// the shared, RLS-isolated shop data in db.js. Lives in the same Postgres
// database as everything else now (previously its own SQLite file), but its
// three tables (shops, logins, sessions) carry no shop_id and no RLS policy -
// they're what *resolves* which shop a request belongs to, so querying them
// happens before any shop context exists. Only this file ever touches them
// directly; every other module reaches them through the functions exported
// here.
//
// Each shop has one or more individual "logins" (people who can sign in),
// exactly one of which is the owner. There's no permission system yet beyond
// that owner flag - see server.js for where it's actually enforced (only on
// login management itself, for now).
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { pool } from './db.js';

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class AuthError extends Error {}

// Exported so server/customer-auth.js (a separate, parallel account system
// for customers rather than staff) can reuse the same hashing without
// duplicating it or importing anything shop/login-specific.
export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored).split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function slugify(name) {
  return (
    String(name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'shop'
  );
}

// Inserts the shop at the first free address: name, name-2, name-3...
// Checking first and inserting after let two sign-ups with the same name at
// the same moment both pick the same address, and the second failed on
// shops_slug_key. ON CONFLICT waits for the other sign-up's transaction and,
// if it took the address, inserts nothing, so this one tries the next.
async function insertShopAtFreeSlug(client, name) {
  const base = slugify(name);
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const { rows: [shop] } = await client.query(
      'INSERT INTO shops (slug, name) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING RETURNING *',
      [slug, name]
    );
    if (shop) return shop;
  }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function validateNewLogin({ name, email, password }) {
  name = (name || '').trim();
  email = (email || '').trim().toLowerCase();
  if (!name) throw new AuthError('Name is required');
  if (!EMAIL_RE.test(email)) throw new AuthError('A valid email is required');
  if (!password || password.length < 8) throw new AuthError('Password must be at least 8 characters');
  const { rows } = await pool.query('SELECT id FROM logins WHERE email = $1', [email]);
  if (rows[0]) throw new AuthError('An account with that email already exists');
  return { name, email };
}

async function insertLogin(client, { shopId, name, email, password, isOwner }) {
  const { rows } = await client.query(
    'INSERT INTO logins (shop_id, name, email, password_hash, is_owner) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [shopId, name, email, hashPassword(password), !!isOwner]
  );
  return rows[0];
}

// Adds a person as the owner of a shop that has none, such as the test shop
// the loader makes (add-hosted-copy design 7, task 3.6b): staff sign in only
// through WorkOS, so nobody can be signed in to it to add one from the app.
// Their password is random and never shown; they sign in through WorkOS with
// this email. Logins carry no shop_id policy, so no shop context is needed.
export async function addOwnerLogin({ shopSlug, name, email }) {
  const unused = randomBytes(24).toString('hex');
  const clean = await validateNewLogin({ name, email, password: unused });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Locks the shop, so two at once can't both add an owner.
    const { rows: [shop] } = await client.query('SELECT * FROM shops WHERE slug = $1 FOR UPDATE', [shopSlug]);
    if (!shop) throw new AuthError(`No shop at ${shopSlug}`);
    const { rows: [owner] } = await client.query('SELECT id FROM logins WHERE shop_id = $1 AND is_owner', [shop.id]);
    if (owner) throw new AuthError(`${shop.name} already has an owner`);
    const login = await insertLogin(client, { shopId: shop.id, ...clean, password: unused, isOwner: true });
    await client.query('COMMIT');
    return { ...login, shopName: shop.name };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Creates a shop and its first login (the owner) together, plus the default
// data every shop starts with - what used to appear lazily on first access
// to that shop's SQLite file (getShopDb in db.js) now has to be seeded
// eagerly here instead, since the shared Postgres schema itself is only
// created once, globally, via migrations.
export async function createShop({ shopName, ownerName, email, password }) {
  shopName = (shopName || '').trim();
  if (!shopName) throw new AuthError('Shop name is required');
  const { name, email: cleanEmail } = await validateNewLogin({ name: ownerName, email, password });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const shop = await insertShopAtFreeSlug(client, shopName);
    // The seed inserts below hit RLS-protected tables (customer_groups,
    // workshop_settings) - their WITH CHECK policy evaluates
    // current_setting('app.current_shop_id') regardless of whether shop_id
    // was passed explicitly or picked up from the column DEFAULT, so this
    // client needs the session variable set even though it isn't going
    // through the normal per-request runWithShop path.
    // is_local = true: scoped to the BEGIN above, so it is gone the moment
    // this transaction ends and cannot ride back into the pool on this
    // client for whoever gets it next. Session scope here was the same leak
    // runWithShop had (see server/db.js), on a different code path. Matches
    // server/customer-auth.js exactly.
    await client.query("SELECT set_config('app.current_shop_id', $1, true)", [String(shop.id)]);
    const login = await insertLogin(client, { shopId: shop.id, name, email: cleanEmail, password, isOwner: true });
    await client.query(
      'INSERT INTO customer_groups (shop_id, name) VALUES ($1, $2), ($1, $3)',
      [shop.id, 'Blue Light', 'ACC']
    );
    // No reserve for a new shop: lunch and admin are blocks now (migration 023),
    // and a reserve on top would charge for them twice. The column default stays
    // 120 so existing shops, and the test fixtures that rely on it, are unchanged.
    await client.query('INSERT INTO workshop_settings (shop_id, full_day_threshold_minutes) VALUES ($1, 0)', [shop.id]);
    await client.query('INSERT INTO label_settings (shop_id) VALUES ($1)', [shop.id]);
    await client.query('INSERT INTO shop_theme (shop_id) VALUES ($1)', [shop.id]);
    // Every shop starts with a mock supplier so the catalogue-sync feature
    // is immediately testable - revisit once a real distributor adapter
    // (e.g. Madison) exists, since seeding a mock one for every real shop
    // stops making sense at that point.
    await client.query(
      "INSERT INTO suppliers (shop_id, name, adapter_type, config) VALUES ($1, 'Madison (mock)', 'mock_csv', '{}'::jsonb)",
      [shop.id]
    );
    await client.query('COMMIT');
    return { shop, login };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}


// workosSessionId: the WorkOS session behind it, when the person signed in on
// WorkOS's page, so signing out can end that too (staff-signin-workos design 3).
export async function createSession(loginId, { workosSessionId = null } = {}) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();
  await pool.query(
    'INSERT INTO sessions (token, login_id, expires_at, workos_session_id) VALUES ($1, $2, $3, $4)',
    [token, loginId, expiresAt, workosSessionId]
  );
  return token;
}

// The login a person WorkOS has signed in belongs to (staff-signin-workos
// design 4): the one linked to them, or else the unlinked login with their
// email, which is linked now. Null for a turned-off login, no match, or a
// login linked to someone else - one answer for all three. The caller has
// already refused an email WorkOS hasn't checked.
export async function loginForWorkosUser({ id, email }) {
  let { rows: [login] } = await pool.query('SELECT * FROM logins WHERE workos_user_id = $1', [id]);
  if (!login) {
    try {
      ({ rows: [login] } = await pool.query(
        'UPDATE logins SET workos_user_id = $1 WHERE email = $2 AND workos_user_id IS NULL AND active RETURNING *',
        [id, email]
      ));
    } catch (err) {
      // Two first sign-ins at once: the other one linked this person.
      if (err.code === '23505') return loginForWorkosUser({ id, email: null });
      throw err;
    }
  }
  return login && login.active ? login : null;
}

// Resolves a session cookie to both the person signed in and their shop -
// server.js uses shop.id to set the RLS session variable for the rest of the
// request (runWithShop in db.js), and login.isOwner to gate the
// login-management routes.
export async function getSessionContext(token) {
  if (!token) return null;
  const { rows: [session] } = await pool.query('SELECT * FROM sessions WHERE token = $1', [token]);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    return null;
  }
  const { rows: [login] } = await pool.query('SELECT * FROM logins WHERE id = $1', [session.login_id]);
  if (!login || !login.active) return null;
  const { rows: [shop] } = await pool.query('SELECT * FROM shops WHERE id = $1', [login.shop_id]);
  if (!shop) return null;
  return { login, shop };
}

// Returns the WorkOS session behind it, if there was one, for its sign-out.
export async function destroySession(token) {
  if (!token) return null;
  const { rows: [gone] } = await pool.query('DELETE FROM sessions WHERE token = $1 RETURNING workos_session_id', [token]);
  return gone?.workos_session_id ?? null;
}

export const SESSION_COOKIE = 'wh_session';
export const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_MS / 1000;
