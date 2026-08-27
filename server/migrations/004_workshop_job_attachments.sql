-- Lets staff attach files to a workshop job - e.g. an e-bike's downloaded
-- diagnostic/customer report - and download them again later. The actual
-- bytes live on disk as flat files named by storage_key (see server.js's
-- UPLOADS_DIR), not in Postgres; this table is just the metadata plus the
-- RLS boundary, same split as everything else that's shop-scoped.

CREATE TABLE workshop_job_attachments (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  workshop_job_id INTEGER NOT NULL REFERENCES workshop_jobs(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL, -- random token used as the on-disk filename - never the original name, to sidestep path-traversal/collision entirely
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workshop_job_attachments_job ON workshop_job_attachments(workshop_job_id);
ALTER TABLE workshop_job_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_job_attachments FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_job_attachments_shop_isolation ON workshop_job_attachments
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
