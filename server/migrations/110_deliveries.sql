-- A delivery, once it's booked in (openspec/changes/delivery-booked-in, design
-- 1; receiving decisions 9 and 10; rs-booked, rs-delivery, rs-hub): who booked
-- it in, when, from which supplier, and each line at what it cost then, copied
-- because an order's or a product's cost can change later. Items set aside at
-- booking in point at their delivery, with their cost. Anything set aside
-- before 110 has neither; nothing is made up for deliveries from before 110.
-- Additive and safe to run twice.
CREATE TABLE IF NOT EXISTS deliveries (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  booked_by_login_id INTEGER REFERENCES logins(id),
  booked_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deliveries_shop_newest ON deliveries(shop_id, id DESC);
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
CREATE INDEX IF NOT EXISTS idx_delivery_lines_delivery ON delivery_lines(delivery_id);
ALTER TABLE delivery_problems ADD COLUMN IF NOT EXISTS delivery_id INTEGER REFERENCES deliveries(id);
ALTER TABLE delivery_problems ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10,2);
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
