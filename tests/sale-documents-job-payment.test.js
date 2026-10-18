// Paying a workshop job's order at the till (Jack, 18 Oct,
// docs/decisions/2026-10-18-till-job-payment.md answer 3). The till asks for
// the amount actually due before taking payment, since the customer's group
// discount and the order's own discount come off on the server; and paying a
// job's order can sell past zero stock, as the plain till does.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { deleteTestShop } from './helpers/testShop.js';
import { staffSignup, staffRequest } from './helpers/staff.js';

let server;
before(async () => { server = await startLiveServer(); });
after(async () => {
  if (server) await server.stop();
  await pool.end();
});

async function setUp() {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const req = (path, options) => staffRequest(server.baseUrl, cookie, path, options);
  const group = (await req('/api/customer-groups', { method: 'POST', body: { name: `Blue Light ${randomUUID().slice(0, 8)}`, discountPercent: 10 } })).body;
  const customer = (await req('/api/customers', { method: 'POST', body: { name: 'Maya Patel', groupIds: [group.id] } })).body;
  const product = (await req('/api/products', { method: 'POST', body: { name: 'Shimano brake pads', price: 20, sku: 'B05S-RX', stockQty: 0 } })).body;
  let job = (await req('/api/workshop-jobs', { method: 'POST', body: { title: 'Brake service', jobDate: '2026-10-13', customerId: customer.id } })).body;
  // Work in progress, which paying finishes (2026-10-08-paying-for-finished-work.md).
  for (const step of ['book-in', 'start']) job = (await req(`/api/workshop-jobs/${job.id}/${step}`, { method: 'POST', body: { version: job.version } })).body;
  const items = await req(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [{ productId: product.id, qty: 1, unitPrice: 20 }], discount: 2 } });
  assert.equal(items.status, 200, JSON.stringify(items.body));
  return { req, shop, job, product };
}

test('the amount due takes off the order discount and the customer group discount', async () => {
  const { req, shop, job, product } = await setUp();
  try {
    const due = await req(`/api/sale-documents/${job.orderId}/due`);
    assert.equal(due.status, 200, JSON.stringify(due.body));
    // £20 less the order's £2, less 10% of £20 for Blue Light: £16.
    assert.deepEqual({ subtotal: due.body.subtotal, discount: due.body.discount, groupDiscount: due.body.groupDiscount, total: due.body.total }, { subtotal: 20, discount: 2, groupDiscount: 2, total: 16 });
    assert.match(due.body.groupName, /^Blue Light .* \(10%\)$/);
    assert.deepEqual(due.body.stock, { [product.id]: 0 });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('paying a job\'s order sells past zero stock when asked, for the amount due', async () => {
  const { req, shop, job } = await setUp();
  try {
    const cashier = (await req('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } })).body;
    const refused = await req(`/api/sale-documents/${job.orderId}/convert`, { method: 'POST', body: { cardAmount: 16, cashierId: cashier.employeeId } });
    assert.equal(refused.status, 400);
    assert.match(refused.body.error, /Not enough stock/);
    const paid = await req(`/api/sale-documents/${job.orderId}/convert`, { method: 'POST', body: { cardAmount: 16, cashierId: cashier.employeeId, sellPastStock: true } });
    assert.equal(paid.status, 201, JSON.stringify(paid.body));
    const order = await runWithShop(shop.id, () => prepare('SELECT status FROM sale_documents WHERE id = ?').get(job.orderId));
    assert.equal(order.status, 'converted');
  } finally {
    await deleteTestShop(shop.id);
  }
});
