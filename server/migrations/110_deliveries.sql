-- A delivery, once it's booked in (openspec/changes/delivery-booked-in, design
-- 1, 5, 6 and 8; receiving decisions 9 and 10; rs-booked, rs-delivery, rs-hub):
-- who booked it in, when, from which supplier, and each line at what it cost
-- then. Names and costs are copied, because a person, product, supplier, order
-- or cost can change or go later. Who is the person checked in, not only the
-- sign-in: a shared computer stays signed in as the Owner, and a team member
-- can be deleted (routes/team.js), so their name stays when the link goes. A
-- request key means Book in sent twice books in once, as a booking's does (039).
-- Items set aside at booking in point at their delivery, with their cost and
-- name. Anything set aside before 110 has none of these; nothing is made up for
-- deliveries from before 110.
-- Additive and safe to run twice: every column is added only when missing. A
-- database that ran an earlier draft of this file doesn't get the new columns by
-- itself, as the runner skips a filename it has already recorded: delete this
-- file's row from schema_migrations there, and it runs again.
CREATE TABLE IF NOT EXISTS deliveries (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  booked_by_login_id INTEGER REFERENCES logins(id),
  booked_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS booked_by_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS booked_by_name TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS request_key_hash TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS request_body_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_deliveries_shop_newest ON deliveries(shop_id, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_request_key ON deliveries(shop_id, request_key_hash) WHERE request_key_hash IS NOT NULL;
CREATE TABLE IF NOT EXISTS delivery_lines (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  delivery_id INTEGER NOT NULL REFERENCES deliveries(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  purchase_order_id INTEGER REFERENCES purchase_orders(id),
  purchase_order_item_id INTEGER REFERENCES purchase_order_items(id),
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0
);
ALTER TABLE delivery_lines ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE delivery_lines ADD COLUMN IF NOT EXISTS product_sku TEXT;
CREATE INDEX IF NOT EXISTS idx_delivery_lines_delivery ON delivery_lines(delivery_id);
ALTER TABLE delivery_problems ADD COLUMN IF NOT EXISTS delivery_id INTEGER REFERENCES deliveries(id);
ALTER TABLE delivery_problems ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10,2);
ALTER TABLE delivery_problems ADD COLUMN IF NOT EXISTS product_name TEXT;
CREATE INDEX IF NOT EXISTS idx_delivery_problems_delivery ON delivery_problems(delivery_id);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deliveries_shop_isolation ON deliveries;
CREATE POLICY deliveries_shop_isolation ON deliveries
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
ALTER TABLE delivery_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS delivery_lines_shop_isolation ON delivery_lines;
CREATE POLICY delivery_lines_shop_isolation ON delivery_lines
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
