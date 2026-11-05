// Migration 116 (openspec/changes/sale-request-key): a sale's request key, once per
// business. Run from empty up to 115, onto a database with a sale, then again.
import '../server/load-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE = path.join(ROOT, 'server/migrations/run-migrations.js');
const FILE = '116_sale_request_key.sql';
const LATER = readdirSync(path.join(ROOT, 'server/migrations')).filter((f) => f.endsWith('.sql') && f >= FILE);

function adminUrlOrSkip(t) {
  try {
    return adminUrlFrom(process.env);
  } catch (err) {
    if (process.env.CI) throw err;
    t.skip('no superuser connection configured');
    return null;
  }
}
async function withClient(url, fn) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try { return await fn(client); } finally { await client.end(); }
}
const migrate = (env) => execFileSync('node', [MIGRATE], { env, encoding: 'utf8', stdio: 'pipe' });
const inShop = (c, id) => c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(id)]);

test('116 adds a sale’s request key, one per business, leaves old sales alone, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig116_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(env);
  const ids = {};
  const aSale = "INSERT INTO sales (subtotal, discount, total, payment_method, cash_amount, card_amount) VALUES (28, 0, 28, 'card', 0, 28) RETURNING id";
  await withClient(url.href, async (c) => {
    ids.shop = (await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id")).rows[0].id;
    ids.other = (await c.query("INSERT INTO shops (name, slug) VALUES ('[Other shop]', 'other-shop') RETURNING id")).rows[0].id;
    await inShop(c, ids.shop);
    ids.old = (await c.query(aSale)).rows[0].id;
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  const stands = async (c) => {
    await inShop(c, ids.shop);
    const { rows: [old] } = await c.query('SELECT total::text AS total, request_key_hash, request_body_hash, request_job_warning FROM sales WHERE id = $1', [ids.old]);
    assert.deepEqual(old, { total: '28.00', request_key_hash: null, request_body_hash: null, request_job_warning: null });
  };
  await withClient(url.href, stands);
  await withClient(url.href, async (c) => {
    await inShop(c, ids.shop);
    const made = async () => (await c.query(aSale)).rows[0].id;
    await c.query('UPDATE sales SET request_key_hash = $1 WHERE id = $2', ['[hash]', await made()]);
    // Many sales with none; one with each key.
    await made();
    await made();
    await assert.rejects(async () => c.query('UPDATE sales SET request_key_hash = $1 WHERE id = $2', ['[hash]', await made()]), /unique/i);
    await inShop(c, ids.other);
    const { rows: [{ id }] } = await c.query(aSale);
    await c.query('UPDATE sales SET request_key_hash = $1 WHERE id = $2', ['[hash]', id]);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM sales')).rows[0].n, 1, 'each business sees its own');
    await inShop(c, ids.shop);
    await c.query('DELETE FROM sales WHERE request_key_hash IS NOT NULL OR id <> $1', [ids.old]);
    await inShop(c, ids.other);
    await c.query('DELETE FROM sales');
  });
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, stands);
});
