// Cost went up? Change it (openspec/changes/product-page-sizes, design 5; receiving's 3 Oct
// later change, walk-through 3 M3): on a booked-in delivery the Owner changes a line's cost;
// the line, the product's cost and its history change together. Jack Lewis, Jo Taylor and
// Shimano brake pads B05S-RX as drawn; the rest placeholders.
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
let supplierId;
before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl, { shopName: '[Other shop]', ownerName: '[Other owner]' });
  const made = await as(owner, '/api/team', 'POST', { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  supplierId = await runWithShop(owner.shop.id, async () => (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run()).lastInsertRowid);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});
function as(who, path, method = 'GET', body) {
  return staffRequest(server.baseUrl, who.cookie, path, { method, body });
}
// A delivery of 2 brake pads at £14.00 each, booked in without an order.
async function delivery() {
  const pads = (await as(owner, '/api/products', 'POST', { name: 'Shimano brake pads', sku: `B05S-RX-${randomUUID().slice(0, 4)}`, category: '[Category]', pricePence: 2800, costPence: 1400 })).body;
  const res = await as(owner, '/api/deliveries/receive', 'POST', { supplierId, items: [{ productId: pads.id, qty: 2 }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const d = (await as(owner, `/api/deliveries/booked-in/${res.body.deliveryId}`)).body;
  return { pads, d, line: d.lines[0] };
}
const cost = (d, line, who, body) => as(who, `/api/deliveries/booked-in/${d.id}/lines/${line.id}/cost`, 'PUT', body);

test('the Owner’s new cost moves the line, the product’s cost and its history together', async () => {
  const { pads, d, line } = await delivery();
  const res = await cost(d, line, owner, { costPence: 1550 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const after = (await as(owner, `/api/deliveries/booked-in/${d.id}`)).body;
  assert.equal(Number(after.lines[0].unitCost), 15.5);
  assert.equal(Number(after.bookedCost), 31);
  const page = (await as(owner, `/api/products/${pads.id}`)).body;
  assert.equal(page.costPence, 1550);
  const change = page.history.find((h) => h.type === 'price_change');
  assert.deepEqual([change.field, change.was, change.now, change.who, change.delivery], ['cost', 1400, 1550, 'Jack Lewis', { id: d.id, supplierName: '[Supplier]' }]);
});

test('the same cost changes nothing', async () => {
  const { pads, d, line } = await delivery();
  assert.equal((await cost(d, line, owner, { costPence: 1400 })).status, 200);
  assert.equal((await as(owner, `/api/products/${pads.id}`)).body.history.some((h) => h.type === 'price_change'), false);
});

test('a cost that isn’t whole pence is refused, saying so', async () => {
  const { d, line } = await delivery();
  for (const costPence of [-1, 1.5, 'abc', null]) {
    const res = await cost(d, line, owner, { costPence });
    assert.equal(res.status, 400, `${costPence}: ${JSON.stringify(res.body)}`);
    assert.match(res.body.error, /whole number of pence/);
  }
});

test('Jo is refused and nothing changes', async () => {
  const { pads, d, line } = await delivery();
  const res = await cost(d, line, jo, { costPence: 1550 });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'Only the shop’s owner can add or change products');
  assert.equal((await as(owner, `/api/products/${pads.id}`)).body.costPence, 1400);
});

test('a line of another delivery, one that isn’t there, or another business’s, isn’t found', async () => {
  const a = await delivery();
  const b = await delivery();
  assert.equal((await cost(a.d, b.line, owner, { costPence: 1550 })).status, 404);
  assert.equal((await cost(a.d, { id: 2147483647 }, owner, { costPence: 1550 })).status, 404);
  assert.equal((await cost(a.d, a.line, other, { costPence: 1550 })).status, 404);
  assert.equal((await as(owner, `/api/products/${a.pads.id}`)).body.costPence, 1400);
});
