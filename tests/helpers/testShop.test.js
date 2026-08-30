import test from 'node:test';
import assert from 'node:assert/strict';
import '../../server/load-env.js';
import { pool } from '../../server/db.js';
import { createTestShop, deleteTestShop } from './testShop.js';

test('createTestShop creates a shop row and deleteTestShop removes it', async () => {
  const shop = await createTestShop();
  assert.ok(shop.id, 'shop should have an id');
  assert.match(shop.slug, /^test-/);

  const { rows: [found] } = await pool.query('SELECT * FROM shops WHERE id = $1', [shop.id]);
  assert.equal(found.slug, shop.slug);

  await deleteTestShop(shop.id);
  const { rows: [gone] } = await pool.query('SELECT * FROM shops WHERE id = $1', [shop.id]);
  assert.equal(gone, undefined);
});

test.after(async () => {
  await pool.end();
});
