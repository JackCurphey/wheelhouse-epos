// One-off migration: moves data out of the old SQLite files (data/accounts.db
// + data/shops/*.db) into the shared Postgres database. Only ever reads the
// SQLite files - never writes to them - so they remain a safe rollback path
// throughout and after this script runs. Run with:
//
//   node server/scripts/migrate-to-postgres.js
//
// BACK UP THE data/ DIRECTORY BEFORE RUNNING THIS. It only reads from it, but
// there is no substitute for your own copy.
//
// Skips data/epos.db and its .bak file - those pre-date multi-shop support
// and are not part of this migration's input set. If you need anything out
// of them, handle that separately; this script won't touch them.
import '../load-env.js';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SHOPS_DIR = path.join(DATA_DIR, 'shops');
const ACCOUNTS_DB = path.join(DATA_DIR, 'accounts.db');

const FORCE = process.argv.includes('--force');

function openReadOnly(filePath) {
  return new DatabaseSync(filePath, { readOnly: true });
}

// Tables migrated per shop, in FK-dependency order - each table only
// references tables earlier in this list (or none), so by the time we reach
// it every id it might reference has already been remapped.
const SHOP_TABLES = [
  'employees',
  'products',
  'customers',
  'customer_groups',
  'customer_bikes',
  'customer_group_members',
  'workshop_jobs',
  'sales',
  'sale_payments',
  'sale_items',
  'sale_documents',
  'sale_document_items',
  'stock_movements',
  'workshop_settings',
];

async function migrateShops(client) {
  if (!existsSync(ACCOUNTS_DB)) {
    console.log('No data/accounts.db found - nothing to migrate for shops/logins.');
    return new Map();
  }
  const registry = openReadOnly(ACCOUNTS_DB);
  const shopIdMap = new Map(); // old shop id -> new shop id
  const shops = registry.prepare('SELECT * FROM shops').all();
  const logins = registry.prepare('SELECT * FROM logins').all();
  registry.close();

  for (const shop of shops) {
    if (!FORCE) {
      const { rows } = await client.query('SELECT id FROM shops WHERE slug = $1', [shop.slug]);
      if (rows[0]) {
        console.log(`  Shop "${shop.slug}" already exists in Postgres (id ${rows[0].id}) - skipping (use --force to re-migrate).`);
        shopIdMap.set(shop.id, rows[0].id);
        continue;
      }
    }
    const { rows: [newShop] } = await client.query(
      'INSERT INTO shops (slug, name, created_at) VALUES ($1, $2, $3) RETURNING id',
      [shop.slug, shop.name, shop.created_at]
    );
    shopIdMap.set(shop.id, newShop.id);
    console.log(`  shops: "${shop.name}" (old id ${shop.id} -> new id ${newShop.id})`);
  }

  let loginCount = 0;
  for (const login of logins) {
    const newShopId = shopIdMap.get(login.shop_id);
    if (!newShopId) continue; // shop wasn't migrated (shouldn't happen, but skip defensively)
    await client.query(
      `INSERT INTO logins (shop_id, name, email, password_hash, is_owner, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO NOTHING`,
      [newShopId, login.name, login.email, login.password_hash, !!login.is_owner, !!login.active, login.created_at, login.updated_at]
    );
    loginCount++;
  }
  console.log(`  logins: ${loginCount} migrated (sessions are not migrated - short-lived, everyone signs in again).`);

  return shopIdMap;
}

// Reads every row of `table` from the shop's SQLite file, remaps any
// foreign-key columns found in `idMaps` (a per-table old->new id Map already
// populated by earlier tables in SHOP_TABLES), inserts into Postgres with
// the new shop_id, and records this table's own old->new id mapping (when it
// has an `id` column) for later tables to use.
async function migrateTable(client, sqliteDb, table, newShopId, idMaps, fkColumns) {
  const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
  const hasId = rows.length === 0 || 'id' in rows[0];
  const newIdMap = new Map();

  for (const row of rows) {
    const columns = Object.keys(row).filter((c) => c !== 'id');
    const values = columns.map((col) => {
      if (fkColumns[col] && row[col] != null) {
        const mapped = idMaps[fkColumns[col]]?.get(row[col]);
        return mapped ?? null; // FK pointed at a row that's missing/wasn't migrated - null it out rather than crash
      }
      return row[col];
    });
    const placeholders = columns.map((_, i) => `$${i + 2}`).join(', ');
    const sql = `INSERT INTO ${table} (shop_id, ${columns.join(', ')}) VALUES ($1, ${placeholders})${hasId ? ' RETURNING id' : ''}`;
    const { rows: inserted } = await client.query(sql, [newShopId, ...values]);
    if (hasId) newIdMap.set(row.id, inserted[0].id);
  }

  if (hasId) idMaps[table] = newIdMap;
  return rows.length;
}

// Maps each table's foreign-key columns to which earlier table's id map to
// look them up in.
const FK_COLUMNS = {
  employees: {},
  products: {},
  customers: {},
  customer_groups: {},
  customer_bikes: { customer_id: 'customers' },
  customer_group_members: { customer_id: 'customers', group_id: 'customer_groups' },
  workshop_jobs: { customer_id: 'customers', bike_id: 'customer_bikes', mechanic_id: 'employees' },
  sales: { customer_id: 'customers', cashier_id: 'employees' },
  sale_payments: { sale_id: 'sales' },
  sale_items: { sale_id: 'sales', product_id: 'products' },
  sale_documents: { customer_id: 'customers', cashier_id: 'employees', converted_sale_id: 'sales', workshop_job_id: 'workshop_jobs' },
  sale_document_items: { document_id: 'sale_documents', product_id: 'products' },
  stock_movements: { product_id: 'products' },
  workshop_settings: {},
};

async function migrateOneShop(oldShopId, newShopId, slug) {
  const dbPath = path.join(SHOPS_DIR, `${slug}.db`);
  if (!existsSync(dbPath)) {
    console.log(`  No SQLite file for shop "${slug}" at ${dbPath} - skipping its data.`);
    return;
  }
  const sqliteDb = openReadOnly(dbPath);
  const client = await pool.connect();
  const idMaps = {}; // table name -> Map(oldId -> newId), built up as we go

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(newShopId)]);

    const counts = {};
    for (const table of SHOP_TABLES) {
      const tableExists = sqliteDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table);
      if (!tableExists) continue;
      counts[table] = await migrateTable(client, sqliteDb, table, newShopId, idMaps, FK_COLUMNS[table] || {});
    }

    await client.query('COMMIT');
    console.log(`  Shop "${slug}": ${Object.entries(counts).map(([t, n]) => `${t}=${n}`).join(', ')}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw new Error(`Migration of shop "${slug}" failed and was rolled back: ${err.message}`);
  } finally {
    client.release();
    sqliteDb.close();
  }
}

async function verifyShop(oldShopId, newShopId, slug) {
  const dbPath = path.join(SHOPS_DIR, `${slug}.db`);
  if (!existsSync(dbPath)) return;
  const sqliteDb = openReadOnly(dbPath);
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(newShopId)]);
    let allOk = true;
    for (const table of SHOP_TABLES) {
      const tableExists = sqliteDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table);
      if (!tableExists) continue;
      const sourceCount = sqliteDb.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
      const { rows: [{ c: destCount }] } = await client.query(`SELECT COUNT(*)::int AS c FROM ${table} WHERE shop_id = $1`, [newShopId]);
      const ok = sourceCount === destCount;
      if (!ok) allOk = false;
      console.log(`    ${ok ? 'OK  ' : 'FAIL'} ${table}: source=${sourceCount} dest=${destCount}`);
    }
    console.log(allOk ? `  Shop "${slug}": all row counts match.` : `  Shop "${slug}": MISMATCH - do not cut over until this is resolved.`);
  } finally {
    client.release();
    sqliteDb.close();
  }
}

async function main() {
  console.log('EPOS -> Postgres data migration');
  console.log('Make sure you have backed up the data/ directory before continuing.\n');

  console.log('Migrating shop/login registry...');
  const client = await pool.connect();
  let shopIdMap;
  try {
    shopIdMap = await migrateShops(client);
  } finally {
    client.release();
  }

  if (existsSync(path.join(DATA_DIR, 'epos.db'))) {
    console.log('\nNote: data/epos.db (and any .bak file) pre-dates multi-shop support and is being left alone - not part of this migration.');
  }

  console.log('\nMigrating per-shop data...');
  const registry = existsSync(ACCOUNTS_DB) ? openReadOnly(ACCOUNTS_DB) : null;
  const shops = registry ? registry.prepare('SELECT * FROM shops').all() : [];
  if (registry) registry.close();

  for (const shop of shops) {
    const newShopId = shopIdMap.get(shop.id);
    await migrateOneShop(shop.id, newShopId, shop.slug);
  }

  console.log('\nVerifying row counts (source SQLite vs. destination Postgres)...');
  for (const shop of shops) {
    const newShopId = shopIdMap.get(shop.id);
    await verifyShop(shop.id, newShopId, shop.slug);
  }

  console.log('\nDone. The SQLite files under data/ were not modified - they remain your rollback path.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
