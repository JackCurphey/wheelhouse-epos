-- The service an online booking named, and what it cost when booked (piece 3b).
-- The price is a copy, not a lookup: a later change to the shop's price list
-- must not alter what an existing booking says. Both stay NULL for a "not
-- sure" booking and for staff-created jobs.
-- Spec: docs/superpowers/specs/2026-09-25-book-server-3b-booked-price-design.md
ALTER TABLE workshop_jobs
  ADD COLUMN service_id INTEGER REFERENCES workshop_services(id),
  ADD COLUMN booked_price NUMERIC(10,2);
