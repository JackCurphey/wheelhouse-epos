-- Adjust stock, with a reason and who (openspec/changes/adjust-stock design 1;
-- stock control decision 6). Additive: older lines, and sales and till sync,
-- leave both empty. The note column already exists.
-- Safe to run twice (the shared dev database ran it once as 089): each column
-- is added only when it isn't there yet, and the reasons' check is dropped
-- and made again, so a database that ran an older list gets this one.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'stock_movements' AND column_name = 'reason') THEN
    ALTER TABLE stock_movements ADD COLUMN reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'stock_movements' AND column_name = 'login_id') THEN
    ALTER TABLE stock_movements ADD COLUMN login_id INTEGER REFERENCES logins(id);
  END IF;
END $$;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_reason_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_reason_check
  CHECK (reason IN ('damaged', 'lost_stolen', 'used_workshop', 'faulty_return', 'found', 'other'));
