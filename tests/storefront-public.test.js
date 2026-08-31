import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import {
  parseStorefrontSlugCandidate,
  resolveStorefrontShop,
  getStorefrontInfo,
  listStorefrontProducts,
  updateStorefrontSettings,
  getOrCreateStorefrontSettings,
} from '../server/storefront.js';
import { saveShopifyConnection } from '../server/shopify.js';

function stubFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => { globalThis.fetch = original; };
}

function fakeRequest(host, pathname, query = {}) {
  const url = new URL(`http://${host}${pathname}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return { req: { headers: { host } }, url };
}

test('parseStorefrontSlugCandidate reads host suffix, path, and query param, in that order', () => {
  const byHost = fakeRequest('acme.wheelhouseepos.com', '/');
  assert.equal(parseStorefrontSlugCandidate(byHost.req, byHost.url), 'acme');

  const byPath = fakeRequest('localhost:4000', '/store/acme');
  assert.equal(parseStorefrontSlugCandidate(byPath.req, byPath.url), 'acme');

  const byQuery = fakeRequest('localhost:4000', '/api/storefront/info', { storefrontSlug: 'acme' });
  assert.equal(parseStorefrontSlugCandidate(byQuery.req, byQuery.url), 'acme');

  const none = fakeRequest('localhost:4000', '/');
  assert.equal(parseStorefrontSlugCandidate(none.req, none.url), null);
});

test('resolveStorefrontShop resolves an enabled shop by subdomain', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, () => updateStorefrontSettings({ enabled: true }));
    const { req, url } = fakeRequest(`${shop.slug}.wheelhouseepos.com`, '/');
    const resolved = await resolveStorefrontShop(req, url);
    assert.deepEqual(resolved, { id: shop.id, slug: shop.slug, name: shop.name });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('resolveStorefrontShop returns null for a disabled storefront', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, () => getOrCreateStorefrontSettings());
    const { req, url } = fakeRequest(`${shop.slug}.wheelhouseepos.com`, '/');
    assert.equal(await resolveStorefrontShop(req, url), null);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('resolveStorefrontShop returns null for an unknown slug', async () => {
  const { req, url } = fakeRequest('no-such-shop-xyz.wheelhouseepos.com', '/');
  assert.equal(await resolveStorefrontShop(req, url), null);
});

test('resolveStorefrontShop falls back to /store/:slug path', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, () => updateStorefrontSettings({ enabled: true }));
    const { req, url } = fakeRequest('localhost:4000', `/store/${shop.slug}`);
    const resolved = await resolveStorefrontShop(req, url);
    assert.deepEqual(resolved, { id: shop.id, slug: shop.slug, name: shop.name });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('resolveStorefrontShop falls back to a ?storefrontSlug= query param', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, () => updateStorefrontSettings({ enabled: true }));
    const { req, url } = fakeRequest('localhost:4000', '/api/storefront/info', { storefrontSlug: shop.slug });
    const resolved = await resolveStorefrontShop(req, url);
    assert.deepEqual(resolved, { id: shop.id, slug: shop.slug, name: shop.name });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('resolveStorefrontShop lets a shop\'s own owner preview it while disabled', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, () => getOrCreateStorefrontSettings()); // enabled defaults to false
    const { req, url } = fakeRequest('localhost:4000', `/store/${shop.slug}`);
    const resolved = await resolveStorefrontShop(req, url, shop.id);
    assert.deepEqual(resolved, { id: shop.id, slug: shop.slug, name: shop.name });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('resolveStorefrontShop does not let a different shop\'s owner preview a disabled storefront', async () => {
  const shop = await createTestShop();
  const otherShop = await createTestShop();
  try {
    await runWithShop(shop.id, () => getOrCreateStorefrontSettings());
    const { req, url } = fakeRequest('localhost:4000', `/store/${shop.slug}`);
    assert.equal(await resolveStorefrontShop(req, url, otherShop.id), null);
  } finally {
    await deleteTestShop(shop.id);
    await deleteTestShop(otherShop.id);
  }
});

test('resolveStorefrontShop still returns null for a disabled storefront with no session at all', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, () => getOrCreateStorefrontSettings());
    const { req, url } = fakeRequest('localhost:4000', `/store/${shop.slug}`);
    assert.equal(await resolveStorefrontShop(req, url, undefined), null);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('getStorefrontInfo reports whether the storefront is actually enabled', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const infoDisabled = await getStorefrontInfo(shop);
      assert.equal(infoDisabled.enabled, false);

      await updateStorefrontSettings({ enabled: true });
      const infoEnabled = await getStorefrontInfo(shop);
      assert.equal(infoEnabled.enabled, true);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('listStorefrontProducts only returns show_online products for the current shop', async () => {
  const shopA = await createTestShop();
  const shopB = await createTestShop();
  try {
    await runWithShop(shopA.id, async () => {
      await prepare(
        "INSERT INTO products (name, price, show_online, active) SELECT 'Visible Bike', 500, true, 1"
      ).run();
    });
    // Directly setting shop_id would violate RLS from outside runWithShop's context,
    // so shopB's product is inserted the same way, under its own shop context.
    await runWithShop(shopB.id, async () => {
      await prepare(
        "INSERT INTO products (name, price, show_online, active) SELECT 'Other Shop Bike', 500, true, 1"
      ).run();
    });
    await runWithShop(shopA.id, async () => {
      await prepare(
        "INSERT INTO products (name, price, show_online, active) SELECT 'Hidden Bike', 500, false, 1"
      ).run();
      const products = await listStorefrontProducts();
      assert.equal(products.length, 1);
      assert.equal(products[0].name, 'Visible Bike');
    });
  } finally {
    await runWithShop(shopA.id, () => prepare('DELETE FROM products').run());
    await runWithShop(shopB.id, () => prepare('DELETE FROM products').run());
    await deleteTestShop(shopA.id);
    await deleteTestShop(shopB.id);
  }
});

test('getStorefrontInfo reflects shop name and settings', async () => {
  const shop = await createTestShop({ name: 'Acme Cycles' });
  try {
    await runWithShop(shop.id, async () => {
      await updateStorefrontSettings({ enabled: true, tagline: 'Ride happy' });
      const info = await getStorefrontInfo(shop);
      assert.equal(info.shopName, 'Acme Cycles');
      assert.equal(info.tagline, 'Ride happy');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('getStorefrontInfo keeps Buy buttons enabled (shopifyDomain set) when the connection is sync_error, but hides them when not_connected', async () => {
  const shop = await createTestShop({ name: 'Acme Cycles' });
  try {
    await runWithShop(shop.id, async () => {
      // Not connected at all - Buy buttons should be hidden.
      const infoNotConnected = await getStorefrontInfo(shop);
      assert.equal(infoNotConnected.shopifyDomain, null);

      const restore = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ locations: [{ id: 1 }] }) }));
      try {
        await saveShopifyConnection({ shopDomain: 'acme.myshopify.com', accessToken: 'tok', storefrontApiToken: 'store-tok' });
      } finally {
        restore();
      }

      const infoConnected = await getStorefrontInfo(shop);
      assert.equal(infoConnected.shopifyDomain, 'acme.myshopify.com');

      // A transient sync failure sets status to sync_error - the underlying
      // Shopify products are still live and purchasable, so Buy buttons
      // should stay up rather than disappearing storefront-wide.
      await prepare('UPDATE shopify_connections SET status = ? WHERE shop_id = ?').run('sync_error', shop.id);
      const infoSyncError = await getStorefrontInfo(shop);
      assert.equal(infoSyncError.shopifyDomain, 'acme.myshopify.com');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test.after(async () => {
  await pool.end();
});
