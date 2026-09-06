// tests/sale-shopify-push-release.test.js
//
// Part 4 of the lifecycle brief: createSale's Shopify inventory pushes fire
// after COMMIT (see the comment at server/server.js's createSale), but used
// to run while still inside the request's own runWithShop scope - holding
// one of the ten pooled Postgres connections across an HTTP round-trip to
// Shopify, retries and backoff included. createSale's `deferShopifyPushesTo`
// option (server/server.js) lets a caller collect the pending pushes instead
// of firing them inline, so it can release its own client first and fire
// them from a fresh scope afterward - exactly what server.js's
// firePendingShopifyPushes does for the two real HTTP routes
// (POST /api/sales, POST /api/sale-documents/:id/convert).
//
// This file drives createSale directly (it is exported), and reproduces
// firePendingShopifyPushes's exact pattern - a fresh runWithShop(shopId, ...)
// opened only after the original scope has already ended - because that
// helper itself is an internal, unexported implementation detail of the
// dispatcher wiring. What's under test is the real, unmodified createSale
// export, which is where the restructuring actually lives.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { saveShopifyConnection, pushInventoryLevel } from '../server/shopify.js';
import { createSale, pendingShopifyPushes, firePendingShopifyPushes } from '../server/server.js';

function stubFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = original;
  };
}

async function setUpShopWithConnectedProduct(events) {
  const shop = await createTestShop();
  const restore = stubFetch(async (url) => {
    events.push('locations-probe');
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
       VALUES ('SKU-PUSH', 'Widget', 10, 5, 20, 1, '888')`
    ).run()
  );
  const { lastInsertRowid: cashierId } = await runWithShop(shop.id, () =>
    prepare(`INSERT INTO employees (name, is_cashier) VALUES ('Till Person', 1)`).run()
  );
  return { shop, productId, cashierId };
}

test('createSale({deferShopifyPushesTo}) captures the pending push instead of firing it, and never touches the network while inside its own runWithShop scope', async () => {
  const events = [];
  const { shop, productId, cashierId } = await setUpShopWithConnectedProduct(events);
  try {
    const eventsBeforeSale = events.length;
    const shopifyPushes = [];
    const restore = stubFetch(async () => {
      events.push('unexpected-network-call-during-createSale');
      return { ok: true, status: 200, json: async () => ({}) };
    });
    let saleId;
    try {
      await runWithShop(shop.id, async () => {
        saleId = await createSale(
          { cashierId, items: [{ productId, qty: 3 }], discount: 0, cashAmount: 30 },
          { deferShopifyPushesTo: shopifyPushes }
        );
      });
    } finally {
      restore();
    }

    assert.ok(saleId, 'the sale must still be created');
    assert.deepEqual(
      events.slice(eventsBeforeSale),
      [],
      'createSale must not touch the network at all while deferShopifyPushesTo is given a collector'
    );
    assert.equal(shopifyPushes.length, 1, 'the pending push must be captured');
    assert.equal(shopifyPushes[0].product.id, productId);
    assert.equal(shopifyPushes[0].newQty, 17, 'stock_qty (20) minus the sale qty (3)');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the deferred push runs, with the right quantity, only after the sale\'s own pooled client is back in the pool - never overlapping it', async () => {
  const events = [];
  const { shop, productId, cashierId } = await setUpShopWithConnectedProduct(events);
  try {
    const shopifyPushes = [];
    let pushedBody = null;
    let activeDuringSale = null;
    let activeAfterRelease = null;
    let activeDuringPush = null;

    const restore = stubFetch(async (url, opts) => {
      events.push('shopify-inventory-push');
      pushedBody = JSON.parse(opts.body);
      activeDuringPush = pool.totalCount - pool.idleCount;
      return { ok: true, status: 200, json: async () => ({}) };
    });
    try {
      await runWithShop(shop.id, async () => {
        await createSale(
          { cashierId, items: [{ productId, qty: 3 }], discount: 0, cashAmount: 30 },
          { deferShopifyPushesTo: shopifyPushes }
        );
        activeDuringSale = pool.totalCount - pool.idleCount;
      });
      events.push('sale-scope-released');
      activeAfterRelease = pool.totalCount - pool.idleCount;

      // The exact pattern server.js's firePendingShopifyPushes uses: a FRESH
      // runWithShop scope, opened only now that the sale's own client has
      // already gone back to the pool.
      await runWithShop(shop.id, async () => {
        for (const { product, newQty } of shopifyPushes) {
          await pushInventoryLevel(product, newQty);
        }
      });
    } finally {
      restore();
    }

    assert.deepEqual(events, ['locations-probe', 'sale-scope-released', 'shopify-inventory-push']);
    assert.equal(pushedBody.inventory_item_id, '888');
    assert.equal(pushedBody.available, 17);
    assert.ok(activeDuringSale >= 1, 'a client is checked out for the sale itself');
    assert.ok(
      activeAfterRelease < activeDuringSale,
      'the sale\'s client must be released before the push scope opens'
    );
    assert.equal(
      activeDuringPush,
      activeAfterRelease + 1,
      'the push must open its own fresh client rather than reusing one still counted from the sale'
    );
  } finally {
    await deleteTestShop(shop.id);
  }
});

// Pins the constraint that motivates wrapping the deferred push in its own
// runWithShop scope in the first place: pushInventoryLevel is not a pure
// network call. getShopifyConnection() (and the post-push status update)
// both read the request-scoped client through prepare()/AsyncLocalStorage
// (server/db.js), so calling it with no scope open at all - which is what
// "just fire it after the client is released" would naively mean - throws
// immediately rather than reaching the network.
test('pushInventoryLevel cannot run with no database scope open at all', async () => {
  await assert.rejects(
    () => pushInventoryLevel({ shopify_inventory_item_id: '888' }, 5),
    /No database client in scope/
  );
});

// Important 4: the real route handlers (POST /api/sales,
// POST /api/sale-documents/:id/convert) only call firePendingShopifyPushes
// from an `afterRelease` callback that runs after res.end() and after
// runWithShop/releaseClient's own round-trips - a real gap the size of a
// signal handler's single tick. If gracefulShutdown's pendingShopifyPushes
// set only gained an entry when firePendingShopifyPushes itself ran (at FIRE
// time), a SIGTERM landing in that gap would see the set empty, let
// closeIdleConnections() cut the idle client's socket, and pool.end() would
// beat the push's own connect() - the same seam commit 26034ae already
// closed one layer earlier. This proves the set gains its entry the moment
// createSale commits (QUEUE time), strictly before any afterRelease callback
// has had a chance to run at all.
test('pendingShopifyPushes gains a tracking entry the moment createSale commits, before firePendingShopifyPushes ever runs', async () => {
  const events = [];
  const { shop, productId, cashierId } = await setUpShopWithConnectedProduct(events);
  try {
    const shopifyPushes = [];
    const sizeBefore = pendingShopifyPushes.size;
    let saleId;
    await runWithShop(shop.id, async () => {
      saleId = await createSale(
        { cashierId, items: [{ productId, qty: 3 }], discount: 0, cashAmount: 30 },
        { deferShopifyPushesTo: shopifyPushes }
      );
    });
    // Deliberately checked BEFORE anything resembling the real
    // firePendingShopifyPushes/afterRelease callback is ever invoked - a
    // fix that only registers the entry at fire time would leave the set
    // exactly as it was before createSale ran, and this assertion would
    // fail.
    assert.ok(saleId, 'the sale must still be created');
    assert.equal(
      pendingShopifyPushes.size,
      sizeBefore + 1,
      'createSale must register a pendingShopifyPushes tracking entry as soon as it commits, not wait for the caller to fire the push'
    );

    // Settling it the real way (the deferred push actually running) must
    // clear the entry back out - proving this isn't a permanent leak.
    const restore = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    try {
      await runWithShop(shop.id, async () => {
        for (const { product, newQty } of shopifyPushes) {
          await pushInventoryLevel(product, newQty);
        }
      });
    } finally {
      restore();
    }
    if (shopifyPushes._pendingPushSettle) shopifyPushes._pendingPushSettle();
    await new Promise((r) => setImmediate(r));
    assert.equal(pendingShopifyPushes.size, sizeBefore, 'the tracking entry must clear once the push actually settles');
  } finally {
    await deleteTestShop(shop.id);
  }
});

// Important 1: firePendingShopifyPushes used to wrap its whole `for` loop
// in ONE runWithShop scope, pinning a single pooled connection for the
// entire batch (each item up to ~15.15s under withRetry - see
// server/shopify.js's withRetry comment). This proves the fix ("a scope per
// push") the direct way: spying on pool.connect() itself. One shared scope
// for a 2-item batch calls pool.connect() exactly once; a fresh scope per
// item calls it twice - a deterministic signal of the actual code path
// taken, not a timing race against how fast Node happens to reuse a freed
// connection.
test('firePendingShopifyPushes opens a fresh pooled connection per push, not one held for the whole batch', async () => {
  const events = [];
  const { shop } = await setUpShopWithConnectedProduct(events);
  try {
    const restoreFetch = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    const originalConnect = pool.connect.bind(pool);
    let connectCalls = 0;
    pool.connect = (...args) => {
      connectCalls += 1;
      return originalConnect(...args);
    };
    const pushes = [
      { product: { shopify_inventory_item_id: '888' }, newQty: 1 },
      { product: { shopify_inventory_item_id: '999' }, newQty: 2 },
    ];
    try {
      const sizeBefore = pendingShopifyPushes.size;
      firePendingShopifyPushes(shop.id, pushes);
      const deadline = Date.now() + 5000;
      while (pendingShopifyPushes.size > sizeBefore) {
        if (Date.now() > deadline) throw new Error('firePendingShopifyPushes never settled');
        await new Promise((r) => setTimeout(r, 20));
      }
    } finally {
      pool.connect = originalConnect;
      restoreFetch();
    }
    assert.equal(
      connectCalls,
      pushes.length,
      `expected one pool.connect() per queued push (${pushes.length}), got ${connectCalls} - a single scope wrapping the whole batch would only call it once`
    );
  } finally {
    await deleteTestShop(shop.id);
  }
});

test.after(async () => {
  await pool.end();
});
