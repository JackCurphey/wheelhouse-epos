-- Service checklists (Jack, 22 Oct, docs/decisions/2026-10-22-service-checklists.md;
-- openspec/changes/service-checklists): each shop writes its own checklists
-- and chooses which services have each; a job has its service's checklist,
-- and the first tick or note copies it onto the job, so a later change in
-- Settings leaves that job's checklist as it was. Additive only.

-- A shop's checklists: a name and its items' labels, in order.
CREATE TABLE workshop_checklists (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL,
  items JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workshop_checklists_shop ON workshop_checklists(shop_id);
ALTER TABLE workshop_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_checklists FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_checklists_shop_isolation ON workshop_checklists
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- A service has one checklist at most; removing the checklist leaves the
-- service without one.
ALTER TABLE workshop_services
  ADD COLUMN checklist_id INTEGER REFERENCES workshop_checklists(id) ON DELETE SET NULL;

-- A job's own copy, written by its first tick or note: the name, and each
-- item's label, tick and note. checklist_id goes to null if the shop later
-- removes the checklist; the copy stays.
CREATE TABLE workshop_job_checklists (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  workshop_job_id INTEGER NOT NULL UNIQUE REFERENCES workshop_jobs(id) ON DELETE CASCADE,
  checklist_id INTEGER REFERENCES workshop_checklists(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  items JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workshop_job_checklists_shop ON workshop_job_checklists(shop_id);
ALTER TABLE workshop_job_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_job_checklists FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_job_checklists_shop_isolation ON workshop_job_checklists
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
