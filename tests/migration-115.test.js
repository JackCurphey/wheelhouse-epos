// Migration 115 (openspec/changes/stock-movements-say-who): each stock line can say
// the person, the shop and what caused it. Run from empty up to 114, onto a database
// holding a stock line, then again. Lines already there stay exactly as they were,
// and each business's lines stay its own.
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
const FILE = '115_stock_movements_say_who.sql';
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

test('115 adds who, shop and cause to stock lines, leaves old lines alone, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig115_${process.pid}`;
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
  await withClient(url.href, async (c) => {
    ids.shop = (await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id")).rows[0].id;
    ids.other = (await c.query("INSERT INTO shops (name, slug) VALUES ('[Other shop]', 'other-shop') RETURNING id")).rows[0].id;
    ids.login = (await c.query("INSERT INTO logins (shop_id, name, email, password_hash) VALUES ($1, 'Jack Lewis', 'jack@example.test', 'x') RETURNING id", [ids.shop])).rows[0].id;
    await inShop(c, ids.shop);
    ids.pads = (await c.query("INSERT INTO products (name, stock_qty) VALUES ('Shimano brake pads', 6) RETURNING id")).rows[0].id;
    ids.old = (await c.query("INSERT INTO stock_movements (product_id, change_qty, type, note, reason, login_id) VALUES ($1, -1, 'adjustment', '[Note]', 'damaged', $2) RETURNING id", [ids.pads, ids.login])).rows[0].id;
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });

  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));

  const oldLineStands = async (c) => {
    await inShop(c, ids.shop);
    const { rows: [line] } = await c.query('SELECT change_qty, note, reason, login_id, employee_id, who_name, site_id, sale_id, delivery_id, shopify_refund_id FROM stock_movements WHERE id = $1', [ids.old]);
    assert.deepEqual(line, { change_qty: -1, note: '[Note]', reason: 'damaged', login_id: ids.login, employee_id: null, who_name: null, site_id: null, sale_id: null, delivery_id: null, shopify_refund_id: null });
  };
  await withClient(url.href, oldLineStands);

  await withClient(url.href, async (c) => {
    await inShop(c, ids.shop);
    const { rows: [{ id: employee }] } = await c.query("INSERT INTO employees (name) VALUES ('Jo Taylor') RETURNING id");
    const { rows: [{ id: site }] } = await c.query("INSERT INTO sites (name, code) VALUES ('Bolton', 'B') RETURNING id");
    const { rows: [{ id: line }] } = await c.query("INSERT INTO stock_movements (product_id, change_qty, type, employee_id, who_name, site_id) VALUES ($1, -1, 'adjustment', $2, 'Jo Taylor', $3) RETURNING id", [ids.pads, employee, site]);
    // Removing a person, sale or delivery has an index to find its lines by.
    for (const [name, column] of [['employee', 'employee_id'], ['sale', 'sale_id'], ['delivery', 'delivery_id']]) {
      const { rows: [index] } = await c.query('SELECT indexdef FROM pg_indexes WHERE indexname = $1', [`idx_stock_movements_${name}`]);
      assert.match(index?.indexdef ?? '', new RegExp(`\\(${column}\\) WHERE \\(${column} IS NOT NULL\\)`), name);
    }
    // A link has to be to something real.
    await assert.rejects(c.query("INSERT INTO stock_movements (product_id, change_qty, type, employee_id) VALUES ($1, -1, 'sale', 999999)", [ids.pads]), /foreign key/i);
    await assert.rejects(c.query("INSERT INTO stock_movements (product_id, change_qty, type, site_id) VALUES ($1, -1, 'sale', 999999)", [ids.pads]), /foreign key/i);
    await assert.rejects(c.query("INSERT INTO stock_movements (product_id, change_qty, type, sale_id) VALUES ($1, -1, 'sale', 999999)", [ids.pads]), /foreign key/i);
    await assert.rejects(c.query("INSERT INTO stock_movements (product_id, change_qty, type, delivery_id) VALUES ($1, -1, 'sale', 999999)", [ids.pads]), /foreign key/i);
    // The person can go; their name stays on the line.
    await c.query('DELETE FROM employees WHERE id = $1', [employee]);
    const { rows: [after] } = await c.query('SELECT employee_id, who_name FROM stock_movements WHERE id = $1', [line]);
    assert.deepEqual(after, { employee_id: null, who_name: 'Jo Taylor' });
    await c.query('DELETE FROM stock_movements WHERE id = $1', [line]);
    // Another business sees none of it.
    await inShop(c, ids.other);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM stock_movements')).rows[0].n, 0);
  });

  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, oldLineStands);
});
