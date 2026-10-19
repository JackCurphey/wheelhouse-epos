-- Notice in whole days (Jack, 19 Oct,
-- docs/decisions/2026-10-19-retire-old-workshop-settings.md answers 4 and 8):
-- when set, customers can book from the start of the day this many days
-- ahead, whatever the time now. Null (every shop to start) keeps notice in
-- hours, min_notice_minutes (033). Additive only.
-- Spec: openspec/changes/notice-days/design.md
ALTER TABLE workshop_settings ADD COLUMN min_notice_days INTEGER;
