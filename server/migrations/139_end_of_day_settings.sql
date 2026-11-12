-- Settings › Front desk › End of day: when "Close the day" shows and whether
-- the cash is counted first (openspec/changes/owner-setup-till-payments-eod
-- design 3; set-eod-close; owner setup decisions 6 and 18). One setting each
-- for the whole business, on the shop's row beside the float. Close the day
-- shows at closing time (0), 30 or 60 minutes before; every shop starts on 30,
-- shops already using the app included, which move from the old fixed hour
-- (Jack's answer 2, docs/decisions/2026-11-11-settings-rest-answers.md): a
-- column added with a default fills the rows already there. Count first is on
-- to start. Additive and safe to run twice.
ALTER TABLE shops ADD COLUMN IF NOT EXISTS close_entry_minutes INTEGER NOT NULL DEFAULT 30
  CHECK (close_entry_minutes IN (0, 30, 60));
ALTER TABLE shops ADD COLUMN IF NOT EXISTS count_first BOOLEAN NOT NULL DEFAULT true;
