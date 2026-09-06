// tests/shopify-fetch-timeout.test.js
//
// Proves that every outbound Shopify Admin API call is bounded by an
// AbortSignal timeout - a Shopify endpoint that never responds must cause a
// bounded failure, not an indefinite hang. This matters because
// pushInventoryLevel (and the product create/update inside
// syncProductToShopify) run inside withRetry() while a request holds one of
// only ten pooled Postgres connections (see server/db.js runWithShop) - an
// unbounded fetch there can pin that connection for as long as Shopify (or
// an attacker, or a network partition) chooses to leave the socket open.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { encryptSecret, shopifyAdminRequest, saveShopifyConnection, pushInventoryLevel } from '../server/shopify.js';

function stubFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => { globalThis.fetch = original; };
}

// Simulates a server that accepts the connection but never sends a
// response. Only ever settles if the caller wired up an AbortSignal that
// eventually fires - exactly the behaviour real undici/fetch has under
// AbortSignal.timeout(). If the code under test never passes a signal, this
// promise never settles at all, matching a genuine hang.
function neverRespondingFetch() {
  return (url, opts) => new Promise((resolve, reject) => {
    opts?.signal?.addEventListener('abort', () => {
      reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    });
  });
}

test('shopifyAdminRequest fails within a bounded time instead of hanging on a slow response', async () => {
  const connection = { shop_domain: 'fake.myshopify.com', access_token: encryptSecret('faketoken') };
  const restore = stubFetch(neverRespondingFetch());
  try {
    const start = Date.now();
    // A generous watchdog well above any single defensible per-call timeout
    // (seconds, not the tens-of-seconds a full withRetry chain could take).
    // If shopifyAdminRequest is truly unbounded, this watchdog wins the
    // race and the assertion below fails - proving the hang rather than
    // silently passing.
    const watchdog = new Promise((resolve) => setTimeout(() => resolve('WATCHDOG'), 8000));
    const outcome = shopifyAdminRequest(connection, 'GET', '/locations.json')
      .then(() => 'RESOLVED')
      .catch((err) => `REJECTED:${err.name}`);
    const result = await Promise.race([outcome, watchdog]);
    const elapsed = Date.now() - start;
    assert.notEqual(result, 'WATCHDOG', `shopifyAdminRequest hung past the watchdog (${elapsed}ms) instead of timing out`);
    assert.match(result, /^REJECTED/, `expected a rejection, got ${result}`);
    assert.ok(elapsed < 8000, `expected a bounded failure well under the watchdog, took ${elapsed}ms`);
  } finally {
    restore();
  }
});

test('pushInventoryLevel fails within a bounded time and marks the connection sync_error when Shopify never responds', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const restoreConnect = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ locations: [{ id: 42 }] }) }));
      try {
        await saveShopifyConnection({ shopDomain: 'fake.myshopify.com', accessToken: 'tok', storefrontApiToken: 'store-tok' });
      } finally {
        restoreConnect();
      }

      const restore = stubFetch(neverRespondingFetch());
      try {
        const start = Date.now();
        // Watchdog set well above the stated worst-case bound for the
        // 3-attempt withRetry chain around pushInventoryLevel (see the
        // worst-case comment next to withRetry in server/shopify.js), so a
        // pass here proves the retry chain as a whole is bounded, not just
        // one attempt.
        const watchdog = new Promise((resolve) => setTimeout(() => resolve('WATCHDOG'), 25000));
        const outcome = pushInventoryLevel({ shopify_inventory_item_id: '888' }, 5)
          .then(() => 'RESOLVED')
          .catch((err) => `REJECTED:${err.name}`);
        const result = await Promise.race([outcome, watchdog]);
        const elapsed = Date.now() - start;
        assert.notEqual(result, 'WATCHDOG', `pushInventoryLevel hung past the watchdog (${elapsed}ms) instead of timing out`);
        assert.match(result, /^REJECTED/, `expected a rejection, got ${result}`);
      } finally {
        restore();
      }

      const connection = await prepare('SELECT status FROM shopify_connections WHERE shop_id = ?').get(shop.id);
      assert.equal(connection.status, 'sync_error');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test.after(async () => {
  await pool.end();
});
