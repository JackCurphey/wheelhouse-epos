-- Drop-off holds (piece 2b). A drop-off booking reserves minutes on a day
-- without holding a start time. The 018 index treated start_time = '' as one
-- slot, so a mechanic's second drop-off booking on a day collided with the
-- first. It now covers timed holds only: untimed holds are counted, never
-- slotted. The per-(shop, date) booking lock is the main guard for both.
-- Plan: docs/superpowers/plans/2026-09-24-book-server-2b-booking-modes.md
DROP INDEX idx_workshop_capacity_holds_live_slot;
CREATE UNIQUE INDEX idx_workshop_capacity_holds_live_slot
  ON workshop_capacity_holds (shop_id, job_date, start_time, COALESCE(mechanic_id, 0))
  WHERE state IN ('held', 'confirmed') AND start_time <> '';
