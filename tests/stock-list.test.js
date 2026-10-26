// The stock list and a product's page, the server (openspec/changes/stock-list;
// st-list, st-product; stock control decisions 2, 3 and 11): a product's page
// reads the product and its stock history newest first, Staff get no cost,
// and the list's search finds a supplier and carries each VAT rate.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { staffLogin } from './helpers/till.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let jo;
let other;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  jo = await staffLogin(owner.shop.id);
  other = await staffSignup(server.baseUrl);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options, who = owner) => staffRequest(server.baseUrl, who.cookie, path, options);

// Shimano brake pads B05S-RX at £28.00, as drawn; the cost, stock and
// supplier are bracketed placeholders.
let n = 0;
async function pads(over = {}) {
  n += 1;
  const res = await staff('/api/products', { method: 'POST', body: { name: 'Shimano brake pads', sku: `B05S-RX-${n}`, category: '[Category]', supplier: '[Supplier]', price: 28, cost: 14, stockQty: 6, ...over } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

test('a product’s page: the product and its stock history, newest first', async () => {
  const p = await pads();
  await staff(`/api/products/${p.id}/stock`, { method: 'POST', body: { change: -1, type: 'adjustment', note: 'Damaged' } });
  await runWithShop(owner.shop.id, () => prepare("INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES (?, -2, 'till_sale', 'Till sale B1-[0000]')").run(p.id));
  const res = await staff(`/api/products/${p.id}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.name, 'Shimano brake pads');
  assert.equal(res.body.stockQty, 5);
  assert.equal(res.body.cost, 14);
  assert.equal(res.body.vatRateBp, 2000);
  assert.deepEqual(res.body.history.map((h) => [h.type, h.change, h.note]), [
    ['till_sale', -2, 'Till sale B1-[0000]'],
    ['adjustment', -1, 'Damaged'],
    ['intake', 6, 'Initial stock'],
  ]);
  assert.ok(res.body.history.every((h) => Number.isInteger(h.id) && !Number.isNaN(Date.parse(h.at))));
});

test('Staff get no cost on a product’s page (stock decision 11)', async () => {
  const p = await pads();
  const res = await staff(`/api/products/${p.id}`, {}, jo);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.cost, null);
  assert.equal(res.body.price, 28);
});

test('a product taken off sale still opens; another shop’s, or none, is not found', async () => {
  const p = await pads();
  await staff(`/api/products/${p.id}`, { method: 'DELETE' });
  const gone = await staff(`/api/products/${p.id}`);
  assert.equal(gone.status, 200);
  assert.equal(gone.body.active, false);
  const theirs = await staff(`/api/products/${p.id}`, {}, other);
  assert.equal(theirs.status, 404);
  assert.equal(theirs.body.error, 'Product not found');
  assert.equal((await staff('/api/products/999999')).status, 404);
  assert.equal((await staff('/api/products/not-a-number')).status, 404);
});

test('the list’s search finds a supplier, and each product carries its VAT rate', async () => {
  await pads({ supplier: '[Second supplier]' });
  const res = await staff('/api/products?search=second%20supplier');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((p) => p.supplier), ['[Second supplier]']);
  assert.equal(res.body[0].vatRateBp, 2000);
});

// The review of stock-list (26 Oct).
test('a product’s page sends its newest 200 stock movements, not every one ever', async () => {
  const p = await pads();
  await runWithShop(owner.shop.id, () => prepare(
    "INSERT INTO stock_movements (product_id, type, change_qty, note, created_at) SELECT ?, 'sale', -1, '', now() - (g || ' minutes')::interval FROM generate_series(1, 250) g RETURNING id"
  ).all(p.id));
  const page = (await staff(`/api/products/${p.id}`)).body;
  assert.equal(page.history.length, 200);
});

test('% and _ in a search are plain characters, not wildcards', async () => {
  const plain = await pads({ name: 'Plain tube' });
  const odd = await pads({ name: 'Tube 50% off' });
  const found = async (q) => (await staff(`/api/products?search=${encodeURIComponent(q)}`)).body.map((x) => x.id);
  assert.equal((await found('_')).includes(plain.id), false, '_ matches only an underscore');
  assert.equal((await found('50%')).includes(odd.id), true);
  assert.equal((await found('%')).includes(plain.id), false, '% matches only a percent sign');
});
