// A product with sizes' page (openspec/changes/product-page-sizes, design 3; st-product-sizes;
// stock control decision 4): GET /api/product-groups/:id gains its stock at each shop, one
// history for all its sizes saying each line's size and colour, and its price changes for the
// Owner only. Jack Lewis and Jo Taylor as drawn; the rest placeholders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let jo;
let group;
before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  const res = await as(owner, '/api/product-groups', 'POST', { name: '[Product with sizes]', category: '[Category]', sizes: [
    { size: 'M', colour: '[Colour 1]', pricePence: 3000, stockQty: 2 },
    { size: 'L', colour: '[Colour 1]', pricePence: 3000, stockQty: 3 },
  ] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  group = (await as(owner, `/api/product-groups/${res.body.id}`)).body;
  const m = group.items.find((i) => i.size === 'M');
  assert.equal((await as(owner, `/api/product-groups/${group.id}`, 'PUT', { sizes: [{ id: m.id, size: 'M', colour: '[Colour 1]', pricePence: 3500 }] })).status, 200);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});
function as(who, path, method = 'GET', body) {
  return staffRequest(server.baseUrl, who.cookie, path, { method, body });
}

test('its stock at each shop is its sizes’ total', async () => {
  const page = (await as(owner, `/api/product-groups/${group.id}`)).body;
  assert.equal(page.stockAtShops.length, 1);
  assert.equal(page.stockAtShops[0].qty, 5);
  assert.equal(page.stockAtShops[0].here, true);
});

test('one history for all its sizes, each line with its size and colour, the price change for the Owner', async () => {
  const page = (await as(owner, `/api/product-groups/${group.id}`)).body;
  const stock = page.history.filter((h) => h.type === 'intake');
  assert.deepEqual(stock.map((h) => [h.size, h.colour, h.change]).sort(), [['L', '[Colour 1]', 3], ['M', '[Colour 1]', 2]]);
  const price = page.history.find((h) => h.type === 'price_change');
  assert.deepEqual([price.size, price.was, price.now, price.who], ['M', 3000, 3500, 'Jack Lewis']);
  assert.equal(page.history[0].type, 'price_change', 'newest first');
});

test('Jo is sent no price change and no cost', async () => {
  const page = (await as(jo, `/api/product-groups/${group.id}`)).body;
  assert.equal(page.history.some((h) => h.type === 'price_change'), false);
  assert.equal(page.history.length, 2);
  assert.ok(page.items.every((i) => i.costPence === null));
});
