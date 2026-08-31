// tests/saleDocuments.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { loadDocumentLine } from '../server/server.js';

// The helper has to survive a shop that owns an order with lines. Until it
// deletes sale_document_items, deleting sale_documents trips a foreign key.
test('deleteTestShop removes a shop that owns an order with lines', async () => {
  const shop = await createTestShop();
  await runWithShop(shop.id, async () => {
    const product = await prepare(
      `INSERT INTO products (sku, name, price, cost, stock_qty, active)
       VALUES ('SKU-1', 'Chain', 24.99, 10.00, 5, 1)`
    ).run();
    const doc = await prepare(
      `INSERT INTO sale_documents (kind, subtotal, discount, total)
       VALUES ('order', 24.99, 0, 24.99)`
    ).run();
    await prepare(
      `INSERT INTO sale_document_items (document_id, product_id, name, sku, unit_price, qty, line_total)
       VALUES (?, ?, 'Chain', 'SKU-1', 24.99, 1, 24.99)`
    ).run(doc.lastInsertRowid, product.lastInsertRowid);
  });

  // The assertion is that this does not throw.
  await deleteTestShop(shop.id);
});

test('loadDocumentLine rejects a product line with no productId', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await assert.rejects(
        () => loadDocumentLine({ qty: 1 }, { checkStock: false }),
        /needs a valid productId and positive qty/
      );
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('loadDocumentLine snapshots name, sku and price from the product', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const info = await prepare(
        `INSERT INTO products (sku, name, price, cost, stock_qty, active)
         VALUES ('SKU-1', 'Chain', 24.99, 10.00, 5, 1)`
      ).run();
      const line = await loadDocumentLine({ productId: info.lastInsertRowid, qty: 2 }, { checkStock: false });
      assert.equal(line.lineType, 'product');
      assert.equal(line.name, 'Chain');
      assert.equal(line.sku, 'SKU-1');
      assert.equal(Number(line.unitPrice), 24.99);
      assert.equal(line.qty, 2);
      assert.equal(Number(line.lineTotal), 49.98);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

// The brief's mutation check (qty <= 0 -> qty < 0) is not actually caught by
// "rejects a product line with no productId" above: that test's item has no
// productId at all, so the !productId branch of the guard throws regardless
// of where the qty boundary sits, and the mutation slips through undetected.
// This test isolates the qty boundary itself (valid productId, qty: 0) so a
// regression there - allowing a zero-quantity line through - actually fails.
test('loadDocumentLine rejects a valid product with qty 0', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const info = await prepare(
        `INSERT INTO products (sku, name, price, cost, stock_qty, active)
         VALUES ('SKU-1', 'Chain', 24.99, 10.00, 5, 1)`
      ).run();
      await assert.rejects(
        () => loadDocumentLine({ productId: info.lastInsertRowid, qty: 0 }, { checkStock: false }),
        /needs a valid productId and positive qty/
      );
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('loadDocumentLine accepts a labour line with a typed price', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const line = await loadDocumentLine(
        { lineType: 'labour', name: 'Rear hub service', unitPrice: 45, minutes: 45 },
        { checkStock: true }
      );
      assert.equal(line.lineType, 'labour');
      assert.equal(line.product, null);
      assert.equal(line.name, 'Rear hub service');
      assert.equal(Number(line.unitPrice), 45);
      assert.equal(line.qty, 1);
      assert.equal(Number(line.lineTotal), 45);
      assert.equal(line.minutes, 45);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a labour line snapshots its service, and repricing the service later does not change it', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const svc = await prepare(
        `INSERT INTO workshop_services (name, price, minutes) VALUES ('Standard service', 55.00, 60)`
      ).run();
      const line = await loadDocumentLine(
        { lineType: 'labour', serviceId: svc.lastInsertRowid },
        { checkStock: true }
      );
      assert.equal(line.name, 'Standard service');
      assert.equal(Number(line.unitPrice), 55);
      assert.equal(line.minutes, 60);

      await prepare('UPDATE workshop_services SET price = 65.00 WHERE id = ?').run(svc.lastInsertRowid);
      // The already-loaded line keeps the price it was created with.
      assert.equal(Number(line.unitPrice), 55);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a labour line needs a description and rejects a negative price', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await assert.rejects(
        () => loadDocumentLine({ lineType: 'labour', unitPrice: 10 }, { checkStock: true }),
        /needs a description/
      );
      await assert.rejects(
        () => loadDocumentLine({ lineType: 'labour', name: 'X', unitPrice: -1 }, { checkStock: true }),
        /price of zero or more/
      );
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a shop cannot see another shop\'s labour lines', async () => {
  const shopA = await createTestShop();
  const shopB = await createTestShop();
  try {
    await runWithShop(shopA.id, async () => {
      const doc = await prepare(
        `INSERT INTO sale_documents (kind, subtotal, discount, total) VALUES ('order', 45, 0, 45)`
      ).run();
      await prepare(
        `INSERT INTO sale_document_items (document_id, name, unit_price, qty, line_total, line_type, minutes)
         VALUES (?, 'A only labour', 45.00, 1, 45.00, 'labour', 45)`
      ).run(doc.lastInsertRowid);
    });
    await runWithShop(shopB.id, async () => {
      const rows = await prepare("SELECT * FROM sale_document_items WHERE line_type = 'labour'").all();
      assert.equal(rows.length, 0, 'shop B must not see shop A labour lines');
    });
  } finally {
    await deleteTestShop(shopA.id);
    await deleteTestShop(shopB.id);
  }
});

// The two tests above only prove loadDocumentLine snapshots the price into
// the object it returns - they never touch storage. A regression where the
// INSERT/SELECT path re-joined workshop_services on service_id and served
// its *current* price instead of the stored unit_price would sail past both
// of them. This test goes through the actual persisted row: insert a labour
// line (via loadDocumentLine, same as the routes do), reprice the service,
// then re-read the row from sale_document_items directly and confirm its
// stored unit_price - the value serializeSaleDocument will hand to the
// client - is untouched by the reprice.
test('a persisted labour line keeps its stored price after the service is repriced', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const svc = await prepare(
        `INSERT INTO workshop_services (name, price, minutes) VALUES ('Standard service', 55.00, 60)`
      ).run();
      const line = await loadDocumentLine({ lineType: 'labour', serviceId: svc.lastInsertRowid }, { checkStock: true });

      const doc = await prepare(
        `INSERT INTO sale_documents (kind, subtotal, discount, total) VALUES ('order', ?, 0, ?)`
      ).run(line.lineTotal, line.lineTotal);
      await prepare(
        `INSERT INTO sale_document_items (document_id, product_id, name, sku, unit_price, qty, line_total, line_type, service_id, minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        doc.lastInsertRowid,
        null,
        line.name,
        line.sku,
        line.unitPrice,
        line.qty,
        line.lineTotal,
        line.lineType,
        line.serviceId,
        line.minutes
      );

      await prepare('UPDATE workshop_services SET price = 65.00 WHERE id = ?').run(svc.lastInsertRowid);

      const stored = await prepare(
        'SELECT * FROM sale_document_items WHERE document_id = ?'
      ).all(doc.lastInsertRowid);
      assert.equal(stored.length, 1);
      assert.equal(Number(stored[0].unit_price), 55, 'stored line price must not follow a later reprice');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});
