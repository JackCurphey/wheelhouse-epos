// Closing an order that has partly arrived (openspec/changes/close-part-delivered;
// Jack's answer 1, docs/decisions/2026-10-27-answers.md: "Mark the rest not
// coming"). What arrived stays in stock and on the order's lines; the rest is
// not coming; a closed order can't be received against; and the close is
// race-safe against a booking in, both ways round. Example data from the
// drawings: Shimano brake pads B05S-RX; the rest stays bracketed.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { adminUrlFrom } from '../scripts/dev/new-db.mjs';
import '../server/load-env.js';
import { runWithShop, prepare, pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let supplierId;
let productId;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  await runWithShop(owner.shop.id, async () => {
    supplierId = (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run()).lastInsertRowid;
    productId = (await prepare("INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES ('B05S-RX', 'Shimano brake pads', 'Parts', 28, 28, 0, now())").run()).lastInsertRowid;
  });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const post = (path, body) => staffRequest(server.baseUrl, owner.cookie, path, { method: 'POST', body });
const get = (path) => staffRequest(server.baseUrl, owner.cookie, path);
// An ordered order for 3 pads.
async function ordered() {
  const made = await post('/api/purchase-orders', { supplierId, items: [{ productId, qty: 3, unitCost: 28 }], markOrdered: true });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  return { id: made.body.id, itemId: made.body.items[0].id };
}
const stock = () => runWithShop(owner.shop.id, async () => (await prepare('SELECT stock_qty FROM products WHERE id = ?').get(productId)).stock_qty);
const statusOf = (id) => runWithShop(owner.shop.id, async () => (await prepare('SELECT status FROM purchase_orders WHERE id = ?').get(id)).status);
const receivedOf = (id) => runWithShop(owner.shop.id, async () => (await prepare('SELECT qty_received FROM purchase_order_items WHERE purchase_order_id = ?').get(id)).qty_received);

// An admin connection (no row-level security) to hold one side of a race open.
async function adminClient() {
  const adminUrl = new URL(adminUrlFrom(process.env));
  adminUrl.pathname = new URL(process.env.DATABASE_URL).pathname;
  const admin = new pg.Client({ connectionString: adminUrl.href });
  await admin.connect();
  return admin;
}
// Waits until another backend is blocked on a lock running a query like `like`.
// Inside a transaction pg_stat_activity is a cached snapshot, so it's cleared each look.
async function seenWaiting(admin, like) {
  for (let i = 0; i < 200; i++) {
    await admin.query('SELECT pg_stat_clear_snapshot()');
    const { rows } = await admin.query(
      "SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE $1 AND pid <> pg_backend_pid()", [like]
    );
    if (rows.length > 0) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

test('a partly delivered order closes: what arrived stays in stock and on the line, the rest is not coming, nothing is still to come', async () => {
  const { id, itemId } = await ordered();
  const before = await stock();
  const booked = await post(`/api/purchase-orders/${id}/receive`, { items: [{ itemId, qtyReceived: 1 }] });
  assert.equal(booked.status, 200, JSON.stringify(booked.body));
  assert.equal(booked.body.status, 'partially_received');

  const res = await post(`/api/purchase-orders/${id}/cancel`, {});
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, 'closed');
  assert.deepEqual(
    res.body.items.map(({ qtyOrdered, qtyReceived, outstanding, notComing }) => ({ qtyOrdered, qtyReceived, outstanding, notComing })),
    [{ qtyOrdered: 3, qtyReceived: 1, outstanding: 0, notComing: 2 }],
  );
  assert.equal(await statusOf(id), 'closed');
  assert.equal(await receivedOf(id), 1, 'the arrived count is kept');
  assert.equal(await stock(), before + 1, 'what arrived stays in stock');
  const moves = await runWithShop(owner.shop.id, () => prepare('SELECT change_qty FROM stock_movements WHERE purchase_order_id = ?').all(id));
  assert.deepEqual(moves.map((m) => m.change_qty), [1], 'the stock history is kept, nothing reversed');

  // The list and the order's own page read it as all in.
  const one = await get(`/api/purchase-orders/${id}`);
  assert.equal(one.body.items[0].outstanding, 0);
  assert.equal(one.body.items[0].notComing, 2);
  const listed = (await get('/api/purchase-orders')).body.find((o) => o.id === id);
  assert.equal(listed.status, 'closed');
  assert.equal(listed.items[0].outstanding, 0);
});

test('damaged ones set aside are not counted as not coming', async () => {
  const { id, itemId } = await ordered();
  const booked = await post(`/api/purchase-orders/${id}/receive`, { items: [{ itemId, qtyReceived: 1 }], problems: [{ itemId, kind: 'damaged', qty: 1 }] });
  assert.equal(booked.status, 200, JSON.stringify(booked.body));
  const res = await post(`/api/purchase-orders/${id}/cancel`, {});
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.items[0].notComing, 1);
  assert.equal(res.body.items[0].outstanding, 0);
});

test('a cancelled order, nothing in, has nothing still to come: every line is not coming', async () => {
  const { id } = await ordered();
  const res = await post(`/api/purchase-orders/${id}/cancel`, {});
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, 'cancelled');
  assert.equal(res.body.items[0].outstanding, 0);
  assert.equal(res.body.items[0].notComing, 3);
});

test('an open order has nothing not coming', async () => {
  const { id } = await ordered();
  assert.equal((await get(`/api/purchase-orders/${id}`)).body.items[0].notComing, 0);
});

test('a closed order can’t be closed again, and a received one says everything has arrived', async () => {
  const { id, itemId } = await ordered();
  await post(`/api/purchase-orders/${id}/receive`, { items: [{ itemId, qtyReceived: 1 }] });
  assert.equal((await post(`/api/purchase-orders/${id}/cancel`, {})).status, 200);
  const again = await post(`/api/purchase-orders/${id}/cancel`, {});
  assert.equal(again.status, 409, JSON.stringify(again.body));
  assert.deepEqual(again.body, { error: 'This purchase order is already closed' });
  assert.equal(await statusOf(id), 'closed');

  const all = await ordered();
  await post(`/api/purchase-orders/${all.id}/receive`, { items: [{ itemId: all.itemId, qtyReceived: 3 }] });
  const res = await post(`/api/purchase-orders/${all.id}/cancel`, {});
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'Everything on this purchase order has arrived' });
  assert.equal(await statusOf(all.id), 'received');
});

test('a closed order can’t be booked in against, by either receive route; stock is unchanged', async () => {
  const { id, itemId } = await ordered();
  await post(`/api/purchase-orders/${id}/receive`, { items: [{ itemId, qtyReceived: 1 }] });
  assert.equal((await post(`/api/purchase-orders/${id}/cancel`, {})).status, 200);
  const before = await stock();
  const onOrder = await post(`/api/purchase-orders/${id}/receive`, { items: [{ itemId, qtyReceived: 1 }] });
  assert.equal(onOrder.status, 400, JSON.stringify(onOrder.body));
  assert.equal(onOrder.body.error, 'This purchase order is not awaiting delivery');
  const delivery = await post('/api/deliveries/receive', { supplierId, items: [{ itemId, qty: 1 }] });
  assert.equal(delivery.status, 400, JSON.stringify(delivery.body));
  assert.equal(delivery.body.error, 'This purchase order is not awaiting delivery');
  assert.equal(await stock(), before);
  assert.equal(await receivedOf(id), 1);
  assert.equal(await statusOf(id), 'closed');
});

// The close waits on the order's row while a booking holds it, then decides
// on the row the booking committed: partly delivered, so it closes, keeping
// what was booked in. A close that decided on what it read before waiting
// would be refused.
test('a close made while a delivery is being booked in waits, then closes with the booking kept', async () => {
  const { id } = await ordered();
  const admin = await adminClient();
  try {
    await admin.query('BEGIN');
    await admin.query('SELECT 1 FROM purchase_orders WHERE id = $1 FOR UPDATE', [id]);
    await admin.query('UPDATE purchase_order_items SET qty_received = 1 WHERE purchase_order_id = $1', [id]);
    await admin.query("UPDATE purchase_orders SET status = 'partially_received' WHERE id = $1", [id]);
    const closing = post(`/api/purchase-orders/${id}/cancel`, {});
    assert.ok(await seenWaiting(admin, '%UPDATE purchase_orders SET status = CASE%'), 'the close was seen waiting on the booking');
    await admin.query('COMMIT');
    const res = await closing;
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'closed');
    assert.equal(res.body.items[0].qtyReceived, 1);
    assert.equal(res.body.items[0].notComing, 2);
    assert.equal(await statusOf(id), 'closed');
    assert.equal(await receivedOf(id), 1);
  } finally {
    await admin.query('ROLLBACK').catch(() => {});
    await admin.end();
  }
});

// A booking waits on the order's row while a close holds it, then sees it
// closed and is refused before touching a line or stock.
test('a booking made while a close is being written waits, then is refused; stock is unchanged', async () => {
  const { id, itemId } = await ordered();
  await post(`/api/purchase-orders/${id}/receive`, { items: [{ itemId, qtyReceived: 1 }] });
  const before = await stock();
  const admin = await adminClient();
  try {
    await admin.query('BEGIN');
    await admin.query("UPDATE purchase_orders SET status = 'closed' WHERE id = $1 AND status = 'partially_received'", [id]);
    const booking = post(`/api/purchase-orders/${id}/receive`, { items: [{ itemId, qtyReceived: 1 }] });
    assert.ok(await seenWaiting(admin, '%purchase_order%'), 'the booking was seen waiting on the close');
    await admin.query('COMMIT');
    const res = await booking;
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.error, 'This purchase order is not awaiting delivery');
    assert.equal(await stock(), before);
    assert.equal(await receivedOf(id), 1);
    assert.equal(await statusOf(id), 'closed');
  } finally {
    await admin.query('ROLLBACK').catch(() => {});
    await admin.end();
  }
});
