-- The bike note (piece 9): the bike in the customer's own words, taken at
-- booking. It is a note on the job, not a customer_bikes row - staff create
-- the real bike at check-in. Additive only.
-- Spec: docs/superpowers/specs/2026-09-26-book-server-9-bike-note-design.md
ALTER TABLE workshop_jobs
  ADD COLUMN customer_bike_note TEXT;
