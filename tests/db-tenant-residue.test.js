// tests/db-tenant-residue.test.js
//
// The bug this file exists for: runWithShop set `app.current_shop_id` with
// is_local=false (a SESSION-scoped setting) on a pooled client and then
// released that client without clearing it. The next request handed the same
// physical connection therefore started life already believing it belonged
// to the previous request's shop. Same story for a transaction left open.
//
// These are direct tests, not inferences: each one re-acquires the very same
// backend (asserted by pg_backend_pid) and inspects it.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare, dbExec } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

// Take a connection and give it straight back, so the pool has a warm idle
// client at the head of its queue. node-postgres hands the most recently
// released client out first, which is what makes "the same backend" below
// deterministic rather than hopeful.
async function warmPool() {
  const client = await pool.connect();
  const { rows: [{ pid }] } = await client.query('SELECT pg_backend_pid() AS pid');
  client.release();
  return pid;
}

test('the tenant setting does not survive past the end of a request on a recycled client', async () => {
  const shop = await createTestShop();
  try {
    const warmPid = await warmPool();

    await runWithShop(shop.id, async () => {
      // Touch an RLS table so this is a realistic request, not just a SET.
      await prepare('SELECT id FROM products').all();
    });

    const recycled = await pool.connect();
    try {
      const { rows: [row] } = await recycled.query(
        "SELECT pg_backend_pid() AS pid, current_setting('app.current_shop_id', true) AS shop_id"
      );
      assert.equal(row.pid, warmPid, 'expected the pool to hand back the same backend - test is not proving anything otherwise');
      assert.ok(
        row.shop_id === null || row.shop_id === '',
        `released client still carries app.current_shop_id = ${JSON.stringify(row.shop_id)}`
      );
    } finally {
      recycled.release();
    }
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a recycled client cannot read the previous request shop rows through a stale setting', async () => {
  const shop = await createTestShop();
  try {
    const warmPid = await warmPool();

    await runWithShop(shop.id, async () => {
      await prepare('INSERT INTO products (name, sku) VALUES (?, ?)').run('Residue Probe', `RESIDUE-${shop.id}`);
    });

    const recycled = await pool.connect();
    try {
      const { rows: [{ pid }] } = await recycled.query('SELECT pg_backend_pid() AS pid');
      assert.equal(pid, warmPid, 'expected the pool to hand back the same backend');

      // The RLS policies cast current_setting('app.current_shop_id') to int
      // with no missing_ok fallback, so an unset/blank value raises rather
      // than returning rows. Fail loud is the point: a silent empty result
      // would be indistinguishable from "this shop has no products".
      await assert.rejects(
        () => recycled.query('SELECT id, shop_id FROM products'),
        (err) => /app\.current_shop_id|invalid input syntax/i.test(err.message),
        'a recycled client must not still be able to read the previous shop rows'
      );
    } finally {
      recycled.release();
    }
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a transaction left open by a request is rolled back before the client goes back to the pool', async () => {
  const shop = await createTestShop();
  const sku = `ORPHAN-${shop.id}`;
  try {
    const warmPid = await warmPool();

    // A handler that opens a transaction and never closes it. Before the
    // hardened release, node-postgres returned this client to the pool with
    // the transaction still open, and the next holder inherited it - along
    // with visibility of these uncommitted rows.
    await runWithShop(shop.id, async () => {
      await dbExec('BEGIN');
      await prepare('INSERT INTO products (name, sku) VALUES (?, ?)').run('Orphan', sku);
    });

    const recycled = await pool.connect();
    try {
      const { rows: [{ pid }] } = await recycled.query('SELECT pg_backend_pid() AS pid');
      assert.equal(pid, warmPid, 'expected the pool to hand back the same backend');

      await recycled.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
      const { rows } = await recycled.query('SELECT id FROM products WHERE sku = $1', [sku]);
      assert.equal(rows.length, 0, 'the orphaned transaction was inherited by the next holder of this connection');
    } finally {
      recycled.release();
    }
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a request for one shop cannot see another shop products, customers or sales', async () => {
  const shopA = await createTestShop();
  const shopB = await createTestShop();
  try {
    await runWithShop(shopB.id, async () => {
      const productId = (
        await prepare('INSERT INTO products (name, sku, price, stock_qty) VALUES (?, ?, ?, ?)')
          .run('B Bike', `B-${shopB.id}`, 100, 5)
      ).lastInsertRowid;
      const customerId = (
        await prepare('INSERT INTO customers (name) VALUES (?)').run('B Customer')
      ).lastInsertRowid;
      await prepare(
        'INSERT INTO sales (customer_id, subtotal, total, payment_method) VALUES (?, ?, ?, ?)'
      ).run(customerId, 100, 100, 'Cash');
      assert.ok(productId && customerId);
    });

    await runWithShop(shopA.id, async () => {
      assert.deepEqual(await prepare('SELECT id FROM products').all(), []);
      assert.deepEqual(await prepare('SELECT id FROM customers').all(), []);
      assert.deepEqual(await prepare('SELECT id FROM sales').all(), []);

      // Naming shop B explicitly does not help either - RLS filters on the
      // session setting, not on the query text.
      assert.deepEqual(await prepare('SELECT id FROM products WHERE shop_id = ?').all(shopB.id), []);
    });
  } finally {
    await deleteTestShop(shopA.id);
    await deleteTestShop(shopB.id);
  }
});

test('runWithShop refuses to re-enter for a different shop', async () => {
  const shopA = await createTestShop();
  const shopB = await createTestShop();
  try {
    await runWithShop(shopA.id, async () => {
      await assert.rejects(
        () => runWithShop(shopB.id, async () => 'should not run'),
        /re-enter|re-entered|nested/i
      );
      // Re-entering for the SAME shop is what storefront resolution does and
      // must keep working.
      assert.equal(await runWithShop(shopA.id, async () => 'ok'), 'ok');
    });
  } finally {
    await deleteTestShop(shopA.id);
    await deleteTestShop(shopB.id);
  }
});
