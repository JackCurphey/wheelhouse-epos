// tests/workshopServices.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

test('a service row stores a name, price and duration', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const info = await prepare(
        `INSERT INTO workshop_services (name, price, minutes) VALUES ('Standard service', 55.00, 60)`
      ).run();
      const row = await prepare('SELECT * FROM workshop_services WHERE id = ?').get(info.lastInsertRowid);
      assert.equal(row.name, 'Standard service');
      assert.equal(Number(row.price), 55);
      assert.equal(row.minutes, 60);
      assert.equal(row.active, 1);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a labour line cannot carry a product, and a product line must have one', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const product = await prepare(
        `INSERT INTO products (sku, name, price, cost, stock_qty, active)
         VALUES ('SKU-1', 'Chain', 24.99, 10.00, 5, 1)`
      ).run();
      const doc = await prepare(
        `INSERT INTO sale_documents (kind, subtotal, discount, total) VALUES ('order', 0, 0, 0)`
      ).run();

      await assert.rejects(
        prepare(
          `INSERT INTO sale_document_items (document_id, product_id, name, unit_price, qty, line_total, line_type)
           VALUES (?, ?, 'Bad', 10, 1, 10, 'labour')`
        ).run(doc.lastInsertRowid, product.lastInsertRowid),
        /sale_document_items_labour_has_no_product/
      );

      await assert.rejects(
        prepare(
          `INSERT INTO sale_document_items (document_id, name, unit_price, qty, line_total, line_type)
           VALUES (?, 'Bad', 10, 1, 10, 'product')`
        ).run(doc.lastInsertRowid),
        /sale_document_items_product_has_product/
      );
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});
