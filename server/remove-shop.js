// Removes a shop and everything it owns (add-hosted-copy task 3.6c). The test
// suite's teardown (tests/helpers/testShop.js) and the hosted copy's "remove a
// shop" command (server/scripts/remove-shop.mjs) both use it, so the command
// runs what every test file already relies on.
import { pool } from './db.js';

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
// is cleaned up the day it is added. Views (all_sales) are skipped: they hold no rows of their own.
async function shopOwnedTables(client) {
  const { rows } = await client.query(`
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND c.column_name = 'shop_id' AND c.table_name <> 'shops'
      AND t.table_type = 'BASE TABLE'
  `);
  return rows.map((r) => r.table_name);
}

/** What removing the shop would take: its logins, workshop jobs and customers. */
export async function shopSummary(shopId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_shop_id', $1, true)", [String(shopId)]);
    const n = async (table) => Number((await client.query(`SELECT count(*) AS n FROM ${table} WHERE shop_id = $1`, [shopId])).rows[0].n);
    const summary = { logins: await n('logins'), jobs: await n('workshop_jobs'), customers: await n('customers') };
    await client.query('COMMIT');
    return summary;
  } finally {
    client.release();
  }
}

export async function removeShop(shopId) {
  const client = await pool.connect();
  try {
    // Savepoints below are only legal inside a transaction block.
    await client.query('BEGIN');
    // is_local = true, so the tenant setting dies with this transaction
    // rather than riding back into the pool on this client - the same
    // hardening runWithShop and auth.js's createShop now have.
    await client.query("SELECT set_config('app.current_shop_id', $1, true)", [String(shopId)]);
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
        throw new Error(`removeShop could not clear: ${failed.join(', ')}`);
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
