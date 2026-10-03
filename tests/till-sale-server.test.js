// The server side of the new till (journey 11, piece 1): who is serving, and
// selling past stock (decision 5: warned, never blocked).
// Spec: docs/superpowers/specs/2026-10-03-till-sale-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let jo;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Till Cycles' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', {
    method: 'POST',
    body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' },
  });
  assert.equal(made.status, 201);
  jo = { ...made.body, cookie: await staffFreshCookie(made.body.loginId) };
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});
const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);

test('who am I says which staff member the login is, and whether they take sales', async () => {
  const me = await staffRequest(server.baseUrl, jo.cookie, '/api/auth/me');
  assert.equal(me.status, 200);
  assert.deepEqual(me.body.employee, { id: jo.employeeId, name: 'Jo Taylor', isCashier: true });
});

test('a login with no staff member says so', async () => {
  const me = await staff('/api/auth/me');
  assert.equal(me.body.employee, null);
  assert.equal(me.body.name, 'Test Owner');
});

async function product(stockQty) {
  const made = await staff('/api/products', { method: 'POST', body: { name: `Inner tube ${Math.random()}`, price: 6, stockQty } });
  assert.equal(made.status, 201);
  return made.body;
}

test('sell past stock: the sale goes through and the stock goes below zero', async () => {
  const tube = await product(1);
  const sale = await staff('/api/sales', {
    method: 'POST',
    body: { items: [{ productId: tube.id, qty: 3 }], cardAmount: 18, cashierId: jo.employeeId, sellPastStock: true },
  });
  assert.equal(sale.status, 201);
  const after = await staff(`/api/products?search=${encodeURIComponent(tube.name)}`);
  assert.equal(after.body.find((p) => p.id === tube.id).stockQty, -2);
});

test('without sell past stock, a sale short of stock is still refused', async () => {
  const tube = await product(0);
  const sale = await staff('/api/sales', {
    method: 'POST',
    body: { items: [{ productId: tube.id, qty: 1 }], cardAmount: 6, cashierId: jo.employeeId },
  });
  assert.equal(sale.status, 400);
  assert.match(sale.body.error, /Not enough stock/);
});
