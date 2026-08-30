import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, prepare, runWithShop } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { matchOrderLineItemsToProducts, matchRefundLineItemsToProducts, claimShopifyEvent, markShopifyEventError } from '../server/shopify.js';

test('matchOrderLineItemsToProducts resolves line items by shopify_variant_id, skipping unmapped ones', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const product = await prepare(
        "INSERT INTO products (name, price, shopify_variant_id) VALUES ('Trail Bike', 899, '777') RETURNING *"
      ).get();
      const order = {
        id: 1001,
        line_items: [
          { variant_id: 777, quantity: 2, price: '899.00' },
          { variant_id: 999999, quantity: 1, price: '10.00' },
        ],
      };
      const items = await matchOrderLineItemsToProducts(order);
      assert.deepEqual(items, [{ productId: product.id, qty: 2, unitPrice: 899 }]);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('matchRefundLineItemsToProducts resolves refund line items by nested line_item.variant_id', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const product = await prepare(
        "INSERT INTO products (name, price, shopify_variant_id) VALUES ('Trail Bike', 899, '777') RETURNING *"
      ).get();
      const refund = {
        id: 2001,
        refund_line_items: [{ quantity: 1, line_item: { variant_id: 777 } }],
      };
      const items = await matchRefundLineItemsToProducts(refund);
      assert.equal(items.length, 1);
      assert.equal(items[0].product.id, product.id);
      assert.equal(items[0].qty, 1);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('claimShopifyEvent claims once, then reports already-claimed on retry', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const first = await claimShopifyEvent('3001', 'order');
      assert.equal(first, true);
      const retry = await claimShopifyEvent('3001', 'order');
      assert.equal(retry, false);
      const differentKind = await claimShopifyEvent('3001', 'refund');
      assert.equal(differentKind, true, 'order and refund events for the same id are independent');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('markShopifyEventError records the failure on an already-claimed event', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await claimShopifyEvent('4001', 'order');
      await markShopifyEventError('4001', 'order', 'Not enough stock');
      const row = await prepare(
        "SELECT status, error_message FROM shopify_processed_events WHERE shopify_order_id = '4001' AND kind = 'order'"
      ).get();
      assert.equal(row.status, 'error');
      assert.equal(row.error_message, 'Not enough stock');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test.after(async () => {
  await pool.end();
});
