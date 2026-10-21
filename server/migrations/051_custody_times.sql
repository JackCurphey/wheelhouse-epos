-- When a bike was booked in and when it was collected (Jack, 21 Oct, booking
-- page stages; the contract in
-- openspec/changes/archive/2026-10-21-booking-page-stages/design.md): the
-- customer's page says "booked in [day] at [time]", and a booking link lasts
-- 30 days after collection (build-plan Q8). Set by the custody moves; null
-- before them and for jobs moved before this migration. Additive only.
ALTER TABLE workshop_jobs ADD COLUMN booked_in_at TIMESTAMPTZ;
ALTER TABLE workshop_jobs ADD COLUMN collected_at TIMESTAMPTZ;
