-- Declining a booking request with a message (Workshop day decision 15,
-- 27 Sep; Jack, 20 Oct): what staff tell the customer they can do next, kept
-- with the job for the customer's booking page. Null for none. Additive only.
-- Spec: openspec/changes/decline-message/design.md
ALTER TABLE workshop_jobs ADD COLUMN decline_message TEXT;
