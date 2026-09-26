-- A booking's services, one row each, with the price each was booked at
-- (server piece 7). Replaces workshop_jobs.service_id / booked_price (026),
-- which held exactly one. Existing bookings are copied across first, then the
-- old columns go, so this table is the only source.
-- Spec: docs/superpowers/specs/2026-09-26-book-server-7-multiple-services-design.md
CREATE TABLE workshop_job_services (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  workshop_job_id INTEGER NOT NULL REFERENCES workshop_jobs(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES workshop_services(id),
  booked_price NUMERIC(10,2),
  position INTEGER NOT NULL,
  UNIQUE (workshop_job_id, service_id)
);
CREATE INDEX idx_workshop_job_services_job ON workshop_job_services(shop_id, workshop_job_id);
ALTER TABLE workshop_job_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_job_services FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_job_services_shop_isolation ON workshop_job_services
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Backfill: FORCE ROW LEVEL SECURITY applies even to this migration's own
-- client (epos_app, the table owner), so app.current_shop_id must be set
-- per-shop before each shop's rows are read or inserted - the same pattern
-- migration 002's supplier backfill uses for the same reason (see
-- 002_supplier_catalogue.sql).
--
-- Unlike 002, the driving loop here cannot come from workshop_jobs itself:
-- workshop_jobs also has FORCE ROW LEVEL SECURITY (migration 001), so a
-- plain `SELECT DISTINCT shop_id FROM workshop_jobs` before current_shop_id
-- is set fails with "unrecognized configuration parameter" (confirmed by
-- running this migration as epos_app - it's the same failure as reading any
-- FORCE-protected table with no tenant set, not specific to this table).
-- shops itself carries no RLS (it's the tenant table, not tenant-scoped
-- data), so it's what drives the loop; app.current_shop_id is set to each
-- shop in turn before that shop's workshop_jobs rows are ever read.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM shops LOOP
    PERFORM set_config('app.current_shop_id', r.id::text, true);
    INSERT INTO workshop_job_services (workshop_job_id, service_id, booked_price, position)
      SELECT id, service_id, booked_price, 0 FROM workshop_jobs
      WHERE service_id IS NOT NULL AND shop_id = r.id;
  END LOOP;
END $$;

ALTER TABLE workshop_jobs DROP COLUMN service_id, DROP COLUMN booked_price;
