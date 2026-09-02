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

// Rows that belong to a shop without carrying shop_id themselves - they hang
// off a row that does. Deleted first, by their parent's shop.
const INDIRECT_CLEANUP = [
  'DELETE FROM sessions WHERE login_id IN (SELECT id FROM logins WHERE shop_id = $1)',
  'DELETE FROM customer_sessions WHERE customer_login_id IN (SELECT id FROM customer_logins WHERE shop_id = $1)',
  'DELETE FROM workshop_job_attachments WHERE workshop_job_id IN (SELECT id FROM workshop_jobs WHERE shop_id = $1)',
];

// Every table carrying a shop_id, discovered rather than listed. An explicit
// list went stale twice while writing the workshop tests - createShop() seeds
// customer_groups and suppliers, and each one only announced itself as a
// foreign-key error during teardown. Discovery means a new tenant-owned table
// is cleaned up the day it is added.
async function shopOwnedTables(client) {
  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'shop_id' AND table_name <> 'shops'
  `);
  return rows.map((r) => r.table_name);
}

export async function deleteTestShop(shopId) {
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shopId)]);
    // Savepoints below are only legal inside a transaction block.
    await client.query('BEGIN');
    for (const sql of INDIRECT_CLEANUP) await client.query(sql, [shopId]);

    // Tables reference each other (workshop_jobs ← sale_documents, customers
    // ← customer_bikes), so a single pass in an arbitrary order hits foreign
    // keys. Retry the ones that fail until a full pass clears nothing more -
    // then any remainder is a real problem worth surfacing.
    let pending = await shopOwnedTables(client);
    while (pending.length) {
      const failed = [];
      for (const table of pending) {
        try {
          await client.query('SAVEPOINT tbl');
          await client.query(`DELETE FROM ${table} WHERE shop_id = $1`, [shopId]);
          await client.query('RELEASE SAVEPOINT tbl');
        } catch {
          await client.query('ROLLBACK TO SAVEPOINT tbl');
          failed.push(table);
        }
      }
      if (failed.length === pending.length) {
        throw new Error(`deleteTestShop could not clear: ${failed.join(', ')}`);
      }
      pending = failed;
    }

    await client.query('DELETE FROM shops WHERE id = $1', [shopId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
