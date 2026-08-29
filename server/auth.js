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

async function uniqueSlug(client, name) {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while ((await client.query('SELECT id FROM shops WHERE slug = $1', [slug])).rows[0]) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function validateNewLogin({ name, email, password }) {
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

export function serializeLogin(login) {
  return { id: login.id, name: login.name, email: login.email, isOwner: !!login.is_owner, active: !!login.active };
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
    const slug = await uniqueSlug(client, shopName);
    const { rows: [shop] } = await client.query(
      'INSERT INTO shops (slug, name) VALUES ($1, $2) RETURNING *',
      [slug, shopName]
    );
    // The seed inserts below hit RLS-protected tables (customer_groups,
    // workshop_settings) - their WITH CHECK policy evaluates
    // current_setting('app.current_shop_id') regardless of whether shop_id
    // was passed explicitly or picked up from the column DEFAULT, so this
    // client needs the session variable set even though it isn't going
    // through the normal per-request runWithShop path.
    await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    const login = await insertLogin(client, { shopId: shop.id, name, email: cleanEmail, password, isOwner: true });
    await client.query(
      'INSERT INTO customer_groups (shop_id, name) VALUES ($1, $2), ($1, $3)',
      [shop.id, 'Blue Light', 'ACC']
    );
    await client.query('INSERT INTO workshop_settings (shop_id) VALUES ($1)', [shop.id]);
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

// Adds another login to an existing shop (owner-only, enforced in server.js).
export async function createEmployeeLogin({ shopId, name, email, password }) {
  const clean = await validateNewLogin({ name, email, password });
  return insertLogin(pool, { shopId, name: clean.name, email: clean.email, password, isOwner: false });
}

export async function listLogins(shopId) {
  const { rows } = await pool.query(
    'SELECT * FROM logins WHERE shop_id = $1 ORDER BY is_owner DESC, name',
    [shopId]
  );
  return rows.map(serializeLogin);
}

export async function setLoginActive(shopId, loginId, active) {
  const { rows: [login] } = await pool.query('SELECT * FROM logins WHERE id = $1 AND shop_id = $2', [loginId, shopId]);
  if (!login) throw new AuthError('Login not found');
  if (login.is_owner) throw new AuthError("The owner login can't be deactivated");
  const { rows: [updated] } = await pool.query(
    "UPDATE logins SET active = $1, updated_at = now() WHERE id = $2 RETURNING *",
    [!!active, loginId]
  );
  return serializeLogin(updated);
}

export async function verifyLogin(email, password) {
  email = (email || '').trim().toLowerCase();
  const { rows: [login] } = await pool.query('SELECT * FROM logins WHERE email = $1', [email]);
  if (!login || !login.active || !verifyPassword(password || '', login.password_hash)) {
    throw new AuthError('Invalid email or password');
  }
  return login;
}

export async function createSession(loginId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();
  await pool.query('INSERT INTO sessions (token, login_id, expires_at) VALUES ($1, $2, $3)', [token, loginId, expiresAt]);
  return token;
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

export async function destroySession(token) {
  if (!token) return;
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

export const SESSION_COOKIE = 'wh_session';
export const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_MS / 1000;
