// Two people paying at once, and an order with nothing on it.
//
// Found in the 21 Oct review of Jack's recent work (old code that the till's
// job payment leans on): convert checked the order was open, made the sale and
// only then marked the order converted, with no lock, so two quick taps took
// one order's payment twice; createSale read stock before its transaction and
// wrote an absolute figure, so two tills selling the last unit both succeeded.
// Each test fires its requests together with Promise.all, which is the only
// way to see these.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { deleteTestShop } from './helpers/testShop.js';
import { staffSignup, staffRequest } from './helpers/staff.js';

let server;
before(async () => { server = await startLiveServer(); });
after(async () => {
  if (server) await server.stop();
  await pool.end();
});

async function setUp({ stockQty }) {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const req = (path, options) => staffRequest(server.baseUrl, cookie, path, options);
  const cashier = (await req('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } })).body;
  const product = (await req('/api/products', { method: 'POST', body: { name: 'Inner tube', price: 5, sku: 'TUBE-1', stockQty } })).body;
  return { req, shop, cashierId: cashier.employeeId, product };
}

const stockOf = (shop, productId) => runWithShop(shop.id, async () => (await prepare('SELECT stock_qty FROM products WHERE id = ?').get(productId)).stock_qty);
const movementsOf = (shop, productId) => runWithShop(shop.id, async () => Number((await prepare("SELECT COALESCE(SUM(change_qty), 0) AS n FROM stock_movements WHERE product_id = ? AND type = 'sale'").get(productId)).n));
const salesFor = (shop, orderId) => runWithShop(shop.id, async () => Number((await prepare('SELECT COUNT(*) AS n FROM sales WHERE note = ?').get(`Converted from order #${orderId}`)).n));

test('two taps on one order take its payment once', async () => {
  const { req, shop, cashierId, product } = await setUp({ stockQty: 5 });
  try {
    const order = (await req('/api/sale-documents', { method: 'POST', body: { kind: 'order', items: [{ productId: product.id, qty: 1, unitPrice: 5 }] } })).body;
    const pay = () => req(`/api/sale-documents/${order.id}/convert`, { method: 'POST', body: { cashierId, cashAmount: 5, cashTendered: 5 } });
    const replies = await Promise.all([pay(), pay()]);
    assert.deepEqual(replies.map((r) => r.status).sort(), [201, 400], JSON.stringify(replies.map((r) => r.body)));
    assert.equal(await salesFor(shop, order.id), 1, 'one sale for one order');
    assert.equal(await stockOf(shop, product.id), 4, 'stock taken once');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('two tills selling the last unit: one sale goes through, the other is refused', async () => {
  const { req, shop, cashierId, product } = await setUp({ stockQty: 1 });
  try {
    const sell = () => req('/api/sales', { method: 'POST', body: { cashierId, items: [{ productId: product.id, qty: 1 }], cashAmount: 5, cashTendered: 5 } });
    const replies = await Promise.all([sell(), sell()]);
    assert.deepEqual(replies.map((r) => r.status).sort(), [201, 400], JSON.stringify(replies.map((r) => r.body)));
    assert.match(replies.find((r) => r.status === 400).body.error, /Not enough stock/);
    assert.equal(await stockOf(shop, product.id), 0);
    assert.equal(await movementsOf(shop, product.id), -1);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('two tills each selling one of the last two units leave none, with both movements recorded', async () => {
  const { req, shop, cashierId, product } = await setUp({ stockQty: 2 });
  try {
    const sell = () => req('/api/sales', { method: 'POST', body: { cashierId, items: [{ productId: product.id, qty: 1 }], cashAmount: 5, cashTendered: 5 } });
    const replies = await Promise.all([sell(), sell()]);
    assert.deepEqual(replies.map((r) => r.status), [201, 201], JSON.stringify(replies.map((r) => r.body)));
    assert.equal(await stockOf(shop, product.id), 0, 'both sales came off the stock');
    assert.equal(await movementsOf(shop, product.id), -2);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('selling past zero stock, when the till asks to, still counts down from what is there', async () => {
  const { req, shop, cashierId, product } = await setUp({ stockQty: 1 });
  try {
    const sell = () => req('/api/sales', { method: 'POST', body: { cashierId, items: [{ productId: product.id, qty: 1 }], cashAmount: 5, cashTendered: 5, sellPastStock: true } });
    const replies = await Promise.all([sell(), sell()]);
    assert.deepEqual(replies.map((r) => r.status), [201, 201]);
    assert.equal(await stockOf(shop, product.id), -1);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('an order with nothing on it cannot be converted into a £0 sale', async () => {
  const { req, shop, cashierId } = await setUp({ stockQty: 1 });
  try {
    const order = (await req('/api/sale-documents', { method: 'POST', body: { kind: 'order', items: [{ lineType: 'labour', name: 'Fit tube', unitPrice: 5 }] } })).body;
    const emptied = await req(`/api/sale-documents/${order.id}/items`, { method: 'PUT', body: { items: [] } });
    assert.equal(emptied.status, 200, 'a job\'s order may be emptied while the job is open');
    const paid = await req(`/api/sale-documents/${order.id}/convert`, { method: 'POST', body: { cashierId, cashAmount: 0 } });
    assert.equal(paid.status, 400, JSON.stringify(paid.body));
    assert.match(paid.body.error, /nothing on/i);
    assert.equal(await salesFor(shop, order.id), 0);
  } finally {
    await deleteTestShop(shop.id);
  }
});

// Jack's check of this fix, 21 Oct: a sale must not wait on the light lock a
// foreign-key check takes on a product (an order line or an offline till's
// sync being saved for it at the same moment). FOR UPDATE waits on it, which
// can deadlock with two products locked in opposite orders; FOR NO KEY UPDATE
// still makes two sales queue but lets the key check through.
test('a sale isn’t held up by another transaction’s key check on its product', async () => {
  const { req, shop, cashierId, product } = await setUp({ stockQty: 5 });
  const other = await pool.connect();
  try {
    await other.query('BEGIN');
    await other.query("SELECT set_config('app.current_shop_id', $1, true)", [String(shop.id)]);
    // The lock Postgres takes when a new row's foreign key points at the product.
    await other.query('SELECT id FROM products WHERE id = $1 FOR KEY SHARE', [product.id]);
    const sale = req('/api/sales', { method: 'POST', body: { cashierId, items: [{ productId: product.id, qty: 1 }], cashAmount: 5, cashTendered: 5 } });
    const outcome = await Promise.race([sale.then((r) => r.status), new Promise((resolve) => setTimeout(() => resolve('held up'), 3000))]);
    assert.equal(outcome, 201, 'the sale went through while the key check was held');
  } finally {
    await other.query('ROLLBACK').catch(() => {});
    other.release();
    await deleteTestShop(shop.id);
  }
});
