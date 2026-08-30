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

test.after(async () => {
  await pool.end();
});
