import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { getShopifyConnection, saveShopifyConnection, serializeShopifyConnection } from '../server/shopify.js';

function stubFetch(responsesByPath) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const match = Object.keys(responsesByPath).find((path) => String(url).includes(path));
    if (!match) throw new Error(`Unexpected fetch to ${url}`);
    const body = responsesByPath[match];
    return { ok: true, status: 200, json: async () => body };
  };
  return () => { globalThis.fetch = original; };
}

test('saveShopifyConnection verifies the token via /locations.json and stores the connection', async () => {
  const restoreFetch = stubFetch({
    '/locations.json': { locations: [{ id: 998877 }] },
  });
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const connection = await saveShopifyConnection({
        shopDomain: 'test-shop.myshopify.com',
        accessToken: 'shpat_fake',
        storefrontApiToken: 'storefront_fake',
      });
      assert.equal(connection.shop_domain, 'test-shop.myshopify.com');
      assert.equal(connection.location_id, '998877');
      assert.equal(connection.status, 'connected');
      assert.notEqual(connection.access_token, 'shpat_fake', 'token must be stored encrypted, not in plaintext');

      const serialized = serializeShopifyConnection(connection);
      assert.deepEqual(serialized, {
        connected: true,
        shopDomain: 'test-shop.myshopify.com',
        status: 'connected',
        connectedAt: connection.connected_at,
      });
    });
  } finally {
    restoreFetch();
    await deleteTestShop(shop.id);
  }
});

test('getShopifyConnection returns null when no connection exists', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      assert.equal(await getShopifyConnection(), null);
      assert.deepEqual(serializeShopifyConnection(null), { connected: false, shopDomain: null, status: 'not_connected', connectedAt: null });
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test.after(async () => {
  await pool.end();
});
