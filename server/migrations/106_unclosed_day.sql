-- A day nobody closed (openspec/changes/unclosed-day, the contract; Jack's
-- 29 Oct answer 5; UX walk-through 2 H1(b); op-float-check-unclosed,
-- op-close-yesterday). The morning after, the float check counts the float
-- plus that day's cash, and the count is that day's count: for_day is the
-- earlier day a count was made for, null on a normal morning. Only a count
-- can be one, only for an earlier day, and one a day. And a day closed late
-- keeps the cash banked for still-earlier days after its count was made
-- (in the count, but not that day's), so it is never banked twice; 0 on a
-- normal close. Additive and safe to run twice.
ALTER TABLE float_checks ADD COLUMN IF NOT EXISTS for_day DATE;
ALTER TABLE day_closes ADD COLUMN IF NOT EXISTS carried_pence INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'float_checks_for_day_check') THEN
    ALTER TABLE float_checks ADD CONSTRAINT float_checks_for_day_check
      CHECK (for_day IS NULL OR (counted_pence IS NOT NULL AND for_day < day));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'float_checks_shop_id_for_day_key') THEN
    ALTER TABLE float_checks ADD CONSTRAINT float_checks_shop_id_for_day_key UNIQUE (shop_id, for_day);
  END IF;
END $$;
