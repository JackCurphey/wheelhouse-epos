// A stock change outside a sale (a product's stock adjustment, booking in a
// purchase order) must not wait on Shopify while it holds its pooled database
// connection (#151 follow-up, Jack, 7 Oct). Like a sale, it answers first and
// pushes afterwards, from a fresh connection (see firePendingShopifyPushes in
// server/lib/sales.js). Spawns the real server, as
// tests/sale-shopify-push-http.test.js does, against a fake Shopify domain:
// the push fails after its retries (at least 150ms of backoff), so its
// failure line coming AFTER the reply shows the reply didn't wait for it.
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
const PUSH_FAILED = /Shopify inventory push failed/;

let child;
let baseUrl;
let shop;
let cookie;
let productId;
let supplierId;
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
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`);
    try {
      const res = await fetch(`${url}/api/auth/me`);
      if (res.status === 401) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not start in ${timeoutMs}ms`);
}

function authedFetch(pathname, body) {
  return fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Sends the request, notes whether the push had already failed when the
// reply arrived, then waits (up to 15s) for the push to be attempted.
async function replyThenPush(pathname, body) {
  const before = stderr.length;
  const res = await authedFetch(pathname, body);
  const json = await res.json();
  const pushedBeforeReply = PUSH_FAILED.test(stderr.slice(before));
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline && child.exitCode === null && !PUSH_FAILED.test(stderr.slice(before))) {
    await new Promise((r) => setTimeout(r, 50));
  }
  return { res, json, pushedBeforeReply, log: stderr.slice(before) };
}

before(async () => {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
  await waitForServer(baseUrl);

  const suffix = randomUUID().slice(0, 8);
  const created = await createShop({
    shopName: `Stock Push Test ${suffix}`,
    ownerName: 'Test Owner',
    email: `stock-push-test-${suffix}@example.com`,
    password: 'a-strong-test-password',
  });
  shop = created.shop;
  cookie = `${SESSION_COOKIE}=${await createSession(created.login.id)}`;

  // A 'connected' row inserted directly, as in sale-shopify-push-http: the
  // connect route would probe a real Shopify.
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    const { rows: [product] } = await client.query(
      `INSERT INTO products (shop_id, sku, name, price, cost, stock_qty, active, shopify_inventory_item_id)
       VALUES ($1, 'SKU-STOCK-PUSH', 'Widget', 10, 5, 20, 1, '777') RETURNING id`,
      [shop.id]
    );
    productId = product.id;
    const { rows: [supplier] } = await client.query(
      `INSERT INTO suppliers (shop_id, name, adapter_type, config, updated_at) VALUES ($1, 'Madison', 'mock_csv', '{}', now()) RETURNING id`,
      [shop.id]
    );
    supplierId = supplier.id;
    await client.query(
      `INSERT INTO shopify_connections (shop_id, shop_domain, access_token, storefront_api_token, webhook_secret, location_id, status)
       VALUES ($1, 'stock-push-test.invalid', $2, $3, $4, '1', 'connected')`,
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

test('a stock adjustment answers before it pushes to Shopify, and still pushes', async () => {
  const { res, json, pushedBeforeReply, log } = await replyThenPush(`/api/products/${productId}/stock`, { change: 3, type: 'intake' });
  assert.equal(res.status, 200, JSON.stringify(json));
  assert.equal(json.stockQty, 23);
  assert.equal(pushedBeforeReply, false, 'the reply waited for the Shopify push');
  assert.equal(child.exitCode, null, 'the server must not crash on the deferred push');
  assert.doesNotMatch(log, /No database client in scope/);
  assert.match(log, PUSH_FAILED, 'the push must still be attempted');
});

test('booking in a purchase order answers before it pushes to Shopify, and still pushes', async () => {
  const made = await authedFetch('/api/purchase-orders', { supplierId, items: [{ productId, qty: 2, unitCost: 5 }] });
  const po = await made.json();
  assert.equal(made.status, 201, JSON.stringify(po));
  const sent = await authedFetch(`/api/purchase-orders/${po.id}/mark-ordered`, {});
  assert.ok(sent.status < 300, `sending the order: ${sent.status}`);
  const { res, json, pushedBeforeReply, log } = await replyThenPush(`/api/purchase-orders/${po.id}/receive`, {
    items: [{ itemId: po.items[0].id, qtyReceived: 2 }],
  });
  assert.equal(res.status, 200, JSON.stringify(json));
  assert.equal(pushedBeforeReply, false, 'the reply waited for the Shopify push');
  assert.equal(child.exitCode, null, 'the server must not crash on the deferred push');
  assert.doesNotMatch(log, /No database client in scope/);
  assert.match(log, PUSH_FAILED, 'the push must still be attempted');
});
