// tests/workshopServices.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { serializeWorkshopService } from '../server/server.js';

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

test('serializeWorkshopService converts a row to camelCase with active as a boolean', () => {
  const row = { id: 7, name: 'Puncture repair', price: '12.00', minutes: 15, active: 1 };
  assert.deepEqual(serializeWorkshopService(row), {
    id: 7,
    name: 'Puncture repair',
    price: '12.00',
    minutes: 15,
    active: true,
  });
});

test('a shop cannot see another shop\'s services', async () => {
  const shopA = await createTestShop();
  const shopB = await createTestShop();
  try {
    await runWithShop(shopA.id, async () => {
      await prepare(`INSERT INTO workshop_services (name, price, minutes) VALUES ('A only', 10, 30)`).run();
    });
    await runWithShop(shopB.id, async () => {
      const rows = await prepare('SELECT * FROM workshop_services').all();
      assert.equal(rows.length, 0, 'shop B must not see shop A services');
    });
  } finally {
    await deleteTestShop(shopA.id);
    await deleteTestShop(shopB.id);
  }
});

test('a deactivated service drops out of selection but its line keeps working', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const svc = await prepare(
        `INSERT INTO workshop_services (name, price, minutes) VALUES ('Gear index', 20.00, 20)`
      ).run();
      const doc = await prepare(
        `INSERT INTO sale_documents (kind, subtotal, discount, total) VALUES ('order', 20, 0, 20)`
      ).run();
      await prepare(
        `INSERT INTO sale_document_items (document_id, name, unit_price, qty, line_total, line_type, service_id, minutes)
         VALUES (?, 'Gear index', 20.00, 1, 20.00, 'labour', ?, 20)`
      ).run(doc.lastInsertRowid, svc.lastInsertRowid);

      await prepare('UPDATE workshop_services SET active = 0 WHERE id = ?').run(svc.lastInsertRowid);

      const selectable = await prepare('SELECT * FROM workshop_services WHERE active = 1').all();
      assert.equal(selectable.length, 0, 'a deactivated service is not selectable');

      const line = await prepare('SELECT * FROM sale_document_items WHERE document_id = ?').get(doc.lastInsertRowid);
      assert.equal(line.service_id, svc.lastInsertRowid, 'the link must not dangle');
      assert.equal(Number(line.unit_price), 20, 'the snapshotted price is untouched');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});
