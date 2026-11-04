// Migration 114 (openspec/changes/products-in-pence, design 1): a product's price
// and cost in whole pence, worked out by the database from its pounds. Run from
// empty up to 113, onto a database holding awkward made-up prices, then again.
// Each figure is checked against the pounds read as text with the point taken out,
// so the check shares no arithmetic with what it checks.
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
const FILE = '114_products_in_pence.sql';
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
const inShop = (c, shopId) => c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shopId)]);

// Pounds as stored → pence: awkward because binary floating point can't hold them
// (19.99 * 100 is 1998.9999999999998), because they sit on either side of what an
// INTEGER holds, or because the old form could save them.
const AWKWARD = [
  ['0.00', 0], ['0.01', 1], ['0.07', 7], ['0.29', 29], ['0.57', 57], ['1.10', 110], ['1.15', 115],
  ['4.35', 435], ['8.20', 820], ['19.99', 1999], ['28.00', 2800], ['1001.10', 100110], ['21474836.47', 2147483647],
  ['21474836.48', 2147483648], ['99999999.99', 9999999999],
];
const NEGATIVE_COSTS = [['-0.01', -1], ['-14.50', -1450], ['-19.99', -1999]];
const SWEEP = 100001;

// The pounds as text with the point taken out and the minus sign kept apart.
const wrongFigures = (c) => c.query(`SELECT count(*)::int AS rows,
  count(*) FILTER (WHERE price_pence <> sign(price)::int * replace(ltrim(price::text, '-'), '.', '')::bigint)::int AS wrong_price,
  count(*) FILTER (WHERE cost_pence <> sign(cost)::int * replace(ltrim(cost::text, '-'), '.', '')::bigint)::int AS wrong_cost
  FROM products`);

test('114 converts every price and cost exactly, on an empty and a populated database, and twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig114_${process.pid}`;
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

  // The awkward figures, then every figure up to £1,000.00.
  const ids = {};
  await withClient(url.href, async (c) => {
    const shop = async (nm, slug) => (await c.query('INSERT INTO shops (name, slug) VALUES ($1, $2) RETURNING id', [nm, slug])).rows[0].id;
    ids.shop = await shop('North Street Cycles', 'north-street-cycles');
    ids.other = await shop('[Other shop]', 'other-shop');
    await inShop(c, ids.shop);
    for (const [pounds] of AWKWARD) await c.query("INSERT INTO products (name, price, cost) VALUES ('[Product]', $1, $1)", [pounds]);
    for (const [pounds] of NEGATIVE_COSTS) await c.query("INSERT INTO products (name, price, cost) VALUES ('[Negative cost]', 28, $1)", [pounds]);
    await c.query(`INSERT INTO products (name, price, cost) SELECT '[Sweep]', g / 100.0, g / 100.0 FROM generate_series(0, ${SWEEP - 1}) g`);
    await inShop(c, ids.other);
    await c.query("INSERT INTO products (name, price, cost) VALUES ('[Other product]', 12.34, 5.67)");
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });

  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));

  const check = async (c) => {
    await inShop(c, ids.shop);
    const { rows } = await c.query("SELECT price::text AS pounds, price_pence, cost::text AS cost_pounds, cost_pence FROM products WHERE name = '[Product]' ORDER BY id");
    assert.deepEqual(rows.map((r) => [r.pounds, Number(r.price_pence)]), AWKWARD);
    assert.deepEqual(rows.map((r) => [r.cost_pounds, Number(r.cost_pence)]), AWKWARD);
    const negative = await c.query("SELECT cost::text AS pounds, cost_pence FROM products WHERE name = '[Negative cost]' ORDER BY id");
    assert.deepEqual(negative.rows.map((r) => [r.pounds, Number(r.cost_pence)]), NEGATIVE_COSTS);
    const { rows: [figures] } = await wrongFigures(c);
    assert.deepEqual(figures, { rows: SWEEP + AWKWARD.length + NEGATIVE_COSTS.length, wrong_price: 0, wrong_cost: 0 });
  };
  await withClient(url.href, check);

  await withClient(url.href, async (c) => {
    await inShop(c, ids.shop);
    // Old writers carry on with pounds, and the pence follow.
    const { rows: [made] } = await c.query("INSERT INTO products (name, price, cost) VALUES ('[New by the old app]', 19.99, 4.35) RETURNING id, price_pence, cost_pence");
    assert.deepEqual([Number(made.price_pence), Number(made.cost_pence)], [1999, 435]);
    const { rows: [saved] } = await c.query('UPDATE products SET price = 1.15, cost = -0.07 WHERE id = $1 RETURNING price_pence, cost_pence', [made.id]);
    assert.deepEqual([Number(saved.price_pence), Number(saved.cost_pence)], [115, -7]);
    // A third decimal is rounded once, by the pounds column, and the pence follow that.
    const { rows: [third] } = await c.query('UPDATE products SET price = 19.995 WHERE id = $1 RETURNING price::text, price_pence', [made.id]);
    assert.deepEqual([third.price, Number(third.price_pence)], ['20.00', 2000]);
    // Pence can't be written around the pounds, so the two can't disagree.
    await assert.rejects(c.query('UPDATE products SET price_pence = 1 WHERE id = $1', [made.id]), /can only be updated to DEFAULT/);
    await assert.rejects(c.query("INSERT INTO products (name, price_pence) VALUES ('[Product]', 1)"), /non-DEFAULT/);
    await c.query('DELETE FROM products WHERE id = $1', [made.id]);
    // Another shop sees only its own.
    await inShop(c, ids.other);
    const { rows } = await c.query('SELECT price_pence, cost_pence FROM products');
    assert.deepEqual(rows.map((r) => [Number(r.price_pence), Number(r.cost_pence)]), [[1234, 567]]);
  });

  // Again on a database that already has it: it runs, and nothing moves.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, check);
});
