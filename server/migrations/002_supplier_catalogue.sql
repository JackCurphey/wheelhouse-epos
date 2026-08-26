-- Supplier catalogue sync: distributors publish item data (price, stock,
-- barcode), staff review new items before they become real products. See
-- server/suppliers/ for the adapter that produces the rows this stores.

CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL,
  adapter_type TEXT NOT NULL,           -- 'mock_csv' today; a real distributor adapter later
  config JSONB NOT NULL DEFAULT '{}',   -- adapter-specific: file path, API creds, etc.
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_suppliers_name_per_shop ON suppliers(shop_id, name);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;
CREATE POLICY suppliers_shop_isolation ON suppliers
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- One row per (supplier, supplier_sku) ever seen. status drives the review
-- queue; product_id is only set once an item has been imported. Re-syncing
-- upserts price/stock/name/barcode/last_seen_at on existing rows but never
-- touches status or product_id (see server/suppliers/index.js's upsert),
-- so an already-imported or already-ignored item doesn't reappear as "new"
-- just because the feed still lists it.
CREATE TABLE supplier_catalogue_items (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  supplier_sku TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,   -- supplier's trade/cost price, NOT the shop's sell price
  stock_qty INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',       -- 'new' | 'imported' | 'ignored'
  product_id INTEGER REFERENCES products(id),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The upsert key: re-syncing matches on this to decide update-vs-insert.
CREATE UNIQUE INDEX idx_catalogue_supplier_sku_per_shop
  ON supplier_catalogue_items(shop_id, supplier_id, supplier_sku);
CREATE INDEX idx_catalogue_shop_status ON supplier_catalogue_items(shop_id, status);
ALTER TABLE supplier_catalogue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_catalogue_items FORCE ROW LEVEL SECURITY;
CREATE POLICY supplier_catalogue_items_shop_isolation ON supplier_catalogue_items
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Backfill: give every shop that already exists a mock Madison supplier to
-- test against immediately - createShop() (see auth.js) seeds this for every
-- shop created from now on, but can't retroactively touch existing ones.
-- FORCE ROW LEVEL SECURITY applies even to this migration's own client, so
-- app.current_shop_id must be set per-shop before each insert, same as
-- createShop()'s equivalent client.query call.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM shops LOOP
    PERFORM set_config('app.current_shop_id', r.id::text, true);
    INSERT INTO suppliers (name, adapter_type, config)
    VALUES ('Madison (mock)', 'mock_csv', '{}'::jsonb);
  END LOOP;
END $$;
