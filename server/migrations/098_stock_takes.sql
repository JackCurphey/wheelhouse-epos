-- Stock take, the counting half (openspec/changes/stock-take design 1; stock
-- control decisions 5, 9 and 11). A count of the whole shop, a category, an
-- area or the products below zero; who joined it and when they finished
-- their part; and each person's count of each product, with when they first
-- and last counted it (the database's now(), the clock stock_movements
-- uses, so applying can compare a count with stock that moved around it).
-- Counting never touches products or stock_movements. Each table is kept to
-- its shop by row-level security, and a counter or count can only point at
-- its own shop's take. Additive and safe to run twice.
CREATE TABLE IF NOT EXISTS stock_takes (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  kind TEXT NOT NULL CHECK (kind IN ('whole_shop', 'category', 'area', 'below_zero')),
  -- The category's or area's name; empty for the whole shop and below zero.
  target TEXT NOT NULL DEFAULT '' CHECK (length(target) <= 60),
  -- A below-zero count: the products below zero when it started.
  product_ids INTEGER[],
  -- Counting only, until applying is built (design: waits for Jack).
  status TEXT NOT NULL DEFAULT 'counting' CHECK (status IN ('counting')),
  started_by_login_id INTEGER NOT NULL REFERENCES logins(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stock_takes_target_named_check CHECK ((kind IN ('category', 'area')) = (btrim(target) <> '')),
  UNIQUE (shop_id, id)
);
ALTER TABLE stock_takes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_takes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_takes_shop_isolation ON stock_takes;
CREATE POLICY stock_takes_shop_isolation ON stock_takes
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE IF NOT EXISTS stock_take_counters (
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  stock_take_id INTEGER NOT NULL,
  login_id INTEGER NOT NULL REFERENCES logins(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  PRIMARY KEY (stock_take_id, login_id),
  FOREIGN KEY (shop_id, stock_take_id) REFERENCES stock_takes(shop_id, id) ON DELETE CASCADE
);
ALTER TABLE stock_take_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_take_counters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_take_counters_shop_isolation ON stock_take_counters;
CREATE POLICY stock_take_counters_shop_isolation ON stock_take_counters
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE IF NOT EXISTS stock_take_counts (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  stock_take_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  login_id INTEGER NOT NULL REFERENCES logins(id),
  qty INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 100000),
  first_counted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_counted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stock_take_id, product_id, login_id),
  FOREIGN KEY (shop_id, stock_take_id) REFERENCES stock_takes(shop_id, id) ON DELETE CASCADE
);
ALTER TABLE stock_take_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_take_counts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_take_counts_shop_isolation ON stock_take_counts;
CREATE POLICY stock_take_counts_shop_isolation ON stock_take_counts
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
