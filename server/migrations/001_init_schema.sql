-- EPOS initial PostgreSQL schema.
--
-- Every shop-scoped table carries a shop_id column defaulted from the
-- session variable `app.current_shop_id` (set once per request - see
-- runWithShop in server/db.js), and a Row-Level Security policy that filters
-- on that same variable. This means: (1) INSERTs never need to name shop_id
-- explicitly - Postgres fills it in from the session automatically, and (2)
-- every SELECT/UPDATE/DELETE is transparently scoped to the current shop
-- with no WHERE clause changes needed anywhere in server.js - a forgotten
-- filter can't leak another shop's data, because there IS no filter to
-- forget. A session that never sets app.current_shop_id gets a hard error
-- from current_setting(), not silently-empty results - fail loud, not
-- fail open.
--
-- Boolean-ish columns (active, is_owner, is_mechanic, is_cashier) stay
-- INTEGER (0/1) rather than native BOOLEAN, since server.js's SQL text
-- compares them with `= 1` / `= 0` throughout (ported as-is from the
-- SQLite version to keep the migration's application-code diff minimal) -
-- changing these to BOOLEAN would require rewriting every one of those
-- comparisons too.

-- ---------- Registry: shops / logins / sessions ----------
-- No shop_id, no RLS - these are what *resolves* which shop a request
-- belongs to, so they're queried before any shop context exists. Only
-- auth.js touches them directly.

CREATE TABLE shops (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE logins (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_owner BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  login_id INTEGER NOT NULL REFERENCES logins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- ---------- Shop-scoped tables ----------

CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL,
  is_mechanic INTEGER NOT NULL DEFAULT 0,
  is_cashier INTEGER NOT NULL DEFAULT 0,
  working_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_employees_shop ON employees(shop_id);
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees FORCE ROW LEVEL SECURITY;
CREATE POLICY employees_shop_isolation ON employees
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  sku TEXT,
  barcode TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Uncategorised',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 3,
  supplier TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Uniqueness must be scoped per shop now that products from every shop share
-- one table - two shops both having SKU "TUBE-700" is fine and expected.
CREATE UNIQUE INDEX idx_products_sku_per_shop ON products(shop_id, sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX idx_products_barcode_per_shop ON products(shop_id, barcode) WHERE barcode IS NOT NULL;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
CREATE POLICY products_shop_isolation ON products
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_shop ON customers(shop_id);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
CREATE POLICY customers_shop_isolation ON customers
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE customer_groups (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_customer_groups_name_per_shop ON customer_groups(shop_id, name);
ALTER TABLE customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_groups_shop_isolation ON customer_groups
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE customer_bikes (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  make TEXT DEFAULT '',
  model TEXT DEFAULT '',
  colour TEXT DEFAULT '',
  serial_number TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_bikes_shop ON customer_bikes(shop_id);
CREATE INDEX idx_customer_bikes_customer ON customer_bikes(customer_id);
ALTER TABLE customer_bikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_bikes FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_bikes_shop_isolation ON customer_bikes
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- shop_id is denormalized here (also derivable via customer_id/group_id)
-- so RLS can do a cheap direct-column check without a subquery join.
CREATE TABLE customer_group_members (
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  group_id INTEGER NOT NULL REFERENCES customer_groups(id),
  PRIMARY KEY (shop_id, customer_id, group_id)
);
ALTER TABLE customer_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_group_members FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_group_members_shop_isolation ON customer_group_members
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE workshop_jobs (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  title TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  bike_id INTEGER REFERENCES customer_bikes(id),
  mechanic_id INTEGER REFERENCES employees(id),
  job_date TEXT NOT NULL,
  start_time TEXT DEFAULT '',
  end_time TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workshop_jobs_shop_date ON workshop_jobs(shop_id, job_date);
ALTER TABLE workshop_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_jobs_shop_isolation ON workshop_jobs
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE sales (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_id INTEGER REFERENCES customers(id),
  cashier_id INTEGER REFERENCES employees(id),
  subtotal NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL, -- 'Cash' | 'Card' | 'Split'
  cash_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  card_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  cash_tendered NUMERIC(10,2),
  note TEXT DEFAULT '',
  group_discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  group_discount_name TEXT DEFAULT ''
);
CREATE INDEX idx_sales_shop_created ON sales(shop_id, created_at);
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales FORCE ROW LEVEL SECURITY;
CREATE POLICY sales_shop_isolation ON sales
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Extra tender lines beyond cash/card (e.g. Cyclescheme, Klarna). Cash/card
-- amounts stay on the sales row itself since change-due logic is cash-specific.
CREATE TABLE sale_payments (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  tender_type TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL
);
CREATE INDEX idx_sale_payments_shop_sale ON sale_payments(shop_id, sale_id);
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY sale_payments_shop_isolation ON sale_payments
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE sale_items (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  product_id INTEGER REFERENCES products(id),
  name TEXT NOT NULL,
  sku TEXT,
  unit_price NUMERIC(10,2) NOT NULL,
  qty INTEGER NOT NULL,
  line_total NUMERIC(10,2) NOT NULL
);
CREATE INDEX idx_sale_items_shop_sale ON sale_items(shop_id, sale_id);
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items FORCE ROW LEVEL SECURITY;
CREATE POLICY sale_items_shop_isolation ON sale_items
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE sale_documents (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  kind TEXT NOT NULL, -- 'quote' | 'order'
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'converted' | 'cancelled'
  title TEXT DEFAULT '',
  customer_id INTEGER REFERENCES customers(id),
  cashier_id INTEGER REFERENCES employees(id),
  subtotal NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  note TEXT DEFAULT '',
  converted_sale_id INTEGER REFERENCES sales(id),
  workshop_job_id INTEGER REFERENCES workshop_jobs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_documents_shop_kind ON sale_documents(shop_id, kind, status);
ALTER TABLE sale_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY sale_documents_shop_isolation ON sale_documents
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE sale_document_items (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  document_id INTEGER NOT NULL REFERENCES sale_documents(id),
  product_id INTEGER REFERENCES products(id),
  name TEXT NOT NULL,
  sku TEXT,
  unit_price NUMERIC(10,2) NOT NULL,
  qty INTEGER NOT NULL,
  line_total NUMERIC(10,2) NOT NULL
);
CREATE INDEX idx_sale_document_items_shop_doc ON sale_document_items(shop_id, document_id);
ALTER TABLE sale_document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_document_items FORCE ROW LEVEL SECURITY;
CREATE POLICY sale_document_items_shop_isolation ON sale_document_items
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE stock_movements (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  change_qty INTEGER NOT NULL,
  type TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_movements_shop_product ON stock_movements(shop_id, product_id);
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY stock_movements_shop_isolation ON stock_movements
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- One row per shop (was a single global id=1 singleton under the old
-- one-file-per-shop design) - server.js looks it up with a plain
-- `LIMIT 1`, relying on RLS + this UNIQUE constraint to guarantee exactly
-- one visible row per shop.
CREATE TABLE workshop_settings (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL UNIQUE DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  opening_time TEXT NOT NULL DEFAULT '09:00',
  closing_time TEXT NOT NULL DEFAULT '18:00',
  opening_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE workshop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_settings_shop_isolation ON workshop_settings
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
