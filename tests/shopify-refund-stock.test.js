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
import { pool, runWithShop } from '../server/db.js';
import { encryptSecret, recordShopifyEventError, pushStockToShopify } from '../server/shopify.js';
import { startLiveServer } from './helpers/liveServer.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

const WEBHOOK_SECRET = 'refund-stock-test-secret';
// Not imported here: importing it would swap this process's fetch too.
const FAKE_SHOPIFY_SUFFIX = '.fake-shopify.invalid';
const FAKE_SHOPIFY = new URL('./helpers/fake-shopify-fetch.js', import.meta.url).href;
let server;

// Shopify is faked inside the server (helpers/fake-shopify-fetch.js), so what
// the refund sends back to Shopify can be read from the server's stderr.
before(async () => {
  server = await startLiveServer({ env: { NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${FAKE_SHOPIFY}`.trim() } });
});
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

// A shop connected to (a fake) Shopify, with one product Shopify knows as
// variant `variantId`. Without `inventoryItemId` the refund sends nothing
// back to Shopify.
async function setUp({ stockQty, variantId, inventoryItemId = null }) {
  const shop = await createTestShop();
  await asShop(shop.id, (c) => c.query(
    `INSERT INTO shopify_connections (shop_id, shop_domain, access_token, storefront_api_token, webhook_secret, location_id, status)
     VALUES ($1, $2, $3, $4, $5, '1', 'connected')`,
    [shop.id, `refund-stock-${shop.id}${FAKE_SHOPIFY_SUFFIX}`, encryptSecret('fake-access-token'), encryptSecret('fake-storefront-token'), encryptSecret(WEBHOOK_SECRET)]
  ));
  const productId = await addProduct(shop.id, { stockQty, variantId, inventoryItemId });
  return { shop, productId };
}

async function addProduct(shopId, { stockQty, variantId, inventoryItemId = null }) {
  return asShop(shopId, async (c) => (await c.query(
    `INSERT INTO products (shop_id, sku, name, price, stock_qty, shopify_variant_id, shopify_inventory_item_id)
     VALUES ($1, $2, 'Inner tube', 5, $3, $4, $5) RETURNING id`,
    [shopId, `TUBE-${randomUUID().slice(0, 8)}`, stockQty, String(variantId), inventoryItemId]
  )).rows[0].id);
}

const newVariant = () => 10_000_000 + Math.floor(Math.random() * 1e9);
const eventsOf = (shopId, refundId) => asShop(shopId, async (c) => (await c.query(
  "SELECT status, error_message FROM shopify_processed_events WHERE shopify_order_id = $1 AND kind = 'refund'", [String(refundId)]
)).rows);

// Waits until `n` database sessions are queued behind `pid`, directly or
// behind one that is; resolves to how many were.
async function waitQueuedBehind(pid, n, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let count = 0;
  while (Date.now() < deadline) {
    const { rows: [row] } = await pool.query(
      `WITH direct AS (SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid)))
       SELECT (SELECT count(*) FROM direct)
            + (SELECT count(*) FROM pg_stat_activity s WHERE EXISTS (SELECT 1 FROM direct d WHERE d.pid = ANY(pg_blocking_pids(s.pid)))) AS n`,
      [pid]
    );
    count = Number(row.n);
    if (count >= n) return count;
    await new Promise((r) => setTimeout(r, 25));
  }
  return count;
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

// ---- 28 Oct review fixes ----

// The claim on a refund is made inside its transaction, so a refund that
// fails partway leaves nothing behind but an error record, and Shopify's
// retry of the same delivery applies it.
test('a refund that fails partway changes nothing, and the same delivery retried applies it', async () => {
  const variantA = newVariant();
  const variantB = newVariant();
  const { shop, productId: a } = await setUp({ stockQty: 5, variantId: variantA });
  // The largest whole number the column holds: adding one fails, after line A.
  const b = await addProduct(shop.id, { stockQty: 2147483647, variantId: variantB });
  try {
    assert.ok(b > a, 'line B is written after line A');
    const refund = { id: 9401, refund_line_items: [
      { quantity: 1, line_item: { variant_id: variantA } },
      { quantity: 1, line_item: { variant_id: variantB } },
    ] };
    const failed = await sendRefund(shop.id, refund);
    assert.equal(failed.status, 500, await failed.text());
    assert.equal(await stockOf(shop.id, a), 5, 'line A rolled back with line B');
    assert.deepEqual(await movementsOf(shop.id, a), []);
    const [event] = await eventsOf(shop.id, 9401);
    assert.equal(event?.status, 'error', 'the failure is recorded');
    assert.match(event.error_message, /out of range/);

    await asShop(shop.id, (c) => c.query('UPDATE products SET stock_qty = 10 WHERE id = $1', [b]));
    const retried = await sendRefund(shop.id, refund);
    assert.equal(retried.status, 200, await retried.text());
    assert.equal(await stockOf(shop.id, a), 6, 'the retry applied line A');
    assert.equal(await stockOf(shop.id, b), 11, 'the retry applied line B');
    assert.deepEqual(await eventsOf(shop.id, 9401), [{ status: 'ok', error_message: null }]);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the same refund delivered twice puts stock back once', async () => {
  const variantId = newVariant();
  const { shop, productId } = await setUp({ stockQty: 20, variantId });
  try {
    const refund = { id: 9501, refund_line_items: [{ quantity: 1, line_item: { variant_id: variantId } }] };
    for (let i = 0; i < 2; i++) {
      const res = await sendRefund(shop.id, refund);
      assert.equal(res.status, 200, await res.text());
    }
    assert.equal(await stockOf(shop.id, productId), 21);
    assert.equal((await movementsOf(shop.id, productId)).length, 1);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the same refund arriving twice at the same moment puts stock back once', async () => {
  const variantId = newVariant();
  const { shop, productId } = await setUp({ stockQty: 20, variantId });
  const other = await pool.connect();
  let both;
  try {
    // Hold the product so both deliveries are in flight together: the first
    // waits on the product, the second on the first's claim.
    await other.query('BEGIN');
    await other.query("SELECT set_config('app.current_shop_id', $1, true)", [String(shop.id)]);
    const { rows: [{ pid }] } = await other.query('SELECT pg_backend_pid() AS pid');
    await other.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [productId]);
    const refund = { id: 9601, refund_line_items: [{ quantity: 1, line_item: { variant_id: variantId } }] };
    both = Promise.all([sendRefund(shop.id, refund), sendRefund(shop.id, refund)]);
    assert.equal(await waitQueuedBehind(pid, 2), 2, 'both deliveries were waiting at once');
    await other.query('COMMIT');
    const replies = await both;
    assert.deepEqual(replies.map((r) => r.status), [200, 200]);
    assert.equal(await stockOf(shop.id, productId), 21);
    assert.equal((await movementsOf(shop.id, productId)).length, 1);
  } finally {
    await other.query('ROLLBACK').catch(() => {});
    other.release();
    if (both) await both.catch(() => {});
    await deleteTestShop(shop.id);
  }
});

// Shopify's refunds/create payload marks each line with restock_type;
// "no_restock" means "Refunding these items won't affect inventory"
// (shopify.dev, Refund resource), so Wheelhouse's stock is left alone too.
test('a refund line Shopify marks no_restock leaves stock alone; the others go back', async () => {
  const variantA = newVariant();
  const variantB = newVariant();
  const { shop, productId: a } = await setUp({ stockQty: 5, variantId: variantA });
  const b = await addProduct(shop.id, { stockQty: 5, variantId: variantB });
  try {
    const res = await sendRefund(shop.id, { id: 9701, refund_line_items: [
      { quantity: 1, restock_type: 'no_restock', line_item: { variant_id: variantA } },
      { quantity: 2, restock_type: 'return', line_item: { variant_id: variantB } },
    ] });
    assert.equal(res.status, 200, await res.text());
    assert.equal(await stockOf(shop.id, a), 5, 'no_restock: unchanged');
    assert.deepEqual(await movementsOf(shop.id, a), []);
    assert.equal(await stockOf(shop.id, b), 7);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the figure sent to Shopify is the stock after a change made during the refund', async () => {
  const variantId = newVariant();
  const inventoryItemId = String(newVariant());
  const { shop, productId } = await setUp({ stockQty: 20, variantId, inventoryItemId });
  const other = await pool.connect();
  let refund;
  try {
    await other.query('BEGIN');
    await other.query("SELECT set_config('app.current_shop_id', $1, true)", [String(shop.id)]);
    const { rows: [{ pid }] } = await other.query('SELECT pg_backend_pid() AS pid');
    await other.query('UPDATE products SET stock_qty = stock_qty - 3 WHERE id = $1', [productId]);
    const logFrom = server.stderr.length;
    refund = sendRefund(shop.id, { id: 9801, refund_line_items: [{ quantity: 1, line_item: { variant_id: variantId } }] });
    assert.equal(await waitQueuedBehind(pid, 1), 1, 'the refund waited on the held row');
    await other.query('COMMIT');
    const res = await refund;
    assert.equal(res.status, 200, await res.text());

    const sent = server.stderr.slice(logFrom).split('\n')
      .filter((line) => line.startsWith('FAKE_SHOPIFY '))
      .map((line) => JSON.parse(line.slice('FAKE_SHOPIFY '.length)))
      .filter((call) => call.path.endsWith('/inventory_levels/set.json') && call.body?.inventory_item_id === inventoryItemId);
    assert.equal(sent.length, 1, 'one push for the refunded product');
    assert.equal(sent[0].body.available, 18, 'Shopify is told 18: 20, three taken off, one refunded');
    assert.equal(await stockOf(shop.id, productId), 18);
  } finally {
    await other.query('ROLLBACK').catch(() => {});
    other.release();
    if (refund) await refund.catch(() => {});
    await deleteTestShop(shop.id);
  }
});

// ---- 28 Oct second review ----

// A refund that fails on its second product (at the column's largest number)
// and so leaves this change's error record; then the product is put right,
// so the next delivery can go through.
async function failOnce(shop, refund, highProductId) {
  const res = await sendRefund(shop.id, refund);
  assert.equal(res.status, 500, await res.text());
  assert.equal((await eventsOf(shop.id, refund.id))[0]?.status, 'error');
  await asShop(shop.id, (c) => c.query('UPDATE products SET stock_qty = 10 WHERE id = $1', [highProductId]));
}

// Before this change, a refund could fail after putting some of its stock
// back and still be marked 'error'. Taking such a row again would put that
// stock back twice, so a row this change didn't write stays taken, as before.
test('an error record from before this change is not taken again; one this change wrote is', async () => {
  const variantId = newVariant();
  const { shop, productId } = await setUp({ stockQty: 5, variantId });
  try {
    await asShop(shop.id, (c) => c.query(
      "INSERT INTO shopify_processed_events (shop_id, shopify_order_id, kind, status, error_message) VALUES ($1, '9901', 'refund', 'error', 'integer out of range')",
      [shop.id]
    ));
    const old = await sendRefund(shop.id, { id: 9901, refund_line_items: [{ quantity: 1, line_item: { variant_id: variantId } }] });
    assert.equal(old.status, 200, await old.text());
    assert.equal(await stockOf(shop.id, productId), 5, 'the old error row stays taken');
    assert.deepEqual(await eventsOf(shop.id, 9901), [{ status: 'error', error_message: 'integer out of range' }]);
    // A later failure (one before its claim) doesn't mark the old row either,
    // which would make it claimable.
    await runWithShop(shop.id, () => recordShopifyEventError(9901, 'refund', 'connection terminated'));
    assert.deepEqual(await eventsOf(shop.id, 9901), [{ status: 'error', error_message: 'integer out of range' }]);

    const variantB = newVariant();
    const b = await addProduct(shop.id, { stockQty: 2147483647, variantId: variantB });
    const refund = { id: 9902, refund_line_items: [
      { quantity: 1, line_item: { variant_id: variantId } },
      { quantity: 1, line_item: { variant_id: variantB } },
    ] };
    await failOnce(shop, refund, b);
    const retried = await sendRefund(shop.id, refund);
    assert.equal(retried.status, 200, await retried.text());
    assert.equal(await stockOf(shop.id, productId), 6, 'this change\'s error row is taken again');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('two retries of a failed refund arriving at the same moment put stock back once', async () => {
  const variantA = newVariant();
  const variantB = newVariant();
  const { shop, productId: a } = await setUp({ stockQty: 5, variantId: variantA });
  const b = await addProduct(shop.id, { stockQty: 2147483647, variantId: variantB });
  const other = await pool.connect();
  let both;
  try {
    const refund = { id: 9903, refund_line_items: [
      { quantity: 1, line_item: { variant_id: variantA } },
      { quantity: 1, line_item: { variant_id: variantB } },
    ] };
    await failOnce(shop, refund, b);

    await other.query('BEGIN');
    await other.query("SELECT set_config('app.current_shop_id', $1, true)", [String(shop.id)]);
    const { rows: [{ pid }] } = await other.query('SELECT pg_backend_pid() AS pid');
    await other.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [a]);
    both = Promise.all([sendRefund(shop.id, refund), sendRefund(shop.id, refund)]);
    assert.equal(await waitQueuedBehind(pid, 2), 2, 'both retries were waiting at once');
    await other.query('COMMIT');
    const replies = await both;
    assert.deepEqual(replies.map((r) => r.status), [200, 200]);
    assert.equal(await stockOf(shop.id, a), 6);
    assert.equal(await stockOf(shop.id, b), 11);
    assert.equal((await movementsOf(shop.id, a)).length, 1);
    assert.deepEqual(await eventsOf(shop.id, 9903), [{ status: 'ok', error_message: null }]);
  } finally {
    await other.query('ROLLBACK').catch(() => {});
    other.release();
    if (both) await both.catch(() => {});
    await deleteTestShop(shop.id);
  }
});

// A failure recorded after another delivery of the same refund went through
// (say one that failed before reaching its claim) must not undo the 'ok'.
test('an error record arriving after the refund went through leaves it done', async () => {
  const variantId = newVariant();
  const { shop } = await setUp({ stockQty: 5, variantId });
  try {
    const res = await sendRefund(shop.id, { id: 9904, refund_line_items: [{ quantity: 1, line_item: { variant_id: variantId } }] });
    assert.equal(res.status, 200, await res.text());
    await runWithShop(shop.id, () => recordShopifyEventError(9904, 'refund', 'connection terminated'));
    assert.deepEqual(await eventsOf(shop.id, 9904), [{ status: 'ok', error_message: null }]);
  } finally {
    await deleteTestShop(shop.id);
  }
});

// Once the refund's stock has committed, a failure to even open the push's
// database scope (the pool full for 5 s, say) is logged, like a failed push,
// and never fails the webhook: a 500 would have Shopify retry a refund that
// is already done, and the retry is told so and pushes nothing.
test('a push to Shopify that cannot get a database connection is logged, not thrown', async (t) => {
  const logged = t.mock.method(console, 'error', () => {});
  const connect = t.mock.method(pool, 'connect', async () => { throw new Error('timeout exceeded when trying to connect'); });
  try {
    await pushStockToShopify(1, [{ product: { id: 1, shopify_inventory_item_id: '1' }, newQty: 3 }]);
  } finally {
    connect.mock.restore();
    logged.mock.restore();
  }
  assert.equal(connect.mock.callCount(), 1, 'the push tried to open its scope');
  assert.ok(logged.mock.calls.some((c) => /Shopify/.test(String(c.arguments[0])) && /timeout exceeded/.test(String(c.arguments[1]?.message))), 'the failure is logged');
});
