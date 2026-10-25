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

// The deletion itself lives in the server (server/remove-shop.js), so the
// hosted copy's "remove a shop" command uses exactly what every test file
// here relies on (add-hosted-copy task 3.6c).
export { removeShop as deleteTestShop } from '../../server/remove-shop.js';
