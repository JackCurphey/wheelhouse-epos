-- Today's stock warnings (openspec/changes/stock-warnings-on-today, the
-- contract; stock control decision 6; st-setting-adjust, st-today-adjust).
-- The amount over which an adjustment shows on Today, set in Settings ›
-- Stockroom, on the shop's row like the float until the settings store
-- (WP-1.2); null until set. On each stock line: an adjustment's value at cost
-- when it was made, whether it went to Today, and who pressed Seen and when.
-- Whole pence. Additive and safe to run twice; stock_movements keeps its
-- row-level security from migration 001.
ALTER TABLE shops ADD COLUMN IF NOT EXISTS stock_adjust_today_over_pence INTEGER
  CHECK (stock_adjust_today_over_pence BETWEEN 0 AND 10000000);

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS value_pence BIGINT CHECK (value_pence >= 0);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS to_see BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS seen_by_login_id INTEGER REFERENCES logins(id);

-- Today reads the lines still to see.
CREATE INDEX IF NOT EXISTS stock_movements_to_see ON stock_movements (shop_id, id) WHERE to_see AND seen_at IS NULL;
