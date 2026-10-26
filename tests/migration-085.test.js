// Migration 085 (openspec/changes/own-messages-server design 1): a shop's own
// messages, who stopped which, and the outbox and stop codes knowing them.
// Run from empty, then onto a database that already has a shop and customer.
import '../server/load-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE = path.join(ROOT, 'server/migrations/run-migrations.js');
const FILE = '085_shop_messages.sql';

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

test('085 adds the own messages and keeps each shop to its own', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig085_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [FILE]);
  });
  migrate(env);
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    await c.query("INSERT INTO customers (name, email) VALUES ('Maya Patel', 'maya@example.test')");
    await c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const { rows: shops } = await c.query("INSERT INTO shops (name, slug) VALUES ('Other Cycles', 'other-cycles') RETURNING id");
    const { rows: [first] } = await c.query('SELECT id FROM shops ORDER BY id LIMIT 1');
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(first.id)]);
    const { rows: [m] } = await c.query(
      "INSERT INTO shop_messages (name, send_when, amount, unit, by_text, by_email, wording) VALUES ('Spring check', 'after_collected', 6, 'months', false, true, 'Hi') RETURNING id, enabled, active_from"
    );
    assert.equal(m.enabled, true);
    assert.ok(m.active_from instanceof Date);
    const { rows: [maya] } = await c.query('SELECT id FROM customers LIMIT 1');
    await c.query('INSERT INTO shop_message_stops (shop_message_id, customer_id) VALUES ($1, $2)', [m.id, maya.id]);
    await c.query("INSERT INTO reminder_stop_codes (code_hash, customer_id, kind, shop_message_id) VALUES ('x', $1, 'own_message', $2)", [maya.id, m.id]);
    await assert.rejects(c.query("INSERT INTO shop_messages (name, send_when, amount, unit, by_text, by_email, wording) VALUES ('No way', 'after_sale', 1, 'days', false, false, 'Hi')"), /check/i, 'text, email or both');
    await assert.rejects(c.query("INSERT INTO shop_messages (name, send_when, amount, unit, by_text, by_email, wording) VALUES ('Too long', 'after_sale', 25, 'months', true, false, 'Hi')"), /check/i, 'months 1 to 24');
    await c.query('INSERT INTO customer_messages (customer_id, body, status, intent_state, channel, template_key, shop_message_id, event_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [maya.id, 'Hi', 'queued', 'intended', 'email', 'own_message', m.id, 'job:1']);
    await assert.rejects(c.query('INSERT INTO customer_messages (customer_id, body, status, intent_state, channel, template_key, shop_message_id, event_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [maya.id, 'Hi', 'queued', 'intended', 'email', 'own_message', m.id, 'job:1']), /unique|duplicate/i, 'once per job');
    // Another shop sees none of it.
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shops[0].id)]);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM shop_messages')).rows[0].n, 0);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM shop_message_stops')).rows[0].n, 0);
    // Removing a message removes who stopped it, and keeps what went.
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(first.id)]);
    await c.query('DELETE FROM shop_messages WHERE id = $1', [m.id]);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM shop_message_stops')).rows[0].n, 0);
    const { rows: [kept] } = await c.query("SELECT shop_message_id FROM customer_messages WHERE event_key = 'job:1'");
    assert.equal(kept.shop_message_id, null);
  });
});
