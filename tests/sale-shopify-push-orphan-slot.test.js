// tests/sale-shopify-push-orphan-slot.test.js
//
// Regression for the fix wave that introduced afb0cb6: that commit moved a
// deferred Shopify push's pendingShopifyPushes tracking entry from FIRE time
// (inside firePendingShopifyPushes, called from a route's afterRelease
// callback) to QUEUE time (inside createSale, immediately after COMMIT, via
// registerPendingShopifyPushSlot). That closed a real gap - a signal landing
// in the ~1ms window between commit and afterRelease used to find the set
// empty - but it opened a new one: the ONLY code that ever calls the
// resolver registerPendingShopifyPushSlot hands back is
// firePendingShopifyPushes, and firePendingShopifyPushes is ONLY ever
// reached from a route's own `afterRelease.push(...)` call, at the very end
// of the route handler, after several more db.prepare calls and
// sendJson(). If anything in that tail throws - a transient DB error, a bug
// in serializeSale, anything - the dispatcher's own catch sends the 500 and
// returns; afterRelease.push(...) is never reached; nothing left holds a
// reference to that slot's resolver. It sits in pendingShopifyPushes
// forever, and gracefulShutdown's `waitForPendingShopifyPushes` never
// resolves - every later shutdown attempt hits the 10s force-exit path
// (exit 1) and logs a false "requests still in flight".
//
// Before afb0cb6, the same throw-after-commit left pendingShopifyPushes
// untouched (nothing was tracked yet at that point), so shutdown health was
// unaffected - the push was just silently lost, which is the defect afb0cb6
// itself fixed. This test pins that the fix for THAT defect didn't
// reintroduce a shutdown-health regression on the way in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { saveShopifyConnection } from '../server/shopify.js';
import * as serverModule from '../server/server.js';
import { createSale, pendingShopifyPushes } from '../server/server.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function stubFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = original;
  };
}

async function setUpShopWithConnectedProduct() {
  const shop = await createTestShop();
  const restore = stubFetch(async (url) => {
    assert.match(String(url), /\/locations\.json/);
    return { ok: true, status: 200, json: async () => ({ locations: [{ id: 42 }] }) };
  });
  try {
    await runWithShop(shop.id, () =>
      saveShopifyConnection({ shopDomain: 'fake.myshopify.com', accessToken: 'tok', storefrontApiToken: 'store-tok' })
    );
  } finally {
    restore();
  }
  const { lastInsertRowid: productId } = await runWithShop(shop.id, () =>
    prepare(
      `INSERT INTO products (sku, name, price, cost, stock_qty, active, shopify_inventory_item_id)
       VALUES ('SKU-ORPHAN', 'Widget', 10, 5, 20, 1, '888')`
    ).run()
  );
  const { lastInsertRowid: cashierId } = await runWithShop(shop.id, () =>
    prepare(`INSERT INTO employees (name, is_cashier) VALUES ('Orphan Tester', 1)`).run()
  );
  return { shop, productId, cashierId };
}

// Part 1: server.js must expose a structural, request-scoped cleanup
// mechanism - not leave settling a queued slot to whichever specific route
// tail happens to reach firePendingShopifyPushes. This is the fix itself:
// on the committed HEAD (afb0cb6), no such export exists, because settling
// is still solely firePendingShopifyPushes' job.
test('server.js exports a request-scoped wrapper that settles any pending Shopify push slots the request registered, even if the request throws', () => {
  assert.equal(
    typeof serverModule.runRequestWithPushSlotCleanup,
    'function',
    'server.js must export runRequestWithPushSlotCleanup (or equivalent) - the dispatcher\'s own catch/finally must be able to settle ' +
      'any slot a request registered at commit time (createSale -> registerPendingShopifyPushSlot) if that same request then throws ' +
      'before ever reaching firePendingShopifyPushes. Without this, a slot registered at COMMIT time and never fired is orphaned in ' +
      'pendingShopifyPushes forever - see the file header comment.'
  );
});

// Part 2: driving the actual failure - createSale really commits and really
// registers a slot (the exact queue-time behaviour afb0cb6 added and must
// keep), and then the "request" throws before anything resembling
// firePendingShopifyPushes/afterRelease ever runs. The slot must not be
// left behind.
test('a request that throws after createSale commits does not orphan its pendingShopifyPushes slot', async () => {
  const { shop, productId, cashierId } = await setUpShopWithConnectedProduct();
  try {
    const shopifyPushes = [];
    const sizeBefore = pendingShopifyPushes.size;

    const wrap = serverModule.runRequestWithPushSlotCleanup || ((fn) => fn());
    await assert.rejects(
      () =>
        wrap(() =>
          runWithShop(shop.id, async () => {
            const saleId = await createSale(
              { cashierId, items: [{ productId, qty: 3 }], discount: 0, cashAmount: 30 },
              { deferShopifyPushesTo: shopifyPushes }
            );
            assert.ok(saleId, 'the sale must actually commit before the simulated tail failure');
            // Sanity: queue-time registration (afb0cb6) must still be intact -
            // the slot exists the moment createSale commits, strictly before
            // this throw, and strictly before any afterRelease/
            // firePendingShopifyPushes call that (in the real dispatcher)
            // hasn't happened yet at this point in the request.
            assert.equal(pendingShopifyPushes.size, sizeBefore + 1, 'the slot must be registered at commit time');
            // Simulates the real regression: a transient DB error, a bug in
            // serializeSale, anything - in the request's own tail, strictly
            // before afterRelease.push(() => firePendingShopifyPushes(...))
            // is ever reached.
            throw new Error('simulated failure in the request tail, after commit, before afterRelease runs');
          })
        ),
      /simulated failure in the request tail/
    );

    assert.equal(
      pendingShopifyPushes.size,
      sizeBefore,
      'the slot registered at commit time must be settled once the request that queued it fails, not left in pendingShopifyPushes forever'
    );
  } finally {
    await deleteTestShop(shop.id);
  }
});

// Part 3: the actual outer promise the whole fix is about - a real spawned
// process reproduces the failure end to end (real createSale commit, real
// registerPendingShopifyPushSlot, real request-tail throw through the real
// production wrapper) and then calls the real, unmodified gracefulShutdown.
// On the committed HEAD, the orphaned slot never settles, so
// waitForPendingShopifyPushes never resolves and shutdown only ever reaches
// exit(1) via the grace-period force-exit timer. Fixed, the slot settles as
// part of handling the request's own failure, so shutdown drains and exits
// 0 - and does so well before the grace period elapses, not merely "before
// SIGKILL".
function runOrphanShutdownFixture(source) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', source], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString('utf8')));
    child.stderr.on('data', (d) => (stderr += d.toString('utf8')));
    child.on('exit', (code) => resolve({ stdout, stderr, code }));
  });
}

test('gracefulShutdown drains and exits 0 after a real request throws post-commit, instead of force-exiting on an orphaned push slot', async () => {
  const shopifyPath = path.join(ROOT, 'server', 'shopify.js').replace(/\\/g, '\\\\');
  const dbPath = path.join(ROOT, 'server', 'db.js').replace(/\\/g, '\\\\');
  const serverPath = path.join(ROOT, 'server', 'server.js').replace(/\\/g, '\\\\');
  const testShopPath = path.join(ROOT, 'tests', 'helpers', 'testShop.js').replace(/\\/g, '\\\\');

  const source = `
import '${path.join(ROOT, 'server', 'load-env.js').replace(/\\/g, '\\\\')}';
import { pool, runWithShop, prepare } from ${JSON.stringify(dbPath)};
import { saveShopifyConnection } from ${JSON.stringify(shopifyPath)};
import { createTestShop, deleteTestShop } from ${JSON.stringify(testShopPath)};
import { createSale, pendingShopifyPushes, gracefulShutdown } from ${JSON.stringify(serverPath)};
import * as serverModule from ${JSON.stringify(serverPath)};

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ locations: [{ id: 42 }] }) });

const shop = await createTestShop();
await runWithShop(shop.id, () => saveShopifyConnection({ shopDomain: 'fake.myshopify.com', accessToken: 'tok', storefrontApiToken: 'store-tok' }));
const { lastInsertRowid: productId } = await runWithShop(shop.id, () =>
  prepare(\`INSERT INTO products (sku, name, price, cost, stock_qty, active, shopify_inventory_item_id)
           VALUES ('SKU-ORPHAN-FX', 'Widget', 10, 5, 20, 1, '888')\`).run()
);
const { lastInsertRowid: cashierId } = await runWithShop(shop.id, () =>
  prepare("INSERT INTO employees (name, is_cashier) VALUES ('Orphan Fixture', 1)").run()
);
globalThis.fetch = originalFetch;

const wrap = serverModule.runRequestWithPushSlotCleanup || ((fn) => fn());
try {
  await wrap(() =>
    runWithShop(shop.id, async () => {
      await createSale(
        { cashierId, items: [{ productId, qty: 3 }], discount: 0, cashAmount: 30 },
        { deferShopifyPushesTo: [] }
      );
      console.log('MARK slot-count-after-commit:' + pendingShopifyPushes.size);
      throw new Error('simulated request-tail failure, after commit');
    })
  );
} catch (err) {
  console.log('MARK request-failed:' + err.message);
}

await deleteTestShop(shop.id);

const start = Date.now();
setInterval(() => {}, 1000).unref?.();
gracefulShutdown('SIGTERM', {
  httpServer: { close: (cb) => setImmediate(cb), closeIdleConnections: () => {} },
  dbPool: pool,
  graceMs: 4000,
  pendingPushes: pendingShopifyPushes,
  exit: (code) => { console.log('MARK exit:' + code + ':' + (Date.now() - start)); process.exit(code); },
});
`;

  const { stdout, stderr, code } = await runOrphanShutdownFixture(source);
  const exitMatch = stdout.match(/MARK exit:(-?\d+):(\d+)/);
  assert.ok(exitMatch, `expected an exit mark; stdout:\n${stdout}\nstderr:\n${stderr}`);
  const [, exitCode, elapsedStr] = exitMatch;
  assert.equal(
    exitCode,
    '0',
    `gracefulShutdown must drain cleanly and exit 0 once the request that orphaned a slot has itself failed - got exit ${exitCode} ` +
      `(1 means it hit the 10s-class force-exit path with a slot that never settled). stdout:\n${stdout}\nstderr:\n${stderr}`
  );
  assert.ok(
    Number(elapsedStr) < 3000,
    `a settled slot must let shutdown finish well before the grace period, not merely before the 4000ms force-exit; took ${elapsedStr}ms`
  );
});

test.after(async () => {
  await pool.end();
});
