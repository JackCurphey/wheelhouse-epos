// Migration 071 (numbered 055, then 063, until 24 Oct) (openspec/changes/wp-1-6-sales-in-pence, design.md Decision 1,
// task 1.3): orders gain pence columns beside their pounds, backfilled with
// ROUND(pounds * 100); paid_pence is the converted sale's total; a product
// line's VAT rate comes from its product and a labour line's stays empty
// (labour's rate is Jack's call, asked on #134).
//
// The test needs pounds orders written before the migration, so it makes a
// throwaway database (scripts/dev/new-db.mjs), migrates it to 050, writes the
// orders as the app would have, then lets the runner apply 071 and runs the
// totals check (scripts/ci/check-money-totals.mjs) on the result. Making one
// needs a superuser: ADMIN_DATABASE_URL, or POSTGRES_SUPERUSER_PASSWORD from
// .env. CI sets one, so there it runs; it is only skipped on a machine with
// neither (as in tests/load-test-shop.test.js).
import '../server/load-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';
import { checkMoneyTotals, formatReport } from '../scripts/ci/check-money-totals.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE = path.join(ROOT, 'server/migrations/run-migrations.js');
const FILE = '071_sales_in_pence.sql';

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

// One shop's pounds data, written at 050 the way the old app writes it: an
// open order with a product line and a labour line, a converted order paid by
// an old sale for less, a converted order with no sale, and a cancelled order
// whose product has a reduced VAT rate.
async function writePoundsOrders(client, name) {
  const { rows: [shop] } = await client.query('INSERT INTO shops (name, slug) VALUES ($1, $2) RETURNING id', [name, name.toLowerCase().replace(/\W+/g, '-')]);
  await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
  const one = async (sql, params) => (await client.query(sql, params)).rows[0];
  const tube = await one("INSERT INTO products (name, price) VALUES ('Inner tube', 6.99) RETURNING id, vat_rate_bp");
  const seat = await one("INSERT INTO products (name, price, vat_rate_bp) VALUES ('Child seat', 89.50, 500) RETURNING id, vat_rate_bp");
  const sale = await one(
    "INSERT INTO sales (subtotal, discount, total, payment_method, card_amount) VALUES (31.99, 2, 29.99, 'Card', 29.99) RETURNING id"
  );
  await client.query("INSERT INTO sale_items (sale_id, product_id, name, unit_price, qty, line_total) VALUES ($1, $2, 'Part', 6.99, 1, 6.99)", [sale.id, tube.id]);
  await client.query("INSERT INTO sale_items (sale_id, name, unit_price, qty, line_total, line_type) VALUES ($1, 'Labour', 25, 1, 25, 'labour')", [sale.id]);
  const order = async (status, subtotal, discount, total, convertedSaleId = null) => (await one(
    "INSERT INTO sale_documents (kind, status, subtotal, discount, total, converted_sale_id) VALUES ('order', $1, $2, $3, $4, $5) RETURNING id",
    [status, subtotal, discount, total, convertedSaleId]
  )).id;
  const line = async (documentId, { productId = null, type = 'product', unit, qty = 1, lineTotal }) => (await one(
    'INSERT INTO sale_document_items (document_id, product_id, name, unit_price, qty, line_total, line_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
    [documentId, productId, type === 'labour' ? 'Labour' : 'Part', unit, qty, lineTotal ?? unit * qty, type]
  )).id;

  const open = await order('open', 31.99, 0, 31.99);
  const openTube = await line(open, { productId: tube.id, unit: 6.99 });
  const openLabour = await line(open, { type: 'labour', unit: 25 });
  // The sale took £2 off at the till, so the order's own total (£31.99) and
  // what was paid (£29.99) differ: paid_pence must be the sale's.
  const converted = await order('converted', 31.99, 0, 31.99, sale.id);
  await line(converted, { productId: tube.id, unit: 6.99 });
  await line(converted, { type: 'labour', unit: 25 });
  const cancelled = await order('cancelled', 89.50, 0, 89.50);
  const seatLine = await line(cancelled, { productId: seat.id, unit: 89.50 });
  // Converted with no sale recorded against it: nothing paid to copy.
  const noSale = await order('converted', 25, 0, 25);
  await line(noSale, { type: 'labour', unit: 25 });
  return { shop: shop.id, sale: sale.id, open, converted, cancelled, noSale, openTube, openLabour, seatLine, tube, seat };
}

test('071 adds pence beside pounds on orders, backfills them, and leaves the totals check clean', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig055_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };

  // Migrate to 050: the runner skips a file already recorded as applied.
  await withClient(url.href, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [FILE]);
  });
  migrate(env);
  const seeded = await withClient(url.href, async (c) => {
    const a = await writePoundsOrders(c, 'North Street Cycles');
    const b = await writePoundsOrders(c, 'Second Shop');
    return [a, b];
  });

  await withClient(url.href, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(env), new RegExp(`Applied migration: ${FILE}`));

  await withClient(url.href, async (c) => {
    const { rows: columns } = await c.query(
      `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name IN ('sale_documents', 'sale_document_items')
          AND (column_name LIKE '%\\_pence' OR column_name = 'vat_rate_bp') ORDER BY table_name, column_name`
    );
    assert.deepEqual(columns.map((r) => [r.table_name, r.column_name, r.data_type, r.is_nullable, r.column_default]), [
      ['sale_document_items', 'line_total_pence', 'integer', 'NO', '0'],
      ['sale_document_items', 'unit_price_pence', 'integer', 'NO', '0'],
      ['sale_document_items', 'vat_rate_bp', 'integer', 'YES', null],
      ['sale_documents', 'discount_pence', 'integer', 'NO', '0'],
      ['sale_documents', 'paid_pence', 'integer', 'NO', '0'],
      ['sale_documents', 'subtotal_pence', 'integer', 'NO', '0'],
      ['sale_documents', 'total_pence', 'integer', 'NO', '0'],
    ]);

    for (const s of seeded) {
      await c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(s.shop)]);
      const { rows: docs } = await c.query(
        'SELECT id, subtotal_pence, discount_pence, total_pence, paid_pence FROM sale_documents WHERE shop_id = $1 ORDER BY id', [s.shop]
      );
      assert.deepEqual(docs.map((d) => [d.id, d.subtotal_pence, d.discount_pence, d.total_pence, d.paid_pence]), [
        [s.open, 3199, 0, 3199, 0],
        // Paid: the converted sale's total, £29.99.
        [s.converted, 3199, 0, 3199, 2999],
        [s.cancelled, 8950, 0, 8950, 0],
        [s.noSale, 2500, 0, 2500, 0],
      ]);
      const { rows: lines } = await c.query(
        'SELECT id, unit_price_pence, line_total_pence, vat_rate_bp FROM sale_document_items WHERE id = ANY($1::int[]) ORDER BY id',
        [[s.openTube, s.openLabour, s.seatLine]]
      );
      assert.deepEqual(lines.map((l) => [l.id, l.unit_price_pence, l.line_total_pence, l.vat_rate_bp]), [
        [s.openTube, 699, 699, s.tube.vat_rate_bp],
        // Labour: no VAT rate assumed.
        [s.openLabour, 2500, 2500, null],
        // The product's own reduced rate, not the default.
        [s.seatLine, 8950, 8950, 500],
      ]);
      assert.equal(s.tube.vat_rate_bp, 2000);
    }
    await c.query("SELECT set_config('app.current_shop_id', '', false)");

    const report = await checkMoneyTotals(c, { shopIds: seeded.map((s) => s.shop) });
    const text = formatReport(report);
    assert.equal(report.ok, true, text);
    assert.deepEqual(report.mismatches, [], text);
    assert.deepEqual(report.notConvertedYet, [], text);
    assert.equal(report.checked.orders, 8);
    // 8 orders and 12 order lines, each with both pounds and pence.
    assert.equal(report.checked.conversion, 20);
  });
});

test('071 applies from empty, with every earlier migration', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig055e_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  assert.match(migrate({ ...process.env, DATABASE_URL: url.href }), new RegExp(`Applied migration: ${FILE}`));
});
