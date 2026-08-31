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
