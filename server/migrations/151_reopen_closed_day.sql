-- Reopening a closed day (openspec/changes/reports-accounts-and-reopen, design 1; Reports part 4, PR 1;
-- Jack's answers 1 and 4 of 12 Nov). The Owner can reopen the latest closed day with a reason: the close
-- stays as the one row for its day (UNIQUE (shop_id, day) stays unique) but is marked reopened, and every
-- report and rule reads closes where reopened_at IS NULL, so a reopened day is "not closed" until it is
-- closed again from a new count (which updates the same row and clears these three columns). The first
-- close's figures are copied to day_close_history when it is reopened, one row per reopening, so nothing
-- is lost. The three columns are all set or all empty. Additive and safe to run twice; row-level security
-- as 096.
ALTER TABLE day_closes
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopened_by INTEGER REFERENCES logins(id),
  ADD COLUMN IF NOT EXISTS reopen_reason TEXT;
ALTER TABLE day_closes DROP CONSTRAINT IF EXISTS day_closes_reopened_together;
ALTER TABLE day_closes ADD CONSTRAINT day_closes_reopened_together CHECK (
  (reopened_at IS NULL) = (reopened_by IS NULL) AND (reopened_at IS NULL) = (reopen_reason IS NULL)
  AND (reopen_reason IS NULL OR char_length(reopen_reason) BETWEEN 1 AND 500));
CREATE INDEX IF NOT EXISTS idx_day_closes_reopened ON day_closes (shop_id) WHERE reopened_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS day_close_history (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  day_close_id INTEGER NOT NULL REFERENCES day_closes(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  closed_by INTEGER NOT NULL REFERENCES logins(id),
  closed_at TIMESTAMPTZ NOT NULL,
  float_check_id INTEGER REFERENCES float_checks(id),
  float_start_pence INTEGER NOT NULL,
  cash_pence INTEGER NOT NULL,
  drawer_cash_pence INTEGER NOT NULL,
  paid_outs_pence INTEGER NOT NULL,
  expected_pence INTEGER NOT NULL,
  counted_pence INTEGER NOT NULL,
  reason TEXT NOT NULL,
  float_pence INTEGER NOT NULL,
  banked_pence INTEGER NOT NULL,
  carried_pence INTEGER NOT NULL,
  takings_pence INTEGER NOT NULL,
  card_pence INTEGER NOT NULL,
  other_pence INTEGER NOT NULL,
  online_pence INTEGER NOT NULL,
  reopened_by INTEGER NOT NULL REFERENCES logins(id),
  reopened_at TIMESTAMPTZ NOT NULL,
  reopen_reason TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_day_close_history_close ON day_close_history (shop_id, day_close_id);

ALTER TABLE day_close_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_close_history FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS day_close_history_shop_isolation ON day_close_history;
CREATE POLICY day_close_history_shop_isolation ON day_close_history
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
