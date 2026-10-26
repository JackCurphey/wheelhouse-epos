// Migration 087 (openspec/changes/ask-the-shop-server design 1): one
// conversation per customer, so a message in job_notes is about a repair (its
// job) or a general message (its customer), never both or neither. Run from
// empty, then onto a database that already has a repair note.
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
const FILE = '087_customer_conversation.sql';

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

test('087 keeps every repair note and adds general messages, one or the other', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig087_${process.pid}`;
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
  let noteId;
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    const { rows: [maya] } = await c.query("INSERT INTO customers (name, email) VALUES ('Maya Patel', 'maya@example.test') RETURNING id");
    const { rows: [job] } = await c.query("INSERT INTO workshop_jobs (title, customer_id, reference, job_date) VALUES ('Standard service', $1, 'WH-1042', '2026-09-17') RETURNING id", [maya.id]);
    // Before 087 a note has to have its job.
    await assert.rejects(c.query("INSERT INTO job_notes (from_customer, body) VALUES (true, 'No job')"), /null/i);
    ({ rows: [{ id: noteId }] } = await c.query("INSERT INTO job_notes (workshop_job_id, from_customer, body) VALUES ($1, true, '[Maya’s note to the shop]') RETURNING id", [job.id]));
    await c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const { rows: [first] } = await c.query('SELECT id FROM shops ORDER BY id LIMIT 1');
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(first.id)]);
    // The repair note is as it was.
    const { rows: [kept] } = await c.query('SELECT workshop_job_id, customer_id, body FROM job_notes WHERE id = $1', [noteId]);
    assert.ok(kept.workshop_job_id !== null);
    assert.equal(kept.customer_id, null);
    assert.equal(kept.body, '[Maya’s note to the shop]');
    const { rows: [maya] } = await c.query('SELECT id FROM customers LIMIT 1');
    const { rows: [job] } = await c.query('SELECT id FROM workshop_jobs LIMIT 1');
    // A general message: the customer, no job.
    await c.query("INSERT INTO job_notes (customer_id, from_customer, body) VALUES ($1, true, '[Maya’s message]')", [maya.id]);
    await assert.rejects(c.query("INSERT INTO job_notes (from_customer, body) VALUES (true, 'Neither')"), /job_notes_job_or_customer/, 'neither');
    await assert.rejects(c.query("INSERT INTO job_notes (workshop_job_id, customer_id, from_customer, body) VALUES ($1, $2, true, 'Both')", [job.id, maya.id]), /job_notes_job_or_customer/, 'both');
    // Another shop sees none of it.
    const { rows: [otherShop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('Other Cycles', 'other-cycles') RETURNING id");
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(otherShop.id)]);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM job_notes')).rows[0].n, 0);
    // Removing the customer removes their general messages.
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(first.id)]);
    await c.query('DELETE FROM workshop_jobs');
    await c.query('DELETE FROM customers WHERE id = $1', [maya.id]);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM job_notes')).rows[0].n, 0);
  });
});
