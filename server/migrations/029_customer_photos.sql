-- Customer photos (piece 6). A photo sent with a booking is a staff attachment
-- marked as coming from the customer. Existing rows are staff files, so false.
-- Spec: docs/superpowers/specs/2026-09-25-book-server-6-customer-photos-design.md
ALTER TABLE workshop_job_attachments
  ADD COLUMN from_customer BOOLEAN NOT NULL DEFAULT false;
