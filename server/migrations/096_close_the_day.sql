-- Close the day (openspec/changes/close-the-day, the contract; cash-up
-- decisions 4 and 6; eod-paidout, eod-z). Cash taken out of the drawer
-- (paid-outs): how much, what it was for, a note, who and when. And one
-- close a shop a day: who closed it and when, this morning's float check,
-- what the drawer should have held and how that was worked out, what was
-- counted and why it differed, the float left and the cash banked, and the
-- day's takings by how they were paid, kept as they were at the close so
-- the report never changes afterwards. Whole pence. Additive and safe to
-- run twice; row-level security as 095.
CREATE TABLE IF NOT EXISTS paid_outs (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  day DATE NOT NULL,
  login_id INTEGER NOT NULL REFERENCES logins(id),
  amount_pence INTEGER NOT NULL CHECK (amount_pence BETWEEN 1 AND 10000000),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 100),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_paid_outs_shop_day ON paid_outs(shop_id, day);

CREATE TABLE IF NOT EXISTS day_closes (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  day DATE NOT NULL,
  login_id INTEGER NOT NULL REFERENCES logins(id),
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  float_check_id INTEGER NOT NULL REFERENCES float_checks(id),
  float_start_pence INTEGER NOT NULL CHECK (float_start_pence BETWEEN 0 AND 10000000),
  cash_pence INTEGER NOT NULL,
  paid_outs_pence INTEGER NOT NULL CHECK (paid_outs_pence >= 0),
  expected_pence INTEGER NOT NULL,
  counted_pence INTEGER NOT NULL CHECK (counted_pence BETWEEN 0 AND 10000000),
  reason TEXT NOT NULL DEFAULT '' CHECK (length(reason) <= 500),
  float_pence INTEGER NOT NULL CHECK (float_pence BETWEEN 0 AND 10000000),
  banked_pence INTEGER NOT NULL CHECK (banked_pence >= 0 AND banked_pence <= counted_pence),
  takings_pence INTEGER NOT NULL,
  card_pence INTEGER NOT NULL,
  other_pence INTEGER NOT NULL,
  UNIQUE (shop_id, day)
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['paid_outs', 'day_closes'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_shop_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (shop_id = current_setting(''app.current_shop_id'')::int) WITH CHECK (shop_id = current_setting(''app.current_shop_id'')::int)',
      t || '_shop_isolation', t
    );
  END LOOP;
END $$;
