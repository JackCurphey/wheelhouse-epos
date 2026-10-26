// A purchase order with a bad line is refused with a 400 and a message, not a
// 500 (WP-0.4: the purchase-order routes moved to server/routes/, and their
// ValidationError with them). No test reached this path before the move,
// which is how a missing ValidationError import went unseen.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
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
    supplierId = (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('Madison', 'mock_csv', '{}', now())").run()).lastInsertRowid;
    productId = (await prepare("INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES ('PO-1', 'Inner tube', 'Parts', 5, 2, 0, now())").run()).lastInsertRowid;
  });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

const create = (items) => staffRequest(server.baseUrl, owner.cookie, '/api/purchase-orders', { method: 'POST', body: { supplierId, items } });

test('a good purchase order is made', async () => {
  const res = await create([{ productId, qty: 2, unitCost: 2 }]);
  assert.equal(res.status, 201, JSON.stringify(res.body));
});

test('a line with no quantity, a bad cost or an unknown product is a 400 with its message', async () => {
  for (const [line, message] of [
    [{ productId, qty: 0, unitCost: 2 }, 'Each item needs a valid productId and positive qty'],
    [{ productId, qty: 1, unitCost: -1 }, 'Each item needs a valid unit cost'],
    [{ productId: 999999, qty: 1, unitCost: 1 }, 'Product 999999 not found or inactive'],
  ]) {
    const res = await create([line]);
    assert.equal(res.status, 400, `${JSON.stringify(line)}: ${JSON.stringify(res.body)}`);
    assert.deepEqual(res.body, { error: message });
  }
});

// A count over 100000 or a cost over £99,999,999.99 (the NUMERIC(10,2)
// column's most) is a 400 with its message, not a 500 from the database
// (review of 26 Oct); the most itself is allowed.
test('a huge count or cost is a 400 with its message; the most is allowed', async () => {
  for (const [line, message] of [
    [{ productId, qty: 100001, unitCost: 2 }, 'A line can order at most 100000'],
    [{ productId, qty: 1e20, unitCost: 2 }, 'A line can order at most 100000'],
    [{ productId, qty: 1, unitCost: 100000000 }, 'A unit cost can be at most £99,999,999.99'],
  ]) {
    const res = await create([line]);
    assert.equal(res.status, 400, `${JSON.stringify(line)}: ${JSON.stringify(res.body)}`);
    assert.deepEqual(res.body, { error: message });
  }
  const most = await create([{ productId, qty: 100000, unitCost: 99999999.99 }]);
  assert.equal(most.status, 201, JSON.stringify(most.body));
});

// The edit route shares the create route's ValidationError handling, and no
// test reached it (#151 follow-up, Jack, 7 Oct), so a break there would have
// been a silent 500.
test('editing a draft with a bad line is a 400 with its message, and the order is unchanged', async () => {
  const made = await create([{ productId, qty: 2, unitCost: 2 }]);
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const id = made.body.id;
  const edit = (items) => staffRequest(server.baseUrl, owner.cookie, `/api/purchase-orders/${id}`, { method: 'PUT', body: { items } });
  for (const [line, message] of [
    [{ productId, qty: 0, unitCost: 2 }, 'Each item needs a valid productId and positive qty'],
    [{ productId, qty: 1, unitCost: -1 }, 'Each item needs a valid unit cost'],
    [{ productId: 999999, qty: 1, unitCost: 1 }, 'Product 999999 not found or inactive'],
  ]) {
    const res = await edit([line]);
    assert.equal(res.status, 400, `${JSON.stringify(line)}: ${JSON.stringify(res.body)}`);
    assert.deepEqual(res.body, { error: message });
  }
  const lines = await runWithShop(owner.shop.id, () =>
    prepare('SELECT qty_ordered, unit_cost FROM purchase_order_items WHERE purchase_order_id = ?').all(id));
  assert.deepEqual(lines.map((l) => [l.qty_ordered, Number(l.unit_cost)]), [[2, 2]]);
});

// The order's total cost, in pounds as stored (openspec/changes/deliveries-orders
// contract): the screens show it as the server gives it. 3 × £1.10 + £0.20
// is 3.5000000000000004 in floating point, so the sum is rounded to the penny.
test('an order gives its total cost, in pounds, rounded to the penny', async () => {
  const made = await create([{ productId, qty: 3, unitCost: 1.1 }, { productId, qty: 1, unitCost: 0.2 }]);
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.equal(made.body.totalCost, 3.5);
  const one = await staffRequest(server.baseUrl, owner.cookie, `/api/purchase-orders/${made.body.id}`);
  assert.equal(one.body.totalCost, 3.5);
  const all = await staffRequest(server.baseUrl, owner.cookie, '/api/purchase-orders');
  assert.equal(all.body.find((o) => o.id === made.body.id).totalCost, 3.5);
});
