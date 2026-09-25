-- Service questions (piece 5). A service's questions are one ordered list, saved
-- whole by staff. A booking keeps a frozen copy of each question's wording as
-- asked, plus the answer, so later edits to the service never change it (as
-- booked_price, 026). Null on "not sure" bookings, staff jobs and older bookings.
-- Spec: docs/superpowers/specs/2026-09-25-book-server-5-service-questions-design.md
ALTER TABLE workshop_services
  ADD COLUMN questions JSONB NOT NULL DEFAULT '[]';

ALTER TABLE workshop_jobs
  ADD COLUMN question_answers JSONB;
