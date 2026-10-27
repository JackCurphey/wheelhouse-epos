-- Opening the shop with a float check (openspec/changes/opening-float-check,
-- the contract; opening the shop decision 2; cash-up decision 4). The shop's
-- float, set in Settings › Front desk › End of day (set-eod), on the shop's
-- row like the receipt words until the settings store (WP-1.2); null until
-- set. And one float check a shop a day: what the drawer should have had,
-- what was counted (null when it "looked right"), the reason, who and when,
-- and who marked a short float Seen on Today. Whole pence. Additive and safe
-- to run twice.
ALTER TABLE shops ADD COLUMN IF NOT EXISTS float_pence INTEGER
  CHECK (float_pence BETWEEN 0 AND 10000000);

CREATE TABLE IF NOT EXISTS float_checks (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  day DATE NOT NULL,
  login_id INTEGER NOT NULL REFERENCES logins(id),
  expected_pence INTEGER NOT NULL CHECK (expected_pence BETWEEN 0 AND 10000000),
  counted_pence INTEGER CHECK (counted_pence BETWEEN 0 AND 10000000),
  reason TEXT NOT NULL DEFAULT '' CHECK (length(reason) <= 500),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_by_login_id INTEGER REFERENCES logins(id),
  seen_at TIMESTAMPTZ,
  UNIQUE (shop_id, day)
);
ALTER TABLE float_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE float_checks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS float_checks_shop_isolation ON float_checks;
CREATE POLICY float_checks_shop_isolation ON float_checks
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
