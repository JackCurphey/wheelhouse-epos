// tests/db-scope-hardening.test.js
//
// Fix-round hardening for server/db.js. Four separate defects, all of them
// about a safety mechanism failing in a way that is worse than not having it:
//
//   1. `DB_TENANT_SCOPE=` (blank, not absent) refused to boot. `?? 'session'`
//      does not catch the empty string, so an empty value in .env or a bare
//      `- DB_TENANT_SCOPE` in a compose file produced a hard error and exit 1
//      on an otherwise healthy deployment.
//   2. `client.release()` can throw - `pg` rejects a release of a client the
//      pool already removed after a connection-level error. That rejection
//      escaped runWithShop's `finally` and replaced the handler's real error
//      with a cleanup error. Cleanup failure must never mask the original.
//   3. The transaction-statement pattern matched only the bare verbs, so
//      `BEGIN TRANSACTION`, `START TRANSACTION`, `END` and `COMMIT WORK` fell
//      through to a raw query and re-opened the nested-BEGIN collapse trap the
//      shim exists to close.
//   4. probePoolerMode blanked its own probe setting as the last statement of
//      the try, so a failure mid-probe returned a client to the pool still
//      carrying `app.pooler_probe` - the exact residue class this whole change
//      removes, in the file that removes it. It also sampled only two clients
//      per round, which is a weak sample for what it is trying to rule out.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare, dbExec, tenantScopeMode, probePoolerMode } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

function withEnv(value, fn) {
  const previous = process.env.DB_TENANT_SCOPE;
  if (value === undefined) delete process.env.DB_TENANT_SCOPE;
  else process.env.DB_TENANT_SCOPE = value;
  return (async () => {
    try {
      return await fn();
    } finally {
      if (previous === undefined) delete process.env.DB_TENANT_SCOPE;
      else process.env.DB_TENANT_SCOPE = previous;
    }
  })();
}

// Replaces pool.connect for the duration of fn, handing back a client whose
// release() throws the way `pg` does for a client the pool has already
// removed. The real client underneath is kept and released properly at the
// end, so the pool is not leaked by the test itself.
async function withUnreleasableClient(fn) {
  const originalConnect = pool.connect;
  const reals = [];
  pool.connect = async () => {
    const real = await originalConnect.call(pool);
    reals.push(real);
    return {
      query: (...args) => real.query(...args),
      release: () => {
        throw new Error('Release called on client which has already been released to the pool.');
      },
    };
  };
  try {
    return await fn();
  } finally {
    pool.connect = originalConnect;
    for (const real of reals) {
      await real.query("SELECT set_config('app.current_shop_id', '', false)").catch(() => {});
      real.release();
    }
  }
}

// ---------- 1. blank DB_TENANT_SCOPE ----------

test('a blank DB_TENANT_SCOPE is treated as unset, not as a misconfiguration', async () => {
  await withEnv('', async () => {
    assert.equal(tenantScopeMode(), 'session');
  });
  await withEnv('   ', async () => {
    assert.equal(tenantScopeMode(), 'session');
  });
});

test('a blank DB_TENANT_SCOPE still serves a request in session mode', async () => {
  const shop = await createTestShop();
  try {
    await withEnv('', async () => {
      await runWithShop(shop.id, async () => {
        await prepare('INSERT INTO products (name, sku) VALUES (?, ?)').run('Blank Scope', `BLANK-${shop.id}`);
      });
    });
    await runWithShop(shop.id, async () => {
      const rows = await prepare('SELECT sku FROM products').all();
      assert.deepEqual(rows.map((r) => r.sku), [`BLANK-${shop.id}`]);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a genuine typo in DB_TENANT_SCOPE is still a hard error', async () => {
  await withEnv('sesion', async () => {
    assert.throws(() => tenantScopeMode(), /DB_TENANT_SCOPE must be one of/);
  });
});

// ---------- 2. release() must never mask the handler's error ----------

test('a failing client.release() does not replace the handler error', async () => {
  const shop = await createTestShop();
  try {
    await withUnreleasableClient(async () => {
      await assert.rejects(
        () =>
          runWithShop(shop.id, async () => {
            throw new Error('the real failure the operator needs to see');
          }),
        /the real failure the operator needs to see/
      );
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a failing client.release() does not turn a successful request into a rejection', async () => {
  const shop = await createTestShop();
  try {
    await withUnreleasableClient(async () => {
      const result = await runWithShop(shop.id, async () => {
        await prepare('SELECT id FROM products').all();
        return 'handler result';
      });
      assert.equal(result, 'handler result');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

// ---------- 3. transaction-control statements beyond the bare verbs ----------

test('BEGIN TRANSACTION / ROLLBACK WORK nest as a savepoint instead of collapsing the outer block', async () => {
  const shop = await createTestShop();
  const keptSku = `SPELLING-KEEP-${shop.id}`;
  const droppedSku = `SPELLING-DROP-${shop.id}`;
  try {
    await withEnv('transaction', async () => {
      await runWithShop(shop.id, async () => {
        // Depth is already 1 here (transaction mode opened the request's own
        // transaction), so a nested block must become a savepoint. Written in
        // the long form a future handler is perfectly entitled to use.
        await prepare('INSERT INTO products (name, sku) VALUES (?, ?)').run('Kept', keptSku);
        await dbExec('BEGIN TRANSACTION');
        await prepare('INSERT INTO products (name, sku) VALUES (?, ?)').run('Dropped', droppedSku);
        await dbExec('ROLLBACK WORK');

        // ABORT is Postgres's alias for ROLLBACK and must be contained the
        // same way rather than tearing down the request's transaction.
        await dbExec('BEGIN');
        await prepare('INSERT INTO products (name, sku) VALUES (?, ?)').run('Aborted', `${droppedSku}-ABORT`);
        await dbExec('ABORT');

        const rows = await prepare('SELECT sku FROM products ORDER BY sku').all();
        assert.deepEqual(
          rows.map((r) => r.sku),
          [keptSku],
          'the nested ROLLBACK must discard only its own block, not the request'
        );
      });
    });

    await runWithShop(shop.id, async () => {
      const rows = await prepare('SELECT sku FROM products ORDER BY sku').all();
      assert.deepEqual(rows.map((r) => r.sku), [keptSku], 'the request itself must still have committed');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('START TRANSACTION / END nest as a savepoint and release it', async () => {
  const shop = await createTestShop();
  const outerSku = `LONGFORM-OUTER-${shop.id}`;
  const innerSku = `LONGFORM-INNER-${shop.id}`;
  try {
    await withEnv('transaction', async () => {
      await runWithShop(shop.id, async () => {
        await prepare('INSERT INTO products (name, sku) VALUES (?, ?)').run('Outer', outerSku);
        await dbExec('START TRANSACTION');
        await prepare('INSERT INTO products (name, sku) VALUES (?, ?)').run('Inner', innerSku);
        await dbExec('END');
        // END released the savepoint; the request transaction is still open,
        // so a further statement must still work rather than autocommitting
        // without a tenant setting.
        const rows = await prepare('SELECT sku FROM products ORDER BY sku').all();
        assert.deepEqual(rows.map((r) => r.sku), [innerSku, outerSku].sort());
      });
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('an unrecognised transaction-control statement is refused rather than run raw', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      // Each of these would silently desynchronise the shim's depth counter if
      // it were passed through to the connection as an ordinary query.
      for (const sql of [
        'SAVEPOINT hand_rolled',
        'RELEASE SAVEPOINT hand_rolled',
        'ROLLBACK TO SAVEPOINT hand_rolled',
        'COMMIT AND CHAIN',
        'BEGIN ISOLATION LEVEL SERIALIZABLE',
        'PREPARE TRANSACTION \'two_phase\'',
      ]) {
        await assert.rejects(
          () => dbExec(sql),
          /transaction-control statement/i,
          `${sql} should have been refused`
        );
      }
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

// ---------- 4. the probe's own residue, and its sample size ----------

// Hands out real pooled clients but never releases them, so the test can
// inspect what each one is carrying after the probe is done with it. One
// nominated client's read is made to fail, to force the probe down its error
// path.
async function inspectablePool({ failReadOnClient = null } = {}) {
  const reals = [];
  const fake = {
    connect: async () => {
      const real = await pool.connect();
      const index = reals.length;
      reals.push(real);
      return {
        query: async (...args) => {
          if (index === failReadOnClient && /current_setting/i.test(String(args[0]))) {
            throw new Error('probe read failed mid-flight');
          }
          return real.query(...args);
        },
        release: () => {},
      };
    },
  };
  return {
    fake,
    reals,
    async residue() {
      const out = [];
      for (const real of reals) {
        const { rows: [row] } = await real.query("SELECT current_setting('app.pooler_probe', true) AS value");
        out.push(row.value);
      }
      return out;
    },
    async dispose() {
      for (const real of reals) {
        await real.query("SELECT set_config('app.pooler_probe', '', false)").catch(() => {});
        real.release();
      }
    },
  };
}

test('probePoolerMode leaves no probe setting behind when a probe query fails', async () => {
  const harness = await inspectablePool({ failReadOnClient: 1 });
  try {
    await assert.rejects(() => probePoolerMode(harness.fake, 1), /probe read failed mid-flight/);
    const residue = await harness.residue();
    assert.ok(residue.length > 0, 'probe should have checked out at least one client');
    for (const [i, value] of residue.entries()) {
      assert.ok(
        value === null || value === '',
        `client ${i} went back to the pool still carrying app.pooler_probe = ${JSON.stringify(value)}`
      );
    }
  } finally {
    await harness.dispose();
  }
});

test('probePoolerMode samples more than two clients per round', async () => {
  const harness = await inspectablePool();
  try {
    const result = await probePoolerMode(harness.fake, 1);
    assert.equal(result.safe, true, result.reason);
    assert.ok(
      harness.reals.length > 2,
      `two concurrent clients is a weak sample for a pooler that may have a pool_size above 1 - got ${harness.reals.length}`
    );
  } finally {
    await harness.dispose();
  }
});
