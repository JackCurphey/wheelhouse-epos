-- A product's price and cost changes (openspec/changes/product-page-sizes, design 1; stock
-- control decisions 7 and 11; receiving's walk-through 3 M3): each change with what it was,
-- what it became, who and when, and the delivery when it came from one. The product's page
-- shows them to the Owner in its history. A new table, so nothing already here is rewritten.
-- Additive and safe to run twice.

CREATE TABLE IF NOT EXISTS product_price_changes (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  product_id INTEGER NOT NULL,
  field TEXT NOT NULL CHECK (field IN ('price', 'cost')),
  was_pence BIGINT NOT NULL CHECK (was_pence >= 0),
  now_pence BIGINT NOT NULL CHECK (now_pence >= 0),
  login_id INTEGER REFERENCES logins(id) ON DELETE SET NULL,
  -- Kept as it was, so a person removed later is still named (as a stock line's who_name).
  who_name TEXT,
  delivery_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The product is this business's own (117's (id, shop_id) key).
  FOREIGN KEY (product_id, shop_id) REFERENCES products (id, shop_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_product_price_changes_product
  ON product_price_changes (shop_id, product_id, created_at DESC);
ALTER TABLE product_price_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_changes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_price_changes_shop_isolation ON product_price_changes;
CREATE POLICY product_price_changes_shop_isolation ON product_price_changes
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
