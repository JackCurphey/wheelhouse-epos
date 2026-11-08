// A price or cost change goes into the history (openspec/changes/product-page-sizes, design 1;
// stock control decisions 7 and 11): each change kept with was, now, who and when; the Owner
// sees them on a product's page, staff are sent none (st-product-staff). Jack Lewis, Jo Taylor
// and Shimano brake pads B05S-RX £28.00 as drawn; the rest placeholders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let jo;
before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl, { shopName: '[Other shop]', ownerName: '[Other owner]' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const as = (who, path, method = 'GET', body) => staffRequest(server.baseUrl, who.cookie, path, { method, body });
const changes = (shop, productId) => runWithShop(shop.shop.id, () => prepare(
  'SELECT field, was_pence, now_pence, who_name, delivery_id FROM product_price_changes WHERE product_id = ? ORDER BY id'
).all(productId));
async function pads() {
  const res = await as(owner, '/api/products', 'POST', { name: 'Shimano brake pads', sku: `B05S-RX-${randomUUID().slice(0, 4)}`, category: 'Brakes', pricePence: 2800, costPence: 1400 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

test('adding a product records no change', async () => {
  const p = await pads();
  assert.deepEqual(await changes(owner, p.id), []);
});

test('a price and a cost saved each record was, now and who', async () => {
  const p = await pads();
  const res = await as(owner, `/api/products/${p.id}`, 'PUT', { pricePence: 3000, costPence: 1500 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual((await changes(owner, p.id)).map((c) => ({ ...c, was_pence: Number(c.was_pence), now_pence: Number(c.now_pence) })), [
    { field: 'price', was_pence: 2800, now_pence: 3000, who_name: 'Jack Lewis', delivery_id: null },
    { field: 'cost', was_pence: 1400, now_pence: 1500, who_name: 'Jack Lewis', delivery_id: null },
  ]);
});

test('a save that changes neither price nor cost records nothing', async () => {
  const p = await pads();
  assert.equal((await as(owner, `/api/products/${p.id}`, 'PUT', { name: 'Shimano brake pads', pricePence: 2800 })).status, 200);
  assert.equal((await as(owner, `/api/products/${p.id}`, 'PUT', { lowStockThreshold: 2 })).status, 200);
  assert.deepEqual(await changes(owner, p.id), []);
});

test('a size’s price saved on its product with sizes records the change', async () => {
  const made = await as(owner, '/api/product-groups', 'POST', { name: '[Product with sizes]', category: '[Category]', sizes: [{ size: 'M', colour: '[Colour 1]', pricePence: 3000 }] });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const group = (await as(owner, `/api/product-groups/${made.body.id}`)).body;
  const m = group.items[0];
  assert.equal((await as(owner, `/api/product-groups/${made.body.id}`, 'PUT', { sizes: [{ id: m.id, size: 'M', colour: '[Colour 1]', pricePence: 3500 }] })).status, 200);
  assert.deepEqual((await changes(owner, m.id)).map((c) => [c.field, Number(c.was_pence), Number(c.now_pence)]), [['price', 3000, 3500]]);
});

test('the Owner’s page has the changes in its history, newest first; Jo’s has none', async () => {
  const p = await pads();
  assert.equal((await as(owner, `/api/products/${p.id}/stock`, 'POST', { change: 2, type: 'adjustment', reason: 'found', note: '' })).status, 200);
  assert.equal((await as(owner, `/api/products/${p.id}`, 'PUT', { pricePence: 3000 })).status, 200);
  const page = (await as(owner, `/api/products/${p.id}`)).body;
  assert.equal(page.history[0].type, 'price_change', JSON.stringify(page.history));
  assert.deepEqual({ field: page.history[0].field, was: page.history[0].was, now: page.history[0].now, who: page.history[0].who }, { field: 'price', was: 2800, now: 3000, who: 'Jack Lewis' });
  assert.equal(page.history[1].type, 'adjustment');
  const seen = (await as(jo, `/api/products/${p.id}`)).body;
  assert.equal(seen.history.some((h) => h.type === 'price_change'), false, JSON.stringify(seen.history));
  assert.equal(seen.history.length, 1);
});

test('another business never sees or reaches the changes', async () => {
  const p = await pads();
  assert.equal((await as(owner, `/api/products/${p.id}`, 'PUT', { pricePence: 3100 })).status, 200);
  assert.deepEqual(await changes(other, p.id), []);
  assert.equal((await as(other, `/api/products/${p.id}`)).status, 404);
});
