-- The mechanic sign-off, piece 1 (Jack, 16 and 18 Oct,
-- docs/decisions/2026-10-16-mechanic-sign-off.md): finishing the work records
-- which mechanic signed it off and when. Reopening clears the two columns;
-- every sign-off stays in workshop_job_sign_offs, stamped cleared_at when the
-- work is reopened, so a job that comes back still shows who passed it
-- (answer 4) before the job history (WP-1.2) exists. Additive only.
-- Spec: openspec/changes/mechanic-sign-off/design.md
ALTER TABLE workshop_jobs
  ADD COLUMN signed_off_by INTEGER REFERENCES employees(id),
  ADD COLUMN signed_off_at TIMESTAMPTZ;

CREATE TABLE workshop_job_sign_offs (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  workshop_job_id INTEGER NOT NULL REFERENCES workshop_jobs(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  signed_off_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cleared_at TIMESTAMPTZ
);
CREATE INDEX idx_workshop_job_sign_offs_job ON workshop_job_sign_offs(shop_id, workshop_job_id);
ALTER TABLE workshop_job_sign_offs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_job_sign_offs FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_job_sign_offs_shop_isolation ON workshop_job_sign_offs
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
