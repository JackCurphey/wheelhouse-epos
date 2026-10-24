-- The shop's deposit settings (bk-settings-deposits; Jack, 24 Oct,
-- docs/decisions/2026-10-24-morning-questions.md answers 1–5;
-- openspec/changes/deposit-settings design 1). Off for every shop to start;
-- money in whole pence. Additive only.
ALTER TABLE workshop_settings ADD COLUMN deposit_on INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workshop_settings ADD COLUMN deposit_kind TEXT NOT NULL DEFAULT 'percent'
  CONSTRAINT workshop_settings_deposit_kind_check CHECK (deposit_kind IN ('percent', 'fixed'));
ALTER TABLE workshop_settings ADD COLUMN deposit_percent INTEGER
  CONSTRAINT workshop_settings_deposit_percent_check CHECK (deposit_percent BETWEEN 1 AND 100);
ALTER TABLE workshop_settings ADD COLUMN deposit_fixed_pence INTEGER
  CONSTRAINT workshop_settings_deposit_fixed_check CHECK (deposit_fixed_pence BETWEEN 1 AND 1000000);
ALTER TABLE workshop_settings ADD COLUMN deposit_unknown_pence INTEGER
  CONSTRAINT workshop_settings_deposit_unknown_check CHECK (deposit_unknown_pence BETWEEN 1 AND 1000000);
ALTER TABLE workshop_settings ADD COLUMN deposit_cancel_hours INTEGER NOT NULL DEFAULT 24
  CONSTRAINT workshop_settings_deposit_cancel_check CHECK (deposit_cancel_hours BETWEEN 0 AND 168);
