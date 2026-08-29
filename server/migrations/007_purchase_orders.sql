-- Purchase orders: build an order against a supplier, then book in
-- deliveries against it (increasing product stock, supporting partial /
-- split deliveries over more than one booking-in). Step one of eventually
-- importing orders straight from a B2B distributor - that's not built here,
-- but the schema leaves room for it (e.g. a future supplier_order_ref).

ALTER TABLE suppliers ADD COLUMN contact_name TEXT NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN email TEXT NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN phone TEXT NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN account_number TEXT NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN address TEXT NOT NULL DEFAULT '';

CREATE TABLE purchase_orders (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'draft', -- draft | ordered | partially_received | received | cancelled
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  ordered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY purchase_orders_shop_isolation ON purchase_orders
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Own shop_id + RLS policy rather than relying on a join to the parent, same
-- reasoning as sale_document_items - a cheap direct-column RLS check.
CREATE TABLE purchase_order_items (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_sku TEXT,
  qty_ordered INTEGER NOT NULL,
  qty_received INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_po_items_order ON purchase_order_items(purchase_order_id);
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items FORCE ROW LEVEL SECURITY;
CREATE POLICY purchase_order_items_shop_isolation ON purchase_order_items
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- So a stock receipt is queryable back to the PO that caused it, not just
-- findable via the free-text note.
ALTER TABLE stock_movements ADD COLUMN purchase_order_id INTEGER REFERENCES purchase_orders(id);
