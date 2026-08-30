# Shopify Checkout Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a shop connect their own Shopify store so storefront products can be bought online — EPOS pushes products and stock to Shopify, a customer builds a cart natively on the storefront and pays on Shopify's hosted checkout, and Shopify order/refund webhooks flow back to keep EPOS stock and sales history accurate.

**Architecture:** All Shopify-domain logic (encryption, HMAC verification, Admin/Storefront API calls, connection CRUD, order/refund line-item matching, idempotency bookkeeping) lives in a new `server/shopify.js` module with plain exported functions, importing nothing from `server.js` — this keeps it independently unit-testable (via a stubbed global `fetch`) and avoids a circular import, since the final step of processing a webhook needs `server.js`'s existing `createSale()`. `server/server.js` gains: new routes, a dispatcher branch for `/webhooks/shopify/...`, hooks into the existing product-CRUD and till-sale code to trigger sync, and two new functions (`processShopifyOrderWebhook`/`processShopifyRefundWebhook`) that glue `shopify.js`'s tested primitives to the existing `createSale()`. The storefront frontend (`public-storefront/`, from the prior plan) gains a native cart built on Shopify's Storefront API, redirecting to Shopify's hosted checkout only for the final payment step.

**Tech Stack:** No new dependencies. Node's built-in global `fetch` for all Shopify API calls; `node:crypto` (`createCipheriv`/`createDecipheriv`/`createHmac`/`timingSafeEqual`) for encryption and webhook verification, matching the style already used in `server/auth.js`.

**Spec:** [docs/superpowers/specs/2026-08-30-shop-storefronts-design.md](../specs/2026-08-30-shop-storefronts-design.md)

**Depends on:** [2026-08-30-storefront-framework.md](2026-08-30-storefront-framework.md) — this plan assumes that one is implemented first (migrations through `011_product_photo_types.sql` already applied, `server/storefront.js` and `public-storefront/` already exist).

## Global Constraints

- Same placeholder/RLS/migration-numbering/no-new-dependency conventions as the storefront framework plan (see its Global Constraints) — new migrations continue from `012_`.
- Two new environment variables are required in production (add to `.env`, not committed): `SHOPIFY_TOKEN_ENCRYPTION_KEY` (a long random string — used to derive the AES key that encrypts stored Shopify tokens) and `APP_PUBLIC_URL` (the app's own public base URL, e.g. `https://app.wheelhouseepos.com` — used to build the webhook callback URLs registered with Shopify). Document both in `README.md`'s requirements section as part of this plan.
- Never log or return a decrypted Shopify access token, storefront token, or webhook secret in any API response — `serializeShopifyConnection` must only ever expose `shopDomain`, `status`, `connectedAt`.
- Tests that call Shopify's API stub `globalThis.fetch` directly (save the original, replace it with a function returning a fake `Response`-like object, restore it in `test.after`) rather than adding an HTTP-mocking dependency — each `node --test` file runs in its own process, so this doesn't leak between test files.

---

## Task 1: Migration — Shopify connections, product mapping columns, event log

**Files:**
- Create: `server/migrations/012_shopify.sql`

**Interfaces:**
- Produces: table `shopify_connections` (`id, shop_id, shop_domain, access_token, storefront_api_token, webhook_secret, location_id, status, connected_at, updated_at`); new columns on `products`: `shopify_product_id`, `shopify_variant_id`, `shopify_inventory_item_id` (all `TEXT`, nullable); table `shopify_processed_events` (`id, shop_id, shopify_order_id, kind, status, error_message, processed_at`, `UNIQUE (shop_id, shopify_order_id, kind)`).

- [ ] **Step 1: Write the migration**

```sql
-- server/migrations/012_shopify.sql

-- Per-shop Shopify connection. Each shop connects their own Shopify store
-- via a custom-app Admin API token they generate themselves (not a public
-- OAuth "install app" flow - see the design spec). location_id is fetched
-- and cached at connect time so inventory pushes don't need an extra API
-- call per update.
CREATE TABLE shopify_connections (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL UNIQUE DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  shop_domain TEXT NOT NULL,
  access_token TEXT NOT NULL,
  storefront_api_token TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  location_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_connected',
  connected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE shopify_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_connections FORCE ROW LEVEL SECURITY;
CREATE POLICY shopify_connections_shop_isolation ON shopify_connections
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Populated once a show_online product is successfully pushed to the
-- shop's connected Shopify store; null means "not yet synced".
ALTER TABLE products ADD COLUMN shopify_product_id TEXT;
ALTER TABLE products ADD COLUMN shopify_variant_id TEXT;
ALTER TABLE products ADD COLUMN shopify_inventory_item_id TEXT;

-- Idempotency + audit log for inbound Shopify order/refund webhooks. The
-- unique constraint is the atomic "claim this event" gate - a webhook
-- handler INSERTs (ON CONFLICT DO NOTHING) before doing any work, and
-- treats zero rows affected as "already processed, skip".
CREATE TABLE shopify_processed_events (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  shopify_order_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'order' | 'refund'
  status TEXT NOT NULL DEFAULT 'ok', -- 'ok' | 'error'
  error_message TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, shopify_order_id, kind)
);
ALTER TABLE shopify_processed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_processed_events FORCE ROW LEVEL SECURITY;
CREATE POLICY shopify_processed_events_shop_isolation ON shopify_processed_events
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
```

- [ ] **Step 2: Run the migration**

```bash
npm run migrate
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/migrations/012_shopify.sql
git commit -m "feat: add shopify_connections, product mapping columns, and event log"
```

---

## Task 2: Crypto and webhook-signature helpers

**Files:**
- Create: `server/shopify.js`
- Create: `tests/shopify-crypto.test.js`

**Interfaces:**
- Produces: `encryptSecret(plaintext)` → base64 string; `decryptSecret(encoded)` → original plaintext string (round-trips with `encryptSecret`); `verifyShopifyWebhookHmac(rawBody, hmacHeader, webhookSecret)` → boolean.

- [ ] **Step 1: Write the failing tests**

```js
// tests/shopify-crypto.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { encryptSecret, decryptSecret, verifyShopifyWebhookHmac } from '../server/shopify.js';

test('encryptSecret/decryptSecret round-trip', () => {
  const plaintext = 'shpat_abc123secret';
  const encrypted = encryptSecret(plaintext);
  assert.notEqual(encrypted, plaintext);
  assert.equal(decryptSecret(encrypted), plaintext);
});

test('encryptSecret produces different ciphertext each time (random IV)', () => {
  const a = encryptSecret('same-input');
  const b = encryptSecret('same-input');
  assert.notEqual(a, b);
  assert.equal(decryptSecret(a), 'same-input');
  assert.equal(decryptSecret(b), 'same-input');
});

test('verifyShopifyWebhookHmac accepts a correctly signed body', () => {
  const secret = 'test-webhook-secret';
  const rawBody = '{"id":123,"line_items":[]}';
  const validHmac = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  assert.equal(verifyShopifyWebhookHmac(rawBody, validHmac, secret), true);
});

test('verifyShopifyWebhookHmac rejects a tampered body', () => {
  const secret = 'test-webhook-secret';
  const validHmac = createHmac('sha256', secret).update('{"id":123}', 'utf8').digest('base64');
  assert.equal(verifyShopifyWebhookHmac('{"id":456}', validHmac, secret), false);
});

test('verifyShopifyWebhookHmac rejects a missing signature', () => {
  assert.equal(verifyShopifyWebhookHmac('{"id":123}', undefined, 'test-webhook-secret'), false);
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test
```

Expected: FAIL — `server/shopify.js` does not exist.

- [ ] **Step 3: Implement**

```js
// server/shopify.js
import { createCipheriv, createDecipheriv, createHmac, timingSafeEqual, randomBytes, scryptSync } from 'node:crypto';

const ENCRYPTION_KEY = scryptSync(process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY || 'dev-only-insecure-key', 'shopify-token-salt', 32);

export function encryptSecret(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptSecret(encoded) {
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function verifyShopifyWebhookHmac(rawBody, hmacHeader, webhookSecret) {
  if (!hmacHeader) return false;
  const computed = createHmac('sha256', webhookSecret).update(rawBody, 'utf8').digest('base64');
  const a = Buffer.from(computed);
  const b = Buffer.from(hmacHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/shopify.js tests/shopify-crypto.test.js
git commit -m "feat: add Shopify token encryption and webhook HMAC verification"
```

---

## Task 3: Shopify Admin API client and connection data layer

**Files:**
- Modify: `server/shopify.js`
- Create: `tests/shopify-connection.test.js`

**Interfaces:**
- Consumes: `prepare` from `server/db.js`.
- Produces: `shopifyAdminRequest(connection, method, path, body?)` → parsed JSON response, throws on non-2xx; `serializeShopifyConnection(row)` → `{ connected, shopDomain, status, connectedAt }`; `getShopifyConnection()` → row or `null`; `saveShopifyConnection({ shopDomain, accessToken, storefrontApiToken })` → row (throws if Shopify rejects the token); `registerShopifyWebhooks(connection, shopId)` → `void`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/shopify-connection.test.js
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test
```

Expected: FAIL — the new exports don't exist yet.

- [ ] **Step 3: Implement, appending to `server/shopify.js`**

```js
// Appended to server/shopify.js
import { prepare } from './db.js';

const SHOPIFY_API_VERSION = '2024-10';

export async function shopifyAdminRequest(connection, method, path, body) {
  const accessToken = decryptSecret(connection.access_token);
  const res = await fetch(`https://${connection.shop_domain}/admin/api/${SHOPIFY_API_VERSION}${path}`, {
    method,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Shopify API error (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

export function serializeShopifyConnection(row) {
  if (!row) return { connected: false, shopDomain: null, status: 'not_connected', connectedAt: null };
  return {
    connected: row.status === 'connected',
    shopDomain: row.shop_domain,
    status: row.status,
    connectedAt: row.connected_at,
  };
}

export async function getShopifyConnection() {
  const row = await prepare('SELECT * FROM shopify_connections LIMIT 1').get();
  return row || null;
}

export async function getShopifyConnectionByShopId(shopId) {
  const row = await prepare('SELECT * FROM shopify_connections WHERE shop_id = ?').get(shopId);
  return row || null;
}

export async function saveShopifyConnection({ shopDomain, accessToken, storefrontApiToken }) {
  // Verify the token works, and fetch the shop's primary location, before
  // ever storing anything - a bad token should fail loudly here rather
  // than being saved as a silently broken "connected" state.
  const probeConnection = { shop_domain: shopDomain, access_token: encryptSecret(accessToken) };
  const locationsResponse = await shopifyAdminRequest(probeConnection, 'GET', '/locations.json');
  const locationId = String(locationsResponse.locations[0].id);

  const existing = await getShopifyConnection();
  const webhookSecret = existing ? decryptSecret(existing.webhook_secret) : randomBytes(32).toString('hex');
  const encryptedAccessToken = encryptSecret(accessToken);
  const encryptedWebhookSecret = encryptSecret(webhookSecret);
  const now = new Date().toISOString();

  if (existing) {
    await prepare(
      `UPDATE shopify_connections
       SET shop_domain = ?, access_token = ?, storefront_api_token = ?, webhook_secret = ?, location_id = ?, status = ?, connected_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(shopDomain, encryptedAccessToken, storefrontApiToken, encryptedWebhookSecret, locationId, 'connected', now, now, existing.id);
  } else {
    await prepare(
      `INSERT INTO shopify_connections (shop_domain, access_token, storefront_api_token, webhook_secret, location_id, status, connected_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(shopDomain, encryptedAccessToken, storefrontApiToken, encryptedWebhookSecret, locationId, 'connected', now, now);
  }
  return getShopifyConnection();
}

export async function registerShopifyWebhooks(connection, shopId) {
  const baseUrl = process.env.APP_PUBLIC_URL;
  if (!baseUrl) throw new Error('APP_PUBLIC_URL is not configured');
  await shopifyAdminRequest(connection, 'POST', '/webhooks.json', {
    webhook: { topic: 'orders/paid', address: `${baseUrl}/webhooks/shopify/${shopId}/orders`, format: 'json' },
  });
  await shopifyAdminRequest(connection, 'POST', '/webhooks.json', {
    webhook: { topic: 'refunds/create', address: `${baseUrl}/webhooks/shopify/${shopId}/refunds`, format: 'json' },
  });
}
```

Combine the new `import { prepare } from './db.js';` with any existing import line at the top of the file into one `import { prepare } from './db.js';` (there is only one so far, from this task).

- [ ] **Step 4: Run to confirm pass**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/shopify.js tests/shopify-connection.test.js
git commit -m "feat: add Shopify Admin API client and connection data layer"
```

---

## Task 4: Connection API route

**Files:**
- Modify: `server/server.js`

**Interfaces:**
- Consumes: `getShopifyConnection`, `saveShopifyConnection`, `serializeShopifyConnection`, `registerShopifyWebhooks` from `server/shopify.js`.
- Produces: `GET /api/shopify/connection` (authenticated); `POST /api/shopify/connection` (authenticated) — body `{ shopDomain, accessToken, storefrontApiToken }`.

No automated test — thin HTTP glue over already-tested Task 3 functions, same as Task 4 of the storefront framework plan. Verified manually.

- [ ] **Step 1: Add the import**

```js
import { getShopifyConnection, saveShopifyConnection, serializeShopifyConnection, registerShopifyWebhooks } from './shopify.js';
```

- [ ] **Step 2: Add the routes**

```js
route('GET', '/api/shopify/connection', async (req, res) => {
  sendJson(res, 200, serializeShopifyConnection(await getShopifyConnection()));
});

route('POST', '/api/shopify/connection', async (req, res) => {
  const body = await readJsonBody(req);
  const shopDomain = String(body.shopDomain || '').trim();
  const accessToken = String(body.accessToken || '').trim();
  const storefrontApiToken = String(body.storefrontApiToken || '').trim();
  if (!shopDomain || !accessToken || !storefrontApiToken) {
    return badRequest(res, 'shopDomain, accessToken, and storefrontApiToken are all required');
  }

  let connection;
  try {
    connection = await saveShopifyConnection({ shopDomain, accessToken, storefrontApiToken });
  } catch (err) {
    return badRequest(res, `Could not connect to Shopify: ${err.message}`);
  }

  try {
    await registerShopifyWebhooks(connection, connection.shop_id);
  } catch (err) {
    console.error('Failed to register Shopify webhooks', err);
    return sendJson(res, 200, {
      ...serializeShopifyConnection(connection),
      warning: 'Connected, but webhook registration failed - online orders will not sync back to stock until this is retried.',
    });
  }

  sendJson(res, 200, serializeShopifyConnection(connection));
});
```

- [ ] **Step 3: Verify manually**

Using a real Shopify development store (create one free via Shopify Partners if you don't have one) and a custom app's Admin + Storefront API tokens:

```bash
npm start
```

```bash
curl -b cookies.txt -X POST -H "Content-Type: application/json" \
  -d '{"shopDomain":"your-dev-store.myshopify.com","accessToken":"shpat_...","storefrontApiToken":"..."}' \
  http://localhost:4000/api/shopify/connection
```

Expected: `{"connected":true,"shopDomain":"your-dev-store.myshopify.com","status":"connected","connectedAt":"..."}`. In the Shopify admin, check Settings → Notifications → Webhooks to confirm the two webhooks were registered (requires `APP_PUBLIC_URL` to be a real, internet-reachable URL for this specific check — e.g. via the Cloudflare Tunnel setup mentioned in `README.md` — a `localhost` URL will save the connection but the webhook registration call to Shopify will fail harmlessly with the warning above).

- [ ] **Step 4: Commit**

```bash
git add server/server.js
git commit -m "feat: wire up Shopify connection API route"
```

---

## Task 5: Product sync (EPOS → Shopify)

**Files:**
- Modify: `server/shopify.js`
- Modify: `server/server.js` (hook into product create/update routes)
- Create: `tests/shopify-product-sync.test.js`

**Interfaces:**
- Produces (in `server/shopify.js`): `syncProductToShopify(product)` → `Promise<{ shopifyProductId, shopifyVariantId } | null>` (returns `null` and does nothing if no connected Shopify store; persists the mapping columns on the product row itself); `unpublishProductFromShopify(product)` → `Promise<void>`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/shopify-product-sync.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop } from '../server/db.js';
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
      const { rows: [product] } = await pool.query(
        "INSERT INTO products (name, price, description, show_online) VALUES ('Trail Bike', 899, 'Great trail bike', true) RETURNING *"
      );

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

      const { rows: [updated] } = await pool.query('SELECT * FROM products WHERE id = $1', [product.id]);
      assert.equal(updated.shopify_product_id, '555');
      assert.equal(updated.shopify_variant_id, '777');
      assert.equal(updated.shopify_inventory_item_id, '888');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('syncProductToShopify updates an existing Shopify product when already mapped', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await connectFakeShopify(shop.id);
      const { rows: [product] } = await pool.query(
        `INSERT INTO products (name, price, show_online, shopify_product_id, shopify_variant_id, shopify_inventory_item_id)
         VALUES ('Trail Bike', 899, true, '555', '777', '888') RETURNING *`
      );

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
    await deleteTestShop(shop.id);
  }
});

test('syncProductToShopify does nothing when Shopify is not connected', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const { rows: [product] } = await pool.query(
        "INSERT INTO products (name, price, show_online) VALUES ('Trail Bike', 899, true) RETURNING *"
      );
      assert.equal(await syncProductToShopify(product), null);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('syncProductToShopify retries on failure, then marks the connection sync_error', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await connectFakeShopify(shop.id);
      const { rows: [product] } = await pool.query(
        "INSERT INTO products (name, price, show_online) VALUES ('Trail Bike', 899, true) RETURNING *"
      );

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

      const { rows: [connection] } = await pool.query('SELECT status FROM shopify_connections WHERE shop_id = $1', [shop.id]);
      assert.equal(connection.status, 'sync_error');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('unpublishProductFromShopify sets published=false on the mapped Shopify product', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await connectFakeShopify(shop.id);
      const { rows: [product] } = await pool.query(
        `INSERT INTO products (name, price, show_online, shopify_product_id) VALUES ('Trail Bike', 899, false, '555') RETURNING *`
      );

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
    await deleteTestShop(shop.id);
  }
});

test.after(async () => {
  await pool.end();
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test
```

Expected: FAIL — `syncProductToShopify`/`unpublishProductFromShopify` don't exist yet.

- [ ] **Step 3: Implement, appending to `server/shopify.js`**

```js
// Appended to server/shopify.js

// Small in-process retry for transient Shopify API failures (rate limits,
// momentary 5xxs). Not a persistent job queue - there's no background
// worker infrastructure in this app yet, and one shop's occasional sync
// hiccup doesn't warrant building one. If every attempt fails, the caller
// marks the connection sync_error so it's visible in shop settings rather
// than failing silently; the next successful product edit or sale clears
// it back to connected on its own.
async function withRetry(fn, attempts = 3, baseDelayMs = 500) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** i));
      }
    }
  }
  throw lastError;
}

export async function syncProductToShopify(product) {
  const connection = await getShopifyConnection();
  if (!connection || connection.status !== 'connected') return null;

  try {
    return await withRetry(async () => {
      const payload = {
        product: {
          title: product.name,
          body_html: product.description || '',
          variants: [{ price: String(product.price) }],
        },
      };

      let response;
      if (product.shopify_product_id) {
        payload.product.id = product.shopify_product_id;
        response = await shopifyAdminRequest(connection, 'PUT', `/products/${product.shopify_product_id}.json`, payload);
      } else {
        response = await shopifyAdminRequest(connection, 'POST', '/products.json', payload);
      }

      const shopifyProduct = response.product;
      const variant = shopifyProduct.variants[0];
      await prepare(
        'UPDATE products SET shopify_product_id = ?, shopify_variant_id = ?, shopify_inventory_item_id = ? WHERE id = ?'
      ).run(String(shopifyProduct.id), String(variant.id), String(variant.inventory_item_id), product.id);

      return { shopifyProductId: String(shopifyProduct.id), shopifyVariantId: String(variant.id) };
    }, 3, 50);
  } catch (err) {
    await prepare('UPDATE shopify_connections SET status = ? WHERE id = ?').run('sync_error', connection.id);
    throw err;
  }
}

export async function unpublishProductFromShopify(product) {
  const connection = await getShopifyConnection();
  if (!connection || connection.status !== 'connected' || !product.shopify_product_id) return;
  await shopifyAdminRequest(connection, 'PUT', `/products/${product.shopify_product_id}.json`, {
    product: { id: product.shopify_product_id, published: false },
  });
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/shopify.js tests/shopify-product-sync.test.js
git commit -m "feat: add Shopify product create/update/unpublish sync"
```

- [ ] **Step 6: Wire sync into the product routes**

In `server/server.js`, add the import and a small helper:

```js
import { syncProductToShopify, unpublishProductFromShopify } from './shopify.js';

async function syncProductWithShopifyIfNeeded(previousShowOnline, updatedProductRow) {
  try {
    if (updatedProductRow.show_online) {
      await syncProductToShopify(updatedProductRow);
    } else if (previousShowOnline && !updatedProductRow.show_online) {
      await unpublishProductFromShopify(updatedProductRow);
    }
  } catch (err) {
    console.error('Shopify product sync failed', err);
  }
}
```

In `route('POST', '/api/products', ...)`, after `const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);` and before `sendJson(res, 201, serializeProduct(row));`, add:

```js
    await syncProductWithShopifyIfNeeded(false, row);
```

In `route('PUT', '/api/products/:id', ...)`, after `const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);` (the one following the `UPDATE` statement, near the end of the handler) and before `sendJson(res, 200, serializeProduct(row));`, add:

```js
    await syncProductWithShopifyIfNeeded(existing.show_online, row);
```

(`existing` is the row fetched at the top of that handler, before the update — already in scope.)

- [ ] **Step 7: Verify manually**

With a connected Shopify dev store (Task 4), create a product with `showOnline: true` via the API, then check the Shopify admin's Products list to confirm it appeared; toggle `showOnline` to `false` via a `PUT` and confirm it's unpublished in Shopify.

- [ ] **Step 8: Commit**

```bash
git add server/server.js
git commit -m "feat: sync products to Shopify on create/update"
```

---

## Task 6: Inventory push (EPOS → Shopify)

**Files:**
- Modify: `server/shopify.js`
- Modify: `server/server.js` (hook into `createSale`'s stock decrement)
- Create: `tests/shopify-inventory-sync.test.js`

**Interfaces:**
- Produces: `pushInventoryLevel(product, quantity)` → `Promise<void>` (no-op if the product has no `shopify_inventory_item_id` or Shopify isn't connected).

- [ ] **Step 1: Write the failing test**

```js
// tests/shopify-inventory-sync.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop } from '../server/db.js';
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

      const { rows: [connection] } = await pool.query('SELECT status FROM shopify_connections WHERE shop_id = $1', [shop.id]);
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
      await pool.query("UPDATE shopify_connections SET status = 'sync_error' WHERE shop_id = $1", [shop.id]);

      const restore = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));
      try {
        await pushInventoryLevel({ shopify_inventory_item_id: '888' }, 3);
      } finally {
        restore();
      }

      const { rows: [connection] } = await pool.query('SELECT status FROM shopify_connections WHERE shop_id = $1', [shop.id]);
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test
```

Expected: FAIL — `pushInventoryLevel` doesn't exist.

- [ ] **Step 3: Implement, appending to `server/shopify.js`**

```js
// Appended to server/shopify.js
// Reuses the withRetry helper already defined earlier in this file (Task 5).

export async function pushInventoryLevel(product, quantity) {
  if (!product.shopify_inventory_item_id) return;
  const connection = await getShopifyConnection();
  // 'sync_error' still attempts the push (it means "was connected, one
  // sync failed" - not "give up permanently"). Only a connection that was
  // never established at all is skipped.
  if (!connection || connection.status === 'not_connected') return;

  try {
    await withRetry(() => shopifyAdminRequest(connection, 'POST', '/inventory_levels/set.json', {
      location_id: connection.location_id,
      inventory_item_id: product.shopify_inventory_item_id,
      available: quantity,
    }), 3, 50);
    if (connection.status === 'sync_error') {
      await prepare('UPDATE shopify_connections SET status = ? WHERE id = ?').run('connected', connection.id);
    }
  } catch (err) {
    await prepare('UPDATE shopify_connections SET status = ? WHERE id = ?').run('sync_error', connection.id);
    throw err;
  }
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/shopify.js tests/shopify-inventory-sync.test.js
git commit -m "feat: add Shopify inventory level push"
```

- [ ] **Step 6: Wire into `createSale`'s stock decrement**

In `server/server.js`, add `pushInventoryLevel` to the existing Shopify import, then in `createSale`'s per-item loop, immediately after the existing `stock_movements` insert (`INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES (?, ?, 'sale', ?)`), add:

```js
      if (product.shopify_inventory_item_id) {
        // Never let a Shopify hiccup fail a real till sale - log and move on.
        await pushInventoryLevel(product, newQty).catch((err) => console.error('Shopify inventory push failed', err));
      }
```

**Note for whoever implements this task:** `createSale` is the till checkout path, and this hook covers it. Other places that change `products.stock_qty` (manual stock receive/adjustment, purchase-order receiving — search `server/server.js` for other `UPDATE products SET stock_qty` occurrences and other `INSERT INTO stock_movements` call sites) should get the same one-line hook so Shopify's stock stays accurate regardless of which flow changed it. Add it at each site found, using that site's own already-updated quantity in place of `newQty`.

- [ ] **Step 7: Verify manually**

With a product synced to a connected Shopify dev store (Task 5), complete a till sale for that product in EPOS, then check the Shopify admin's inventory page for that product to confirm the available quantity decreased by the sold amount.

- [ ] **Step 8: Commit**

```bash
git add server/server.js
git commit -m "feat: push inventory changes to Shopify on till sale"
```

---

## Task 7: Webhook order/refund matching and idempotency

**Files:**
- Modify: `server/shopify.js`
- Create: `tests/shopify-webhook-matching.test.js`

**Interfaces:**
- Produces: `matchOrderLineItemsToProducts(order)` → `Promise<Array<{ productId, qty, unitPrice }>>`; `matchRefundLineItemsToProducts(refund)` → `Promise<Array<{ product, qty }>>`; `claimShopifyEvent(shopifyEventId, kind)` → `Promise<boolean>` (returns `true` if this call newly claimed the event, `false` if already processed — atomic via `INSERT ... ON CONFLICT DO NOTHING`); `markShopifyEventError(shopifyEventId, kind, errorMessage)` → `Promise<void>`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/shopify-webhook-matching.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { matchOrderLineItemsToProducts, matchRefundLineItemsToProducts, claimShopifyEvent, markShopifyEventError } from '../server/shopify.js';

test('matchOrderLineItemsToProducts resolves line items by shopify_variant_id, skipping unmapped ones', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const { rows: [product] } = await pool.query(
        "INSERT INTO products (name, price, shopify_variant_id) VALUES ('Trail Bike', 899, '777') RETURNING *"
      );
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
      const { rows: [product] } = await pool.query(
        "INSERT INTO products (name, price, shopify_variant_id) VALUES ('Trail Bike', 899, '777') RETURNING *"
      );
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
      const { rows: [row] } = await pool.query(
        "SELECT status, error_message FROM shopify_processed_events WHERE shopify_order_id = '4001' AND kind = 'order'"
      );
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test
```

Expected: FAIL — the four new exports don't exist.

- [ ] **Step 3: Implement, appending to `server/shopify.js`**

```js
// Appended to server/shopify.js

export async function matchOrderLineItemsToProducts(order) {
  const items = [];
  for (const lineItem of order.line_items) {
    const product = await prepare('SELECT id FROM products WHERE shopify_variant_id = ?').get(String(lineItem.variant_id));
    if (product) {
      items.push({ productId: product.id, qty: lineItem.quantity, unitPrice: Number(lineItem.price) });
    }
  }
  return items;
}

export async function matchRefundLineItemsToProducts(refund) {
  const items = [];
  for (const refundLineItem of refund.refund_line_items || []) {
    const variantId = refundLineItem.line_item?.variant_id;
    if (!variantId) continue;
    const product = await prepare('SELECT * FROM products WHERE shopify_variant_id = ?').get(String(variantId));
    if (product) items.push({ product, qty: refundLineItem.quantity });
  }
  return items;
}

export async function claimShopifyEvent(shopifyEventId, kind) {
  const result = await prepare(
    `INSERT INTO shopify_processed_events (shopify_order_id, kind) VALUES (?, ?)
     ON CONFLICT (shop_id, shopify_order_id, kind) DO NOTHING`
  ).run(String(shopifyEventId), kind);
  return result.changes > 0;
}

export async function markShopifyEventError(shopifyEventId, kind, errorMessage) {
  await prepare(
    'UPDATE shopify_processed_events SET status = ?, error_message = ? WHERE shopify_order_id = ? AND kind = ?'
  ).run('error', errorMessage, String(shopifyEventId), kind);
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm test
```

Expected: PASS. If `claimShopifyEvent`'s `INSERT ... ON CONFLICT DO NOTHING` interacts unexpectedly with `server/db.js`'s automatic `RETURNING id` appending (check `needsReturningId` in `server/db.js` if this fails), adjust by passing the fully-formed SQL including `RETURNING id` explicitly and reading `result.changes` from the row count as before — the test will surface this precisely if it's an issue.

- [ ] **Step 5: Commit**

```bash
git add server/shopify.js tests/shopify-webhook-matching.test.js
git commit -m "feat: add Shopify webhook line-item matching and idempotency"
```

---

## Task 8: Webhook endpoint and order/refund processing

**Files:**
- Modify: `server/server.js`

**Interfaces:**
- Consumes: `getShopifyConnectionByShopId`, `decryptSecret`, `verifyShopifyWebhookHmac`, `matchOrderLineItemsToProducts`, `matchRefundLineItemsToProducts`, `claimShopifyEvent`, `markShopifyEventError`, `pushInventoryLevel` (all from `server/shopify.js`); the existing local `createSale`, `ValidationError`, `runWithShop`, `pool`.
- Produces: `POST /webhooks/shopify/:shopId/orders`, `POST /webhooks/shopify/:shopId/refunds` — unauthenticated (HMAC-verified instead), acknowledge with `200` once an event is durably claimed (even on a recognized business-logic failure, to stop Shopify's retries; a `401` for bad signatures and a `500` for unexpected errors still allow Shopify to retry).

This task deliberately keeps `processShopifyOrderWebhook`/`processShopifyRefundWebhook` in `server.js` rather than `server/shopify.js`, so they can call the existing `createSale`/`ValidationError` directly without creating a circular import between the two files (`shopify.js` imports nothing from `server.js`). The line-item matching and idempotency-claiming they depend on were already unit-tested in Task 7 — the full flow (including the `createSale` call) is verified against a real Shopify dev store in Task 11's end-to-end pass, matching the design spec's own testing section.

No automated test in this task for that reason.

- [ ] **Step 1: Add imports**

```js
import {
  getShopifyConnectionByShopId,
  decryptSecret,
  verifyShopifyWebhookHmac,
  matchOrderLineItemsToProducts,
  matchRefundLineItemsToProducts,
  claimShopifyEvent,
  markShopifyEventError,
} from './shopify.js';
```

- [ ] **Step 2: Add a raw-body reader**

Add near the existing `readJsonBody` function (webhook signature verification needs the exact bytes Shopify sent, not a round-tripped `JSON.stringify(JSON.parse(...))`):

```js
function readRawBody(req, maxBytes = 2_000_000) {
  return new Promise((resolve, reject) => {
    let data = '';
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
```

- [ ] **Step 3: Add the order/refund processing functions**

```js
async function processShopifyOrderWebhook(shopId, order) {
  return runWithShop(shopId, async () => {
    const claimed = await claimShopifyEvent(order.id, 'order');
    if (!claimed) return;

    const items = await matchOrderLineItemsToProducts(order);
    if (items.length === 0) return;

    try {
      await createSale({
        customerId: null,
        cashierId: null,
        items,
        discount: 0,
        cashAmount: 0,
        cardAmount: 0,
        cashTendered: null,
        payments: [{ tenderType: 'Shopify', amount: items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0) }],
        note: `Shopify order #${order.order_number || order.id}`,
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        await markShopifyEventError(order.id, 'order', err.message);
        return;
      }
      throw err;
    }
  });
}

async function processShopifyRefundWebhook(shopId, refund) {
  return runWithShop(shopId, async () => {
    const claimed = await claimShopifyEvent(refund.id, 'refund');
    if (!claimed) return;

    const items = await matchRefundLineItemsToProducts(refund);
    for (const { product, qty } of items) {
      const newQty = product.stock_qty + qty;
      await db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(newQty, nowIso(), product.id);
      await db.prepare(
        `INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES (?, ?, 'return', ?)`
      ).run(product.id, qty, `Shopify refund #${refund.id}`);
      if (product.shopify_inventory_item_id) {
        await pushInventoryLevel(product, newQty).catch((err) => console.error('Shopify inventory push failed', err));
      }
    }
  });
}
```

- [ ] **Step 4: Add the dispatcher branch**

In the `createServer(async (req, res) => { ... })` callback, add this branch right after the existing storefront-resolution branch (Task 8 of the storefront framework plan) and before the `/api/portal/` branch:

```js
  if (pathname.startsWith('/webhooks/shopify/')) {
    const match = pathname.match(/^\/webhooks\/shopify\/(\d+)\/(orders|refunds)$/);
    if (!match) return notFound(res, 'Unknown webhook route');
    const shopId = Number(match[1]);
    const kind = match[2];

    let rawBody;
    try {
      rawBody = await readRawBody(req);
    } catch (err) {
      return badRequest(res, 'Invalid request body');
    }

    // shopify_connections has FORCE ROW LEVEL SECURITY, so it can only be
    // read correctly from inside a runWithShop context for the exact shop
    // being queried (the storefront framework plan's final review found
    // this same bug class in resolveStorefrontShop - a bare pool/prepare
    // call against an RLS-protected table outside runWithShop either
    // throws on a connection that's never set app.current_shop_id, or
    // reads a stale different shop's session value). Unlike that case,
    // shopId is already known here from the URL, so there's no chicken-
    // and-egg problem - just enter the context immediately.
    const connection = await runWithShop(shopId, () => getShopifyConnectionByShopId(shopId));
    if (!connection) return notFound(res, 'Unknown shop');

    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    if (!verifyShopifyWebhookHmac(rawBody, hmacHeader, decryptSecret(connection.webhook_secret))) {
      return sendJson(res, 401, { error: 'Invalid signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (err) {
      return badRequest(res, 'Invalid JSON body');
    }

    try {
      if (kind === 'orders') {
        await processShopifyOrderWebhook(shopId, payload);
      } else {
        await processShopifyRefundWebhook(shopId, payload);
      }
      sendJson(res, 200, { ok: true });
    } catch (err) {
      console.error('Shopify webhook processing failed', err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }
```

- [ ] **Step 5: Verify manually**

This is fully exercised by Task 11's end-to-end pass (a real Shopify dev-store order and refund). As a quicker sanity check before that, send a deliberately invalid signature and confirm it's rejected:

```bash
curl -X POST -H "Content-Type: application/json" -H "X-Shopify-Hmac-Sha256: bogus" \
  -d '{"id":1,"line_items":[]}' \
  http://localhost:4000/webhooks/shopify/<real-shop-id>/orders
```

Expected: `401 {"error":"Invalid signature"}`.

- [ ] **Step 6: Commit**

```bash
git add server/server.js
git commit -m "feat: add Shopify order/refund webhook endpoint"
```

---

## Task 9: Storefront cart and checkout

**Files:**
- Modify: `server/storefront.js` (extend `getStorefrontInfo` and `serializeStorefrontProduct` from the prior plan)
- Modify: `public-storefront/storefront.js`, `public-storefront/storefront.css`

**Interfaces:**
- Modifies: `getStorefrontInfo(shopRow)` now also returns `shopifyDomain` and `shopifyStorefrontToken` (both `null` unless a connection with `status = 'connected'` exists — both are intentionally client-safe, publishable values, not secrets); `serializeStorefrontProduct(row)` now also returns `shopifyVariantId` (`null` if unsynced).

No automated test for the frontend cart (no frontend test coverage exists anywhere in this codebase); verified manually against a real Shopify dev store in Task 11.

- [ ] **Step 1: Extend `getStorefrontInfo` in `server/storefront.js`**

Add the import (`server/storefront.js` importing from `server/shopify.js` — one-directional, no cycle, since `shopify.js` imports nothing from `storefront.js`):

```js
import { getShopifyConnection } from './shopify.js';
```

Change `getStorefrontInfo` to:

```js
export async function getStorefrontInfo(shopRow) {
  const settings = await getOrCreateStorefrontSettings();
  const shopifyConnection = await getShopifyConnection();
  const shopifyConnected = shopifyConnection && shopifyConnection.status === 'connected';
  return {
    shopName: shopRow.name,
    tagline: settings.tagline || '',
    description: settings.description || '',
    logoUrl: settings.logo_url || null,
    heroImageUrl: settings.hero_image_url || null,
    themePreset: settings.theme_preset,
    shopifyDomain: shopifyConnected ? shopifyConnection.shop_domain : null,
    shopifyStorefrontToken: shopifyConnected ? shopifyConnection.storefront_api_token : null,
  };
}
```

And `serializeStorefrontProduct`:

```js
export function serializeStorefrontProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    description: row.description || '',
    photoUrl: row.photo_url || null,
    shopifyVariantId: row.shopify_variant_id || null,
  };
}
```

And `listStorefrontProducts`'s query to also select the new column:

```js
export async function listStorefrontProducts() {
  const rows = await prepare(
    'SELECT id, name, price, description, photo_url, shopify_variant_id FROM products WHERE show_online = ? AND active = 1 ORDER BY category, name'
  ).all(true);
  return rows.map(serializeStorefrontProduct);
}
```

- [ ] **Step 2: Add cart logic to `public-storefront/storefront.js`**

Add near the top of the file, after `applyTheme`:

```js
let shopifyCart = { id: null, checkoutUrl: null, lineCount: 0 };

async function shopifyStorefrontQuery(domain, token, query, variables) {
  const res = await fetch(`https://${domain}/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join(', '));
  return json.data;
}

async function addToShopifyCart(domain, token, variantId, quantity = 1) {
  const merchandiseId = `gid://shopify/ProductVariant/${variantId}`;
  const query = shopifyCart.id
    ? `mutation($cartId: ID!, $lines: [CartLineInput!]!) {
         cartLinesAdd(cartId: $cartId, lines: $lines) { cart { id checkoutUrl lines(first: 100) { edges { node { id } } } } }
       }`
    : `mutation($lines: [CartLineInput!]!) {
         cartCreate(input: { lines: $lines }) { cart { id checkoutUrl lines(first: 100) { edges { node { id } } } } }
       }`;
  const variables = shopifyCart.id
    ? { cartId: shopifyCart.id, lines: [{ merchandiseId, quantity }] }
    : { lines: [{ merchandiseId, quantity }] };

  const data = await shopifyStorefrontQuery(domain, token, query, variables);
  const cart = shopifyCart.id ? data.cartLinesAdd.cart : data.cartCreate.cart;
  shopifyCart = { id: cart.id, checkoutUrl: cart.checkoutUrl, lineCount: cart.lines.edges.length };
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  badge.textContent = shopifyCart.lineCount > 0 ? `Cart (${shopifyCart.lineCount})` : '';
  badge.style.display = shopifyCart.lineCount > 0 ? 'inline-block' : 'none';
  badge.onclick = () => { if (shopifyCart.checkoutUrl) window.location.href = shopifyCart.checkoutUrl; };
}
```

- [ ] **Step 3: Update `render()` to show Buy buttons and the cart badge**

Replace the header and product-card templates in `render(info, products)`:

```js
  document.getElementById('app').innerHTML = `
    <header class="storefront-header">
      ${info.logoUrl ? `<img src="${esc(info.logoUrl)}" alt="${esc(info.shopName)} logo" />` : ''}
      <div>
        <h1>${esc(info.shopName)}</h1>
        ${info.tagline ? `<p>${esc(info.tagline)}</p>` : ''}
      </div>
      <button id="cart-badge" class="cart-badge" style="display:none;"></button>
    </header>
    <section class="storefront-hero">
      ${info.heroImageUrl ? `<img src="${esc(info.heroImageUrl)}" alt="" />` : ''}
      ${info.description ? `<p>${esc(info.description)}</p>` : ''}
    </section>
    <section class="product-grid">
      ${products.length ? products.map((p) => `
        <div class="product-card">
          ${p.photoUrl ? `<img src="${esc(p.photoUrl)}" alt="${esc(p.name)}" />` : ''}
          <h3>${esc(p.name)}</h3>
          ${p.description ? `<p>${esc(p.description)}</p>` : ''}
          <p class="price">£${p.price.toFixed(2)}</p>
          ${p.shopifyVariantId && info.shopifyDomain
            ? `<button class="buy-button" data-variant-id="${esc(p.shopifyVariantId)}">Add to cart</button>`
            : '<p>Coming soon</p>'}
        </div>
      `).join('') : '<p class="empty-state">No products listed yet.</p>'}
    </section>
    <footer class="storefront-footer">
      <a href="${esc(bookHref)}">Book a workshop slot</a>
    </footer>
  `;

  document.querySelectorAll('.buy-button').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Adding…';
      try {
        await addToShopifyCart(info.shopifyDomain, info.shopifyStorefrontToken, btn.dataset.variantId);
        btn.textContent = 'Added';
      } catch (err) {
        btn.textContent = 'Add to cart';
        alert(`Could not add to cart: ${err.message}`);
      } finally {
        btn.disabled = false;
      }
    });
  });
  updateCartBadge();
```

- [ ] **Step 4: Add cart badge styling to `public-storefront/storefront.css`**

```css
.cart-badge {
  margin-left: auto;
  background: #fff;
  color: var(--accent-dark);
  border: none;
  border-radius: 999px;
  padding: 0.5rem 1rem;
  font-weight: bold;
  cursor: pointer;
}
.buy-button {
  width: 100%;
  padding: 0.5rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.buy-button:disabled { opacity: 0.6; cursor: default; }
```

- [ ] **Step 5: Commit**

```bash
git add server/storefront.js public-storefront/storefront.js public-storefront/storefront.css
git commit -m "feat: add Shopify cart and checkout to the storefront"
```

---

## Task 10: Owner-facing Shopify connection UI

**Files:**
- Modify: `public/app.js`

**Interfaces:**
- Consumes: `GET`/`POST /api/shopify/connection` (Task 4).

No automated test — UI work, consistent with the rest of `public/app.js`. Verified manually.

- [ ] **Step 1: Add a "Shopify" section to the storefront settings screen**

Add alongside the `renderStorefrontSettingsSection` function from the storefront framework plan:

```js
async function renderShopifyConnectionSection(container) {
  const connection = await api('/api/shopify/connection');
  container.innerHTML = `
    <h3>Shopify</h3>
    ${connection.connected
      ? `<p>Connected to <strong>${esc(connection.shopDomain)}</strong> (status: ${esc(connection.status)})</p>`
      : `
        <label>Shopify store domain <input type="text" id="shopify-domain" placeholder="your-shop.myshopify.com"></label>
        <label>Admin API access token <input type="password" id="shopify-access-token"></label>
        <label>Storefront API token <input type="password" id="shopify-storefront-token"></label>
        <button id="shopify-connect">Connect Shopify</button>
        <span id="shopify-connect-status"></span>
      `}
  `;
  const connectBtn = document.getElementById('shopify-connect');
  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      const status = document.getElementById('shopify-connect-status');
      status.textContent = 'Connecting…';
      try {
        await api('/api/shopify/connection', {
          method: 'POST',
          body: {
            shopDomain: document.getElementById('shopify-domain').value,
            accessToken: document.getElementById('shopify-access-token').value,
            storefrontApiToken: document.getElementById('shopify-storefront-token').value,
          },
        });
        await renderShopifyConnectionSection(container);
      } catch (err) {
        status.textContent = `Error: ${err.message}`;
      }
    });
  }
}
```

Call `renderShopifyConnectionSection(anotherContainerElement)` from the same place `renderStorefrontSettingsSection` is called, right below it.

- [ ] **Step 2: Verify manually**

Open the settings screen, enter real Shopify dev-store credentials, click "Connect Shopify", confirm it shows "Connected to your-shop.myshopify.com".

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: add Shopify connection UI to shop settings"
```

---

## Task 11: End-to-end manual verification against a real Shopify dev store

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

```bash
npm test
```

Expected: all tests pass (both plans' suites).

- [ ] **Step 2: Full manual walkthrough**

Prerequisites: a free Shopify Partners development store, with a custom app created in it (Admin API scopes: `read_products`, `write_products`, `read_inventory`, `write_inventory`, `read_orders`; Storefront API scope: unauthenticated read/write checkout) and its two tokens generated. `APP_PUBLIC_URL` set to a real, internet-reachable URL (e.g. via the existing Cloudflare Tunnel setup) so Shopify's webhooks can reach this app.

1. Connect the shop to the Shopify dev store via the new settings UI (Task 10). Confirm the two webhooks appear under the dev store's webhook settings.
2. Mark a product `show_online`, confirm it appears in the Shopify admin's product list with the same name/price/description.
3. Visit the storefront (`/store/<slug>`), confirm the product shows an "Add to cart" button (not "Coming soon").
4. Add it to cart, click the cart badge, confirm it lands on Shopify's checkout page.
5. Complete the order using Shopify's Bogus Gateway test payment (enabled by default on dev stores).
6. Confirm: EPOS's product stock decreased by the purchased quantity, a new row appears in EPOS sales history with payment method "Shopify" for the correct amount, and the Shopify admin's inventory for that product also reflects the decrease.
7. Refund the order from the Shopify admin. Confirm EPOS stock is restored by the refunded quantity.
8. Sell the same product via the EPOS till (a normal in-person sale) and confirm the Shopify admin's inventory count decreases accordingly (the two-way sync from Task 6).
9. Toggle the product's `show_online` off in EPOS, confirm it's unpublished from the Shopify storefront (no longer purchasable there) without being deleted (its order history in Shopify should remain intact).

- [ ] **Step 3: Note any gaps found for follow-up**

Fix anything the walkthrough surfaces before considering this plan complete.
