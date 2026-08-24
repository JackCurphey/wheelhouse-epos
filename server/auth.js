// Shop accounts & sessions - the "who is logged in" layer sitting in front of
// the per-shop databases in db.js. Kept in its own registry database (rather
// than one of the per-shop files) since it needs to be queried before we know
// which shop a request belongs to.
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
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
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
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'shop';
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

export function serializeShop(row) {
  return { id: row.id, slug: row.slug, name: row.name, email: row.email };
}

export function createShop({ name, email, password }) {
  name = (name || '').trim();
  email = (email || '').trim().toLowerCase();
  if (!name) throw new AuthError('Shop name is required');
  if (!EMAIL_RE.test(email)) throw new AuthError('A valid email is required');
  if (!password || password.length < 8) throw new AuthError('Password must be at least 8 characters');
  if (registry.prepare('SELECT id FROM shops WHERE email = ?').get(email)) {
    throw new AuthError('An account with that email already exists');
  }
  const slug = uniqueSlug(name);
  const info = registry
    .prepare('INSERT INTO shops (slug, name, email, password_hash) VALUES (?, ?, ?, ?)')
    .run(slug, name, email, hashPassword(password));
  return registry.prepare('SELECT * FROM shops WHERE id = ?').get(info.lastInsertRowid);
}

export function verifyLogin(email, password) {
  email = (email || '').trim().toLowerCase();
  const row = registry.prepare('SELECT * FROM shops WHERE email = ?').get(email);
  if (!row || !verifyPassword(password || '', row.password_hash)) {
    throw new AuthError('Invalid email or password');
  }
  return row;
}

export function createSession(shopId) {
  const token = randomBytes32Hex();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();
  registry.prepare('INSERT INTO sessions (token, shop_id, expires_at) VALUES (?, ?, ?)').run(token, shopId, expiresAt);
  return token;
}

function randomBytes32Hex() {
  return randomBytes(32).toString('hex');
}

export function getShopForSession(token) {
  if (!token) return null;
  const session = registry.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    registry.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return registry.prepare('SELECT * FROM shops WHERE id = ?').get(session.shop_id);
}

export function destroySession(token) {
  if (!token) return;
  registry.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export const SESSION_COOKIE = 'wh_session';
export const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_MS / 1000;
