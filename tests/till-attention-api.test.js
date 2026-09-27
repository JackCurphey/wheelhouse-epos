// tests/till-attention-api.test.js
// The manager's attention list: "check these" and "needs attention".
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §5, §8
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { registerTill, tillRequest, seedProduct } from './helpers/till.js';

let server; let owner; let other; let b1;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  other = await staffSignup(server.baseUrl);
  b1 = await registerTill(server.baseUrl, owner);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

test('below-zero stock appears on the list, and resolving clears it', async () => {
  const tube = await seedProduct(owner.shop.id, { stock: 0 });
  await tillRequest(server.baseUrl, owner.shop.slug, b1.token, '/sync', { method: 'POST', body: { pendingCount: 0, items: [{
    kind: 'sale', clientId: randomUUID(), receiptNumber: 1, tillClockAt: '2026-09-01T09:30:00.000Z', madeOffline: false,
    lines: [{ productId: tube, description: 'Inner tube', qty: 1, unitPricePence: 699, vatRateBp: 2000 }],
    payments: [{ method: 'card', amountPence: 699 }],
  }] } });
  const list = (await staffRequest(server.baseUrl, owner.cookie, '/api/till-attention')).body;
  const item = list.find((a) => a.kind === 'stock_below_zero' && a.productId === tube);
  assert.ok(item);
  assert.equal((await staffRequest(server.baseUrl, other.cookie, `/api/till-attention/${item.id}/resolve`, { method: 'POST' })).status, 404);
  const done = await staffRequest(server.baseUrl, owner.cookie, `/api/till-attention/${item.id}/resolve`, { method: 'POST' });
  assert.deepEqual(done.body, { id: item.id, resolved: true });
  const after = (await staffRequest(server.baseUrl, owner.cookie, '/api/till-attention')).body;
  assert.equal(after.some((a) => a.id === item.id), false);
  assert.equal((await staffRequest(server.baseUrl, owner.cookie, `/api/till-attention/${item.id}/resolve`, { method: 'POST' })).status, 404);
});
