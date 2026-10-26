-- One conversation per customer (Jack, 26 Oct, docs/decisions/2026-10-26-day-answers.md
-- sections 2 and 8; openspec/changes/ask-the-shop-server design 1). A message
-- in job_notes is about a repair (its job, as every note so far) or a general
-- message to or from a customer (its customer): exactly one of the two. A
-- repair note's customer is read through its job, never copied, so moving a
-- job moves its notes. Additive: every existing note keeps its job.
ALTER TABLE job_notes ALTER COLUMN workshop_job_id DROP NOT NULL;
ALTER TABLE job_notes ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE job_notes ADD CONSTRAINT job_notes_job_or_customer CHECK (num_nonnulls(workshop_job_id, customer_id) = 1);
CREATE INDEX idx_job_notes_customer ON job_notes(shop_id, customer_id, id) WHERE customer_id IS NOT NULL;
