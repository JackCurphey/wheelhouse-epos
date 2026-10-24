// Sales in pence, step A (openspec/changes/wp-1-6-sales-in-pence task 1.4):
// the sale-documents routes and loadDocumentLine write pence beside pounds,
// convert sets paid_pence to the sale's total, and every reply carries
// …Pence fields beside the pound fields it already had (design.md
// Decisions 1, 2 and 6). Statuses are unchanged. Each test ends by running
// the totals check on its shop, which must find nothing it doesn't know.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { loadDocumentLine } from '../server/lib/sales.js';
import { checkShop } from '../scripts/ci/check-money-totals.mjs';
import { startLiveServer } from './helpers/liveServer.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { staffSignup, staffRequest } from './helpers/staff.js';

let server;
before(async () => { server = await startLiveServer(); });
after(async () => {
  if (server) await server.stop();
  await pool.end();
});

async function assertTotalsClean(shopId) {
  const client = await pool.connect();
  try {
    const result = await checkShop(client, shopId);
    const unknown = result.mismatches.filter((m) => !m.known);
    assert.deepEqual(unknown, [], JSON.stringify(unknown));
    assert.ok(result.checked.orders > 0, 'the check read the shop\'s orders');
  } finally {
    client.release();
  }
}

async function seedProduct(shopId, { price, vatRateBp }) {
  return runWithShop(shopId, async () => (await prepare(
    `INSERT INTO products (sku, name, price, cost, stock_qty, active, vat_rate_bp)
     VALUES ('SKU-1', 'Chain', ?, 10.00, 5, 1, ?) RETURNING id`
  ).get(price, vatRateBp)).id);
}

test('loadDocumentLine gives a product line its pence and its product\'s VAT rate', async () => {
  const shop = await createTestShop();
  try {
    const productId = await seedProduct(shop.id, { price: 24.99, vatRateBp: 2000 });
    await runWithShop(shop.id, async () => {
      const line = await loadDocumentLine({ productId, qty: 2 }, { checkStock: false });
      assert.equal(line.unitPricePence, 2499);
      assert.equal(line.lineTotalPence, 4998);
      assert.equal(line.vatRateBp, 2000);
      // The pound fields are unchanged.
      assert.equal(Number(line.unitPrice), 24.99);
      assert.equal(line.qty, 2);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('loadDocumentLine gives a labour line its pence and no VAT rate', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const line = await loadDocumentLine({ lineType: 'labour', name: 'Fit chain', unitPrice: 15, minutes: 20 }, { checkStock: false });
      assert.equal(line.unitPricePence, 1500);
      assert.equal(line.lineTotalPence, 1500);
      // Labour's VAT rate is Jack's call (#134): nothing is assumed.
      assert.equal(line.vatRateBp, null);
      assert.equal(line.unitPrice, 15);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('creating an order writes pence beside pounds and replies with both', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const req = (path, options) => staffRequest(server.baseUrl, cookie, path, options);
  try {
    const productId = await seedProduct(shop.id, { price: 24.99, vatRateBp: 2000 });
    const created = await req('/api/sale-documents', {
      method: 'POST',
      body: {
        kind: 'order',
        discount: 5,
        items: [{ productId, qty: 2 }, { lineType: 'labour', name: 'Fit chain', unitPrice: 15, minutes: 20 }],
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const doc = created.body;
    assert.equal(doc.status, 'open');
    assert.equal(doc.subtotalPence, 6498);
    assert.equal(doc.discountPence, 500);
    assert.equal(doc.totalPence, 5998);
    assert.equal(doc.paidPence, 0);
    assert.equal(Number(doc.subtotal), 64.98);
    assert.equal(Number(doc.total), 59.98);
    const [part, labour] = doc.items;
    assert.equal(part.unitPricePence, 2499);
    assert.equal(part.lineTotalPence, 4998);
    assert.equal(part.vatRateBp, 2000);
    assert.equal(Number(part.unitPrice), 24.99);
    assert.equal(labour.unitPricePence, 1500);
    assert.equal(labour.lineTotalPence, 1500);
    assert.equal(labour.vatRateBp, null);

    // The list and the single order carry the same pence.
    const one = (await req(`/api/sale-documents/${doc.id}`)).body;
    assert.equal(one.totalPence, 5998);
    assert.equal(one.items[0].lineTotalPence, 4998);
    const list = (await req('/api/sale-documents?kind=order')).body;
    assert.equal(list.find((d) => d.id === doc.id).totalPence, 5998);

    await assertTotalsClean(shop.id);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a discount bigger than the lines leaves a total of 0 in pence and pounds', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const req = (path, options) => staffRequest(server.baseUrl, cookie, path, options);
  try {
    const created = await req('/api/sale-documents', {
      method: 'POST',
      body: { kind: 'quote', discount: 20, items: [{ lineType: 'labour', name: 'Fit chain', unitPrice: 15 }] },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.totalPence, 0);
    assert.equal(Number(created.body.total), 0);
    assert.equal(created.body.discountPence, 2000);
    await assertTotalsClean(shop.id);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('three lines of 0.10 add up to exactly 30p, with nothing left over', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const req = (path, options) => staffRequest(server.baseUrl, cookie, path, options);
  try {
    const productId = await seedProduct(shop.id, { price: 0.1, vatRateBp: 2000 });
    const created = (await req('/api/sale-documents', { method: 'POST', body: { kind: 'order', items: [{ productId, qty: 1 }] } })).body;
    const put = await req(`/api/sale-documents/${created.id}/items`, {
      method: 'PUT',
      body: { items: [{ productId, qty: 1 }, { productId, qty: 1 }, { productId, qty: 1 }], discount: 0.05 },
    });
    assert.equal(put.status, 200, JSON.stringify(put.body));
    assert.equal(put.body.subtotalPence, 30);
    assert.equal(put.body.discountPence, 5);
    assert.equal(put.body.totalPence, 25);
    assert.equal(Number(put.body.total), 0.25);
    assert.deepEqual(put.body.items.map((i) => i.lineTotalPence), [10, 10, 10]);
    await assertTotalsClean(shop.id);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('editing an order\'s details keeps its pence, and the reply carries them', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const req = (path, options) => staffRequest(server.baseUrl, cookie, path, options);
  try {
    const created = (await req('/api/sale-documents', {
      method: 'POST', body: { kind: 'order', items: [{ lineType: 'labour', name: 'Fit chain', unitPrice: 15 }] },
    })).body;
    const put = await req(`/api/sale-documents/${created.id}`, { method: 'PUT', body: { title: 'Chain', status: 'cancelled' } });
    assert.equal(put.status, 200, JSON.stringify(put.body));
    assert.equal(put.body.status, 'cancelled');
    assert.equal(put.body.totalPence, 1500);
    assert.equal(put.body.items[0].unitPricePence, 1500);
    await assertTotalsClean(shop.id);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the amount due carries pence beside pounds', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const req = (path, options) => staffRequest(server.baseUrl, cookie, path, options);
  try {
    const created = (await req('/api/sale-documents', {
      method: 'POST', body: { kind: 'order', discount: 2.5, items: [{ lineType: 'labour', name: 'Fit chain', unitPrice: 15 }] },
    })).body;
    const due = await req(`/api/sale-documents/${created.id}/due`);
    assert.equal(due.status, 200, JSON.stringify(due.body));
    assert.equal(due.body.total, 12.5);
    assert.equal(due.body.subtotalPence, 1500);
    assert.equal(due.body.discountPence, 250);
    assert.equal(due.body.groupDiscountPence, 0);
    assert.equal(due.body.totalPence, 1250);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('paying an order sets what was paid to the sale\'s total, in pence, and it reads converted', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const req = (path, options) => staffRequest(server.baseUrl, cookie, path, options);
  try {
    const cashierId = await runWithShop(shop.id, async () =>
      (await prepare("INSERT INTO employees (name, is_cashier, active) VALUES ('Test Staff', 1, 1) RETURNING id").get()).id);
    const created = (await req('/api/sale-documents', {
      method: 'POST', body: { kind: 'order', discount: 2.5, items: [{ lineType: 'labour', name: 'Fit chain', unitPrice: 15 }] },
    })).body;
    const paid = await req(`/api/sale-documents/${created.id}/convert`, {
      method: 'POST', body: { cashierId, cashAmount: 12.5, cashTendered: 12.5 },
    });
    assert.equal(paid.status, 201, JSON.stringify(paid.body));
    const doc = (await req(`/api/sale-documents/${created.id}`)).body;
    assert.equal(doc.status, 'converted');
    assert.equal(doc.convertedSaleId, paid.body.id);
    assert.equal(doc.paidPence, 1250);
    assert.equal(doc.totalPence, 1250);
    await assertTotalsClean(shop.id);
  } finally {
    await deleteTestShop(shop.id);
  }
});

// Pence is the authority (design.md Decision 2): a typed price finer than a
// penny is rounded to the penny once, and the line is that times the
// quantity, so the pounds written beside it are penny-exact too.
test('a price finer than a penny is rounded once per unit, and pounds follow the pence', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const req = (path, options) => staffRequest(server.baseUrl, cookie, path, options);
  try {
    const productId = await seedProduct(shop.id, { price: 1, vatRateBp: 2000 });
    const created = await req('/api/sale-documents', {
      method: 'POST', body: { kind: 'order', items: [{ productId, qty: 3, unitPrice: 0.333 }] },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const [line] = created.body.items;
    assert.equal(line.unitPricePence, 33);
    assert.equal(line.lineTotalPence, 99);
    assert.equal(Number(line.unitPrice), 0.33);
    assert.equal(Number(line.lineTotal), 0.99);
    assert.equal(created.body.totalPence, 99);
    assert.equal(Number(created.body.total), 0.99);
    await assertTotalsClean(shop.id);
  } finally {
    await deleteTestShop(shop.id);
  }
});

// The order's own total has no group discount on it (it is the customer's,
// taken off when paying, as createSale does), so what was paid is the sale's
// total and can be less than the order's total. The totals check holds
// paid_pence to the sale's total (design.md Decision 7).
test('paying with a group discount records what the sale took, not the order\'s total', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const req = (path, options) => staffRequest(server.baseUrl, cookie, path, options);
  try {
    const group = (await req('/api/customer-groups', { method: 'POST', body: { name: 'Trade [n]', discountPercent: 10 } })).body;
    const customer = (await req('/api/customers', { method: 'POST', body: { name: 'Maya Patel', groupIds: [group.id] } })).body;
    const cashierId = await runWithShop(shop.id, async () =>
      (await prepare("INSERT INTO employees (name, is_cashier, active) VALUES ('Test Staff', 1, 1) RETURNING id").get()).id);
    const created = (await req('/api/sale-documents', {
      method: 'POST', body: { kind: 'order', customerId: customer.id, items: [{ lineType: 'labour', name: 'Fit chain', unitPrice: 15 }] },
    })).body;
    const due = (await req(`/api/sale-documents/${created.id}/due`)).body;
    assert.equal(due.groupDiscountPence, 150);
    assert.equal(due.totalPence, 1350);
    // Cash handed over beyond the total is change, not a payment.
    const paid = await req(`/api/sale-documents/${created.id}/convert`, {
      method: 'POST', body: { cashierId, cashAmount: 13.5, cashTendered: 20 },
    });
    assert.equal(paid.status, 201, JSON.stringify(paid.body));
    const doc = (await req(`/api/sale-documents/${created.id}`)).body;
    assert.equal(doc.totalPence, 1500);
    assert.equal(doc.paidPence, 1350);
    await assertTotalsClean(shop.id);
  } finally {
    await deleteTestShop(shop.id);
  }
});
