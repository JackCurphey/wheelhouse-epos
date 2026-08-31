// tests/saleDocuments.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

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
