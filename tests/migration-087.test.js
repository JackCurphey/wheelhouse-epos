// Migration 087 (openspec/changes/company-customers design 1): a customer can
// be a company or club, with a contact name, a VAT number and an address to
// send invoices to. Run from an empty scratch database.
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

test('087 gives every customer a person-or-company flag, off to start, and the three company details', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig087_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  migrate(env);
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    const { rows: [maya] } = await c.query("INSERT INTO customers (name, email) VALUES ('Maya Patel', 'maya@example.test') RETURNING *");
    assert.equal(maya.is_company, false, 'a person unless chosen');
    assert.equal(maya.contact_name, null);
    assert.equal(maya.vat_number, null);
    assert.equal(maya.invoice_email, null);
    const { rows: [club] } = await c.query(
      "INSERT INTO customers (name, is_company, contact_name, vat_number, invoice_email) VALUES ('[Company name]', true, '[Contact name]', '[Company VAT number]', '[accounts email]') RETURNING *"
    );
    assert.deepEqual([club.is_company, club.contact_name, club.vat_number, club.invoice_email], [true, '[Contact name]', '[Company VAT number]', '[accounts email]']);
    await assert.rejects(c.query('UPDATE customers SET is_company = NULL WHERE id = $1', [maya.id]), /null/i);
  });
  // Running again changes nothing (the runner records what it ran).
  migrate(env);
});
