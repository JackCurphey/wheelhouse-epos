// tests/sale-shopify-push-unwrapped-slot.test.js
//
// Fix round 3: registerPendingShopifyPushSlot's cleanup only works if the
// call happens inside runRequestWithPushSlotCleanup's AsyncLocalStorage
// scope - see the comment on pendingPushSlotRequestStorage in server.js.
// That invariant used to be asserted only in a comment, not enforced. This
// test pins the enforcement: registering a slot with no active
// request-scoped store must log a clear, loud error identifying the gap,
// so a future route added outside the one wrapped branch is caught the
// moment it is first exercised rather than silently degrading shutdown
// health months later.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { saveShopifyConnection } from '../server/shopify.js';
import { createSale, pendingShopifyPushes } from '../server/server.js';

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
       VALUES ('SKU-UNWRAPPED', 'Widget', 10, 5, 20, 1, '999')`
    ).run()
  );
  const { lastInsertRowid: cashierId } = await runWithShop(shop.id, () =>
    prepare(`INSERT INTO employees (name, is_cashier) VALUES ('Unwrapped Tester', 1)`).run()
  );
  return { shop, productId, cashierId };
}

test('registering a deferred Shopify push slot with no active request-scoped store logs a loud, identifiable error', async () => {
  const { shop, productId, cashierId } = await setUpShopWithConnectedProduct();
  const originalConsoleError = console.error;
  const calls = [];
  console.error = (...args) => {
    calls.push(args);
  };
  const shopifyPushes = [];
  try {
    // Deliberately NOT wrapped in runRequestWithPushSlotCleanup - this is
    // exactly the condition the guard exists to catch.
    const saleId = await runWithShop(shop.id, () =>
      createSale(
        { cashierId, items: [{ productId, qty: 2 }], discount: 0, cashAmount: 20 },
        { deferShopifyPushesTo: shopifyPushes }
      )
    );
    assert.ok(saleId, 'the sale must commit and register a slot for this test to be meaningful');

    const matched = calls.some((args) =>
      args.some(
        (arg) =>
          typeof arg === 'string' &&
          arg.includes('registerPendingShopifyPushSlot') &&
          arg.includes('no active request-scoped store')
      )
    );
    assert.ok(
      matched,
      `expected a console.error call identifying the missing request-scoped store; got calls:\n${JSON.stringify(calls, null, 2)}`
    );
  } finally {
    console.error = originalConsoleError;
    // Drain the slot registered above so it doesn't linger in
    // pendingShopifyPushes for the rest of the suite - _pendingPushSettle
    // is exactly the resolver registerPendingShopifyPushSlot returned.
    if (typeof shopifyPushes._pendingPushSettle === 'function') {
      shopifyPushes._pendingPushSettle();
    }
    await deleteTestShop(shop.id);
  }
});

test.after(async () => {
  await pool.end();
});
