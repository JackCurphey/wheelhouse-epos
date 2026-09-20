-- Tags waiting to come out of a printer. The existing print path keeps its
-- queue in memory and clears it when an agent collects a job, so a restart or a
-- lost acknowledgement loses the state entirely. This table is where that
-- becomes durable.
--
-- 'unknown' is a real, storable state: an agent can print and then die before
-- acknowledging, and the honest answer is that nobody knows whether the label
-- exists. A person resolves it. Nothing retries from unknown automatically -
-- that is how a bike ends up with two tags.

CREATE TABLE workshop_print_tasks (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  workshop_job_id INTEGER NOT NULL REFERENCES workshop_jobs(id),
  printer_name TEXT NOT NULL,
  copies INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued', 'claimed', 'acknowledged', 'failed', 'unknown')),
  -- Which agent took it, and when we last heard anything.
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workshop_print_tasks_shop_state
  ON workshop_print_tasks (shop_id, state);

ALTER TABLE workshop_print_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_print_tasks FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_print_tasks_shop_isolation ON workshop_print_tasks
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
