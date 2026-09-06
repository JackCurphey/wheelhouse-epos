// tests/sale-shopify-push-http.test.js
//
// A real end-to-end round trip through POST /api/sales, spawning the actual
// server (not reimplementing its dispatcher), to exercise the ACTUAL,
// unexported firePendingShopifyPushes helper - the thing
// tests/sale-shopify-push-release.test.js cannot reach directly, since it
// only exists inside server.js's dispatcher wiring.
//
// pushInventoryLevel (server/shopify.js) is not a pure network call: it
// reads the request-scoped client via prepare()/AsyncLocalStorage both
// before AND after the Shopify HTTP call. Firing it with no runWithShop
// scope open at all - which is what "release the client, then fire the
// push" naively means - throws "No database client in scope" immediately,
// and since firePendingShopifyPushes's own promise chain is what has to
// catch that (nothing upstream awaits it), an unwrapped version would either
// silently swallow every deferred push (never reaching Shopify at all, if
// caught) or - with no catch at all - become an unhandled rejection that
// the Part 2 crash guard would treat as fatal, taking the whole process
// down over a Shopify hiccup. Both failure modes are checked below.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { createShop, createSession, SESSION_COOKIE } from '../server/auth.js';
import { encryptSecret } from '../server/shopify.js';
import { deleteTestShop } from './helpers/testShop.js';
import { pool } from '../server/db.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let child;
let baseUrl;
let shop;
let cookie;
let cashierId;
let productId;
let stderr = '';

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${child.exitCode}`);
    }
    try {
      const res = await fetch(`${url}/api/auth/me`);
      if (res.status === 401) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not start in ${timeoutMs}ms: ${lastErr}`);
}

function authedFetch(pathname, options = {}) {
  const headers = { ...(options.headers || {}), Cookie: cookie };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${baseUrl}${pathname}`, { ...options, headers });
}

before(async () => {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => {
    stderr += d.toString('utf8');
    process.stderr.write(`[server] ${d}`);
  });
  await waitForServer(baseUrl);

  const suffix = randomUUID().slice(0, 8);
  const created = await createShop({
    shopName: `Shopify Push Release Test ${suffix}`,
    ownerName: 'Test Owner',
    email: `shopify-push-test-${suffix}@example.com`,
    password: 'a-strong-test-password',
  });
  shop = created.shop;
  const token = await createSession(created.login.id);
  cookie = `${SESSION_COOKIE}=${token}`;

  // Inserted directly rather than through POST /api/shopify/connection - that
  // route's own connect flow does a real "list locations" probe against
  // Shopify, which this test has no working domain for. What matters here is
  // only that a 'connected' row exists so pushInventoryLevel doesn't return
  // early on "never connected".
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    const { rows: [cashier] } = await client.query(
      `INSERT INTO employees (shop_id, name, is_cashier, active) VALUES ($1, 'Test Cashier', 1, 1) RETURNING id`,
      [shop.id]
    );
    cashierId = cashier.id;
    const { rows: [product] } = await client.query(
      `INSERT INTO products (shop_id, sku, name, price, cost, stock_qty, active, shopify_inventory_item_id)
       VALUES ($1, 'SKU-HTTP-PUSH', 'Widget', 10, 5, 20, 1, '888') RETURNING id`,
      [shop.id]
    );
    productId = product.id;
    await client.query(
      `INSERT INTO shopify_connections (shop_id, shop_domain, access_token, storefront_api_token, webhook_secret, location_id, status)
       VALUES ($1, 'sale-push-test.invalid', $2, $3, $4, '1', 'connected')`,
      [shop.id, encryptSecret('fake-access-token'), encryptSecret('fake-storefront-token'), encryptSecret('fake-webhook-secret')]
    );
  } finally {
    client.release();
  }
});

after(async () => {
  if (child && child.exitCode === null) child.kill('SIGTERM');
  if (shop) await deleteTestShop(shop.id);
});

test('POST /api/sales for a Shopify-mapped product returns 201 immediately and the deferred push fails cleanly (never crashing the process) once it runs', async () => {
  const stderrBefore = stderr.length;

  const res = await authedFetch('/api/sales', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ productId, qty: 2 }],
      cashierId,
      cashAmount: 20,
      cashTendered: 20,
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 201, JSON.stringify(body));
  assert.ok(body.id, 'the sale must still be created and returned to the client');

  // The deferred push runs fire-and-forget, in a fresh runWithShop scope,
  // after the response above already went out. Give it a moment to fail
  // against the unreachable fake Shopify domain.
  await new Promise((r) => setTimeout(r, 1000));

  assert.equal(child.exitCode, null, 'the process must not have crashed handling the deferred push');
  const newStderr = stderr.slice(stderrBefore);
  assert.doesNotMatch(
    newStderr,
    /No database client in scope/,
    'the deferred push must run inside its own runWithShop scope, not with none open at all'
  );
  assert.match(
    newStderr,
    /Shopify inventory push failed/,
    'the push must actually have been attempted (and failed cleanly against the fake domain), not silently skipped'
  );
});
