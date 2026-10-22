-- Notes with the shop (decisions 3 and 7, docs/decisions/2026-10-01-account-and-reminders-review.md;
-- account.mjs; openspec/changes/notes-with-the-shop). Additive only.
--
-- A conversation on a job: the customer's notes from their booking page and
-- staff replies, the words themselves. The text that tells the customer of a
-- reply is a message like any other (customer_messages).
CREATE TABLE job_notes (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  workshop_job_id INTEGER NOT NULL REFERENCES workshop_jobs(id) ON DELETE CASCADE,
  from_customer BOOLEAN NOT NULL,
  login_id INTEGER REFERENCES logins(id),
  body TEXT NOT NULL CONSTRAINT job_notes_body_check CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_notes_job ON job_notes(workshop_job_id, id);
ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY job_notes_shop_isolation ON job_notes
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
