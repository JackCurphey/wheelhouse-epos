// A Shopify refund puts stock back without losing a change made at the same
// moment (shopify-refund-stock, 28 Oct review of server/server.js).
//
// The refund webhook read the product, then wrote an absolute figure
// (`stock_qty = <what it read> + qty`). A till sale, an adjustment or a
// delivery landing between the read and the write was overwritten. The race
// test below holds the product's row with a second connection, changes the
// stock there, lets the webhook reach its write and wait on that row, then
// commits: both changes must survive.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { encryptSecret } from '../server/shopify.js';
import { startLiveServer } from './helpers/liveServer.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

const WEBHOOK_SECRET = 'refund-stock-test-secret';
let server;

before(async () => { server = await startLiveServer(); });
after(async () => {
  if (server) await server.stop();
  await pool.end();
});

async function asShop(shopId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_shop_id', $1, true)", [String(shopId)]);
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// A shop connected to Shopify, with one product Shopify knows as variant
// `variantId`. No inventory item id, so the webhook makes no outside call.
async function setUp({ stockQty, variantId }) {
  const shop = await createTestShop();
  const productId = await asShop(shop.id, async (c) => {
    await c.query(
      `INSERT INTO shopify_connections (shop_id, shop_domain, access_token, storefront_api_token, webhook_secret, location_id, status)
       VALUES ($1, 'refund-stock-test.invalid', $2, $3, $4, '1', 'connected')`,
      [shop.id, encryptSecret('fake-access-token'), encryptSecret('fake-storefront-token'), encryptSecret(WEBHOOK_SECRET)]
    );
    const { rows: [p] } = await c.query(
      `INSERT INTO products (shop_id, sku, name, price, stock_qty, shopify_variant_id)
       VALUES ($1, $2, 'Inner tube', 5, $3, $4) RETURNING id`,
      [shop.id, `TUBE-${randomUUID().slice(0, 8)}`, stockQty, String(variantId)]
    );
    return p.id;
  });
  return { shop, productId };
}

function sendRefund(shopId, refund) {
  const body = JSON.stringify(refund);
  const hmac = createHmac('sha256', WEBHOOK_SECRET).update(body, 'utf8').digest('base64');
  return fetch(`${server.baseUrl}/webhooks/shopify/${shopId}/refunds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Hmac-Sha256': hmac },
    body,
  });
}

const stockOf = (shopId, productId) => asShop(shopId, async (c) => (await c.query('SELECT stock_qty FROM products WHERE id = $1', [productId])).rows[0].stock_qty);
const movementsOf = (shopId, productId) => asShop(shopId, async (c) => (await c.query(
  'SELECT change_qty, type, note FROM stock_movements WHERE product_id = $1 ORDER BY id', [productId]
)).rows);

test('a Shopify refund puts its stock back and records the return', async () => {
  const variantId = 7100 + Math.floor(Math.random() * 1e6);
  const { shop, productId } = await setUp({ stockQty: 20, variantId });
  try {
    const res = await sendRefund(shop.id, { id: 9101, refund_line_items: [{ quantity: 2, line_item: { variant_id: variantId } }] });
    assert.equal(res.status, 200, await res.text());
    assert.equal(await stockOf(shop.id, productId), 22);
    assert.deepEqual(await movementsOf(shop.id, productId), [{ change_qty: 2, type: 'return', note: 'Shopify refund #9101' }]);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a stock change made while the refund is in flight is not lost', async () => {
  const variantId = 7200 + Math.floor(Math.random() * 1e6);
  const { shop, productId } = await setUp({ stockQty: 20, variantId });
  const other = await pool.connect();
  let refund;
  try {
    // The other change: three taken off, the row held until we say so.
    await other.query('BEGIN');
    await other.query("SELECT set_config('app.current_shop_id', $1, true)", [String(shop.id)]);
    const { rows: [{ pid: otherPid }] } = await other.query('SELECT pg_backend_pid() AS pid');
    await other.query('UPDATE products SET stock_qty = stock_qty - 3 WHERE id = $1', [productId]);

    refund = sendRefund(shop.id, { id: 9201, refund_line_items: [{ quantity: 1, line_item: { variant_id: variantId } }] });

    // Wait until the webhook has read the product and is waiting on its row.
    const deadline = Date.now() + 10000;
    let waiting = false;
    while (!waiting && Date.now() < deadline) {
      const { rows } = await pool.query('SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))', [otherPid]);
      waiting = rows.length > 0;
      if (!waiting) await new Promise((r) => setTimeout(r, 25));
    }
    assert.ok(waiting, 'the refund reached its stock write and waited on the held row');

    await other.query('COMMIT');
    const res = await refund;
    assert.equal(res.status, 200, await res.text());

    assert.equal(await stockOf(shop.id, productId), 18, '20, three taken off elsewhere, one refunded: 18');
    assert.deepEqual(await movementsOf(shop.id, productId), [{ change_qty: 1, type: 'return', note: 'Shopify refund #9201' }]);
  } finally {
    await other.query('ROLLBACK').catch(() => {});
    other.release();
    if (refund) await refund.catch(() => {});
    await deleteTestShop(shop.id);
  }
});

// The refund now holds its products' rows until it commits, so it takes them
// in product id order, as a sale, receiving and till sync do; otherwise a
// two-line refund and a two-line sale could each hold one row and wait for
// the other's (a deadlock, and the claimed refund would be dropped).
test('a refund of two products takes their rows in id order, so it cannot deadlock with a sale', async () => {
  const variantA = 7300 + Math.floor(Math.random() * 1e6);
  const variantB = variantA + 1;
  const { shop, productId: lowId } = await setUp({ stockQty: 10, variantId: variantA });
  const other = await pool.connect();
  let refund;
  try {
    const highId = await asShop(shop.id, async (c) => (await c.query(
      `INSERT INTO products (shop_id, sku, name, price, stock_qty, shopify_variant_id)
       VALUES ($1, $2, 'Tyre', 20, 10, $3) RETURNING id`,
      [shop.id, `TYRE-${randomUUID().slice(0, 8)}`, String(variantB)]
    )).rows[0].id);
    assert.ok(highId > lowId);

    // Another transaction (a sale, which locks in id order) holds the lower id.
    await other.query('BEGIN');
    await other.query("SELECT set_config('app.current_shop_id', $1, true)", [String(shop.id)]);
    const { rows: [{ pid: otherPid }] } = await other.query('SELECT pg_backend_pid() AS pid');
    await other.query('UPDATE products SET stock_qty = stock_qty - 1 WHERE id = $1', [lowId]);

    // The refund lists the higher id first.
    refund = sendRefund(shop.id, { id: 9301, refund_line_items: [
      { quantity: 1, line_item: { variant_id: variantB } },
      { quantity: 1, line_item: { variant_id: variantA } },
    ] });
    const deadline = Date.now() + 10000;
    let waiting = false;
    while (!waiting && Date.now() < deadline) {
      const { rows } = await pool.query('SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))', [otherPid]);
      waiting = rows.length > 0;
      if (!waiting) await new Promise((r) => setTimeout(r, 25));
    }
    assert.ok(waiting, 'the refund is waiting on the held row');

    // The other transaction now takes the higher id too, then commits.
    await other.query('UPDATE products SET stock_qty = stock_qty - 1 WHERE id = $1', [highId]);
    await other.query('COMMIT');
    const res = await refund;
    assert.equal(res.status, 200, await res.text());
    assert.equal(await stockOf(shop.id, lowId), 10, 'one sold, one refunded');
    assert.equal(await stockOf(shop.id, highId), 10, 'one sold, one refunded');
  } finally {
    await other.query('ROLLBACK').catch(() => {});
    other.release();
    if (refund) await refund.catch(() => {});
    await deleteTestShop(shop.id);
  }
});
