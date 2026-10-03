// Searching products and customers ignores capitals: staff type "brake" and
// expect "Brake pads", "maya" and expect "Maya Patel". Found when the job
// page's Add item searched the real server (3 Oct 2026).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Case Cycles' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});
const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);

test('a product search ignores capitals', async () => {
  await staff('/api/products', { method: 'POST', body: { name: 'Brake pads (pair)', price: 18, sku: 'BP-01' } });
  const found = await staff('/api/products?search=brake');
  assert.deepEqual(found.body.map((p) => p.name), ['Brake pads (pair)']);
  assert.deepEqual((await staff('/api/products?search=bp-01')).body.map((p) => p.name), ['Brake pads (pair)']);
});

test('a customer search ignores capitals', async () => {
  await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: 'Maya@Example.test' } });
  assert.deepEqual((await staff('/api/customers?search=maya')).body.map((c) => c.name), ['Maya Patel']);
  assert.deepEqual((await staff('/api/customers?search=maya@example')).body.map((c) => c.name), ['Maya Patel']);
});
