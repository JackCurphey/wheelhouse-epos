// Shop accounts & sessions - the "who is logged in" layer sitting in front of
// the per-shop databases in db.js. Kept in its own registry database (rather
// than one of the per-shop files) since a login must be resolved to a shop
// before we know which shop's file to open.
//
// Each shop has one or more individual "logins" (people who can sign in),
// exactly one of which is the owner. There's no permission system yet beyond
// that owner flag - see server.js for where it's actually enforced (only on
// login management itself, for now).
import { DatabaseSync } from 'node:sqlite';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { DATA_DIR } from './db.js';

const REGISTRY_PATH = path.join(DATA_DIR, 'accounts.db');
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const registry = new DatabaseSync(REGISTRY_PATH);
registry.exec('PRAGMA journal_mode = DELETE;');
registry.exec('PRAGMA foreign_keys = ON;');

registry.exec(`
CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS logins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_owner INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`);

const tableInfo = (name) => registry.prepare(`PRAGMA table_info(${name})`).all();
const tableExists = (name) => !!registry.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);

// Migration: shops used to carry their own email/password directly (one
// login per shop). Move that into a logins row for each existing shop -
// flagged as the owner, since it was the only login that shop had - then
// drop the now-unused columns from shops.
if (tableInfo('shops').some((c) => c.name === 'email')) {
  // Off for the whole block: rebuilding shops (below) would otherwise fail
  // with logins.shop_id still pointing at the old table. Must be set before
  // BEGIN - SQLite ignores this pragma inside a transaction.
  registry.exec('PRAGMA foreign_keys = OFF;');
  registry.exec('BEGIN;');
  try {
    const oldShops = registry.prepare('SELECT * FROM shops').all();
    for (const s of oldShops) {
      registry
        .prepare('INSERT INTO logins (shop_id, name, email, password_hash, is_owner) VALUES (?, ?, ?, ?, 1)')
        .run(s.id, s.name, s.email, s.password_hash);
    }
    // SQLite can't DROP COLUMN on one that carries a UNIQUE constraint (the
    // old email column), so rebuild the table under the new (already-defined
    // above) shape instead - same pattern db.js uses for its migrations.
    registry.exec(
      "CREATE TABLE shops_new (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));"
    );
    registry.exec('INSERT INTO shops_new (id, slug, name, created_at) SELECT id, slug, name, created_at FROM shops;');
    registry.exec('DROP TABLE shops;');
    registry.exec('ALTER TABLE shops_new RENAME TO shops;');
    registry.exec('COMMIT;');
  } catch (err) {
    registry.exec('ROLLBACK;');
    throw err;
  } finally {
    registry.exec('PRAGMA foreign_keys = ON;');
  }
}

// Sessions used to key off shop_id directly; now they key off login_id (the
// specific person signed in). Simplest fix is to drop and recreate rather
// than migrate the column - sessions are short-lived, so everyone signed in
// under the old scheme just signs in again.
if (tableExists('sessions') && !tableInfo('sessions').some((c) => c.name === 'login_id')) {
  registry.exec('DROP TABLE sessions;');
}
registry.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  login_id INTEGER NOT NULL REFERENCES logins(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL
);
`);

export class AuthError extends Error {}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
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

function uniqueSlug(name) {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (registry.prepare('SELECT id FROM shops WHERE slug = ?').get(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateNewLogin({ name, email, password }) {
  name = (name || '').trim();
  email = (email || '').trim().toLowerCase();
  if (!name) throw new AuthError('Name is required');
  if (!EMAIL_RE.test(email)) throw new AuthError('A valid email is required');
  if (!password || password.length < 8) throw new AuthError('Password must be at least 8 characters');
  if (registry.prepare('SELECT id FROM logins WHERE email = ?').get(email)) {
    throw new AuthError('An account with that email already exists');
  }
  return { name, email };
}

function insertLogin({ shopId, name, email, password, isOwner }) {
  const info = registry
    .prepare('INSERT INTO logins (shop_id, name, email, password_hash, is_owner) VALUES (?, ?, ?, ?, ?)')
    .run(shopId, name, email, hashPassword(password), isOwner ? 1 : 0);
  return registry.prepare('SELECT * FROM logins WHERE id = ?').get(info.lastInsertRowid);
}

export function serializeLogin(login) {
  return { id: login.id, name: login.name, email: login.email, isOwner: !!login.is_owner, active: !!login.active };
}

// Creates a shop and its first login (the owner) together - this is what
// happens when someone signs up for the first time.
export function createShop({ shopName, ownerName, email, password }) {
  shopName = (shopName || '').trim();
  if (!shopName) throw new AuthError('Shop name is required');
  const { name, email: cleanEmail } = validateNewLogin({ name: ownerName, email, password });

  const slug = uniqueSlug(shopName);
  const shopInfo = registry.prepare('INSERT INTO shops (slug, name) VALUES (?, ?)').run(slug, shopName);
  const shop = registry.prepare('SELECT * FROM shops WHERE id = ?').get(shopInfo.lastInsertRowid);
  const login = insertLogin({ shopId: shop.id, name, email: cleanEmail, password, isOwner: true });
  return { shop, login };
}

// Adds another login to an existing shop (owner-only, enforced in server.js).
export function createEmployeeLogin({ shopId, name, email, password }) {
  const clean = validateNewLogin({ name, email, password });
  return insertLogin({ shopId, name: clean.name, email: clean.email, password, isOwner: false });
}

export function listLogins(shopId) {
  return registry.prepare('SELECT * FROM logins WHERE shop_id = ? ORDER BY is_owner DESC, name').all(shopId).map(serializeLogin);
}

export function setLoginActive(shopId, loginId, active) {
  const login = registry.prepare('SELECT * FROM logins WHERE id = ? AND shop_id = ?').get(loginId, shopId);
  if (!login) throw new AuthError('Login not found');
  if (login.is_owner) throw new AuthError("The owner login can't be deactivated");
  registry
    .prepare("UPDATE logins SET active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
    .run(active ? 1 : 0, loginId);
  return serializeLogin(registry.prepare('SELECT * FROM logins WHERE id = ?').get(loginId));
}

export function verifyLogin(email, password) {
  email = (email || '').trim().toLowerCase();
  const login = registry.prepare('SELECT * FROM logins WHERE email = ?').get(email);
  if (!login || !login.active || !verifyPassword(password || '', login.password_hash)) {
    throw new AuthError('Invalid email or password');
  }
  return login;
}

export function createSession(loginId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();
  registry.prepare('INSERT INTO sessions (token, login_id, expires_at) VALUES (?, ?, ?)').run(token, loginId, expiresAt);
  return token;
}

// Resolves a session cookie to both the person signed in and their shop -
// server.js uses shop.slug to pick which per-shop database to open, and
// login.isOwner to gate the login-management routes.
export function getSessionContext(token) {
  if (!token) return null;
  const session = registry.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    registry.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  const login = registry.prepare('SELECT * FROM logins WHERE id = ?').get(session.login_id);
  if (!login || !login.active) return null;
  const shop = registry.prepare('SELECT * FROM shops WHERE id = ?').get(login.shop_id);
  if (!shop) return null;
  return { login, shop };
}

export function destroySession(token) {
  if (!token) return;
  registry.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export const SESSION_COOKIE = 'wh_session';
export const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_MS / 1000;
