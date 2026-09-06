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
import { createSale } from '../server/server.js';

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

test.after(async () => {
  await pool.end();
});
