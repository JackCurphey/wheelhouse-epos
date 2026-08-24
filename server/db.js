// Database layer for the bike shop EPOS.
// Uses Node's built-in node:sqlite module (available from Node 22.5+) so the
// app needs zero npm install to run.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', 'data');
const SHOPS_DIR = path.join(DATA_DIR, 'shops');
mkdirSync(SHOPS_DIR, { recursive: true });

export function shopDbPath(slug) {
  return path.join(SHOPS_DIR, `${slug}.db`);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE,
  barcode TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Uncategorised',
  price REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 3,
  supplier TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS customer_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS customer_group_members (
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  group_id INTEGER NOT NULL REFERENCES customer_groups(id),
  PRIMARY KEY (customer_id, group_id)
);

CREATE TABLE IF NOT EXISTS customer_bikes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  make TEXT DEFAULT '',
  model TEXT DEFAULT '',
  colour TEXT DEFAULT '',
  serial_number TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  customer_id INTEGER REFERENCES customers(id),
  cashier_id INTEGER REFERENCES employees(id),
  subtotal REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT NOT NULL, -- 'Cash' | 'Card' | 'Split'
  cash_amount REAL NOT NULL DEFAULT 0,
  card_amount REAL NOT NULL DEFAULT 0,
  cash_tendered REAL,
  note TEXT DEFAULT ''
);

-- Extra tender lines beyond cash/card (e.g. Cyclescheme, Klarna). Cash/card
-- amounts stay on the sales row itself since change-due logic is cash-specific.
CREATE TABLE IF NOT EXISTS sale_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  tender_type TEXT NOT NULL,
  amount REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  product_id INTEGER REFERENCES products(id),
  name TEXT NOT NULL,
  sku TEXT,
  unit_price REAL NOT NULL,
  qty INTEGER NOT NULL,
  line_total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  change_qty INTEGER NOT NULL,
  type TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sale_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL, -- 'quote' | 'order'
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'converted' | 'cancelled'
  title TEXT DEFAULT '',
  customer_id INTEGER REFERENCES customers(id),
  cashier_id INTEGER REFERENCES employees(id),
  subtotal REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  note TEXT DEFAULT '',
  converted_sale_id INTEGER REFERENCES sales(id),
  workshop_job_id INTEGER REFERENCES workshop_jobs(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sale_document_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES sale_documents(id),
  product_id INTEGER REFERENCES products(id),
  name TEXT NOT NULL,
  sku TEXT,
  unit_price REAL NOT NULL,
  qty INTEGER NOT NULL,
  line_total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS workshop_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  bike_id INTEGER REFERENCES customer_bikes(id),
  mechanic_id INTEGER REFERENCES employees(id),
  job_date TEXT NOT NULL,
  start_time TEXT DEFAULT '',
  end_time TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  is_mechanic INTEGER NOT NULL DEFAULT 0,
  is_cashier INTEGER NOT NULL DEFAULT 0,
  working_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS workshop_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  opening_time TEXT NOT NULL DEFAULT '09:00',
  closing_time TEXT NOT NULL DEFAULT '18:00',
  opening_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;

const dbCache = new Map(); // slug -> DatabaseSync, opened lazily and kept open for the process lifetime

function openShopDb(slug) {
  const db = new DatabaseSync(shopDbPath(slug));
  // Use the default rollback-journal mode rather than WAL: WAL relies on
  // shared-memory mapping that some filesystems (network drives, some
  // mounted/synced folders) don't support, and a single-till local app
  // doesn't need WAL's concurrent-reader benefits anyway.
  try {
    db.exec('PRAGMA journal_mode = DELETE;');
  } catch (_) {
    // Fall back silently - SQLite's own default is already a safe choice.
  }
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);

  // Migration: mechanics and cashiers used to be separate tables. Merge any
  // leftover rows from those into employees (matching by name, since the
  // same person is often both), repoint every workshop_jobs.mechanic_id /
  // sales.cashier_id / sale_documents.cashier_id at the merged employee, and
  // retire the old tables. Runs once - after this, mechanics/cashiers no
  // longer exist, so the guard below skips it on every later start.
  const tableExists = (name) =>
    !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);

  if (tableExists('mechanics') || tableExists('cashiers')) {
    // Off for the whole block: the remap UPDATEs below point mechanic_id/
    // cashier_id at brand-new employees ids before the columns' own
    // REFERENCES metadata has been corrected to target employees(id), which
    // would otherwise violate the (still-old) mechanics/cashiers FK. Must be
    // set before BEGIN - SQLite ignores this pragma inside a transaction.
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec('BEGIN;');
    try {
    const mechRows = tableExists('mechanics') ? db.prepare('SELECT * FROM mechanics').all() : [];
    const cashierRows = tableExists('cashiers') ? db.prepare('SELECT * FROM cashiers').all() : [];
    const mechanicIdMap = new Map();
    const cashierIdMap = new Map();

    if (mechRows.length || cashierRows.length) {
      const nameKey = (n) => (n || '').trim().toLowerCase();
      const employeeIdByName = new Map();
      const insertEmployee = db.prepare(
        `INSERT INTO employees (name, is_mechanic, is_cashier, working_days, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );

      for (const m of mechRows) {
        const info = insertEmployee.run(m.name, 1, 0, m.working_days || '[0,1,2,3,4,5,6]', m.active, m.created_at, m.updated_at);
        const empId = info.lastInsertRowid;
        employeeIdByName.set(nameKey(m.name), empId);
        mechanicIdMap.set(m.id, empId);
      }
      for (const c of cashierRows) {
        const key = nameKey(c.name);
        if (employeeIdByName.has(key)) {
          const empId = employeeIdByName.get(key);
          const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(empId);
          db.prepare('UPDATE employees SET is_cashier = 1, active = ?, updated_at = ? WHERE id = ?').run(
            existing.active || c.active ? 1 : 0,
            new Date().toISOString(),
            empId
          );
          cashierIdMap.set(c.id, empId);
        } else {
          const info = insertEmployee.run(c.name, 0, 1, '[0,1,2,3,4,5,6]', c.active, c.created_at, c.updated_at);
          const empId = info.lastInsertRowid;
          employeeIdByName.set(key, empId);
          cashierIdMap.set(c.id, empId);
        }
      }

      for (const [oldId, newId] of mechanicIdMap) {
        db.prepare('UPDATE workshop_jobs SET mechanic_id = ? WHERE mechanic_id = ?').run(newId, oldId);
      }
      for (const [oldId, newId] of cashierIdMap) {
        db.prepare('UPDATE sales SET cashier_id = ? WHERE cashier_id = ?').run(newId, oldId);
        db.prepare('UPDATE sale_documents SET cashier_id = ? WHERE cashier_id = ?').run(newId, oldId);
      }
    }

    // workshop_jobs.mechanic_id and sales/sale_documents.cashier_id may still
    // carry REFERENCES metadata pointing at the old mechanics/cashiers
    // tables (SQLite can't ALTER a column's REFERENCES target in place), so
    // rebuild each table - identical columns/order, just re-declared against
    // employees(id). Built under a temp name and swapped in via DROP+RENAME
    // (rather than renaming the live table away first) so other tables'
    // REFERENCES clauses - which SQLite resolves by name - keep resolving
    // to the same final table throughout.
    db.exec(`
      CREATE TABLE workshop_jobs_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        customer_id INTEGER REFERENCES customers(id),
        bike_id INTEGER REFERENCES customer_bikes(id),
        mechanic_id INTEGER REFERENCES employees(id),
        job_date TEXT NOT NULL,
        start_time TEXT DEFAULT '',
        end_time TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'scheduled',
        notes TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
    `);
    // Named columns on both sides - ALTER TABLE ADD COLUMN always appends at
    // the end, so this table's on-disk column order won't match the fresh
    // CREATE TABLE order above, and a positional `SELECT *` would silently
    // copy values into the wrong columns.
    db.exec(`
      INSERT INTO workshop_jobs_new (id, title, customer_id, bike_id, mechanic_id, job_date, start_time, end_time, status, notes, created_at, updated_at)
      SELECT id, title, customer_id, bike_id, mechanic_id, job_date, start_time, end_time, status, notes, created_at, updated_at FROM workshop_jobs;
    `);
    db.exec('DROP TABLE workshop_jobs;');
    db.exec('ALTER TABLE workshop_jobs_new RENAME TO workshop_jobs;');

    db.exec(`
      CREATE TABLE sales_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        customer_id INTEGER REFERENCES customers(id),
        cashier_id INTEGER REFERENCES employees(id),
        subtotal REAL NOT NULL,
        discount REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL,
        payment_method TEXT NOT NULL,
        cash_tendered REAL,
        note TEXT DEFAULT ''
      );
    `);
    db.exec(`
      INSERT INTO sales_new (id, created_at, customer_id, cashier_id, subtotal, discount, total, payment_method, cash_tendered, note)
      SELECT id, created_at, customer_id, cashier_id, subtotal, discount, total, payment_method, cash_tendered, note FROM sales;
    `);
    db.exec('DROP TABLE sales;');
    db.exec('ALTER TABLE sales_new RENAME TO sales;');

    db.exec(`
      CREATE TABLE sale_documents_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        title TEXT DEFAULT '',
        customer_id INTEGER REFERENCES customers(id),
        cashier_id INTEGER REFERENCES employees(id),
        subtotal REAL NOT NULL,
        discount REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL,
        note TEXT DEFAULT '',
        converted_sale_id INTEGER REFERENCES sales(id),
        workshop_job_id INTEGER REFERENCES workshop_jobs(id),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
    `);
    db.exec(`
      INSERT INTO sale_documents_new (id, kind, status, title, customer_id, cashier_id, subtotal, discount, total, note, converted_sale_id, workshop_job_id, created_at, updated_at)
      SELECT id, kind, status, title, customer_id, cashier_id, subtotal, discount, total, note, converted_sale_id, workshop_job_id, created_at, updated_at FROM sale_documents;
    `);
    db.exec('DROP TABLE sale_documents;');
    db.exec('ALTER TABLE sale_documents_new RENAME TO sale_documents;');

    if (tableExists('mechanics')) db.exec('DROP TABLE mechanics;');
    if (tableExists('cashiers')) db.exec('DROP TABLE cashiers;');

    db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    } finally {
      db.exec('PRAGMA foreign_keys = ON;');
    }
  }

  // Migration: sales tables created before customer accounts existed won't
  // have this column yet, and CREATE TABLE IF NOT EXISTS above won't add it.
  const salesCols = db.prepare("PRAGMA table_info(sales)").all();
  if (!salesCols.some((c) => c.name === 'customer_id')) {
    db.exec('ALTER TABLE sales ADD COLUMN customer_id INTEGER REFERENCES customers(id);');
  }
  if (!salesCols.some((c) => c.name === 'cashier_id')) {
    db.exec('ALTER TABLE sales ADD COLUMN cashier_id INTEGER REFERENCES employees(id);');
  }
  if (!salesCols.some((c) => c.name === 'cash_amount')) {
    db.exec('ALTER TABLE sales ADD COLUMN cash_amount REAL NOT NULL DEFAULT 0;');
    db.exec('ALTER TABLE sales ADD COLUMN card_amount REAL NOT NULL DEFAULT 0;');
    // Backfill: sales recorded before split tender existed were entirely one
    // method, so the full total goes to whichever column matches.
    db.exec("UPDATE sales SET cash_amount = total WHERE payment_method = 'Cash';");
    db.exec("UPDATE sales SET card_amount = total WHERE payment_method = 'Card';");
  }

  const productCols = db.prepare("PRAGMA table_info(products)").all();
  if (!productCols.some((c) => c.name === 'barcode')) {
    db.exec('ALTER TABLE products ADD COLUMN barcode TEXT;');
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);');

  const workshopJobCols = db.prepare("PRAGMA table_info(workshop_jobs)").all();
  if (!workshopJobCols.some((c) => c.name === 'end_time')) {
    db.exec("ALTER TABLE workshop_jobs ADD COLUMN end_time TEXT DEFAULT '';");
  }
  // Backfill: jobs scheduled before end times existed get a default 1-hour
  // block so every timed job is a valid, resizable block on the diary grid.
  db.exec(`
    UPDATE workshop_jobs
    SET end_time = printf('%02d:%02d',
          ((CAST(substr(start_time,1,2) AS INTEGER)*60 + CAST(substr(start_time,4,2) AS INTEGER) + 60) / 60) % 24,
          (CAST(substr(start_time,1,2) AS INTEGER)*60 + CAST(substr(start_time,4,2) AS INTEGER) + 60) % 60)
    WHERE start_time IS NOT NULL AND start_time != '' AND (end_time IS NULL OR end_time = '');
  `);

  if (!workshopJobCols.some((c) => c.name === 'bike_id')) {
    db.exec('ALTER TABLE workshop_jobs ADD COLUMN bike_id INTEGER REFERENCES customer_bikes(id);');
  }
  if (!workshopJobCols.some((c) => c.name === 'mechanic_id')) {
    db.exec('ALTER TABLE workshop_jobs ADD COLUMN mechanic_id INTEGER REFERENCES employees(id);');
  }
  if (!workshopJobCols.some((c) => c.name === 'status')) {
    db.exec("ALTER TABLE workshop_jobs ADD COLUMN status TEXT NOT NULL DEFAULT 'scheduled';");
  }

  const workshopSettingsCols = db.prepare("PRAGMA table_info(workshop_settings)").all();
  if (!workshopSettingsCols.some((c) => c.name === 'opening_days')) {
    db.exec("ALTER TABLE workshop_settings ADD COLUMN opening_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]';");
  }

  const saleDocCols = db.prepare("PRAGMA table_info(sale_documents)").all();
  if (!saleDocCols.some((c) => c.name === 'title')) {
    db.exec("ALTER TABLE sale_documents ADD COLUMN title TEXT DEFAULT '';");
  }
  if (!saleDocCols.some((c) => c.name === 'workshop_job_id')) {
    db.exec('ALTER TABLE sale_documents ADD COLUMN workshop_job_id INTEGER REFERENCES workshop_jobs(id);');
  }
  if (!saleDocCols.some((c) => c.name === 'cashier_id')) {
    db.exec('ALTER TABLE sale_documents ADD COLUMN cashier_id INTEGER REFERENCES employees(id);');
  }

  // Every workshop job should have an order behind it (so it's findable from
  // the Orders page). Backfills a placeholder order for any job that
  // predates that rule or otherwise ended up without one; no-op once caught
  // up, since the WHERE NOT EXISTS only matches jobs still missing one.
  db.exec(`
    INSERT INTO sale_documents (kind, customer_id, subtotal, discount, total, note, title, workshop_job_id, updated_at)
    SELECT 'order', w.customer_id, 0, 0, 0, w.notes, w.title, w.id, strftime('%Y-%m-%dT%H:%M:%fZ','now')
    FROM workshop_jobs w
    WHERE NOT EXISTS (SELECT 1 FROM sale_documents d WHERE d.workshop_job_id = w.id);
  `);

  db.exec('INSERT OR IGNORE INTO workshop_settings (id, opening_time, closing_time) VALUES (1, \'09:00\', \'18:00\');');

  const groupCount = db.prepare('SELECT COUNT(*) AS c FROM customer_groups').get();
  if (groupCount.c === 0) {
    const insertGroup = db.prepare('INSERT INTO customer_groups (name) VALUES (?)');
    insertGroup.run('Blue Light');
    insertGroup.run('ACC');
  }

  return db;
}

// Returns the (cached, already-migrated) database for one shop, opening and
// initialising its file on first use. Each shop's data lives in its own
// file under data/shops/ so one shop's data is never queryable from another
// shop's session - see server.js, which resolves the shop from the session
// cookie before any handler touches `db`.
export function getShopDb(slug) {
  let db = dbCache.get(slug);
  if (!db) {
    db = openShopDb(slug);
    dbCache.set(slug, db);
  }
  return db;
}
