// tests/shopify-inventory-sync.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { saveShopifyConnection, pushInventoryLevel } from '../server/shopify.js';

function stubFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => { globalThis.fetch = original; };
}

test('pushInventoryLevel sets the quantity at the connection\'s stored location', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const restoreConnect = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ locations: [{ id: 42 }] }) }));
      try {
        await saveShopifyConnection({ shopDomain: 'fake.myshopify.com', accessToken: 'tok', storefrontApiToken: 'store-tok' });
      } finally {
        restoreConnect();
      }

      const product = { shopify_inventory_item_id: '888' };
      const restore = stubFetch(async (url, opts) => {
        assert.match(String(url), /\/inventory_levels\/set\.json$/);
        const body = JSON.parse(opts.body);
        assert.equal(body.location_id, '42');
        assert.equal(body.inventory_item_id, '888');
        assert.equal(body.available, 7);
        return { ok: true, status: 200, json: async () => ({}) };
      });
      try {
        await pushInventoryLevel(product, 7);
      } finally {
        restore();
      }
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('pushInventoryLevel retries on failure, then marks the connection sync_error', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const restoreConnect = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ locations: [{ id: 42 }] }) }));
      try {
        await saveShopifyConnection({ shopDomain: 'fake.myshopify.com', accessToken: 'tok', storefrontApiToken: 'store-tok' });
      } finally {
        restoreConnect();
      }

      let attempts = 0;
      const restore = stubFetch(async () => {
        attempts += 1;
        return { ok: false, status: 500, json: async () => ({ errors: 'Internal Server Error' }) };
      });
      try {
        await assert.rejects(() => pushInventoryLevel({ shopify_inventory_item_id: '888' }, 5));
      } finally {
        restore();
      }
      assert.equal(attempts, 3);

      // Use the request-scoped client (prepare/currentClient), not a raw
      // pool.query - the runWithShop client above is still checked out for
      // the whole duration of this callback, so pool.query would be forced
      // onto a different, brand-new connection that has never had
      // app.current_shop_id set, and shopify_connections' FORCE ROW LEVEL
      // SECURITY policy would then fail with "unrecognized configuration
      // parameter" rather than filtering rows. Same pattern already used in
      // tests/shopify-product-sync.test.js.
      const connection = await prepare('SELECT status FROM shopify_connections WHERE shop_id = ?').get(shop.id);
      assert.equal(connection.status, 'sync_error');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('pushInventoryLevel recovers the connection to connected after a prior sync_error', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const restoreConnect = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ locations: [{ id: 42 }] }) }));
      try {
        await saveShopifyConnection({ shopDomain: 'fake.myshopify.com', accessToken: 'tok', storefrontApiToken: 'store-tok' });
      } finally {
        restoreConnect();
      }
      // Same reasoning as above - use the request-scoped client rather than
      // a raw pool.query for shop-scoped tables under RLS.
      await prepare("UPDATE shopify_connections SET status = 'sync_error' WHERE shop_id = ?").run(shop.id);

      const restore = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));
      try {
        await pushInventoryLevel({ shopify_inventory_item_id: '888' }, 3);
      } finally {
        restore();
      }

      const connection = await prepare('SELECT status FROM shopify_connections WHERE shop_id = ?').get(shop.id);
      assert.equal(connection.status, 'connected');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('pushInventoryLevel is a no-op for a product with no Shopify mapping', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await pushInventoryLevel({ shopify_inventory_item_id: null }, 5);
      // No fetch stub installed at all - if this called fetch, the test would throw ECONNREFUSED/DNS error.
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test.after(async () => {
  await pool.end();
});
