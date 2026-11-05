// Sales, the till's sync, Shopify and the imports through the one place
// (openspec/changes/stock-movements-say-who): who, shop and cause on each line, and a
// held product answered without a sale, refund or order being lost. Jack Lewis, Jo
// Taylor, Bolton and Shimano brake pads as drawn; the rest placeholders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { encryptSecret } from '../server/shopify.js';
import { readNextFile, bringBatch, ROW_APPLIERS } from '../server/move/bring-across.js';
import { dbExec } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { registerTill, tillRequest } from './helpers/till.js';
import { deleteTestShop } from './helpers/testShop.js';
import { xlsxOf } from './helpers/xlsx.js';

const WEBHOOK_SECRET = 'stock-movements-test-secret';
const FAKE_SHOPIFY = new URL('./helpers/fake-shopify-fetch.js', import.meta.url).href;
let server;
let owner;
let jo;
let bolton;
let second;
let till;
before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1', NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${FAKE_SHOPIFY}`.trim() } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  bolton = (await staff('/api/sites', { method: 'POST', body: { name: 'Bolton', code: 'B' } })).body;
  second = (await staff('/api/sites', { method: 'POST', body: { name: '[Second site]', code: 'S' } })).body;
  till = await registerTill(server.baseUrl, owner, { siteCode: 'S' });
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const { rows: [{ employee_id: employeeId }] } = await pool.query('SELECT employee_id FROM logins WHERE id = $1', [made.body.loginId]);
  jo = { employeeId, cookie: await staffFreshCookie(made.body.loginId) };
  await inShop(() => prepare(
    "INSERT INTO shopify_connections (shop_id, shop_domain, access_token, storefront_api_token, webhook_secret, location_id, status) VALUES (?, ?, ?, ?, ?, '1', 'connected')"
  ).run(owner.shop.id, `moves-${owner.shop.id}.fake-shopify.invalid`, encryptSecret('fake-access-token'), encryptSecret('fake-storefront-token'), encryptSecret(WEBHOOK_SECRET)));
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

function staff(path, options) { return staffRequest(server.baseUrl, owner.cookie, path, options); }
const inShop = (fn) => runWithShop(owner.shop.id, fn);
let n = 0;
const product = (stock = 6, over = '') => inShop(async () => {
  n += 1;
  return (await prepare(`INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at${over ? ', shopify_variant_id' : ''}) VALUES (?, 'Shimano brake pads', '[Category]', 28, 14, ?, now()${over ? ', ?' : ''})`)
    .run(`B05S-RX-${n}`, stock, ...(over ? [over] : []))).lastInsertRowid;
});
const stockOf = (id) => inShop(async () => (await prepare('SELECT stock_qty FROM products WHERE id = ?').get(id)).stock_qty);
const linesOf = (id) => inShop(() => prepare('SELECT * FROM stock_movements WHERE product_id = ? ORDER BY id').all(id));

async function whileHeld(id, ask) {
  const holder = await pool.connect();
  try {
    await holder.query('BEGIN');
    await holder.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    await holder.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [id]);
    const started = Date.now();
    const res = await Promise.race([ask(), new Promise((_, reject) => { setTimeout(() => reject(new Error('still waiting after 8s')), 8000); })]);
    return { res, waited: Date.now() - started };
  } finally {
    await holder.query('ROLLBACK');
    holder.release();
  }
}

// ---- A sale ----

test('a sale: who sold it, the shop, the sale; stock down', async () => {
  const id = await product();
  const res = await staff('/api/sales', { method: 'POST', body: { items: [{ productId: id, qty: 2 }], cardAmount: 56, cashierId: jo.employeeId } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const [line] = await linesOf(id);
  assert.deepEqual(
    [line.change_qty, line.type, line.note, line.login_id, line.employee_id, line.who_name, line.site_id, line.sale_id],
    [-2, 'sale', `Sale #${res.body.id}`, owner.loginId, jo.employeeId, 'Jo Taylor', bolton.id, res.body.id]
  );
  assert.equal(await stockOf(id), 4);
});

test('a sale short of stock is still refused, naming the product, with nothing written', async () => {
  const id = await product(1);
  const res = await staff('/api/sales', { method: 'POST', body: { items: [{ productId: id, qty: 2 }], cardAmount: 56, cashierId: jo.employeeId } });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /Shimano brake pads/);
  assert.deepEqual([await stockOf(id), (await linesOf(id)).length], [1, 0]);
});

test('two lines of one product on a sale short of stock together are refused', async () => {
  const id = await product(3);
  const res = await staff('/api/sales', { method: 'POST', body: { items: [{ productId: id, qty: 2 }, { productId: id, qty: 2 }], cardAmount: 112, cashierId: jo.employeeId } });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(await stockOf(id), 3);
});

test('a sale of a held product answers busy, sells nothing, and then goes through', async () => {
  const id = await product();
  const body = { items: [{ productId: id, qty: 1 }], cardAmount: 28, cashierId: jo.employeeId };
  const { res, waited } = await whileHeld(id, () => staff('/api/sales', { method: 'POST', body }));
  assert.equal(res.status, 503, JSON.stringify(res.body));
  assert.equal(res.body.code, 'busy');
  assert.ok(waited >= 1900 && waited < 4500, `waited ${waited}ms`);
  assert.equal(await stockOf(id), 6);
  assert.equal((await inShop(() => prepare('SELECT count(*)::int AS c FROM sale_items WHERE product_id = ?').get(id))).c, 0);
  assert.equal((await staff('/api/sales', { method: 'POST', body })).status, 201);
  assert.equal(await stockOf(id), 5);
});

// ---- The till's sync ----

let receipt = 0;
function tillSale(productId, over = {}) {
  receipt += 1;
  return {
    kind: 'sale', clientId: randomUUID(), receiptNumber: receipt, tillClockAt: '2026-09-01T09:30:00.000Z', madeOffline: true, employeeId: jo.employeeId,
    lines: [{ productId, description: 'Shimano brake pads', qty: 1, unitPricePence: 2800, vatRateBp: 2000 }],
    payments: [{ method: 'cash', amountPence: 2800 }],
    ...over,
  };
}
const sync = (items) => tillRequest(server.baseUrl, owner.shop.slug, till.token, '/sync', { method: 'POST', body: { pendingCount: 0, items } });

test('a till’s sale: the person on it, the till’s own shop, the till sale', async () => {
  const id = await product();
  const item = tillSale(id);
  const res = await sync([item]);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const sale = await inShop(() => prepare('SELECT id FROM till_sales WHERE client_id = ?').get(item.clientId));
  const [line] = await linesOf(id);
  assert.deepEqual([line.change_qty, line.type, line.employee_id, line.who_name, line.site_id, line.till_sale_id], [-1, 'till_sale', jo.employeeId, 'Jo Taylor', second.id, sale.id]);
  assert.equal(await stockOf(id), 5);
});

test('a till’s sale still goes below zero and says so, and a product no longer held is still only a flag', async () => {
  const id = await product(0);
  const item = tillSale(id, { lines: [{ productId: 2147483000, description: '[Gone]', qty: 1, unitPricePence: 100, vatRateBp: 2000 }, { productId: id, description: 'Shimano brake pads', qty: 1, unitPricePence: 2700, vatRateBp: 2000 }] });
  const res = await sync([item]);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const kinds = res.body.results[0].attention.map((a) => a.kind ?? a);
  assert.ok(JSON.stringify(res.body).includes('stock_below_zero'), JSON.stringify(kinds));
  assert.ok(JSON.stringify(res.body).includes('unknown_product'), JSON.stringify(kinds));
  assert.equal(await stockOf(id), -1);
});

test('a till’s sale of a held product is sent again, and counts once when it is', async () => {
  const id = await product();
  const item = tillSale(id);
  const { res, waited } = await whileHeld(id, () => sync([item]));
  assert.equal(res.status, 503, JSON.stringify(res.body));
  assert.ok(waited >= 1900 && waited < 4500, `waited ${waited}ms`);
  assert.equal(await stockOf(id), 6);
  assert.equal((await sync([item])).status, 200);
  const again = await sync([item]);
  assert.equal(again.body.results[0].status, 'duplicate');
  assert.deepEqual([await stockOf(id), (await linesOf(id)).length], [5, 1]);
});

// ---- Shopify ----

function shopify(kind, payload) {
  const body = JSON.stringify(payload);
  const hmac = createHmac('sha256', WEBHOOK_SECRET).update(body, 'utf8').digest('base64');
  return fetch(`${server.baseUrl}/webhooks/shopify/${owner.shop.id}/${kind}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-shopify-hmac-sha256': hmac }, body });
}
const variant = () => String(10_000_000 + Math.floor(Math.random() * 1e9));
const refundOf = (variantId) => ({ id: Number(randomBytes(4).readUInt32BE(0)), refund_line_items: [{ quantity: 1, restock_type: 'return', line_item: { variant_id: Number(variantId) } }] });

test('a Shopify refund: nobody named, the refund, the shop; a held product is retried and counts once', async () => {
  const v = variant();
  const id = await product(6, v);
  const refund = refundOf(v);
  const { res } = await whileHeld(id, () => shopify('refunds', refund));
  assert.equal(res.status, 500, 'Shopify retries on an error');
  assert.equal(await stockOf(id), 6);
  assert.equal((await shopify('refunds', refund)).status, 200);
  const [line] = await linesOf(id);
  assert.deepEqual([line.change_qty, line.type, line.login_id, line.who_name, line.site_id, line.shopify_refund_id], [1, 'return', null, null, bolton.id, String(refund.id)]);
  assert.equal(await stockOf(id), 7);
});

const orderOf = (variantId, over = {}) => ({ id: Number(randomBytes(4).readUInt32BE(0)), order_number: 1001, total_discounts: '0', line_items: [{ variant_id: Number(variantId), quantity: 1, price: '28.00' }], ...over });
const eventOf = (id) => inShop(() => prepare("SELECT status, error_message FROM shopify_processed_events WHERE shopify_order_id = ? AND kind = 'order'").get(String(id)));
const salesFor = (id) => inShop(async () => (await prepare('SELECT count(*)::int AS c FROM sale_items WHERE product_id = ?').get(id)).c);

test('a Shopify order for a held product fails after its 2 seconds, and Shopify’s retry counts it once', async () => {
  const v = variant();
  const id = await product(6, v);
  const order = orderOf(v);
  const { res, waited } = await whileHeld(id, () => shopify('orders', order));
  assert.equal(res.status, 500, 'Shopify retries on an error');
  assert.ok(waited >= 1900 && waited < 4500, `waited ${waited}ms`);
  assert.deepEqual([await stockOf(id), (await linesOf(id)).length, await salesFor(id)], [6, 0, 0]);
  assert.equal((await eventOf(order.id)).status, 'error');
  assert.equal((await shopify('orders', order)).status, 200);
  assert.deepEqual([await stockOf(id), (await linesOf(id)).length, await salesFor(id)], [5, 1, 1]);
  assert.equal((await eventOf(order.id)).status, 'ok');
  const [line] = await linesOf(id);
  assert.deepEqual([line.change_qty, line.type, line.who_name, line.site_id], [-1, 'sale', null, bolton.id]);
  assert.ok(Number.isInteger(line.sale_id));
  // Sent again after it counted: nothing more.
  assert.equal((await shopify('orders', order)).status, 200);
  assert.deepEqual([await stockOf(id), (await linesOf(id)).length], [5, 1]);
});

test('a Shopify order that fails for any other reason is retried too, and counts once', async () => {
  const v = variant();
  const id = await product(6, v);
  const good = orderOf(v);
  // Too large a figure for the sale's own columns: a database error, not a refusal.
  const failing = { ...good, line_items: [{ variant_id: Number(v), quantity: 1, price: '99999999999.00' }] };
  assert.equal((await shopify('orders', failing)).status, 500);
  assert.deepEqual([await stockOf(id), (await linesOf(id)).length], [6, 0]);
  assert.equal((await shopify('orders', good)).status, 200);
  assert.deepEqual([await stockOf(id), (await linesOf(id)).length, await salesFor(id)], [5, 1, 1]);
});

test('the same Shopify order delivered twice at once counts once', async () => {
  const v = variant();
  const id = await product(6, v);
  const order = orderOf(v);
  const replies = await Promise.all([shopify('orders', order), shopify('orders', order), shopify('orders', order)]);
  assert.ok(replies.some((r) => r.status === 200), replies.map((r) => r.status).join());
  // A delivery told to wait can answer an error; Shopify's retry then finds it done.
  assert.equal((await shopify('orders', order)).status, 200);
  assert.deepEqual([await stockOf(id), (await linesOf(id)).length, await salesFor(id)], [5, 1, 1]);
});

test('a Shopify order refused for good stays refused: no sale, and no retry changes that', async () => {
  const v = variant();
  const id = await product(0, v);
  const order = orderOf(v);
  assert.equal((await shopify('orders', order)).status, 200);
  const event = await eventOf(order.id);
  assert.equal(event.status, 'error');
  assert.match(event.error_message, /Not enough stock/);
  assert.equal((await shopify('orders', order)).status, 200);
  assert.deepEqual([await stockOf(id), (await linesOf(id)).length, await salesFor(id)], [0, 0, 0]);
});

test('a Shopify order and refund behind an unfinished delivery of themselves give up after 2 seconds, and retry', async () => {
  const v = variant();
  const id = await product(6, v);
  for (const [kind, event, name] of [['order', orderOf(v), 'orders'], ['refund', refundOf(v), 'refunds']]) {
    const holder = await pool.connect();
    let res;
    let waited;
    try {
      await holder.query('BEGIN');
      await holder.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
      await holder.query('INSERT INTO shopify_processed_events (shopify_order_id, kind) VALUES ($1, $2)', [String(event.id), kind]);
      const started = Date.now();
      res = await Promise.race([shopify(name, event), new Promise((_, reject) => { setTimeout(() => reject(new Error(`${kind} still waiting after 8s`)), 8000); })]);
      waited = Date.now() - started;
    } finally {
      await holder.query('ROLLBACK');
      holder.release();
    }
    assert.equal(res.status, 500, kind);
    assert.ok(waited >= 1900 && waited < 4500, `${kind} waited ${waited}ms`);
    assert.equal((await shopify(name, event)).status, 200, kind);
  }
  assert.deepEqual([await stockOf(id), (await linesOf(id)).length], [6, 2], 'one sold, one back');
});

test('a Shopify order for nothing we hold is claimed and sells nothing', async () => {
  const order = orderOf(variant());
  assert.equal((await shopify('orders', order)).status, 200);
  assert.equal((await eventOf(order.id)).status, 'ok');
});

// ---- The imports ----

test('a supplier’s item imported with stock has its line, naming who, and its stock', async () => {
  const supplierName = `[Supplier ${randomUUID().slice(0, 6)}]`;
  const item = await inShop(async () => {
    const supplier = await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES (?, 'mock_csv', '{}', now())").run(supplierName);
    return (await prepare("INSERT INTO supplier_catalogue_items (supplier_id, supplier_sku, name, price, stock_qty, status) VALUES (?, ?, '[Catalogue item]', 14, 4, 'new')").run(supplier.lastInsertRowid, `[Code ${supplierName}]`)).lastInsertRowid;
  });
  const res = await staff(`/api/catalogue-items/${item}/import`, { method: 'POST', body: { price: 28, category: '[Category]' } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.stockQty, 4);
  const [line] = await linesOf(res.body.id);
  assert.deepEqual([line.change_qty, line.type, line.note, line.who_name, line.site_id], [4, 'intake', `Imported from ${supplierName}’s catalogue`, 'Jack Lewis', bolton.id]);
});

test('importing with stock at a till with nobody checked in asks for a PIN, and adds nothing', async () => {
  const cookie = await staffFreshCookie(owner.loginId);
  const made = await fetch(`${server.baseUrl}/api/till-setup`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ siteId: bolton.id, number: 9 }) });
  assert.equal(made.status, 201);
  const tillCookie = [cookie, ...made.headers.getSetCookie().map((l) => l.split(';')[0])].join('; ');
  const code = `[Code ${randomUUID().slice(0, 6)}]`;
  const item = await inShop(async () => {
    const supplier = await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES (?, 'mock_csv', '{}', now())").run(code);
    return (await prepare("INSERT INTO supplier_catalogue_items (supplier_id, supplier_sku, name, price, stock_qty, status) VALUES (?, ?, '[Catalogue item]', 14, 4, 'new')").run(supplier.lastInsertRowid, code)).lastInsertRowid;
  });
  const res = await staffRequest(server.baseUrl, tillCookie, `/api/catalogue-items/${item}/import`, { method: 'POST', body: { price: 28, category: '[Category]' } });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'check_in_first');
  assert.equal((await inShop(() => prepare('SELECT count(*)::int AS c FROM products WHERE sku = ?').get(code))).c, 0);
});

test('a Citrus Lime row keeps the batch’s own shorter wait, and uses the batch’s shop', async () => {
  const sku = `B05S-RX-${randomUUID().slice(0, 6)}`;
  const row = { 'Item Lookup Code': sku, Description: 'Shimano brake pads', Price: '28', 'Qty On Hand': '2' };
  await inShop(async () => {
    await dbExec('BEGIN');
    await prepare("SET LOCAL lock_timeout = '500ms'").run();
    const done = await ROW_APPLIERS.price_list(row, { sent_by_login_id: owner.loginId }, { firstStore: '', siteId: second.id });
    assert.equal(done.state, 'in');
    assert.equal((await prepare('SHOW lock_timeout').get()).lock_timeout, '500ms');
    await dbExec('ROLLBACK');
  });
  await inShop(async () => {
    await dbExec('BEGIN');
    await ROW_APPLIERS.price_list(row, { sent_by_login_id: owner.loginId }, { firstStore: '', siteId: second.id });
    const line = await prepare('SELECT m.site_id, m.login_id FROM stock_movements m JOIN products p ON p.id = m.product_id WHERE p.sku = ?').get(sku);
    assert.deepEqual([line.site_id, line.login_id], [second.id, owner.loginId]);
    await dbExec('ROLLBACK');
  });
});

test('a Citrus Lime row with stock: its line, who sent the file, the shop', async () => {
  const sku = `B05S-RX-${randomUUID().slice(0, 6)}`;
  const header = ['Store', 'Department', 'Category', 'Supplier', 'Item Lookup Code', 'Description', 'Store Cost', 'Price', 'Tax Rate', 'Min (Reorder Point)', 'Qty On Hand', 'Active'];
  const key = randomBytes(24).toString('hex');
  const sent = await staff('/api/move/files', { method: 'POST', body: { fileName: 'export.xlsx', dataBase64: xlsxOf([['Price List - Store Level'], header, ['Bolton', '[Department]', '[Category]', '[Supplier]', sku, 'Shimano brake pads', 14, 28, 0.2, 3, 3, 'Yes']]).toString('base64'), requestKey: key } });
  assert.ok(sent.status < 300, JSON.stringify(sent.body));
  while (await readNextFile(owner.shop.id));
  while (await inShop(() => bringBatch()));
  const made = await inShop(() => prepare('SELECT id, stock_qty FROM products WHERE sku = ?').get(sku));
  assert.equal(made.stock_qty, 3);
  const [line] = await linesOf(made.id);
  assert.deepEqual([line.change_qty, line.type, line.login_id, line.site_id], [3, 'intake', owner.loginId, bolton.id]);
  assert.equal((await staff(`/api/products/${made.id}`)).body.history[0].who, 'Jack Lewis');
});
