-- Till PINs and the PIN check-in (openspec/changes/pins-and-checkin, the
-- contract; signing in decisions 4, 6 and 7). employees.pin_hash is
-- migration 036's. Added here: the PIN Wheelhouse has just shown someone,
-- hashed, until they keep it; each PIN check-in on a till's browser, by the
-- shop's own day, with only the hash of the browser's check-in cookie; and
-- who checked the float, from the check-in. Additive and safe to run twice.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pin_offer_hash TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pin_offer_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS pin_checkins (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  login_id INTEGER NOT NULL REFERENCES logins(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  day DATE NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pin_checkins_day ON pin_checkins(shop_id, day);
ALTER TABLE pin_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_checkins FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pin_checkins_shop_isolation ON pin_checkins;
CREATE POLICY pin_checkins_shop_isolation ON pin_checkins
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

ALTER TABLE float_checks ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;
