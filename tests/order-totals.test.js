// One amount-due function (money-path review): createSale, GET
// /api/sale-documents/:id/due and the Bike ready message all use
// computeOrderTotals, so a customer is never told one amount and charged another.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { computeOrderTotals, createSale } from '../server/lib/sales.js';
import { startLiveServer } from './helpers/liveServer.js';
import { deleteTestShop } from './helpers/testShop.js';
import { staffSignup, staffRequest } from './helpers/staff.js';

let server;
before(async () => { server = await startLiveServer(); });
after(async () => {
  if (server) await server.stop();
  await pool.end();
});

test('computeOrderTotals rounds each part to pence once, so 3 x 0.1 does not drift', async () => {
  const t = await computeOrderTotals({ items: [{ unitPrice: 0.1, qty: 3 }], discount: 0.1, customerId: null });
  assert.deepEqual(t, { subtotal: 0.3, discount: 0.1, groupDiscount: { amount: 0, name: '' }, total: 0.2 });
});

test('computeOrderTotals never goes below zero', async () => {
  const t = await computeOrderTotals({ items: [{ unitPrice: 5, qty: 1 }], discount: 9, customerId: null });
  assert.equal(t.total, 0);
});

test('createSale and the amount due agree, group discount included', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const req = (path, options) => staffRequest(server.baseUrl, cookie, path, options);
  try {
    const group = (await req('/api/customer-groups', { method: 'POST', body: { name: `Trade ${randomUUID().slice(0, 8)}`, discountPercent: 10 } })).body;
    const customer = (await req('/api/customers', { method: 'POST', body: { name: 'Maya Patel', groupIds: [group.id] } })).body;
    const product = (await req('/api/products', { method: 'POST', body: { name: 'Chain link', price: 0.1, sku: 'CL-1', stockQty: 10 } })).body;
    const order = (await req('/api/sale-documents', { method: 'POST', body: { kind: 'order', customerId: customer.id, items: [{ productId: product.id, qty: 1, unitPrice: 0.1 }] } })).body;
    assert.ok(order.id, JSON.stringify(order));
    const put = await req(`/api/sale-documents/${order.id}/items`, { method: 'PUT', body: { items: [{ productId: product.id, qty: 3, unitPrice: 0.1 }], discount: 0.05 } });
    assert.equal(put.status, 200, JSON.stringify(put.body));
    const due = (await req(`/api/sale-documents/${order.id}/due`)).body;
    const totals = await runWithShop(shop.id, () => computeOrderTotals({ items: [{ unitPrice: 0.1, qty: 3 }], discount: 0.05, customerId: customer.id }));
    assert.equal(due.total, totals.total);
    assert.equal(due.groupDiscount, totals.groupDiscount.amount);
    const cashier = await runWithShop(shop.id, async () => (await prepare("INSERT INTO employees (name, is_cashier, active) VALUES ('Jo Taylor', 1, 1) RETURNING id").get()).id);
    const sale = await runWithShop(shop.id, () => createSale({ customerId: customer.id, cashierId: cashier, items: [{ productId: product.id, qty: 3, unitPrice: 0.1 }], discount: 0.05, cashAmount: due.total, cardAmount: 0, cashTendered: null, payments: [], note: '' }));
    const stored = await runWithShop(shop.id, () => prepare("SELECT total FROM sales WHERE id = ?").get(sale));
    assert.equal(Number(stored.total), due.total);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the amount due is refused for an order that is already paid or cancelled', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const req = (path, options) => staffRequest(server.baseUrl, cookie, path, options);
  try {
    const order = (await req('/api/sale-documents', { method: 'POST', body: { kind: 'order', items: [{ lineType: 'labour', name: 'Service', unitPrice: 10, minutes: 30 }] } })).body;
    assert.ok(order.id, JSON.stringify(order));
    assert.equal((await req(`/api/sale-documents/${order.id}/due`)).status, 200);
    await runWithShop(shop.id, () => prepare("UPDATE sale_documents SET status = 'converted' WHERE id = ?").run(order.id));
    const converted = await req(`/api/sale-documents/${order.id}/due`);
    assert.equal(converted.status, 400, JSON.stringify(converted.body));
    assert.equal(converted.body.error, 'This order is already converted');
    await runWithShop(shop.id, () => prepare("UPDATE sale_documents SET status = 'cancelled' WHERE id = ?").run(order.id));
    assert.equal((await req(`/api/sale-documents/${order.id}/due`)).status, 400);
  } finally {
    await deleteTestShop(shop.id);
  }
});
