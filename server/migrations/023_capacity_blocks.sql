-- When a mechanic is available: per-weekday opening hours, and blocks (lunch,
-- leave, shop closures). Plus the two columns 2b uses to schedule a booking-mode
-- change from a date, so piece 2 is one migration.
-- Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md

-- Only the days whose hours differ from opening_time/closing_time, as a JSON
-- object keyed by weekday (0 = Sunday): {"6": {"open": "09:00", "close": "17:00"}}.
-- '{}' is today's behaviour - every open day uses the usual hours - so no
-- backfill is needed. opening_days still says which days are open.
ALTER TABLE workshop_settings
  ADD COLUMN weekday_hours TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN next_booking_mode TEXT CHECK (next_booking_mode IN ('timed', 'dropoff')),
  ADD COLUMN next_booking_mode_from TEXT CHECK (next_booking_mode_from ~ '^\d{4}-\d{2}-\d{2}$'),
  ADD CONSTRAINT workshop_settings_next_mode_pair
    CHECK ((next_booking_mode IS NULL) = (next_booking_mode_from IS NULL));

-- Three kinds of block in one table:
--   weekly, one mechanic  - lunch, routine admin (weekdays + times)
--   dates,  one mechanic  - leave, an appointment (date range, all day or times)
--   dates,  no mechanic   - the shop is closed (date range, always all day)
-- Times NULL = all day. The reason is for staff only; customers see
-- "unavailable" and nothing else.
CREATE TABLE workshop_unavailability (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  -- CASCADE: a deleted mechanic's lunch and leave go with them.
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('weekly', 'dates')),
  weekdays TEXT,
  start_date TEXT CHECK (start_date ~ '^\d{4}-\d{2}-\d{2}$'),
  end_date TEXT CHECK (end_date ~ '^\d{4}-\d{2}-\d{2}$'),
  start_time TEXT CHECK (start_time ~ '^\d{2}:\d{2}$'),
  end_time TEXT CHECK (end_time ~ '^\d{2}:\d{2}$'),
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workshop_unavailability_times_pair CHECK ((start_time IS NULL) = (end_time IS NULL)),
  CONSTRAINT workshop_unavailability_times_order CHECK (start_time IS NULL OR end_time > start_time),
  CONSTRAINT workshop_unavailability_weekly_shape CHECK (kind <> 'weekly' OR (
    employee_id IS NOT NULL AND weekdays IS NOT NULL AND start_time IS NOT NULL
    AND start_date IS NULL AND end_date IS NULL)),
  CONSTRAINT workshop_unavailability_dates_shape CHECK (kind <> 'dates' OR (
    start_date IS NOT NULL AND end_date IS NOT NULL AND end_date >= start_date AND weekdays IS NULL)),
  CONSTRAINT workshop_unavailability_shop_all_day CHECK (
    employee_id IS NOT NULL OR (kind = 'dates' AND start_time IS NULL))
);
CREATE INDEX idx_workshop_unavailability_shop ON workshop_unavailability(shop_id, employee_id);
ALTER TABLE workshop_unavailability ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_unavailability FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_unavailability_shop_isolation ON workshop_unavailability
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
