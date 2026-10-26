// Receiving a delivery with or without an order (openspec/changes/
// receive-without-order, the contract; rs-receive, rs-problem; receiving
// decisions 2, 3, 4 and 9): POST /api/deliveries/receive books order lines
// and lines not on an order in one go. Receiving raises stock_qty, so it is
// atomic, in product order, and records who did it. The concurrent tests fire
// their requests together with Promise.all, as
// tests/purchase-orders-receive.test.js does.
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
let jo;
let supplierId;
let supplier2Id;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId), loginId: made.body.loginId };
  await runWithShop(owner.shop.id, async () => {
    supplierId = (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run()).lastInsertRowid;
    supplier2Id = (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier 2]', 'mock_csv', '{}', now())").run()).lastInsertRowid;
  });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const asOwner = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const asJo = (path, options) => staffRequest(server.baseUrl, jo.cookie, path, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);

// The drawing's pads (B05S-RX, £28.00); other products stay placeholders.
async function product(name = '[Product]', stockQty = 0) {
  const sku = `${name === 'Shimano brake pads' ? 'B05S-RX' : '[Supplier code]'}-${randomUUID().slice(0, 6)}`;
  return inShop(async () => (await prepare('INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES (?, ?, ?, 28, 28, ?, now())').run(sku, name, 'Parts', stockQty)).lastInsertRowid);
}
async function orderedOrder(lines, from = supplierId) {
  const made = await asOwner('/api/purchase-orders', { method: 'POST', body: { supplierId: from, items: lines.map(([productId, qty]) => ({ productId, qty, unitCost: 28 })) } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const ordered = await asOwner(`/api/purchase-orders/${made.body.id}/mark-ordered`, { method: 'POST', body: {} });
  assert.equal(ordered.status, 200, JSON.stringify(ordered.body));
  return ordered.body;
}
const stockOf = (id) => inShop(async () => (await prepare('SELECT stock_qty FROM products WHERE id = ?').get(id)).stock_qty);
const movesOf = (id) => inShop(() => prepare('SELECT change_qty, type, note, login_id, purchase_order_id FROM stock_movements WHERE product_id = ? ORDER BY id').all(id));
const problemsFor = (productId) => inShop(() => prepare('SELECT purchase_order_id, purchase_order_item_id, supplier_id, kind, qty, note FROM delivery_problems WHERE product_id = ? ORDER BY id').all(productId));
const deliver = (as, body) => as('/api/deliveries/receive', { method: 'POST', body });

test('a staff member books a delivery in with no order: stock goes up and the history says who, from which supplier', async () => {
  const thing = await product('[Product]', 1);
  const res = await deliver(asJo, { supplierId, items: [{ productId: thing, qty: 2 }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.booked, 2);
  assert.deepEqual(res.body.orders, []);
  assert.equal(await stockOf(thing), 3);
  assert.deepEqual(await movesOf(thing), [
    { change_qty: 2, type: 'intake', note: 'Delivery from [Supplier], not on an order', login_id: jo.loginId, purchase_order_id: null },
  ]);
});

test('no supplier picked: still booked in', async () => {
  const thing = await product();
  const res = await deliver(asJo, { supplierId: null, items: [{ productId: thing, qty: 1 }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(await stockOf(thing), 1);
  assert.equal((await movesOf(thing))[0].note, 'Delivery, not on an order');
});

test('one delivery, part on an order and part not: one booking adds both, and the order moves on', async () => {
  const pads = await product('Shimano brake pads');
  const extra = await product();
  const o = await orderedOrder([[pads, 2]]);
  const res = await deliver(asJo, { supplierId, items: [{ productId: pads, itemId: o.items[0].id, qty: 1 }, { productId: extra, qty: 3 }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.booked, 4);
  assert.equal(res.body.orders.length, 1);
  assert.equal(res.body.orders[0].id, o.id);
  assert.equal(res.body.orders[0].status, 'partially_received');
  assert.equal(res.body.orders[0].items[0].qtyReceived, 1);
  assert.equal(await stockOf(pads), 1);
  assert.equal(await stockOf(extra), 3);
  const [padsMove] = await movesOf(pads);
  assert.equal(padsMove.type, 'po_receipt');
  assert.equal(padsMove.purchase_order_id, o.id);
  assert.equal(padsMove.login_id, jo.loginId, 'who booked the order line in');
});

test('damaged and wrong items not on an order are recorded with the supplier and not added to stock', async () => {
  const thing = await product();
  const res = await deliver(asJo, {
    supplierId,
    items: [{ productId: thing, qty: 1 }],
    problems: [
      { productId: thing, kind: 'damaged', qty: 1, note: '  box crushed  ' },
      { productId: thing, kind: 'wrong_item', qty: 1 },
    ],
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(await stockOf(thing), 1);
  assert.deepEqual((await problemsFor(thing)).map((p) => [p.purchase_order_id, p.purchase_order_item_id, p.supplier_id, p.kind, p.qty, p.note]), [
    [null, null, supplierId, 'damaged', 1, 'box crushed'],
    [null, null, supplierId, 'wrong_item', 1, ''],
  ]);
});

test('a problem on an order line is recorded against the order, with the supplier', async () => {
  const thing = await product();
  const o = await orderedOrder([[thing, 3]]);
  const res = await deliver(asJo, { supplierId, items: [{ productId: thing, itemId: o.items[0].id, qty: 1 }], problems: [{ itemId: o.items[0].id, kind: 'missing', qty: 1 }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual((await problemsFor(thing)).map((p) => [p.purchase_order_id, p.purchase_order_item_id, p.supplier_id, p.kind]), [[o.id, o.items[0].id, supplierId, 'missing']]);
  assert.equal(res.body.orders[0].items[0].outstanding, 2);
});

test('refused, changing nothing: Missing with no order, an unknown or inactive product, an unknown supplier, another supplier’s order, too many, nothing at all', async () => {
  const thing = await product();
  const gone = await product();
  await inShop(() => prepare('UPDATE products SET active = 0 WHERE id = ?').run(gone));
  const theirs = await orderedOrder([[thing, 1]], supplier2Id);
  const ours = await orderedOrder([[thing, 1]]);
  for (const body of [
    { supplierId, problems: [{ productId: thing, kind: 'missing', qty: 1 }] },
    { supplierId, items: [{ productId: 999999, qty: 1 }] },
    { supplierId, items: [{ productId: gone, qty: 1 }] },
    { supplierId: 999999, items: [{ productId: thing, qty: 1 }] },
    { supplierId, items: [{ productId: thing, itemId: theirs.items[0].id, qty: 1 }] },
    { supplierId: null, items: [{ productId: thing, itemId: ours.items[0].id, qty: 1 }] },
    { supplierId, items: [{ productId: thing, itemId: ours.items[0].id, qty: 2 }] },
    { supplierId, items: [{ productId: thing, qty: 0 }] },
    { supplierId, items: [{ productId: thing, qty: 1 }], problems: [{ productId: thing, kind: 'lost', qty: 1 }] },
    { supplierId },
  ]) {
    const res = await deliver(asJo, body);
    assert.equal(res.status, 400, `${JSON.stringify(body)}: ${JSON.stringify(res.body)}`);
  }
  assert.equal(await stockOf(thing), 0);
  assert.equal((await problemsFor(thing)).length, 0);
});

test('two people booking the last pads on an order in at once: one counts against the order, the other is refused', async () => {
  const pads = await product('Shimano brake pads');
  const o = await orderedOrder([[pads, 1]]);
  const book = () => deliver(asJo, { supplierId, items: [{ productId: pads, itemId: o.items[0].id, qty: 1 }] });
  const replies = await Promise.all([book(), book(), book()]);
  assert.deepEqual(replies.map((r) => r.status).sort(), [200, 400, 400], JSON.stringify(replies.map((r) => r.body)));
  assert.equal(await stockOf(pads), 1);
});

test('two deliveries with the same products in opposite orders, not on an order, booked in at once, all land', async () => {
  const a = await product('[Product A]');
  const b = await product('[Product B]');
  const rounds = 10;
  const bodies = [];
  for (let i = 0; i < rounds; i++) {
    bodies.push({ supplierId, items: [{ productId: a, qty: 1 }, { productId: b, qty: 1 }] });
    bodies.push({ supplierId, items: [{ productId: b, qty: 1 }, { productId: a, qty: 1 }] });
  }
  const replies = await Promise.all(bodies.map((body) => deliver(asJo, body)));
  assert.deepEqual(replies.map((r) => r.status), replies.map(() => 200), JSON.stringify(replies.filter((r) => r.status !== 200).map((r) => r.body)));
  assert.equal(await stockOf(a), rounds * 2);
  assert.equal(await stockOf(b), rounds * 2);
});

test('a delivery mixing an order line and a product not on it, against one the other way round, at once: both land', async () => {
  const a = await product('[Product A]');
  const b = await product('[Product B]');
  const rounds = 8;
  const bodies = [];
  for (let i = 0; i < rounds; i++) {
    const oa = await orderedOrder([[a, 1]]);
    const ob = await orderedOrder([[b, 1]]);
    // b's order line first, then a not on an order; and the reverse.
    bodies.push({ supplierId, items: [{ productId: b, itemId: ob.items[0].id, qty: 1 }, { productId: a, qty: 1 }] });
    bodies.push({ supplierId, items: [{ productId: a, itemId: oa.items[0].id, qty: 1 }, { productId: b, qty: 1 }] });
  }
  const replies = await Promise.all(bodies.map((body) => deliver(asJo, body)));
  assert.deepEqual(replies.map((r) => r.status), replies.map(() => 200), JSON.stringify(replies.filter((r) => r.status !== 200).map((r) => r.body)));
  assert.equal(await stockOf(a), rounds * 2);
  assert.equal(await stockOf(b), rounds * 2);
});

test('the order route records who booked it in too', async () => {
  const pads = await product('Shimano brake pads');
  const o = await orderedOrder([[pads, 1]]);
  const res = await asJo(`/api/purchase-orders/${o.id}/receive`, { method: 'POST', body: { items: [{ itemId: o.items[0].id, qtyReceived: 1 }] } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await movesOf(pads))[0].login_id, jo.loginId);
});

test('signed out is refused', async () => {
  const res = await staffRequest(server.baseUrl, '', '/api/deliveries/receive', { method: 'POST', body: { supplierId, items: [] } });
  assert.equal(res.status, 401, JSON.stringify(res.body));
});

// Review, 26 Oct: a problem not on an order has the same top as a count, so
// a huge one is refused with 400, not a database error.
test('a problem past the most a line can take is refused with 400, changing nothing', async () => {
  const thing = await product();
  for (const qty of [100001, 1e12]) {
    const res = await deliver(asJo, { supplierId, items: [{ productId: thing, qty: 1 }], problems: [{ productId: thing, kind: 'damaged', qty }] });
    assert.equal(res.status, 400, `${qty}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.error, 'A problem needs how many, a whole number above 0');
  }
  assert.equal(await stockOf(thing), 0);
  assert.equal((await problemsFor(thing)).length, 0);
});

test('an order line with no supplier picked is refused: pick the supplier it is from', async () => {
  const thing = await product();
  const o = await orderedOrder([[thing, 1]]);
  const res = await deliver(asJo, { supplierId: null, items: [{ productId: thing, itemId: o.items[0].id, qty: 1 }] });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(res.body.error, 'Pick the supplier this order is from.');
});
