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
