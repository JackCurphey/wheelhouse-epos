-- Adjust stock, with a reason and who (openspec/changes/adjust-stock design 1;
-- stock control decision 6). Additive: older lines, and sales and till sync,
-- leave both empty. The note column already exists.
ALTER TABLE stock_movements ADD COLUMN reason TEXT
  CHECK (reason IN ('damaged', 'lost_stolen', 'used_workshop', 'faulty_return', 'found', 'other'));
ALTER TABLE stock_movements ADD COLUMN login_id INTEGER REFERENCES logins(id);
