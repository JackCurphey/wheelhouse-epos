import { randomUUID } from 'node:crypto';
import { pool } from '../../server/db.js';

export async function createTestShop(overrides = {}) {
  const slug = overrides.slug || `test-${randomUUID().slice(0, 8)}`;
  const name = overrides.name || `Test Shop ${slug}`;
  const { rows: [shop] } = await pool.query(
    'INSERT INTO shops (name, slug) VALUES ($1, $2) RETURNING *',
    [name, slug]
  );
  return shop;
}

export async function deleteTestShop(shopId) {
  await pool.query('DELETE FROM shops WHERE id = $1', [shopId]);
}
