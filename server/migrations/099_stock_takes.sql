-- Stock take (openspec/changes/stock-take design 1; stock control decisions
-- 5, 9 and 11). A count of the whole shop, a category, an area or the
-- products below zero; who joined it and when they finished their part; each
-- person's count of each product, with when they first and last counted it
-- (the database's now(), the clock stock_movements uses, so applying can
-- find the stock that moved after a product's last count); recounts asked
-- for; and, once applied, what each counted product was expected, counted
-- and changed by, with the "Counted" stock-history line it wrote. Each table
-- is kept to its shop by row-level security, and every row of a take can
-- only point at its own shop's take.
--
-- Safe to run twice, and onto the shared development database, which ran
-- an earlier draft of this file as 098_stock_takes.sql (renumbered for
-- 098_first_pin.sql): every table and column is added only when missing, and
-- the checks the draft made are dropped and made again.
CREATE TABLE IF NOT EXISTS stock_takes (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  kind TEXT NOT NULL CHECK (kind IN ('whole_shop', 'category', 'area', 'below_zero')),
  -- The category's or area's name; empty for the whole shop and below zero.
  target TEXT NOT NULL DEFAULT '',
  -- A below-zero count: the products below zero when it started.
  product_ids INTEGER[],
  status TEXT NOT NULL DEFAULT 'counting',
  started_by_login_id INTEGER NOT NULL REFERENCES logins(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, id)
);
ALTER TABLE stock_takes ADD COLUMN IF NOT EXISTS applied_by_login_id INTEGER REFERENCES logins(id);
ALTER TABLE stock_takes ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
-- The draft's checks, by the names Postgres or the draft gave them.
ALTER TABLE stock_takes DROP CONSTRAINT IF EXISTS stock_takes_target_check;
ALTER TABLE stock_takes DROP CONSTRAINT IF EXISTS stock_takes_target_named_check;
ALTER TABLE stock_takes DROP CONSTRAINT IF EXISTS stock_takes_status_check;
ALTER TABLE stock_takes DROP CONSTRAINT IF EXISTS stock_takes_applied_check;
ALTER TABLE stock_takes ADD CONSTRAINT stock_takes_target_check
  CHECK (length(target) <= 60 AND (kind IN ('category', 'area')) = (btrim(target) <> ''));
ALTER TABLE stock_takes ADD CONSTRAINT stock_takes_status_check CHECK (status IN ('counting', 'applied'));
-- Applied, with who and when; counting (or undone), with neither.
ALTER TABLE stock_takes ADD CONSTRAINT stock_takes_applied_check
  CHECK ((status = 'applied') = (applied_at IS NOT NULL AND applied_by_login_id IS NOT NULL));
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

-- 0 is "counted as none" (Count them as none, decision 11).
CREATE TABLE IF NOT EXISTS stock_take_counts (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  stock_take_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  login_id INTEGER NOT NULL REFERENCES logins(id),
  qty INTEGER NOT NULL,
  first_counted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_counted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stock_take_id, product_id, login_id),
  FOREIGN KEY (shop_id, stock_take_id) REFERENCES stock_takes(shop_id, id) ON DELETE CASCADE
);
ALTER TABLE stock_take_counts DROP CONSTRAINT IF EXISTS stock_take_counts_qty_check;
ALTER TABLE stock_take_counts ADD CONSTRAINT stock_take_counts_qty_check CHECK (qty BETWEEN 0 AND 100000);
ALTER TABLE stock_take_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_take_counts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_take_counts_shop_isolation ON stock_take_counts;
CREATE POLICY stock_take_counts_shop_isolation ON stock_take_counts
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- A line sent back to the counters (Recount, tk-diff), by whom and when.
CREATE TABLE IF NOT EXISTS stock_take_recounts (
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  stock_take_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  asked_by_login_id INTEGER NOT NULL REFERENCES logins(id),
  asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (stock_take_id, product_id),
  FOREIGN KEY (shop_id, stock_take_id) REFERENCES stock_takes(shop_id, id) ON DELETE CASCADE
);
ALTER TABLE stock_take_recounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_take_recounts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_take_recounts_shop_isolation ON stock_take_recounts;
CREATE POLICY stock_take_recounts_shop_isolation ON stock_take_recounts
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- What applying found for each counted product, and the history line it
-- wrote (none when it matched). Undo takes them away again.
CREATE TABLE IF NOT EXISTS stock_take_results (
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  stock_take_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  expected INTEGER NOT NULL,
  counted INTEGER NOT NULL CHECK (counted >= 0),
  difference INTEGER NOT NULL,
  cost_pence INTEGER NOT NULL,
  stock_movement_id INTEGER REFERENCES stock_movements(id),
  PRIMARY KEY (stock_take_id, product_id),
  FOREIGN KEY (shop_id, stock_take_id) REFERENCES stock_takes(shop_id, id) ON DELETE CASCADE,
  CHECK (difference = counted - expected),
  CHECK ((difference = 0) = (stock_movement_id IS NULL))
);
-- In the order results were written, so Undo can tell a count applied later
-- (second review, 28 Oct). Added after the table, so a database that ran the
-- draft gets it too.
ALTER TABLE stock_take_results ADD COLUMN IF NOT EXISTS id BIGSERIAL;
ALTER TABLE stock_take_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_take_results FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_take_results_shop_isolation ON stock_take_results;
CREATE POLICY stock_take_results_shop_isolation ON stock_take_results
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- A stock-history line written by applying a count, or by undoing one, tied
-- to its own shop's take like every other row of a take (review, 28 Oct).
-- The draft linked it by id alone; that link is dropped and made again. It
-- is added NOT VALID, as 096's are: checking the existing rows would read
-- stock_movements under its forced row-level security with no shop set,
-- which fails. New and changed rows are checked as usual.
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS stock_take_id INTEGER;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_stock_take_id_fkey;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_stock_take_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_stock_take_fkey
  FOREIGN KEY (shop_id, stock_take_id) REFERENCES stock_takes(shop_id, id) NOT VALID;
-- A till sale's history line names its sale, so a count can allow for it by
-- when it was made at the till, not when it reached the server (review, 28
-- Oct). Older lines, and every other kind, leave it empty. It links by id
-- alone, not by (shop_id, till_sale_id) like the take's link: till_sales has
-- no unique (shop_id, id) to point at, and the till's sync writes both rows
-- for one shop in one transaction.
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS till_sale_id INTEGER REFERENCES till_sales(id);
