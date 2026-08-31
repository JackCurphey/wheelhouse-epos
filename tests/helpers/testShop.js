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
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shopId)]);
    await client.query('DELETE FROM sessions WHERE login_id IN (SELECT id FROM logins WHERE shop_id = $1)', [shopId]);
    await client.query('DELETE FROM logins WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM customer_sessions WHERE customer_login_id IN (SELECT id FROM customer_logins WHERE shop_id = $1)', [shopId]);
    await client.query('DELETE FROM customer_logins WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM sale_documents WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM workshop_jobs WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM customer_bikes WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM customers WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM employees WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM storefront_settings WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM shopify_connections WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM shopify_processed_events WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM products WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM shops WHERE id = $1', [shopId]);
  } finally {
    client.release();
  }
}
