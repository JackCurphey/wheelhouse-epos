-- A bike left uncollected (collect and pay review item 4, H4 and M5,
-- docs/decisions/2026-09-30-collect-and-pay-review.md;
-- openspec/changes/uncollected-bike). The shop's two day counts, counted from
-- when the work is marked ready (signed_off_at): when "Bike still waiting"
-- goes, and when the bike shows on Today. 3 and 7 to start (design 6). And
-- when, and by whom, an uncollected bike's customer was contacted from Today.
-- 063 is left for sales in pence (#404). Additive only.
ALTER TABLE workshop_settings
  ADD COLUMN collection_reminder_days INTEGER NOT NULL DEFAULT 3
    CONSTRAINT workshop_settings_collection_reminder_days_check CHECK (collection_reminder_days BETWEEN 1 AND 60),
  ADD COLUMN collection_today_days INTEGER NOT NULL DEFAULT 7
    CONSTRAINT workshop_settings_collection_today_days_check CHECK (collection_today_days BETWEEN 2 AND 90),
  ADD CONSTRAINT workshop_settings_collection_days_order_check CHECK (collection_today_days > collection_reminder_days);

ALTER TABLE workshop_jobs
  ADD COLUMN uncollected_contacted_at TIMESTAMPTZ,
  ADD COLUMN uncollected_contacted_by_login_id INTEGER REFERENCES logins(id);
