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

// The older Shopify connection (shopify_connections; decision 9 keeps it) is
// sent the stock less bikes held for Cycle to Work, as the newer sync is
// (openspec/changes/cycle-to-work task 5.6; decided-while-building 14 Nov).
// Codes and prices are made-up test values.
test('pushInventoryLevel sends the stock less held frames and bikes held by count, never below nought', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const restoreConnect = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ locations: [{ id: 42 }] }) }));
      try {
        await saveShopifyConnection({ shopDomain: 'fake.myshopify.com', accessToken: 'tok', storefrontApiToken: 'store-tok' });
      } finally {
        restoreConnect();
      }
      const bike = (await prepare("INSERT INTO products (sku, name, price, cost, stock_qty, vat_rate_bp, shopify_inventory_item_id) VALUES ('[SKU-HELD]', '[Bike]', '900.00', 0, 3, 2000, '777') RETURNING id").get()).id;
      const site = null; // a test shop has no site; both columns allow none
      const customer = (await prepare("INSERT INTO customers (name) VALUES ('[Customer]') RETURNING id").get()).id;
      const provider = (await prepare("INSERT INTO c2w_providers (name) VALUES ('[Provider]') RETURNING id").get()).id;
      await prepare("INSERT INTO stock_frames (product_id, site_id, frame_number, frame_key, state) VALUES (?, ?, '[FRAME-1]', '[FRAME-1]', 'held') RETURNING id").get(bike, site);
      await prepare("INSERT INTO c2w_orders (customer_id, provider_id, product_id, site_id, held_at, stage, quote_number, total_pence, customer_code) VALUES (?, ?, ?, ?, now(), 'waiting', 1, 90000, ?) RETURNING id")
        .get(customer, provider, bike, site, `[code-${shop.id}]`);

      const sent = [];
      const restore = stubFetch(async (url, opts) => { sent.push(JSON.parse(opts.body).available); return { ok: true, status: 200, json: async () => ({}) }; });
      try {
        const product = await prepare('SELECT * FROM products WHERE id = ?').get(bike);
        await pushInventoryLevel(product, 3);
        await pushInventoryLevel(product, 1);
      } finally {
        restore();
      }
      assert.deepEqual(sent, [1, 0], 'a held frame and a count hold are each left out, and the figure stops at nought');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test.after(async () => {
  await pool.end();
});
