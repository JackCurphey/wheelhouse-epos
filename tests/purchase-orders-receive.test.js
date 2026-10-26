// Receiving a delivery against an order (openspec/changes/receive-delivery;
// rs-receive, rs-problem; receiving decisions 3, 4 and 9). Receiving raises
// stock_qty, so it is atomic and counts once: two people booking the same
// line in at the same moment must not both get it. The concurrent tests fire
// their requests together with Promise.all, the only way to see a race, as
// tests/sales-concurrency.test.js does.
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
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  await runWithShop(owner.shop.id, async () => {
    supplierId = (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run()).lastInsertRowid;
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
async function product(name = 'Shimano brake pads', stockQty = 0) {
  const sku = `${name === 'Shimano brake pads' ? 'B05S-RX' : '[Supplier code]'}-${randomUUID().slice(0, 6)}`;
  return inShop(async () => (await prepare('INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES (?, ?, ?, 28, 28, ?, now())').run(sku, name, 'Parts', stockQty)).lastInsertRowid);
}
async function orderedOrder(lines) {
  const made = await asOwner('/api/purchase-orders', { method: 'POST', body: { supplierId, items: lines.map(([productId, qty]) => ({ productId, qty, unitCost: 28 })) } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const ordered = await asOwner(`/api/purchase-orders/${made.body.id}/mark-ordered`, { method: 'POST', body: {} });
  assert.equal(ordered.status, 200, JSON.stringify(ordered.body));
  return ordered.body;
}
const stockOf = (id) => inShop(async () => (await prepare('SELECT stock_qty FROM products WHERE id = ?').get(id)).stock_qty);
const receiptsOf = (id) => inShop(async () => Number((await prepare("SELECT COALESCE(SUM(change_qty), 0) AS n FROM stock_movements WHERE product_id = ? AND type = 'po_receipt'").get(id)).n));
const problemsOf = (orderId) => inShop(() => prepare('SELECT purchase_order_item_id, product_id, kind, qty, note FROM delivery_problems WHERE purchase_order_id = ? ORDER BY id').all(orderId));
const receive = (as, orderId, body) => as(`/api/purchase-orders/${orderId}/receive`, { method: 'POST', body });

test('a staff member books a delivery in: stock and the arrived count go up, and the order is partly delivered', async () => {
  const pads = await product('Shimano brake pads', 2);
  const o = await orderedOrder([[pads, 3]]);
  const res = await receive(asJo, o.id, { items: [{ itemId: o.items[0].id, qtyReceived: 2 }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.items[0].qtyReceived, 2);
  assert.equal(res.body.status, 'partially_received');
  assert.equal(await stockOf(pads), 4);
  assert.equal(await receiptsOf(pads), 2);
});

test('damaged and wrong items are recorded, not added to stock, and stay to come; missing is recorded too', async () => {
  const thing = await product('[Product]');
  const o = await orderedOrder([[thing, 5]]);
  const line = o.items[0].id;
  const res = await receive(asJo, o.id, {
    items: [{ itemId: line, qtyReceived: 2 }],
    problems: [
      { itemId: line, kind: 'damaged', qty: 1, note: '  box crushed  ' },
      { itemId: line, kind: 'wrong_item', qty: 1 },
      { itemId: line, kind: 'missing', qty: 1 },
    ],
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.items[0].qtyReceived, 2);
  assert.equal(res.body.items[0].outstanding, 3, 'the set-aside and missing ones are still to come');
  assert.equal(await stockOf(thing), 2);
  assert.deepEqual((await problemsOf(o.id)).map((p) => [p.purchase_order_item_id, p.product_id, p.kind, p.qty, p.note]), [
    [line, thing, 'damaged', 1, 'box crushed'],
    [line, thing, 'wrong_item', 1, ''],
    [line, thing, 'missing', 1, ''],
  ]);
});

test('only problems: they are recorded, nothing goes into stock, and an ordered order stays ordered', async () => {
  const thing = await product('[Product]');
  const o = await orderedOrder([[thing, 2]]);
  const res = await receive(asJo, o.id, { problems: [{ itemId: o.items[0].id, kind: 'damaged', qty: 2 }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, 'ordered');
  assert.equal(await stockOf(thing), 0);
  assert.equal((await problemsOf(o.id)).length, 1);
});

test('more than is still to come, counting what is set aside, is refused and changes nothing', async () => {
  const thing = await product('[Product]');
  const o = await orderedOrder([[thing, 2]]);
  const line = o.items[0].id;
  const res = await receive(asJo, o.id, { items: [{ itemId: line, qtyReceived: 2 }], problems: [{ itemId: line, kind: 'damaged', qty: 1 }] });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /only 2 outstanding/);
  assert.equal(await stockOf(thing), 0);
  assert.equal((await problemsOf(o.id)).length, 0);
});

test('a problem of an unknown kind, no quantity or another order’s line is refused', async () => {
  const thing = await product('[Product]');
  const o = await orderedOrder([[thing, 2]]);
  const other = await orderedOrder([[thing, 2]]);
  for (const p of [
    { itemId: o.items[0].id, kind: 'lost', qty: 1 },
    { itemId: o.items[0].id, kind: 'damaged', qty: 0 },
    { itemId: other.items[0].id, kind: 'damaged', qty: 1 },
  ]) {
    const res = await receive(asJo, o.id, { problems: [p] });
    assert.equal(res.status, 400, `${JSON.stringify(p)}: ${JSON.stringify(res.body)}`);
  }
  assert.equal((await problemsOf(o.id)).length, 0);
});

test('two people booking the last pads in at once: one is booked in, the other refused, stock goes up once', async () => {
  const pads = await product('Shimano brake pads', 0);
  const o = await orderedOrder([[pads, 1]]);
  const book = () => receive(asJo, o.id, { items: [{ itemId: o.items[0].id, qtyReceived: 1 }] });
  const replies = await Promise.all([book(), book(), book()]);
  assert.deepEqual(replies.map((r) => r.status).sort(), [200, 400, 400], JSON.stringify(replies.map((r) => r.body)));
  assert.equal(await stockOf(pads), 1, 'stock counted once');
  assert.equal(await receiptsOf(pads), 1);
  const after = await asJo(`/api/purchase-orders/${o.id}`);
  assert.equal(after.body.items[0].qtyReceived, 1);
  assert.equal(after.body.status, 'received');
});

test('one product on several orders booked in at once: every unit reaches stock (no lost update)', async () => {
  const pads = await product('Shimano brake pads', 0);
  const orders = [];
  for (let i = 0; i < 5; i++) orders.push(await orderedOrder([[pads, 1]]));
  const replies = await Promise.all(orders.map((o) => receive(asJo, o.id, { items: [{ itemId: o.items[0].id, qtyReceived: 1 }] })));
  assert.deepEqual(replies.map((r) => r.status), [200, 200, 200, 200, 200], JSON.stringify(replies.map((r) => r.body)));
  assert.equal(await stockOf(pads), 5);
});
