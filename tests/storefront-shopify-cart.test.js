// tests/storefront-shopify-cart.test.js
//
// public-storefront/storefront.js is a plain browser script (no bundler, no
// module exports) - it's loaded in this test via node:vm into a sandboxed
// context with fake `document`/`location`/`fetch` globals, so its top-level
// function declarations (addToShopifyCart, shopifyStorefrontQuery,
// updateCartBadge, ...) become callable directly without needing a real DOM
// or network. The bottom of the file calls `boot()` automatically on load;
// the fake `fetch` below answers its relative /api/... calls with a generic
// 404 so it fails harmlessly into its own try/catch instead of throwing.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public-storefront', 'storefront.js'),
  'utf8'
);

function loadStorefrontSandbox({ shopifyResponse }) {
  const badgeEl = { textContent: '', style: {}, onclick: null };
  const sandbox = {
    document: {
      getElementById: (id) => (id === 'cart-badge' ? badgeEl : { innerHTML: '' }),
      querySelectorAll: () => [],
    },
    location: { pathname: '/store/test-shop' },
    fetch: async (url) => {
      if (String(url).startsWith('https://')) {
        return { ok: true, status: 200, json: async () => shopifyResponse() };
      }
      // boot()'s own relative /api/storefront/... calls - not under test here.
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
    },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { sandbox, badgeEl };
}

test('addToShopifyCart (cartCreate) succeeds and updates the badge when userErrors is empty', async () => {
  const { sandbox, badgeEl } = loadStorefrontSandbox({
    shopifyResponse: () => ({
      data: {
        cartCreate: {
          cart: { id: 'gid://shopify/Cart/1', checkoutUrl: 'https://example.myshopify.com/checkout', lines: { edges: [{ node: { id: 'line1' } }] } },
          userErrors: [],
        },
      },
    }),
  });

  await sandbox.addToShopifyCart('example.myshopify.com', 'tok', '123', 1);
  assert.equal(badgeEl.textContent, 'Cart (1)');
});

test('addToShopifyCart (cartCreate) throws a readable error, not a null-deref, when Shopify returns userErrors', async () => {
  const { sandbox } = loadStorefrontSandbox({
    shopifyResponse: () => ({
      data: {
        cartCreate: {
          cart: null,
          userErrors: [{ field: ['lines', '0', 'merchandiseId'], message: 'This item is not available for purchase.' }],
        },
      },
    }),
  });

  await assert.rejects(
    () => sandbox.addToShopifyCart('example.myshopify.com', 'tok', '123', 1),
    (err) => {
      assert.match(err.message, /not available for purchase/);
      assert.doesNotMatch(err.message, /Cannot read propert/i);
      return true;
    }
  );
});

test('addToShopifyCart (cartLinesAdd) also checks userErrors on the second-item-onward path', async () => {
  let call = 0;
  const { sandbox, badgeEl } = loadStorefrontSandbox({
    shopifyResponse: () => {
      call += 1;
      if (call === 1) {
        // First call creates the cart (cartCreate).
        return {
          data: {
            cartCreate: {
              cart: { id: 'gid://shopify/Cart/1', checkoutUrl: 'https://example.myshopify.com/checkout', lines: { edges: [{ node: { id: 'line1' } }] } },
              userErrors: [],
            },
          },
        };
      }
      // Second call adds another line (cartLinesAdd) and fails with userErrors.
      return {
        data: {
          cartLinesAdd: {
            cart: null,
            userErrors: [{ field: ['lines'], message: 'The quantity is not available for this product.' }],
          },
        },
      };
    },
  });

  await sandbox.addToShopifyCart('example.myshopify.com', 'tok', '123', 1);
  assert.equal(badgeEl.textContent, 'Cart (1)');

  await assert.rejects(
    () => sandbox.addToShopifyCart('example.myshopify.com', 'tok', '456', 5),
    /quantity is not available/
  );
});

test('the cartCreate and cartLinesAdd mutation strings both request userErrors', async () => {
  const capturedQueries = [];
  const badgeEl = { textContent: '', style: {}, onclick: null };
  const sandbox = {
    document: { getElementById: (id) => (id === 'cart-badge' ? badgeEl : { innerHTML: '' }), querySelectorAll: () => [] },
    location: { pathname: '/store/test-shop' },
    fetch: async (url, opts) => {
      if (String(url).startsWith('https://')) {
        capturedQueries.push(JSON.parse(opts.body).query);
        const isCreate = capturedQueries.length === 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: isCreate
              ? { cartCreate: { cart: { id: 'gid://shopify/Cart/1', checkoutUrl: 'https://x', lines: { edges: [] } }, userErrors: [] } }
              : { cartLinesAdd: { cart: { id: 'gid://shopify/Cart/1', checkoutUrl: 'https://x', lines: { edges: [] } }, userErrors: [] } },
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  await sandbox.addToShopifyCart('example.myshopify.com', 'tok', '123', 1);
  await sandbox.addToShopifyCart('example.myshopify.com', 'tok', '456', 1);

  assert.equal(capturedQueries.length, 2);
  assert.match(capturedQueries[0], /userErrors\s*\{\s*field\s+message\s*\}/);
  assert.match(capturedQueries[1], /userErrors\s*\{\s*field\s+message\s*\}/);
});
