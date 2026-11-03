// A delivery, once it's booked in (openspec/changes/delivery-booked-in, the
// contract; rs-booked, rs-delivery, rs-hub; receiving decisions 4, 9 and 10):
// booking in keeps the delivery, with what it cost then and what was set
// aside. Anyone signed in reads it; only the Owner is sent costs, until roles.

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
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl, { shopName: '[Other shop]' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = await staffFreshCookie(made.body.loginId);
  await runWithShop(owner.shop.id, async () => {
    supplierId = (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run()).lastInsertRowid;
  });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const asOwner = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const asJo = (path, options) => staffRequest(server.baseUrl, jo, path, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const deliver = (as, body) => as('/api/deliveries/receive', { method: 'POST', body });

async function product(cost = 12.5, name = '[Product]') {
  const sku = `[Supplier code]-${randomUUID().slice(0, 6)}`;
  const id = await inShop(async () => (await prepare('INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES (?, ?, ?, 28, ?, 0, now())').run(sku, name, 'Parts', cost)).lastInsertRowid);
  return { id, sku };
}
async function orderedOrder(lines) {
  const made = await asOwner('/api/purchase-orders', { method: 'POST', body: { supplierId, items: lines.map(([productId, qty, unitCost]) => ({ productId, qty, unitCost })) } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const ordered = await asOwner(`/api/purchase-orders/${made.body.id}/mark-ordered`, { method: 'POST', body: {} });
  assert.equal(ordered.status, 200, JSON.stringify(ordered.body));
  return ordered.body;
}
const stockOf = (id) => inShop(async () => (await prepare('SELECT stock_qty FROM products WHERE id = ?').get(id)).stock_qty);
const deliveryCount = () => inShop(async () => (await prepare('SELECT count(*) AS n FROM deliveries').get()).n);

test('booking in keeps the delivery: who, when, its supplier, each line at the order’s cost, what was set aside and what’s still to come', async () => {
  const pads = await product(28, 'Shimano brake pads');
  const thing = await product(12.5);
  const order = await orderedOrder([[pads.id, 4, 19.99]]);
  const res = await deliver(asOwner, {
    supplierId,
    items: [{ productId: pads.id, itemId: order.items[0].id, qty: 2 }, { productId: thing.id, qty: 3 }],
    problems: [{ itemId: order.items[0].id, kind: 'damaged', qty: 1, note: '' }, { productId: thing.id, kind: 'wrong_item', qty: 2, note: '' }],
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(Number.isInteger(res.body.deliveryId), JSON.stringify(res.body));

  const got = await asOwner(`/api/deliveries/booked-in/${res.body.deliveryId}`);
  assert.equal(got.status, 200, JSON.stringify(got.body));
  const d = got.body;
  assert.equal(d.supplierId, supplierId);
  assert.equal(d.supplierName, '[Supplier]');
  assert.equal(d.items, 5);
  assert.equal(d.bookedBy, 'Jack Lewis');
  assert.match(d.bookedInAt, /^\d{4}-\d{2}-\d{2}T/);
  // Lines in booking's order, by product: the order's cost, or the product's when it's not on one.
  assert.deepEqual(d.lines.map((l) => [l.productId, l.name, l.sku, l.qty, l.unitCost, l.lineCost]), [
    [pads.id, 'Shimano brake pads', pads.sku, 2, 19.99, 39.98],
    [thing.id, '[Product]', thing.sku, 3, 12.5, 37.5],
  ]);
  assert.equal(d.bookedCost, 77.48, 'in whole pence, so floating point doesn’t show');
  assert.deepEqual(d.setAside.map((p) => [p.name, p.kind, p.qty, p.cost, p.returned]), [
    ['Shimano brake pads', 'damaged', 1, 19.99, false],
    ['[Product]', 'wrong_item', 2, 25, false],
  ]);
  assert.deepEqual(d.stillToCome.map((o) => [o.orderId, o.supplierName, o.qty, typeof o.orderedAt]), [[order.id, '[Supplier]', 1, 'string']]);
});

test('each line carries its barcode and price, for its labels, for anyone signed in', async () => {
  const thing = await product(12.5);
  await inShop(() => prepare("UPDATE products SET barcode = ? WHERE id = ?").run(`[barcode]-${thing.id}`, thing.id));
  const { body: { deliveryId } } = await deliver(asJo, { supplierId, items: [{ productId: thing.id, qty: 1 }] });
  const { body } = await asJo(`/api/deliveries/booked-in/${deliveryId}`);
  assert.equal(body.lines[0].barcode, `[barcode]-${thing.id}`);
  assert.equal(body.lines[0].price, 28);
});

test('a cost changed later doesn’t change what the delivery cost then', async () => {
  const thing = await product(12.5);
  const { body: { deliveryId } } = await deliver(asOwner, { supplierId, items: [{ productId: thing.id, qty: 1 }] });
  await inShop(() => prepare('UPDATE products SET cost = 99 WHERE id = ?').run(thing.id));
  const { body } = await asOwner(`/api/deliveries/booked-in/${deliveryId}`);
  assert.equal(body.lines[0].unitCost, 12.5);
  assert.equal(body.bookedCost, 12.5);
});

test('anyone else is sent no costs at all, and sees who booked it', async () => {
  const thing = await product(12.5);
  const { body: { deliveryId } } = await deliver(asJo, { supplierId, items: [{ productId: thing.id, qty: 2 }], problems: [{ productId: thing.id, kind: 'damaged', qty: 1, note: '' }] });
  const res = await asJo(`/api/deliveries/booked-in/${deliveryId}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.bookedBy, 'Jo Taylor');
  assert.equal(res.body.lines[0].qty, 2);
  assert.equal(res.body.setAside[0].qty, 1);
  assert.ok(!/cost/i.test(JSON.stringify(res.body)), JSON.stringify(res.body));
  // And the Owner reading Jo's delivery does get them.
  assert.equal((await asOwner(`/api/deliveries/booked-in/${deliveryId}`)).body.bookedCost, 25);
});

test('the old app’s order route keeps a delivery too, from the order’s supplier', async () => {
  const thing = await product(12.5);
  const order = await orderedOrder([[thing.id, 2, 10]]);
  const res = await asOwner(`/api/purchase-orders/${order.id}/receive`, { method: 'POST', body: { items: [{ itemId: order.items[0].id, qtyReceived: 1 }] } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const row = await inShop(() => prepare('SELECT d.supplier_id, l.qty, l.unit_cost, l.purchase_order_id, l.purchase_order_item_id FROM deliveries d JOIN delivery_lines l ON l.delivery_id = d.id WHERE l.product_id = ?').get(thing.id));
  assert.deepEqual(row, { supplier_id: supplierId, qty: 1, unit_cost: 10, purchase_order_id: order.id, purchase_order_item_id: order.items[0].id });
});

test('a refused booking keeps no delivery and adds no stock', async () => {
  const thing = await product();
  const order = await orderedOrder([[thing.id, 1, 10]]);
  const before = await deliveryCount();
  const res = await deliver(asOwner, { supplierId, items: [{ productId: thing.id, itemId: order.items[0].id, qty: 2 }] });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(await deliveryCount(), before);
  assert.equal(await stockOf(thing.id), 0);
});

test('two people book the last one in at once: one delivery, and stock goes up once', async () => {
  const thing = await product();
  const order = await orderedOrder([[thing.id, 1, 10]]);
  const count = await deliveryCount();
  const both = await Promise.all([asOwner, asJo].map((as) => deliver(as, { supplierId, items: [{ productId: thing.id, itemId: order.items[0].id, qty: 1 }] })));
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 400], JSON.stringify(both.map((r) => r.body)));
  assert.equal(await deliveryCount(), count + 1);
  assert.equal(await stockOf(thing.id), 1);
});

test('a booking that only marks items missing keeps no delivery: nothing arrived', async () => {
  const thing = await product();
  const order = await orderedOrder([[thing.id, 2, 10]]);
  const before = await deliveryCount();
  const res = await deliver(asOwner, { supplierId, problems: [{ itemId: order.items[0].id, kind: 'missing', qty: 1, note: '' }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.deliveryId, null);
  assert.equal(await deliveryCount(), before);
});

test('only set-aside items still keep a delivery, of 0 items; Missing beside them isn’t listed as set aside', async () => {
  const thing = await product();
  const order = await orderedOrder([[thing.id, 3, 10]]);
  const { body: { deliveryId } } = await deliver(asOwner, { supplierId, problems: [{ itemId: order.items[0].id, kind: 'damaged', qty: 1, note: '' }, { itemId: order.items[0].id, kind: 'missing', qty: 1, note: '' }] });
  const { body } = await asOwner(`/api/deliveries/booked-in/${deliveryId}`);
  assert.equal(body.items, 0);
  assert.deepEqual(body.lines, []);
  assert.deepEqual(body.setAside.map((p) => p.kind), ['damaged']);
  assert.equal(body.bookedCost, 0);
});

test('an item marked Returned says so on its delivery', async () => {
  const thing = await product();
  const { body: { deliveryId } } = await deliver(asOwner, { supplierId, items: [{ productId: thing.id, qty: 1 }], problems: [{ productId: thing.id, kind: 'damaged', qty: 1, note: '' }] });
  const before = await asOwner(`/api/deliveries/booked-in/${deliveryId}`);
  assert.equal(before.body.setAside[0].returned, false);
  assert.equal((await asOwner(`/api/deliveries/to-return/${before.body.setAside[0].id}/returned`, { method: 'POST', body: {} })).status, 200);
  assert.equal((await asOwner(`/api/deliveries/booked-in/${deliveryId}`)).body.setAside[0].returned, true);
});

test('no supplier picked: the delivery has none, and an order all in has nothing still to come', async () => {
  const thing = await product();
  const { body: { deliveryId } } = await deliver(asOwner, { supplierId: null, items: [{ productId: thing.id, qty: 1 }] });
  const { body } = await asOwner(`/api/deliveries/booked-in/${deliveryId}`);
  assert.equal(body.supplierId, null);
  assert.equal(body.supplierName, null);
  assert.deepEqual(body.stillToCome, []);

  const pads = await product();
  const order = await orderedOrder([[pads.id, 1, 10]]);
  const all = await deliver(asOwner, { supplierId, items: [{ productId: pads.id, itemId: order.items[0].id, qty: 1 }] });
  assert.deepEqual((await asOwner(`/api/deliveries/booked-in/${all.body.deliveryId}`)).body.stillToCome, []);
});

test('Recent deliveries: the newest 10 for anyone signed in, newest first, nothing about cost', async () => {
  const thing = await product();
  const ids = [];
  for (let i = 0; i < 11; i++) ids.push((await deliver(asOwner, { supplierId, items: [{ productId: thing.id, qty: i + 1 }] })).body.deliveryId);
  const res = await asJo('/api/deliveries');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.deliveries.map((d) => d.id), ids.slice(1).reverse());
  const newest = res.body.deliveries[0];
  assert.deepEqual([newest.supplierName, newest.items, newest.bookedBy], ['[Supplier]', 11, 'Jack Lewis']);
  assert.match(newest.bookedInAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(!/cost/i.test(JSON.stringify(res.body)));
});

test('another shop’s delivery, or an id that isn’t one, is not found; signed out is refused', async () => {
  const thing = await product();
  const { body: { deliveryId } } = await deliver(asOwner, { supplierId, items: [{ productId: thing.id, qty: 1 }] });
  assert.equal((await staffRequest(server.baseUrl, other.cookie, `/api/deliveries/booked-in/${deliveryId}`)).status, 404);
  assert.deepEqual((await staffRequest(server.baseUrl, other.cookie, '/api/deliveries')).body, { deliveries: [] });
  assert.equal((await asOwner('/api/deliveries/booked-in/999999999')).status, 404);
  assert.equal((await asOwner('/api/deliveries/booked-in/abc')).status, 404);
  assert.equal((await staffRequest(server.baseUrl, '', '/api/deliveries')).status, 401);
});
