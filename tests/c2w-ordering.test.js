// Ordering a Cycle to Work bike from the supplier, and booking it in
// (openspec/changes/cycle-to-work, tasks 6.3–6.4; drawings cw-list, cw-ordered,
// cw-order-anyway, cw-order-on-order in docs/design/user-journeys/generator/c2w.mjs
// and rs-receive-c2w, rs-frame-c2w, rs-booked-c2w in receiving.mjs). The drawings
// leave names, amounts and frame numbers bracketed, so the values here are made-up
// test values.
//
// The server clock is pinned to 1 Sep 2026 (WHEELHOUSE_TEST_CLOCK).
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let jo;
let provider;
let maya;
let site;
let supplierId;
const own = (p, options) => staffRequest(server.baseUrl, owner.cookie, p, options);
const asJo = (p, options) => staffRequest(server.baseUrl, jo, p, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const tag = () => randomUUID().slice(0, 8);

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const made = await own('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${tag()}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = await staffFreshCookie(made.body.loginId);
  const set = await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 7, remindDays: 2, quoteValidDays: 30 } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  provider = (await own('/api/c2w/providers', { method: 'POST', body: { name: '[Provider]' } })).body.provider;
  maya = (await own('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: `maya-${tag()}@example.test` } })).body;
  await inShop(async () => {
    site = (await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get()).id;
    supplierId = (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run()).lastInsertRowid;
    const top = (await prepare("INSERT INTO product_categories (name, path, bike_kind) VALUES ('Bikes', 'Bikes', 'bikes') RETURNING id").get()).id;
    await prepare("INSERT INTO product_categories (parent_id, name, path) VALUES (?, 'Road bikes', 'Bikes › Road bikes')").run(top);
  });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

// A £1,000 bike with frame numbers and none in stock, from [Supplier] as typed on the
// product (restock matches a product's supplier to Settings' suppliers by name).
const bike = (supplier = ' [supplier] ') => inShop(async () => (await prepare(
  "INSERT INTO products (sku, name, category, supplier, price, cost, stock_qty, updated_at) VALUES (?, '[Bike] · [Size]', 'Bikes › Road bikes', ?, 1000, 600, 0, now())"
).run(`[Supplier code]-${tag()}`, supplier)).lastInsertRowid);
const rule = async (orderRule) => {
  const res = await own('/api/c2w/settings', { method: 'PUT', body: { orderRule } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
};
const quote = async (productId) => {
  const res = await own('/api/c2w/orders', { method: 'POST', body: { customerId: maya.id, providerId: provider.id, productId, accessoryIds: [] } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.order;
};
const post = (p, body, as = own) => as(p, { method: 'POST', body });
const order = async (id) => (await own(`/api/c2w/orders/${id}`)).body.order;
const applied = (id) => post(`/api/c2w/orders/${id}/applied`, {});
const certify = (id) => post(`/api/c2w/orders/${id}/certificate`, { number: '[certificate number]', amountPence: 100000 });
const orderBike = (id, body = {}, as = own) => post(`/api/c2w/orders/${id}/order`, body, as);
const nextOf = async (id) => {
  const { groups } = (await own('/api/c2w/orders')).body;
  return Object.values(groups).flat().find((o) => o.id === id)?.next;
};
// A supplier of the test's own, so its drafts hold only what the test puts on them.
const ownSupplier = () => inShop(async () => {
  const name = `[Supplier ${tag()}]`;
  const id = (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES (?, 'mock_csv', '{}', now())").run(name)).lastInsertRowid;
  return { id, name };
});
const poRow = (poId) => inShop(() => prepare('SELECT id, status FROM purchase_orders WHERE id = ?').get(poId));
const linesFor = (c2wId) => inShop(() => prepare(
  `SELECT i.id, i.purchase_order_id, i.product_id, i.qty_ordered, i.c2w_order_id, po.status, po.supplier_id
   FROM purchase_order_items i JOIN purchase_orders po ON po.id = i.purchase_order_id WHERE i.c2w_order_id = ? ORDER BY i.id`
).all(c2wId));

// ---------- 6.3 ----------

test('6.3 with "Once the certificate arrives", a bike not in stock is ordered only once the certificate is in', async () => {
  await rule('certificate');
  const made = await quote(await bike());
  assert.equal(made.inStock, false);
  assert.equal((await applied(made.id)).status, 200);
  assert.equal(await nextOf(made.id), 'certificate');
  const early = await orderBike(made.id);
  assert.equal(early.status, 409, JSON.stringify(early.body));
  assert.equal(early.body.code, 'not_time_to_order');
  assert.deepEqual(await linesFor(made.id), []);

  assert.equal((await certify(made.id)).status, 200);
  assert.equal(await nextOf(made.id), 'order');
  const res = await orderBike(made.id);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.supplier, '[Supplier]');
  const [line, ...more] = await linesFor(made.id);
  assert.deepEqual(more, []);
  assert.deepEqual([line.product_id, line.qty_ordered, line.status, line.supplier_id], [made.productId, 1, 'draft', supplierId]);
  assert.equal(res.body.purchaseOrderId, line.purchase_order_id);
  const o = res.body.order;
  assert.deepEqual([o.onOrder, o.orderedFrom, o.purchaseOrderId, o.stage], [true, '[Supplier]', line.purchase_order_id, 'certificate']);
  assert.notEqual(await nextOf(made.id), 'order');
  const last = (await order(made.id)).events.at(-1);
  assert.equal(last.kind, 'ordered');
  assert.deepEqual([last.detail.supplier, last.detail.purchaseOrderId, last.reason], ['[Supplier]', line.purchase_order_id, null]);
});

test('6.3 with "Once the customer has applied", ordering opens at Applied, and anyone checked in can order', async () => {
  await rule('applied');
  const made = await quote(await bike());
  assert.equal((await orderBike(made.id, {}, asJo)).status, 409, 'not before Applied');
  assert.equal((await applied(made.id)).status, 200);
  assert.equal(await nextOf(made.id), 'order');
  const res = await orderBike(made.id, {}, asJo);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await linesFor(made.id)).length, 1);
});

test('6.3 a bike is ordered once: a second order is refused', async () => {
  await rule('applied');
  const made = await quote(await bike());
  await applied(made.id);
  assert.equal((await orderBike(made.id)).status, 200);
  const again = await orderBike(made.id);
  assert.equal(again.status, 409, JSON.stringify(again.body));
  const anyway = await orderBike(made.id, { anyway: true, reason: '[reason]' });
  assert.equal(anyway.status, 409, JSON.stringify(anyway.body));
  assert.equal(anyway.body.code, 'already_ordered');
  assert.equal((await linesFor(made.id)).length, 1);
});

test('6.3 two orders for the same bike go on the supplier’s one draft as two lines, each naming its order', async () => {
  await rule('applied');
  const product = await bike();
  const a = await quote(product);
  const b = await quote(product);
  for (const o of [a, b]) {
    await applied(o.id);
    assert.equal((await orderBike(o.id)).status, 200);
  }
  const [la] = await linesFor(a.id);
  const [lb] = await linesFor(b.id);
  assert.equal(la.purchase_order_id, lb.purchase_order_id);
  assert.notEqual(la.id, lb.id);
});

test('6.3 Undo takes the line off the draft and the order offers ordering again', async () => {
  await rule('applied');
  const made = await quote(await bike());
  await applied(made.id);
  assert.equal((await orderBike(made.id)).status, 200);
  const res = await post(`/api/c2w/orders/${made.id}/order/undo`, {});
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(await linesFor(made.id), []);
  assert.equal(res.body.order.onOrder, false);
  assert.equal(await nextOf(made.id), 'order');
  assert.equal((await order(made.id)).events.at(-1).kind, 'order_undone');
  assert.equal((await post(`/api/c2w/orders/${made.id}/order/undo`, {})).status, 409, 'nothing left to undo');
});

test('6.3 Undo is refused once the supplier order has been sent', async () => {
  await rule('applied');
  const made = await quote(await bike());
  await applied(made.id);
  const ordered = await orderBike(made.id);
  assert.equal((await post(`/api/purchase-orders/${ordered.body.purchaseOrderId}/mark-ordered`, {})).status, 200);
  const res = await post(`/api/c2w/orders/${made.id}/order/undo`, {});
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal((await linesFor(made.id)).length, 1);
});

test('6.3 "Order now anyway…" is refused without a reason, Owner only, and logged with its reason', async () => {
  await rule('certificate');
  const made = await quote(await bike());
  const blank = await orderBike(made.id, { anyway: true, reason: '   ' });
  assert.equal(blank.status, 400, JSON.stringify(blank.body));
  const staff = await orderBike(made.id, { anyway: true, reason: '[reason]' }, asJo);
  assert.equal(staff.status, 403, JSON.stringify(staff.body));
  assert.deepEqual(await linesFor(made.id), []);
  const res = await orderBike(made.id, { anyway: true, reason: '[reason]' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await linesFor(made.id)).length, 1);
  const last = (await order(made.id)).events.at(-1);
  assert.deepEqual([last.kind, last.reason, last.detail.anyway, last.by], ['ordered', '[reason]', true, 'Jack Lewis']);
});

test('6.3 a bike in stock, or one with no supplier, is not ordered', async () => {
  await rule('applied');
  const noSupplier = await quote(await bike('[Somewhere else]'));
  await applied(noSupplier.id);
  const res = await orderBike(noSupplier.id);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'no_supplier');

  const product = await bike();
  await inShop(async () => {
    await prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, 1) RETURNING product_id').get(site, product);
    await prepare("INSERT INTO stock_frames (product_id, site_id, frame_number, frame_key) VALUES (?, ?, '[FRAME-A]', ?) RETURNING id").get(product, site, `[frame-a-${tag()}]`);
  });
  const held = await quote(product);
  assert.equal(held.held, true);
  await applied(held.id);
  const refused = await orderBike(held.id, { anyway: true, reason: '[reason]' });
  assert.equal(refused.status, 409, JSON.stringify(refused.body));
  assert.equal(refused.body.code, 'has_bike');
  assert.deepEqual(await linesFor(held.id), []);
});

test('6.3 editing the draft keeps the line’s order, and restock adds its own line beside it', async () => {
  await rule('applied');
  const product = await bike();
  const made = await quote(product);
  await applied(made.id);
  const poId = (await orderBike(made.id)).body.purchaseOrderId;
  const restock = await post('/api/restock/add-to-order', { supplierId, lines: [{ productId: product, qty: 2 }] });
  assert.equal(restock.status, 200, JSON.stringify(restock.body));
  const lines = await inShop(() => prepare('SELECT qty_ordered, c2w_order_id FROM purchase_order_items WHERE purchase_order_id = ? AND product_id = ? ORDER BY id').all(poId, product));
  assert.deepEqual(lines.map((l) => [l.qty_ordered, l.c2w_order_id]), [[1, made.id], [2, null]]);

  const edit = await own(`/api/purchase-orders/${poId}`, { method: 'PUT', body: { notes: '[note]', items: [{ productId: product, qty: 1, unitCost: 600 }, { productId: product, qty: 3, unitCost: 600 }] } });
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  assert.equal((await linesFor(made.id)).length, 1, 'the edit kept the line for the order');
  assert.equal((await order(made.id)).onOrder, true);
});

test('6.3 an edit that names a line’s job leaves the order on the line that doesn’t', async () => {
  await rule('applied');
  const product = await bike();
  const made = await quote(product);
  await applied(made.id);
  const poId = (await orderBike(made.id)).body.purchaseOrderId;
  const edit = await own(`/api/purchase-orders/${poId}`, { method: 'PUT', body: { items: [{ productId: product, qty: 2, unitCost: 600, forJobId: null }, { productId: product, qty: 1, unitCost: 600 }] } });
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  assert.deepEqual((await linesFor(made.id)).map((l) => l.qty_ordered), [1]);
});

test('6.3 Undo on a line edited up to more than one takes off only the order’s bike', async () => {
  await rule('applied');
  const product = await bike();
  const made = await quote(product);
  await applied(made.id);
  const poId = (await orderBike(made.id)).body.purchaseOrderId;
  const edit = await own(`/api/purchase-orders/${poId}`, { method: 'PUT', body: { items: [{ productId: product, qty: 3, unitCost: 600 }] } });
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  const res = await post(`/api/c2w/orders/${made.id}/order/undo`, {});
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.order.onOrder, false);
  const left = await inShop(() => prepare('SELECT qty_ordered, c2w_order_id FROM purchase_order_items WHERE purchase_order_id = ? AND product_id = ?').all(poId, product));
  assert.deepEqual(left.map((l) => [l.qty_ordered, l.c2w_order_id]), [[2, null]]);
});

test('6.3 Undo takes away the draft it leaves empty, and keeps one with other lines on it', async () => {
  await rule('applied');
  const sup = await ownSupplier();
  const alone = await quote(await bike(sup.name));
  await applied(alone.id);
  const emptied = (await orderBike(alone.id)).body.purchaseOrderId;
  assert.equal((await post(`/api/c2w/orders/${alone.id}/order/undo`, {})).status, 200);
  assert.ok(!(await poRow(emptied)), 'the draft left empty went');

  const product = await bike(sup.name);
  const kept = await quote(product);
  await applied(kept.id);
  const poId = (await orderBike(kept.id)).body.purchaseOrderId;
  assert.equal((await post('/api/restock/add-to-order', { supplierId: sup.id, lines: [{ productId: product, qty: 2 }] })).status, 200);
  assert.equal((await post(`/api/c2w/orders/${kept.id}/order/undo`, {})).status, 200);
  assert.equal((await poRow(poId))?.status, 'draft', 'the draft with the restock line stays');
  const left = await inShop(() => prepare('SELECT qty_ordered, c2w_order_id FROM purchase_order_items WHERE purchase_order_id = ?').all(poId));
  assert.deepEqual(left.map((l) => [l.qty_ordered, l.c2w_order_id]), [[2, null]]);
});

test('6.3 a supplier order cancelled leaves the bike not on order, to be ordered again', async () => {
  await rule('applied');
  const sup = await ownSupplier();
  const made = await quote(await bike(sup.name));
  await applied(made.id);
  const poId = (await orderBike(made.id)).body.purchaseOrderId;
  assert.equal((await order(made.id)).orderedFrom, sup.name);
  assert.equal((await post(`/api/purchase-orders/${poId}/cancel`, {})).status, 200);
  const o = await order(made.id);
  assert.deepEqual([o.onOrder, o.purchaseOrderId, o.orderedFrom], [false, null, null]);
  assert.equal(await nextOf(made.id), 'order');
  const undo = await post(`/api/c2w/orders/${made.id}/order/undo`, {});
  assert.deepEqual([undo.status, undo.body.code], [409, 'not_on_order'], 'nothing on order to undo');
  const again = await orderBike(made.id);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.notEqual(again.body.purchaseOrderId, poId);
});

test('6.3 Restock doesn’t count a customer’s bike on order as stock coming', async () => {
  await rule('applied');
  const product = await bike();
  await inShop(() => prepare('UPDATE products SET low_stock_threshold = 1 WHERE id = ?').run(product));
  const made = await quote(product);
  await applied(made.id);
  assert.equal((await orderBike(made.id)).status, 200);
  const res = await own('/api/restock');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.groups.flatMap((g) => g.lines).some((l) => l.productId === product), 'the bike is still running low');
});

// ---------- 6.4 ----------

// Sends the draft to the supplier and books the bike in with its frame number.
async function bookIn(c2wId, frame) {
  const [line] = await linesFor(c2wId);
  assert.equal((await post(`/api/purchase-orders/${line.purchase_order_id}/mark-ordered`, {})).status, 200);
  const res = await post('/api/deliveries/receive', { supplierId, items: [{ itemId: line.id, qty: 1, frames: [frame] }] }, asJo);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return inShop(() => prepare('SELECT id, state, c2w_order_id FROM stock_frames WHERE frame_number = ?').get(frame));
}

test('6.4 booking the bike in with the certificate in holds its frame for the order and moves it to Ready to collect', async () => {
  await rule('certificate');
  const made = await quote(await bike());
  await applied(made.id);
  await certify(made.id);
  assert.equal((await orderBike(made.id)).status, 200);
  const frame = await bookIn(made.id, `[FRAME-${tag()}]`);
  assert.deepEqual([frame.state, frame.c2w_order_id], ['held', made.id]);
  const o = await order(made.id);
  assert.deepEqual([o.stage, o.frameId, o.held, o.inStock], ['ready', frame.id, true, true]);
  const last = o.events.at(-1);
  assert.deepEqual([last.kind, last.detail.frameId, last.detail.ready, last.by], ['booked_in', frame.id, true, 'Jo Taylor']);
});

test('6.4 booking the bike in before the certificate holds its frame and leaves the order where it is', async () => {
  await rule('applied');
  const made = await quote(await bike());
  await applied(made.id);
  assert.equal((await orderBike(made.id)).status, 200);
  const frame = await bookIn(made.id, `[FRAME-${tag()}]`);
  assert.deepEqual([frame.state, frame.c2w_order_id], ['held', made.id]);
  const o = await order(made.id);
  assert.deepEqual([o.stage, o.frameId, o.held], ['waiting', frame.id, true]);
  assert.equal(o.events.at(-1).detail.ready, undefined);
});

test('6.4 a bike booked in for an order that has since got its bike goes on sale like any other', async () => {
  await rule('applied');
  const product = await bike();
  const made = await quote(product);
  await applied(made.id);
  assert.equal((await orderBike(made.id)).status, 200);
  // Another bike of the same kind came in and was put aside first.
  await inShop(async () => {
    const other = (await prepare("INSERT INTO stock_frames (product_id, site_id, frame_number, frame_key, state, c2w_order_id) VALUES (?, ?, '[FRAME-B]', ?, 'held', ?) RETURNING id").get(product, site, `[frame-b-${tag()}]`, made.id)).id;
    await prepare('UPDATE c2w_orders SET frame_id = ?, held_at = now() WHERE id = ?').run(other, made.id);
  });
  const frame = await bookIn(made.id, `[FRAME-${tag()}]`);
  assert.deepEqual([frame.state, frame.c2w_order_id], ['in_stock', null]);
});

test('6.4 a bike booked in at another shop from the order’s goes on sale there', async () => {
  await rule('applied');
  const made = await quote(await bike());
  await applied(made.id);
  assert.equal((await orderBike(made.id)).status, 200);
  await inShop(async () => {
    const elsewhere = (await prepare("INSERT INTO sites (name, code) VALUES ('Bolton', 'B') RETURNING id").get()).id;
    await prepare('UPDATE c2w_orders SET site_id = ? WHERE id = ?').run(elsewhere, made.id);
  });
  const frame = await bookIn(made.id, `[FRAME-${tag()}]`);
  assert.deepEqual([frame.state, frame.c2w_order_id], ['in_stock', null]);
  const o = await order(made.id);
  assert.deepEqual([o.stage, o.held], ['waiting', false]);
});

test('6.4 booking the bike in with no frame number holds one for the order as a count', async () => {
  await rule('applied');
  const made = await quote(await bike());
  await applied(made.id);
  assert.equal((await orderBike(made.id)).status, 200);
  const [line] = await linesFor(made.id);
  assert.equal((await post(`/api/purchase-orders/${line.purchase_order_id}/mark-ordered`, {})).status, 200);
  const res = await post(`/api/purchase-orders/${line.purchase_order_id}/receive`, { items: [{ itemId: line.id, qtyReceived: 1 }] }, asJo);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const o = await order(made.id);
  assert.deepEqual([o.stage, o.held, o.frameId, o.onOrder], ['waiting', true, null, false]);
  assert.equal(o.events.at(-1).kind, 'booked_in');
});
