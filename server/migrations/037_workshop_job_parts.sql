-- A job's parts: one row per day it is worked (Workshop day decision 52,
-- settled 3 Oct 2026: "one block per day"). Part 1 is always the job's own
-- job_date / start_time / end_time / mechanic_id; the triggers below keep it
-- identical, so every existing write path (the old diary, the booking link,
-- accepting a change request) stays correct without being touched. Later
-- parts (position 2, 3, ...) are added by staff ("Add another day") or by
-- carry-over of an unfinished job. Additive only: nothing is dropped.
-- Spec: docs/superpowers/specs/2026-10-03-multi-day-jobs-design.md
CREATE TABLE workshop_job_parts (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  workshop_job_id INTEGER NOT NULL REFERENCES workshop_jobs(id) ON DELETE CASCADE,
  part_date TEXT NOT NULL,
  start_time TEXT DEFAULT '',
  end_time TEXT DEFAULT '',
  mechanic_id INTEGER REFERENCES employees(id),
  position INTEGER NOT NULL,
  UNIQUE (workshop_job_id, position)
);
CREATE INDEX idx_workshop_job_parts_date ON workshop_job_parts(shop_id, part_date);
ALTER TABLE workshop_job_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_job_parts FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_job_parts_shop_isolation ON workshop_job_parts
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Part 1 follows the job. shop_id is copied from the job row rather than
-- left to the column default, so the part always belongs to the job's shop.
CREATE FUNCTION workshop_job_part_one_insert() RETURNS trigger AS $$
BEGIN
  INSERT INTO workshop_job_parts (shop_id, workshop_job_id, part_date, start_time, end_time, mechanic_id, position)
  VALUES (NEW.shop_id, NEW.id, NEW.job_date, NEW.start_time, NEW.end_time, NEW.mechanic_id, 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION workshop_job_part_one_update() RETURNS trigger AS $$
BEGIN
  UPDATE workshop_job_parts
     SET part_date = NEW.job_date, start_time = NEW.start_time, end_time = NEW.end_time, mechanic_id = NEW.mechanic_id
   WHERE workshop_job_id = NEW.id AND position = 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workshop_jobs_part_one_insert AFTER INSERT ON workshop_jobs
  FOR EACH ROW EXECUTE FUNCTION workshop_job_part_one_insert();
CREATE TRIGGER workshop_jobs_part_one_update AFTER UPDATE OF job_date, start_time, end_time, mechanic_id ON workshop_jobs
  FOR EACH ROW EXECUTE FUNCTION workshop_job_part_one_update();

-- Backfill: one part per existing job. FORCE ROW LEVEL SECURITY applies to
-- this migration's own client too, so app.current_shop_id is set per shop
-- first, with the shops table (no RLS) driving the loop - the pattern and
-- the reasons are in 030_workshop_job_services.sql. The count guard rolls the
-- whole migration back if any shop's jobs were not all copied.
DO $$
DECLARE
  r RECORD;
  expected INTEGER;
  copied INTEGER;
BEGIN
  FOR r IN SELECT id FROM shops LOOP
    PERFORM set_config('app.current_shop_id', r.id::text, true);
    SELECT count(*) INTO expected FROM workshop_jobs WHERE shop_id = r.id;
    INSERT INTO workshop_job_parts (shop_id, workshop_job_id, part_date, start_time, end_time, mechanic_id, position)
      SELECT shop_id, id, job_date, start_time, end_time, mechanic_id, 1 FROM workshop_jobs WHERE shop_id = r.id;
    GET DIAGNOSTICS copied = ROW_COUNT;
    IF copied <> expected THEN
      RAISE EXCEPTION 'workshop_job_parts backfill for shop % copied % of % jobs', r.id, copied, expected;
    END IF;
  END LOOP;
END $$;
