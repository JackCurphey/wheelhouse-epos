// To return to [Supplier], with Returned (openspec/changes/to-return; rs-hub;
// receiving decisions 4, 9 and 10): damaged and wrong items set aside at
// booking in are listed by supplier until Returned. The Owner's, as orders
// are, until roles. Returned changes no stock. The server's clock is pinned
// to 1 Sep 2026.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
const shops = [];
before(async () => {
  server = await startLiveServer();
});
after(async () => {
  for (const s of shops) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
});

const call = (cookie, path, options) => staffRequest(server.baseUrl, cookie, path, options);
const post = (cookie, path, body = {}) => call(cookie, path, { method: 'POST', body });

async function shop() {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  const made = await post(owner.cookie, '/api/team', { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  owner.jo = { cookie: await staffFreshCookie(made.body.loginId) };
  owner.in = (fn) => runWithShop(owner.shop.id, fn);
  await owner.in(async () => {
    owner.supplier = (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run()).lastInsertRowid;
    owner.supplier2 = (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier 2]', 'mock_csv', '{}', now())").run()).lastInsertRowid;
  });
  return owner;
}
const product = (owner, name) => owner.in(async () => (await prepare('INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES (?, ?, ?, 28, 28, 0, now())')
  .run(`[Supplier code]-${randomUUID().slice(0, 6)}`, name, 'Parts')).lastInsertRowid);
async function orderedOrder(owner, productId, qty) {
  const made = await post(owner.cookie, '/api/purchase-orders', { supplierId: owner.supplier, items: [{ productId, qty, unitCost: 28 }] });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  return (await post(owner.cookie, `/api/purchase-orders/${made.body.id}/mark-ordered`)).body;
}
const deliver = async (cookie, body) => {
  const res = await post(cookie, '/api/deliveries/receive', body);
  assert.equal(res.status, 200, JSON.stringify(res.body));
};
const toReturn = (cookie) => call(cookie, '/api/deliveries/to-return');
const strip = (list) => list.suppliers.map((s) => ({ ...s, items: s.items.map(({ id, deliveredAt, ...rest }) => (assert.ok(Number.isInteger(id) && !Number.isNaN(Date.parse(deliveredAt))), rest)) }));

test('damaged and wrong items not yet returned, by supplier, the Owner\'s only; missing ones are still to come', async () => {
  const owner = await shop();
  assert.deepEqual((await toReturn(owner.cookie)).body, { suppliers: [] });
  const pads = await product(owner, 'Shimano brake pads');
  const thing = await product(owner, '[Product]');
  const other = await product(owner, '[Product 2]');
  const order = await orderedOrder(owner, pads, 4);
  // On the order: 1 damaged, 1 missing, 2 booked in.
  await deliver(owner.jo.cookie, { supplierId: owner.supplier, items: [{ productId: pads, itemId: order.items[0].id, qty: 2 }],
    problems: [{ itemId: order.items[0].id, kind: 'damaged', qty: 1 }, { itemId: order.items[0].id, kind: 'missing', qty: 1 }] });
  // Not on an order: a wrong item from [Supplier 2], and one with no supplier picked.
  await deliver(owner.jo.cookie, { supplierId: owner.supplier2, items: [], problems: [{ productId: thing, kind: 'wrong_item', qty: 2 }] });
  await deliver(owner.jo.cookie, { items: [], problems: [{ productId: other, kind: 'damaged', qty: 1 }] });
  const refused = await toReturn(owner.jo.cookie);
  assert.deepEqual([refused.status, refused.body.code], [403, 'owner_only']);
  const list = (await toReturn(owner.cookie)).body;
  assert.deepEqual(strip(list), [
    { supplierId: owner.supplier, supplierName: '[Supplier]', items: [{ productName: 'Shimano brake pads', kind: 'damaged', qty: 1 }] },
    { supplierId: owner.supplier2, supplierName: '[Supplier 2]', items: [{ productName: '[Product]', kind: 'wrong_item', qty: 2 }] },
    { supplierId: null, supplierName: null, items: [{ productName: '[Product 2]', kind: 'damaged', qty: 1 }] },
  ]);
  // Another shop sees none of them.
  const elsewhere = await shop();
  assert.deepEqual((await toReturn(elsewhere.cookie)).body, { suppliers: [] });
});

test('Returned: who and when, no stock change, off the list; once only, and not for a missing item or another shop\'s', async () => {
  const owner = await shop();
  const pads = await product(owner, 'Shimano brake pads');
  const order = await orderedOrder(owner, pads, 3);
  await deliver(owner.cookie, { supplierId: owner.supplier, items: [{ productId: pads, itemId: order.items[0].id, qty: 1 }],
    problems: [{ itemId: order.items[0].id, kind: 'damaged', qty: 1 }, { itemId: order.items[0].id, kind: 'missing', qty: 1 }] });
  const [item] = (await toReturn(owner.cookie)).body.suppliers[0].items;
  const missing = await owner.in(() => prepare("SELECT id FROM delivery_problems WHERE kind = 'missing'").get());
  const stock = async () => (await owner.in(() => prepare('SELECT stock_qty FROM products WHERE id = ?').get(pads))).stock_qty;
  assert.equal(await stock(), 1);
  const jo = await post(owner.jo.cookie, `/api/deliveries/to-return/${item.id}/returned`);
  assert.deepEqual([jo.status, jo.body.code], [403, 'owner_only']);
  assert.equal((await post(owner.cookie, `/api/deliveries/to-return/${missing.id}/returned`)).status, 404, 'a missing item is never returned');
  const other = await shop();
  assert.equal((await post(other.cookie, `/api/deliveries/to-return/${item.id}/returned`)).status, 404, 'another shop\'s');
  // Two presses at once: one marks it, the other is refused.
  const both = await Promise.all([1, 2].map(() => post(owner.cookie, `/api/deliveries/to-return/${item.id}/returned`)));
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 404]);
  const done = both.find((r) => r.status === 200).body;
  assert.equal(done.id, item.id);
  assert.ok(!Number.isNaN(Date.parse(done.returnedAt)));
  const row = await owner.in(() => prepare('SELECT returned_at, returned_by_login_id FROM delivery_problems WHERE id = ?').get(item.id));
  assert.equal(row.returned_by_login_id, owner.loginId);
  assert.ok(row.returned_at);
  assert.equal(await stock(), 1, 'no stock change');
  assert.deepEqual((await toReturn(owner.cookie)).body, { suppliers: [] });
  assert.equal((await post(owner.cookie, '/api/deliveries/to-return/nope/returned')).status, 404);
});
