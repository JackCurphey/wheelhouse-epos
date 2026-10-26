// An order's status changes (openspec/changes/deliveries-orders; review of
// 26 Oct): New order makes an order already ordered in one call, so a failed
// second request can't leave a draft that a retry duplicates; mark-ordered and
// cancel check the status in the same UPDATE that changes it, so two requests
// at once can't both pass the check; and a staff member's refusal leaves a
// real draft a draft.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare, pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let jo;
let supplierId;
let productId;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
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

const as = (who) => (path, body) => staffRequest(server.baseUrl, who.cookie, path, { method: 'POST', body });
const create = (extra = {}) => as(owner)('/api/purchase-orders', { supplierId, items: [{ productId, qty: 1, unitCost: 28 }], ...extra });
const statusOf = (id) => runWithShop(owner.shop.id, () => prepare('SELECT status, ordered_at FROM purchase_orders WHERE id = ?').get(id));
const countOrders = () => runWithShop(owner.shop.id, async () => Number((await prepare('SELECT count(*) AS n FROM purchase_orders').get()).n));

test('markOrdered: true makes the order already ordered, in one call', async () => {
  const before = await countOrders();
  const res = await create({ markOrdered: true });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.status, 'ordered');
  assert.ok(res.body.orderedAt, 'it says when it was ordered');
  const row = await statusOf(res.body.id);
  assert.equal(row.status, 'ordered');
  assert.ok(row.ordered_at !== null);
  assert.equal(await countOrders(), before + 1, 'one order, not a draft and an ordered one');
});

test('without markOrdered the order is a draft', async () => {
  const res = await create();
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.status, 'draft');
  assert.equal((await statusOf(res.body.id)).ordered_at, null);
});

test('a refused markOrdered order leaves nothing behind, draft or ordered', async () => {
  const before = await countOrders();
  const res = await as(owner)('/api/purchase-orders', { supplierId, items: [{ productId, qty: 1, unitCost: 28 }, { productId: 999999, qty: 1, unitCost: 1 }], markOrdered: true });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(await countOrders(), before);
});

test('a staff member asking for markOrdered is refused, and nothing is made', async () => {
  const before = await countOrders();
  const res = await as(jo)('/api/purchase-orders', { supplierId, items: [{ productId, qty: 1, unitCost: 28 }], markOrdered: true });
  assert.equal(res.status, 403, JSON.stringify(res.body));
  assert.equal(await countOrders(), before);
});

test('a staff member refused mark-ordered on a real draft leaves it a draft', async () => {
  const draft = await create();
  const res = await as(jo)(`/api/purchase-orders/${draft.body.id}/mark-ordered`, {});
  assert.equal(res.status, 403, JSON.stringify(res.body));
  assert.equal((await statusOf(draft.body.id)).status, 'draft');
});

test('a cancelled order can’t then be marked ordered: 409, and it stays cancelled', async () => {
  const draft = await create();
  const id = draft.body.id;
  assert.equal((await as(owner)(`/api/purchase-orders/${id}/cancel`, {})).status, 200);
  const res = await as(owner)(`/api/purchase-orders/${id}/mark-ordered`, {});
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'Only a draft purchase order can be marked as ordered' });
  assert.equal((await statusOf(id)).status, 'cancelled');
});

test('an ordered order can’t be marked ordered again: 409, and its ordered date stays', async () => {
  const made = await create({ markOrdered: true });
  const was = await statusOf(made.body.id);
  const res = await as(owner)(`/api/purchase-orders/${made.body.id}/mark-ordered`, {});
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(await statusOf(made.body.id), was);
});

test('a cancelled order can’t be cancelled again: 409', async () => {
  const draft = await create();
  assert.equal((await as(owner)(`/api/purchase-orders/${draft.body.id}/cancel`, {})).status, 200);
  const res = await as(owner)(`/api/purchase-orders/${draft.body.id}/cancel`, {});
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'This purchase order is already cancelled' });
});

test('an order with something booked in can’t be cancelled: 409, and its status stays', async () => {
  const made = await create({ markOrdered: true });
  const id = made.body.id;
  // Booked in behind the status's back, as a receipt landing between a check
  // and the cancel would: the status still says ordered.
  await runWithShop(owner.shop.id, () => prepare('UPDATE purchase_order_items SET qty_received = 1 WHERE purchase_order_id = ?').run(id));
  const res = await as(owner)(`/api/purchase-orders/${id}/cancel`, {});
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'This purchase order already has items booked in and cannot be cancelled' });
  assert.equal((await statusOf(id)).status, 'ordered');
});
