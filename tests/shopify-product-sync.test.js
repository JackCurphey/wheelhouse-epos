// tests/shopify-product-sync.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { saveShopifyConnection, syncProductToShopify, unpublishProductFromShopify } from '../server/shopify.js';

function stubFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => { globalThis.fetch = original; };
}

async function connectFakeShopify(shopId) {
  const restore = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ locations: [{ id: 1 }] }) }));
  try {
    return await saveShopifyConnection({ shopDomain: 'fake.myshopify.com', accessToken: 'tok', storefrontApiToken: 'store-tok' });
  } finally {
    restore();
  }
}

test('syncProductToShopify creates a new Shopify product and stores the mapping', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await connectFakeShopify(shop.id);
      const product = await prepare(
        "INSERT INTO products (name, price, description, show_online) VALUES ('Trail Bike', 899, 'Great trail bike', true) RETURNING *"
      ).get();

      const restore = stubFetch(async (url, opts) => {
        assert.match(String(url), /\/products\.json$/);
        assert.equal(opts.method, 'POST');
        return { ok: true, status: 201, json: async () => ({ product: { id: 555, variants: [{ id: 777, inventory_item_id: 888 }] } }) };
      });
      try {
        const result = await syncProductToShopify(product);
        assert.deepEqual(result, { shopifyProductId: '555', shopifyVariantId: '777' });
      } finally {
        restore();
      }

      const updated = await prepare('SELECT * FROM products WHERE id = ?').get(product.id);
      assert.equal(updated.shopify_product_id, '555');
      assert.equal(updated.shopify_variant_id, '777');
      assert.equal(updated.shopify_inventory_item_id, '888');
    });
  } finally {
    // Products created under this shop must be cleared before the shop row
    // itself can be deleted (products.shop_id has a FK to shops), same
    // pattern as storefront-public.test.js.
    await runWithShop(shop.id, () => prepare('DELETE FROM products').run());
    await deleteTestShop(shop.id);
  }
});

test('syncProductToShopify updates an existing Shopify product when already mapped', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await connectFakeShopify(shop.id);
      const product = await prepare(
        `INSERT INTO products (name, price, show_online, shopify_product_id, shopify_variant_id, shopify_inventory_item_id)
         VALUES ('Trail Bike', 899, true, '555', '777', '888') RETURNING *`
      ).get();

      const restore = stubFetch(async (url, opts) => {
        assert.match(String(url), /\/products\/555\.json$/);
        assert.equal(opts.method, 'PUT');
        return { ok: true, status: 200, json: async () => ({ product: { id: 555, variants: [{ id: 777, inventory_item_id: 888 }] } }) };
      });
      try {
        await syncProductToShopify(product);
      } finally {
        restore();
      }
    });
  } finally {
    await runWithShop(shop.id, () => prepare('DELETE FROM products').run());
    await deleteTestShop(shop.id);
  }
});

test('syncProductToShopify does nothing when Shopify is not connected', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const product = await prepare(
        "INSERT INTO products (name, price, show_online) VALUES ('Trail Bike', 899, true) RETURNING *"
      ).get();
      assert.equal(await syncProductToShopify(product), null);
    });
  } finally {
    await runWithShop(shop.id, () => prepare('DELETE FROM products').run());
    await deleteTestShop(shop.id);
  }
});

test('syncProductToShopify retries on failure, then marks the connection sync_error', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await connectFakeShopify(shop.id);
      const product = await prepare(
        "INSERT INTO products (name, price, show_online) VALUES ('Trail Bike', 899, true) RETURNING *"
      ).get();

      let attempts = 0;
      const restore = stubFetch(async () => {
        attempts += 1;
        return { ok: false, status: 500, json: async () => ({ errors: 'Internal Server Error' }) };
      });
      try {
        await assert.rejects(() => syncProductToShopify(product));
      } finally {
        restore();
      }
      assert.equal(attempts, 3, 'should retry twice after the first failure (3 attempts total)');

      const connection = await prepare('SELECT status FROM shopify_connections WHERE shop_id = ?').get(shop.id);
      assert.equal(connection.status, 'sync_error');
    });
  } finally {
    await runWithShop(shop.id, () => prepare('DELETE FROM products').run());
    await deleteTestShop(shop.id);
  }
});

test('syncProductToShopify recovers a sync_error connection back to connected on the next successful sync', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await connectFakeShopify(shop.id);
      const product = await prepare(
        "INSERT INTO products (name, price, show_online) VALUES ('Trail Bike', 899, true) RETURNING *"
      ).get();

      // Simulate a prior transient failure having already marked the
      // connection sync_error, the way the retry-then-fail test above does.
      await prepare('UPDATE shopify_connections SET status = ? WHERE shop_id = ?').run('sync_error', shop.id);

      const restore = stubFetch(async (url, opts) => {
        assert.match(String(url), /\/products\.json$/);
        assert.equal(opts.method, 'POST');
        return { ok: true, status: 201, json: async () => ({ product: { id: 555, variants: [{ id: 777, inventory_item_id: 888 }] } }) };
      });
      try {
        const result = await syncProductToShopify(product);
        assert.deepEqual(result, { shopifyProductId: '555', shopifyVariantId: '777' });
      } finally {
        restore();
      }

      const connection = await prepare('SELECT status FROM shopify_connections WHERE shop_id = ?').get(shop.id);
      assert.equal(connection.status, 'connected');
    });
  } finally {
    await runWithShop(shop.id, () => prepare('DELETE FROM products').run());
    await deleteTestShop(shop.id);
  }
});

test('unpublishProductFromShopify sets published=false on the mapped Shopify product', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await connectFakeShopify(shop.id);
      const product = await prepare(
        `INSERT INTO products (name, price, show_online, shopify_product_id) VALUES ('Trail Bike', 899, false, '555') RETURNING *`
      ).get();

      const restore = stubFetch(async (url, opts) => {
        assert.match(String(url), /\/products\/555\.json$/);
        const body = JSON.parse(opts.body);
        assert.equal(body.product.published, false);
        return { ok: true, status: 200, json: async () => ({ product: { id: 555 } }) };
      });
      try {
        await unpublishProductFromShopify(product);
      } finally {
        restore();
      }
    });
  } finally {
    await runWithShop(shop.id, () => prepare('DELETE FROM products').run());
    await deleteTestShop(shop.id);
  }
});

test.after(async () => {
  await pool.end();
});
