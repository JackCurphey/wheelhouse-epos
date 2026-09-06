// tests/db-transaction-scope.test.js
//
// Covers server/db.js's transaction handling: the savepoint-aware dbExec
// shim, and the two DB_TENANT_SCOPE modes ("session", today's default and
// what ships, and "transaction", off by default).
//
// The shim matters because `db.exec('BEGIN')` appears at 11 sites across
// server/server.js and server/team.js. Before this change a second BEGIN on
// the same client was a no-op with a Postgres warning, so a nested block's
// ROLLBACK silently discarded the OUTER block's work too, and a nested
// block's COMMIT silently committed it. Those two facts are what tests
// "a nested BEGIN..." and "an inner COMMIT..." below pin down.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare, dbExec } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { createSale } from '../server/server.js';
import { createTeamMember } from '../server/team.js';

// Every test restores the env var itself, but a throw mid-test must not leak
// "transaction" mode into the next test in this file (node:test runs the
// tests in one file sequentially, so leakage would be silent and confusing).
function withTenantScope(mode, fn) {
  const previous = process.env.DB_TENANT_SCOPE;
  if (mode === undefined) delete process.env.DB_TENANT_SCOPE;
  else process.env.DB_TENANT_SCOPE = mode;
  return (async () => {
    try {
      return await fn();
    } finally {
      if (previous === undefined) delete process.env.DB_TENANT_SCOPE;
      else process.env.DB_TENANT_SCOPE = previous;
    }
  })();
}

// Reads shop-scoped rows on a SECOND connection, which is the only way to
// tell "committed" from "merely written inside an open transaction" - the
// writing connection sees its own uncommitted rows either way.
async function skusVisibleElsewhere(shopId, skus) {
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shopId)]);
    const { rows } = await client.query('SELECT sku FROM products WHERE sku = ANY($1) ORDER BY sku', [skus]);
    return rows.map((r) => r.sku);
  } finally {
    client.release();
  }
}

async function insertProduct(sku) {
  await prepare('INSERT INTO products (name, sku) VALUES (?, ?)').run(`Product ${sku}`, sku);
}

test('a nested BEGIN becomes a savepoint: the inner ROLLBACK discards only the inner work', async () => {
  const shop = await createTestShop();
  const outerSku = `NEST-OUTER-${shop.id}`;
  const innerSku = `NEST-INNER-${shop.id}`;
  try {
    await runWithShop(shop.id, async () => {
      await dbExec('BEGIN');
      await insertProduct(outerSku);

      // Before the savepoint shim this second BEGIN was a no-op ("WARNING:
      // there is already a transaction in progress") and the ROLLBACK below
      // therefore threw away the outer insert as well.
      await dbExec('BEGIN');
      await insertProduct(innerSku);
      await dbExec('ROLLBACK');

      await dbExec('COMMIT');
    });

    assert.deepEqual(await skusVisibleElsewhere(shop.id, [outerSku, innerSku]), [outerSku]);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('an inner COMMIT only releases its savepoint: a later outer ROLLBACK still discards it', async () => {
  const shop = await createTestShop();
  const outerSku = `REL-OUTER-${shop.id}`;
  const innerSku = `REL-INNER-${shop.id}`;
  try {
    await runWithShop(shop.id, async () => {
      await dbExec('BEGIN');
      await insertProduct(outerSku);

      await dbExec('BEGIN');
      await insertProduct(innerSku);
      // A real COMMIT here would make BOTH rows durable and leave the
      // following ROLLBACK with nothing to undo - the partial-commit hazard.
      await dbExec('COMMIT');

      await dbExec('ROLLBACK');
    });

    assert.deepEqual(await skusVisibleElsewhere(shop.id, [outerSku, innerSku]), []);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('session mode (the default) keeps each block a real, independently durable transaction', async () => {
  const shop = await createTestShop();
  const sku = `SESSION-${shop.id}`;
  try {
    await withTenantScope(undefined, async () => {
      await runWithShop(shop.id, async () => {
        await dbExec('BEGIN');
        await insertProduct(sku);
        await dbExec('COMMIT');

        // Committed for real, so another connection can see it while this
        // request is still running. This is today's behaviour and what ships.
        assert.deepEqual(await skusVisibleElsewhere(shop.id, [sku]), [sku]);
      });
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('transaction mode wraps the whole request in one transaction that commits at the end', async () => {
  const shop = await createTestShop();
  const sku = `TXMODE-${shop.id}`;
  try {
    await withTenantScope('transaction', async () => {
      await runWithShop(shop.id, async () => {
        await insertProduct(sku);
        // No explicit COMMIT anywhere: in transaction mode this write is
        // still inside the request's transaction, so nobody else can see it.
        assert.deepEqual(await skusVisibleElsewhere(shop.id, [sku]), []);
      });
    });

    // ...and runWithShop committed it on the way out.
    assert.deepEqual(await skusVisibleElsewhere(shop.id, [sku]), [sku]);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('transaction mode rolls the whole request back when the handler throws', async () => {
  const shop = await createTestShop();
  const committedSku = `TXFAIL-COMMITTED-${shop.id}`;
  const looseSku = `TXFAIL-LOOSE-${shop.id}`;
  try {
    await withTenantScope('transaction', async () => {
      await assert.rejects(
        runWithShop(shop.id, async () => {
          await insertProduct(looseSku);
          // An inner block that "commits" is only releasing a savepoint, so
          // the outer rollback below must take this with it too.
          await dbExec('BEGIN');
          await insertProduct(committedSku);
          await dbExec('COMMIT');
          throw new Error('handler blew up');
        }),
        /handler blew up/
      );
    });

    assert.deepEqual(await skusVisibleElsewhere(shop.id, [committedSku, looseSku]), []);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('COMMIT or ROLLBACK with nothing open, or against an already-released savepoint, never throws', async () => {
  const shop = await createTestShop();
  try {
    await withTenantScope('transaction', async () => {
      await runWithShop(shop.id, async () => {
        // Positive control: raw SQL in exactly this shape DOES throw, so the
        // assertions below are testing the shim's guard rather than
        // Postgres being lenient.
        const control = await pool.connect();
        try {
          await control.query('BEGIN');
          await control.query('SAVEPOINT sp_control');
          await control.query('RELEASE SAVEPOINT sp_control');
          await assert.rejects(
            () => control.query('ROLLBACK TO SAVEPOINT sp_control'),
            (err) => err.code === '3B001'
          );
        } finally {
          await control.query('ROLLBACK').catch(() => {});
          control.release();
        }

        // The createSale shape: a block commits, then post-commit work
        // throws, and the catch issues a ROLLBACK whose block is gone. This
        // must NOT raise - it sits in a catch that re-throws the real error,
        // and a 3B001 here would mask it.
        await dbExec('BEGIN');
        await insertProduct(`EDGE-${shop.id}`);
        await dbExec('COMMIT');
        await assert.doesNotReject(() => dbExec('ROLLBACK'));

        // ...and now nothing at all is open. Both verbs must still no-op.
        await assert.doesNotReject(() => dbExec('ROLLBACK'));
        await assert.doesNotReject(() => dbExec('COMMIT'));

        // The client is still usable afterwards rather than wedged.
        const { rows } = await pool.connect().then(async (c) => {
          try { return await c.query('SELECT 1 AS ok'); } finally { c.release(); }
        });
        assert.equal(rows[0].ok, 1);
      });
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

// Pinned to session mode explicitly. Without the pin this asserts session-mode
// behaviour under whatever the ambient environment happens to hold, so a
// deployment or a CI runner exporting DB_TENANT_SCOPE=transaction would change
// what the test means without changing the test.
//
// WHAT THIS TEST PROVES, precisely: that every write the sale path makes sits
// inside ONE rollback boundary. It does NOT distinguish a working ROLLBACK
// from a broken one - the transaction is already ABORTED by the CHECK
// violation when the site's ROLLBACK runs, and Postgres treats COMMIT on an
// aborted transaction as a rollback, so replacing the ROLLBACK with a COMMIT
// is invisible from here (mutation M5 in the build report). Single-boundary
// coverage is the point, and it is enough.
test('a sale that fails partway leaves no sale, no sale_items and no stock_movements behind', async () => {
  const shop = await createTestShop();
  try {
    // A CHECK that only a deliberately absurd quantity can violate, so it
    // fires on the SECOND line's stock_movements insert - after the sale row,
    // the first line's sale_item and stock_movement, and the second line's
    // sale_item have all already been written inside the transaction.
    // NOT VALID keeps it from scanning the existing table; it still applies
    // to new rows, which is all this needs.
    //
    // DROP IF EXISTS first: the ADD sits outside the try whose finally drops
    // it, so a run killed between ADD and DROP used to leave the constraint
    // behind and every subsequent run then failed at ADD with 42710, before
    // ever reaching the finally - a permanent, self-inflicted red.
    //
    // The reviewer's DDL-free alternative (driving the second line's
    // `UPDATE products SET stock_qty = ?` into an int4 underflow) does not
    // work and was checked rather than assumed: createSale loads its lines
    // with checkStock: true, which requires product.stock_qty >= qty, and
    // stock_qty is int4, so stock_qty - qty is never negative. The attempt
    // fails with ValidationError "Not enough stock" BEFORE the BEGIN, leaving
    // zero rows and therefore no partway state at all.
    await pool.query('ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS tmp_sale_rollback_probe');
    await pool.query(
      'ALTER TABLE stock_movements ADD CONSTRAINT tmp_sale_rollback_probe CHECK (change_qty <> -424242) NOT VALID'
    );
    try {
      await withTenantScope('session', async () => {
        let cashierId;
        let goodProductId;
        let boomProductId;
        await runWithShop(shop.id, async () => {
          cashierId = (
            await prepare("INSERT INTO employees (name, is_cashier) VALUES (?, 1)").run('Till Person')
          ).lastInsertRowid;
          goodProductId = (
            await prepare('INSERT INTO products (name, sku, price, stock_qty) VALUES (?, ?, ?, ?)')
              .run('Inner Tube', `TUBE-${shop.id}`, 5, 10)
          ).lastInsertRowid;
          boomProductId = (
            await prepare('INSERT INTO products (name, sku, price, stock_qty) VALUES (?, ?, ?, ?)')
              .run('Bulk Widget', `BULK-${shop.id}`, 0, 500000)
          ).lastInsertRowid;
        });

        await runWithShop(shop.id, async () => {
          await assert.rejects(
            () =>
              createSale({
                cashierId,
                items: [
                  { productId: goodProductId, qty: 1 },
                  { productId: boomProductId, qty: 424242 },
                ],
                discount: 0,
                cashAmount: 5,
                cardAmount: 0,
              }),
            (err) => err.code === '23514' || /tmp_sale_rollback_probe/.test(err.message)
          );

          assert.equal((await prepare('SELECT id FROM sales').all()).length, 0, 'no sale should survive');
          assert.equal((await prepare('SELECT id FROM sale_items').all()).length, 0, 'no sale_items should survive');
          assert.equal(
            (await prepare('SELECT id FROM stock_movements').all()).length,
            0,
            'no stock_movements should survive'
          );
          // The stock deduction the first line already made must be undone too.
          const good = await prepare('SELECT stock_qty FROM products WHERE id = ?').get(goodProductId);
          assert.equal(good.stock_qty, 10);
        });
      });
    } finally {
      await pool.query('ALTER TABLE stock_movements DROP CONSTRAINT tmp_sale_rollback_probe');
    }
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('createTeamMember rolls back the employee row when the login insert fails', async () => {
  const shop = await createTestShop();
  const email = `clash-${shop.id}@example.com`;
  try {
    await runWithShop(shop.id, async () => {
      await createTeamMember({
        shopId: shop.id,
        name: 'First Person',
        isCashier: true,
        email,
        password: 'correct horse battery',
      });

      // logins.email is globally UNIQUE, so the employee insert succeeds and
      // the login insert then fails - the exact partway failure the
      // BEGIN/COMMIT/ROLLBACK block at server/team.js:79 exists to contain.
      await assert.rejects(() =>
        createTeamMember({
          shopId: shop.id,
          name: 'Second Person',
          isCashier: true,
          email,
          password: 'correct horse battery',
        })
      );

      const employees = await prepare('SELECT name FROM employees ORDER BY name').all();
      assert.deepEqual(employees.map((e) => e.name), ['First Person']);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});
