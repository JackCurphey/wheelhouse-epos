-- Claims on workshop capacity. Only 'held' and 'confirmed' consume space; an
-- expired or released hold must stop counting the moment it changes, which is
-- why the uniqueness rule below is scoped to the live states rather than to
-- every row.
--
-- The partial unique index is what makes "two customers cannot both take the
-- last slot" a fact of the database rather than a hope about application code.
-- Checking availability and then inserting is two statements, and the gap
-- between them is exactly where the double booking happens.

CREATE TABLE workshop_capacity_holds (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  workshop_job_id INTEGER REFERENCES workshop_jobs(id),
  job_date TEXT NOT NULL,
  -- Empty for a drop-off day: it reserves effort without holding a time.
  start_time TEXT NOT NULL DEFAULT '',
  mechanic_id INTEGER REFERENCES employees(id),
  minutes INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'held'
    CHECK (state IN ('held', 'confirmed', 'expired', 'released')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One live hold per shop, date, time and mechanic. COALESCE because a NULL
-- mechanic means the shared queue, and NULL never equals NULL in an index.
CREATE UNIQUE INDEX idx_workshop_capacity_holds_live_slot
  ON workshop_capacity_holds (shop_id, job_date, start_time, COALESCE(mechanic_id, 0))
  WHERE state IN ('held', 'confirmed');

CREATE INDEX idx_workshop_capacity_holds_shop_date
  ON workshop_capacity_holds (shop_id, job_date);

ALTER TABLE workshop_capacity_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_capacity_holds FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_capacity_holds_shop_isolation ON workshop_capacity_holds
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
