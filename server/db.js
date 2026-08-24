// Database layer for the bike shop EPOS.
// Uses Node's built-in node:sqlite module (available from Node 22.5+) so the
// app needs zero npm install to run.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'epos.db');

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

const SEED_PRODUCTS = [
  // Bikes
  { sku: 'BIKE-HYB-001', name: 'Ridgeway Hybrid 700c', category: 'Bikes', price: 449.99, cost: 280.00, stock_qty: 6, low_stock_threshold: 2, supplier: 'Ridgeway Cycles' },
  { sku: 'BIKE-MTB-001', name: 'Summit Trail 27.5" Mountain Bike', category: 'Bikes', price: 599.00, cost: 380.00, stock_qty: 4, low_stock_threshold: 2, supplier: 'Summit Bikes Ltd' },
  { sku: 'BIKE-RD-001', name: 'Velocé Carbon Road Bike', category: 'Bikes', price: 1299.00, cost: 850.00, stock_qty: 2, low_stock_threshold: 1, supplier: 'Veloce Imports' },
  { sku: 'BIKE-KID-001', name: "Kids' 20\" Explorer Bike", category: 'Bikes', price: 189.99, cost: 110.00, stock_qty: 5, low_stock_threshold: 2, supplier: 'Ridgeway Cycles' },
  { sku: 'BIKE-EBK-001', name: 'Volt Electric City Bike', category: 'Bikes', price: 1599.00, cost: 1050.00, stock_qty: 3, low_stock_threshold: 1, supplier: 'Volt E-Bikes' },
  // Parts
  { sku: 'PRT-TUBE-26', name: 'Inner Tube 26"', category: 'Parts', price: 6.99, cost: 2.10, stock_qty: 40, low_stock_threshold: 10, supplier: 'CycleParts Wholesale' },
  { sku: 'PRT-TUBE-700', name: 'Inner Tube 700c', category: 'Parts', price: 7.49, cost: 2.30, stock_qty: 35, low_stock_threshold: 10, supplier: 'CycleParts Wholesale' },
  { sku: 'PRT-BRKPAD-01', name: 'Disc Brake Pads (pair)', category: 'Parts', price: 14.99, cost: 5.00, stock_qty: 18, low_stock_threshold: 5, supplier: 'CycleParts Wholesale' },
  { sku: 'PRT-CHAIN-01', name: '9-Speed Chain', category: 'Parts', price: 19.99, cost: 8.50, stock_qty: 12, low_stock_threshold: 4, supplier: 'CycleParts Wholesale' },
  { sku: 'PRT-TYRE-26', name: 'Tyre 26" x 2.1 All-Terrain', category: 'Parts', price: 22.99, cost: 9.00, stock_qty: 16, low_stock_threshold: 4, supplier: 'CycleParts Wholesale' },
  { sku: 'PRT-SADDLE-01', name: 'Comfort Gel Saddle', category: 'Parts', price: 27.50, cost: 11.00, stock_qty: 9, low_stock_threshold: 3, supplier: 'ComfortRide Co' },
  { sku: 'PRT-PEDAL-01', name: 'Alloy Platform Pedals (pair)', category: 'Parts', price: 15.99, cost: 6.00, stock_qty: 14, low_stock_threshold: 4, supplier: 'CycleParts Wholesale' },
  // Accessories
  { sku: 'ACC-HELM-01', name: 'Adult Cycling Helmet', category: 'Accessories', price: 34.99, cost: 14.00, stock_qty: 20, low_stock_threshold: 5, supplier: 'SafeHead Ltd' },
  { sku: 'ACC-HELM-KID', name: "Kids' Cycling Helmet", category: 'Accessories', price: 24.99, cost: 9.50, stock_qty: 15, low_stock_threshold: 5, supplier: 'SafeHead Ltd' },
  { sku: 'ACC-LOCK-01', name: 'D-Lock with Cable', category: 'Accessories', price: 29.99, cost: 12.00, stock_qty: 11, low_stock_threshold: 4, supplier: 'SecureCycle' },
  { sku: 'ACC-LIGHT-SET', name: 'Front & Rear LED Light Set', category: 'Accessories', price: 18.99, cost: 6.50, stock_qty: 25, low_stock_threshold: 6, supplier: 'BrightWay' },
  { sku: 'ACC-PUMP-01', name: 'Mini Track Pump', category: 'Accessories', price: 16.99, cost: 6.00, stock_qty: 13, low_stock_threshold: 4, supplier: 'CycleParts Wholesale' },
  { sku: 'ACC-BOTTLE-01', name: 'Water Bottle & Cage', category: 'Accessories', price: 9.99, cost: 3.20, stock_qty: 30, low_stock_threshold: 8, supplier: 'HydroRide' },
  { sku: 'ACC-PANNIER-01', name: 'Rear Pannier Rack Bag', category: 'Accessories', price: 39.99, cost: 16.00, stock_qty: 8, low_stock_threshold: 3, supplier: 'HydroRide' },
  { sku: 'ACC-GLOVE-01', name: 'Padded Cycling Gloves', category: 'Accessories', price: 12.99, cost: 4.50, stock_qty: 17, low_stock_threshold: 5, supplier: 'ComfortRide Co' },
  // Services
  { sku: 'SVC-TUNE-01', name: 'Basic Bike Tune-Up (Service)', category: 'Services', price: 35.00, cost: 0, stock_qty: 999, low_stock_threshold: 0, supplier: '' },
  { sku: 'SVC-TUNE-02', name: 'Full Service & Safety Check', category: 'Services', price: 65.00, cost: 0, stock_qty: 999, low_stock_threshold: 0, supplier: '' },
  { sku: 'SVC-PUNC-01', name: 'Puncture Repair (Service)', category: 'Services', price: 12.00, cost: 0, stock_qty: 999, low_stock_threshold: 0, supplier: '' },
];

let dbInstance = null;

export function initDb() {
  if (dbInstance) return dbInstance;
  const db = new DatabaseSync(DB_PATH);
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

  const countRow = db.prepare('SELECT COUNT(*) AS c FROM products').get();
  if (countRow.c === 0) {
    const insert = db.prepare(`
      INSERT INTO products (sku, name, category, price, cost, stock_qty, low_stock_threshold, supplier)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of SEED_PRODUCTS) {
      insert.run(p.sku, p.name, p.category, p.price, p.cost, p.stock_qty, p.low_stock_threshold, p.supplier);
    }
  }

  db.exec('INSERT OR IGNORE INTO workshop_settings (id, opening_time, closing_time) VALUES (1, \'09:00\', \'18:00\');');

  dbInstance = db;
  return db;
}

export function getDb() {
  if (!dbInstance) return initDb();
  return dbInstance;
}
