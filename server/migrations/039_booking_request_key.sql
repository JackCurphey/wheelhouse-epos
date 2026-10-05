-- The server accepts each online booking request once (WP-0.2). The customer's
-- client sends a request key and repeats it on every retry; a retry after a
-- lost reply gets the booking already made, not a second one. Both values
-- are SHA-256 hashes: the key can mint a fresh private link, so like the link
-- itself only its hash is kept, and the body's hash tells a true retry from
-- the same key reused for a different booking. Additive only.
-- Spec: docs/superpowers/specs/2026-10-05-wp-0-2-booking-bugs-server.md
ALTER TABLE workshop_jobs
  ADD COLUMN booking_request_key_hash TEXT,
  ADD COLUMN booking_request_body_hash TEXT;

CREATE UNIQUE INDEX idx_workshop_jobs_booking_request_key
  ON workshop_jobs (shop_id, booking_request_key_hash) WHERE booking_request_key_hash IS NOT NULL;
