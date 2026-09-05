-- Per-shop configuration for the two ways bike shops take work in. See
-- docs/decisions/2026-09-04-booking-mode-and-downtime.md.
--
-- One file rather than four: migrations here are forward-only and each runs
-- in its own transaction, so splitting these would create a real state where
-- a shop has booking_mode but no drop-off window. Every default below is
-- chosen so an existing shop behaves exactly as it did before this ran.

-- 'timed'   - a customer books a start time (today's only behaviour)
-- 'dropoff' - a customer books a day; the bike is left and fitted in
ALTER TABLE workshop_settings
  ADD COLUMN booking_mode TEXT NOT NULL DEFAULT 'timed'
    CHECK (booking_mode IN ('timed', 'dropoff'));

-- Drop-off mode: when the bike should be brought in. Inert under 'timed'.
ALTER TABLE workshop_settings
  ADD COLUMN dropoff_window_start TEXT NOT NULL DEFAULT '09:00',
  ADD COLUMN dropoff_window_end   TEXT NOT NULL DEFAULT '10:00';

-- Timed mode: how far before their slot a customer is asked to arrive.
ALTER TABLE workshop_settings
  ADD COLUMN timed_lead_minutes INTEGER NOT NULL DEFAULT 30;

-- What "Not sure / something not listed" books. The mechanic sets the real
-- duration when they review the job; this is only what it reserves until then.
ALTER TABLE workshop_settings
  ADD COLUMN unspecified_job_minutes INTEGER NOT NULL DEFAULT 60;

-- Whether the customer-facing service list shows prices. Defaults to off:
-- publishing a shop's labour rates without being asked is the harder mistake
-- to undo.
ALTER TABLE workshop_settings
  ADD COLUMN show_prices_online INTEGER NOT NULL DEFAULT 0;

-- Which catalogue services a customer may book online. Defaults to off, so a
-- shop opts each one in rather than exposing the whole internal price list by
-- accident.
ALTER TABLE workshop_services
  ADD COLUMN bookable_online INTEGER NOT NULL DEFAULT 0;
