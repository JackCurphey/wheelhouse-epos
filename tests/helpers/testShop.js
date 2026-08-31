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
    // Children before parents. sale_documents must go before sales because
    // converted_sale_id points at it, and before workshop_jobs because
    // workshop_job_id does.
    await client.query('DELETE FROM sale_document_items WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM sale_documents WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM sale_items WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM workshop_services WHERE shop_id = $1', [shopId]);
    // sale_payments.sale_id has no ON DELETE CASCADE, so it must be cleared
    // before sales or the delete below fails with a foreign-key violation.
    await client.query('DELETE FROM sale_payments WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM sales WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM stock_movements WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM workshop_job_attachments WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM workshop_jobs WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM workshop_settings WHERE shop_id = $1', [shopId]);
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
