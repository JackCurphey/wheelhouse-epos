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
import { encryptSecret, shopifyAdminRequest, saveShopifyConnection, pushInventoryLevel, registerShopifyWebhooks } from '../server/shopify.js';

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

// A response that resolves successfully but only after `delayMs` - models a
// slow-but-working Shopify, not a hang. Still honours the caller's
// AbortSignal so a genuinely too-slow response still times out.
function slowRespondingFetch(delayMs) {
  return (url, opts) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve({ ok: true, status: 200, json: async () => ({ webhook: { id: 1 } }) });
    }, delayMs);
    opts?.signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    });
  });
}

// Finding 2: registerShopifyWebhooks makes two SHOPIFY_WEBHOOK_TIMEOUT_MS
// (10s) calls, and the whole function runs inside runWithShop for the
// POST /api/shopify/connection route (server/server.js:3207), holding a
// pooled Postgres connection for the whole request. If each call is
// merely slow (not hung) and takes close to the full 10s to succeed,
// running them one after another would add up to ~20s of held connection
// time; run concurrently, the same two slow-but-working calls must
// finish in ~1 call's worth of time (~6s here), not ~2 (~12s) - proving
// the calls race the same deadline instead of stacking.
test('registerShopifyWebhooks completes in ~1 call worth of time, not ~2, when both calls are merely slow (not hung)', async () => {
  const originalBaseUrl = process.env.APP_PUBLIC_URL;
  process.env.APP_PUBLIC_URL = 'https://example.test';
  const connection = { shop_domain: 'fake.myshopify.com', access_token: encryptSecret('faketoken') };
  const restore = stubFetch(slowRespondingFetch(6000));
  try {
    const start = Date.now();
    // Strictly between one slow call (~6s) and two stacked slow calls
    // (~12s), so this only passes if the two webhook calls genuinely run
    // concurrently instead of sequentially.
    const watchdog = new Promise((resolve) => setTimeout(() => resolve('WATCHDOG'), 9000));
    const outcome = registerShopifyWebhooks(connection, 'test-shop-id')
      .then(() => 'RESOLVED')
      .catch((err) => `REJECTED:${err.message}`);
    const result = await Promise.race([outcome, watchdog]);
    const elapsed = Date.now() - start;
    assert.notEqual(result, 'WATCHDOG', `registerShopifyWebhooks took longer than one call's worth of time (${elapsed}ms) - the two webhook calls are running sequentially, not concurrently`);
    assert.equal(result, 'RESOLVED', `expected both calls to succeed, got ${result}`);
  } finally {
    restore();
    process.env.APP_PUBLIC_URL = originalBaseUrl;
  }
});

test.after(async () => {
  await pool.end();
});
