-- Adjust stock, with a reason and who (openspec/changes/adjust-stock design 1;
-- stock control decision 6). Additive: older lines, and sales and till sync,
-- leave both empty. The note column already exists.
-- Safe to run twice (the shared dev database ran it once as 089): each column
-- is added with its check or foreign key only when it isn't there yet, so the
-- second run changes nothing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'reason') THEN
    ALTER TABLE stock_movements ADD COLUMN reason TEXT
      CHECK (reason IN ('damaged', 'lost_stolen', 'used_workshop', 'faulty_return', 'found', 'other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'login_id') THEN
    ALTER TABLE stock_movements ADD COLUMN login_id INTEGER REFERENCES logins(id);
  END IF;
END $$;
