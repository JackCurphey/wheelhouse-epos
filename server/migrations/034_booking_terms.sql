-- Booking terms (piece 11). workshop_settings.booking_terms holds a shop's
-- own terms; null means the standard Wheelhouse terms (server/standard-terms.js)
-- apply. workshop_jobs.terms_text is the copy of the terms in force at
-- booking time, saved with the job; null for bookings made before this piece
-- and for staff-made jobs (which take no terms consent at all). Additive only.
-- Spec: docs/superpowers/specs/2026-09-26-book-server-11-terms-design.md
ALTER TABLE workshop_settings
  ADD COLUMN booking_terms TEXT;
ALTER TABLE workshop_jobs
  ADD COLUMN terms_text TEXT;
