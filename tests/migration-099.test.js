// Migration 099 (openspec/changes/stock-take design 1): stock takes, who is
// counting, and each person's count of each product, kept per shop. Run from
// empty, then onto a database that already has a shop, then again.
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
const FILE = '099_stock_takes.sql';
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
const asShop = (c, id) => c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(id)]);

test('099 adds stock takes and their counts, and keeps each shop to its own', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig099_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  // Every migration before 099 from empty, then a shop, then 099 onto it.
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(env);
  const ids = {};
  await withClient(url.href, async (c) => {
    const { rows: [shop] } = await c.query("INSERT INTO shops (name, slug) VALUES ('North Street Cycles', 'north-street-cycles') RETURNING id");
    const { rows: [jack] } = await c.query("INSERT INTO logins (shop_id, name, email, password_hash) VALUES ($1, 'Jack Lewis', 'jack@example.test', 'x') RETURNING id", [shop.id]);
    await asShop(c, shop.id);
    const { rows: [pads] } = await c.query("INSERT INTO products (name, sku) VALUES ('Shimano brake pads', 'B05S-RX') RETURNING id");
    Object.assign(ids, { shop: shop.id, jack: jack.id, pads: pads.id });
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await asShop(c, ids.shop);
    const take = (kind, target = '', ids2 = null) => c.query('INSERT INTO stock_takes (kind, target, product_ids, started_by_login_id) VALUES ($1, $2, $3, $4) RETURNING *', [kind, target, ids2, ids.jack]);
    const { rows: [area] } = await take('area', 'Wall 3');
    assert.equal(area.shop_id, ids.shop);
    assert.equal(area.status, 'counting');
    assert.ok(area.started_at instanceof Date);
    await take('whole_shop');
    await take('category', 'Drivetrain › Derailleurs');
    await take('below_zero', '', [ids.pads]);
    await assert.rejects(take('cupboard', 'x'), /check/i, 'a known kind');
    await assert.rejects(take('area', ''), /check/i, 'an area is named');
    await assert.rejects(take('whole_shop', 'x'), /check/i, 'the whole shop has no name');
    await assert.rejects(take('area', 'x'.repeat(61)), /check/i, 'up to 60 characters');
    await assert.rejects(c.query("UPDATE stock_takes SET status = 'cancelled' WHERE id = $1", [area.id]), /check/i, 'counting or applied');
    await assert.rejects(c.query("UPDATE stock_takes SET status = 'applied' WHERE id = $1", [area.id]), /check/i, 'applied says who and when');
    await assert.rejects(c.query('UPDATE stock_takes SET applied_at = now(), applied_by_login_id = $2 WHERE id = $1', [area.id, ids.jack]), /check/i, 'still counting: no applied time');
    const line = (qty) => c.query('INSERT INTO stock_take_counts (stock_take_id, product_id, login_id, qty) VALUES ($1, $2, $3, $4) RETURNING *', [area.id, ids.pads, ids.jack, qty]);
    const { rows: [l] } = await line(2);
    assert.equal(l.shop_id, ids.shop);
    assert.ok(l.first_counted_at instanceof Date && l.last_counted_at instanceof Date);
    await assert.rejects(line(1), /unique|duplicate/i, 'one line a person a product');
    await c.query('DELETE FROM stock_take_counts');
    await line(0);
    await c.query('DELETE FROM stock_take_counts');
    await assert.rejects(line(-1), /check/i, 'never below none');
    await assert.rejects(line(100001), /check/i, 'at most 100,000');
    await line(2);
    await c.query('INSERT INTO stock_take_counters (stock_take_id, login_id) VALUES ($1, $2)', [area.id, ids.jack]);
    await assert.rejects(c.query('INSERT INTO stock_take_counters (stock_take_id, login_id) VALUES ($1, $2)', [area.id, ids.jack]), /unique|duplicate|primary/i);
    ids.take = area.id;
    // A recount, once a product; a result that adds up, with a history line when it changed.
    const recount = () => c.query('INSERT INTO stock_take_recounts (stock_take_id, product_id, asked_by_login_id) VALUES ($1, $2, $3)', [area.id, ids.pads, ids.jack]);
    await recount();
    await assert.rejects(recount(), /unique|duplicate|primary/i);
    const { rows: [mv] } = await c.query("INSERT INTO stock_movements (product_id, change_qty, type, note, stock_take_id) VALUES ($1, -1, 'count', '', $2) RETURNING id", [ids.pads, area.id]);
    const result = (expected, counted, difference, movement) => c.query('INSERT INTO stock_take_results (stock_take_id, product_id, expected, counted, difference, cost_pence, stock_movement_id) VALUES ($1, $2, $3, $4, $5, 1400, $6)', [area.id, ids.pads, expected, counted, difference, movement]);
    await assert.rejects(result(3, 2, 0, mv.id), /check/i, 'the difference adds up');
    await assert.rejects(result(3, 2, -1, null), /check/i, 'a change has its history line');
    await assert.rejects(result(2, 2, 0, mv.id), /check/i, 'a match has none');
    await result(3, 2, -1, mv.id);
    await c.query("UPDATE stock_takes SET status = 'applied', applied_at = now(), applied_by_login_id = $2 WHERE id = $1", [area.id, ids.jack]);
    // Another shop sees none of it, and can't count against this shop's take.
    const { rows: [other] } = await c.query("INSERT INTO shops (name, slug) VALUES ('Other Cycles', 'other-cycles') RETURNING id");
    await asShop(c, other.id);
    for (const table of ['stock_takes', 'stock_take_counts', 'stock_take_counters', 'stock_take_recounts', 'stock_take_results']) {
      assert.equal((await c.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, 0, table);
    }
    const { rows: [theirs] } = await c.query("INSERT INTO logins (shop_id, name, email, password_hash) VALUES ($1, '[Owner]', 'owner@example.test', 'x') RETURNING id", [other.id]);
    await assert.rejects(c.query('INSERT INTO stock_take_counters (stock_take_id, login_id) VALUES ($1, $2)', [ids.take, theirs.id]), /foreign key/i, 'not another shop’s take');
    const { rows: [theirPads] } = await c.query("INSERT INTO products (name) VALUES ('[Product]') RETURNING id");
    await assert.rejects(c.query('INSERT INTO stock_take_counts (stock_take_id, product_id, login_id, qty) VALUES ($1, $2, $3, 1)', [ids.take, theirPads.id, theirs.id]), /foreign key/i, 'no count against another shop’s take');
    await assert.rejects(c.query('INSERT INTO stock_take_recounts (stock_take_id, product_id, asked_by_login_id) VALUES ($1, $2, $3)', [ids.take, theirPads.id, theirs.id]), /foreign key/i, 'no recount of another shop’s take');
    await assert.rejects(c.query('INSERT INTO stock_take_results (stock_take_id, product_id, expected, counted, difference, cost_pence) VALUES ($1, $2, 1, 1, 0, 0)', [ids.take, theirPads.id]), /foreign key/i, 'no result on another shop’s take');
    await assert.rejects(c.query("INSERT INTO stock_movements (product_id, change_qty, type, note, stock_take_id) VALUES ($1, 1, 'count', '', $2)", [theirPads.id, ids.take]), /foreign key/i, 'no history line on another shop’s take');
    // A till sale's history line says which sale it was, so a count can tell when it was made.
    assert.equal((await c.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'till_sale_id'")).rows[0].n, 1);
  });
  // Run again on a database that already has it: what was kept stays.
  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    await asShop(c, ids.shop);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM stock_takes')).rows[0].n, 4);
    assert.equal((await c.query('SELECT qty FROM stock_take_counts')).rows[0].qty, 2);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM stock_take_counters')).rows[0].n, 1);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM stock_take_results')).rows[0].n, 1);
    assert.equal((await c.query("SELECT status FROM stock_takes WHERE id = $1", [ids.take])).rows[0].status, 'applied');
  });
});

// The shared development database ran the first draft as 098_stock_takes.sql:
// its tables, with a count of at least 1 and counting only. 099 brings them up.
test('099 brings the draft 098 tables up to date', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig099d_${process.pid}`;
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
  await withClient(url.href, async (c) => {
    // The draft, as it was: inline checks with Postgres's own names.
    await c.query(`CREATE TABLE stock_takes (id SERIAL PRIMARY KEY, shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
      kind TEXT NOT NULL CHECK (kind IN ('whole_shop', 'category', 'area', 'below_zero')), target TEXT NOT NULL DEFAULT '' CHECK (length(target) <= 60),
      product_ids INTEGER[], status TEXT NOT NULL DEFAULT 'counting' CHECK (status IN ('counting')), started_by_login_id INTEGER NOT NULL REFERENCES logins(id),
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(), CONSTRAINT stock_takes_target_named_check CHECK ((kind IN ('category', 'area')) = (btrim(target) <> '')), UNIQUE (shop_id, id))`);
    await c.query(`CREATE TABLE stock_take_counts (id SERIAL PRIMARY KEY, shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
      stock_take_id INTEGER NOT NULL, product_id INTEGER NOT NULL REFERENCES products(id), login_id INTEGER NOT NULL REFERENCES logins(id),
      qty INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 100000), first_counted_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_counted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (stock_take_id, product_id, login_id), FOREIGN KEY (shop_id, stock_take_id) REFERENCES stock_takes(shop_id, id) ON DELETE CASCADE)`);
    await c.query("INSERT INTO schema_migrations (filename) VALUES ('098_stock_takes.sql')");
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(url.href, async (c) => {
    const checks = (await c.query("SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid IN ('stock_takes'::regclass, 'stock_take_counts'::regclass) AND contype = 'c' ORDER BY 1")).rows;
    const def = (n) => checks.find((x) => x.conname === n)?.def ?? '';
    assert.match(def('stock_takes_status_check'), /applied/, 'applied allowed');
    assert.match(def('stock_take_counts_qty_check'), /0 AND 100000|>= 0/, 'none allowed');
    assert.ok(!checks.some((x) => x.conname === 'stock_takes_target_named_check'), 'the draft’s own check is gone');
    for (const table of ['stock_take_counters', 'stock_take_recounts', 'stock_take_results']) {
      assert.equal((await c.query('SELECT relforcerowsecurity AS f FROM pg_class WHERE relname = $1', [table])).rows[0]?.f, true, table);
    }
    assert.equal((await c.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'stock_take_id'")).rows[0].n, 1);
  });
});
