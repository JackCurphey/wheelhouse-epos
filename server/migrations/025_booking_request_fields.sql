-- The booking request (piece 3): what the customer chose to be told and
-- agreed to. Update channel and marketing permission belong to the person and
-- carry to their next booking, so they sit on customers. Terms consent belongs
-- to the one booking it was given for, so it sits on the job, as a timestamp.
-- The terms wording is not stored; see the spec.
-- Spec: docs/superpowers/specs/2026-09-25-book-server-3-booking-request-design.md
ALTER TABLE customers
  ADD COLUMN update_channel TEXT CHECK (update_channel IN ('email', 'sms', 'whatsapp')),
  ADD COLUMN marketing_permission BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE workshop_jobs
  ADD COLUMN terms_accepted_at TIMESTAMPTZ;
