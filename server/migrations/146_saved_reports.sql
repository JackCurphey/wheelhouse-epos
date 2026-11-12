-- Saved reports (openspec/changes/reports-your-own design 7; Reports part 3, PR 2):
-- a changed Sales, or Takings and cash-ups, report kept under a name by the person
-- who saved it. It keeps the choices and the KIND of period (This week, Last month),
-- never dates, so it opens on the latest period each time. `shared` is kept from the
-- start (who can see it) and stays false until staff roles bring managers (WP-1.1).
-- `measure` and `split` are free text checked by server/lib/report-changed.js, so a
-- later measure needs no migration. A name is one live name per person, whatever its
-- capitals; a deleted report keeps its row and frees its name. Additive and safe to
-- run twice: nothing existing is touched.
CREATE TABLE IF NOT EXISTS saved_reports (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  login_id INTEGER NOT NULL REFERENCES logins(id) ON DELETE CASCADE,
  base TEXT NOT NULL,
  measure TEXT NOT NULL,
  split TEXT NOT NULL,
  only_categories TEXT[] NOT NULL DEFAULT '{}',
  supplier TEXT,
  period TEXT NOT NULL,
  name TEXT NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 80),
  shared BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_reports_live_name ON saved_reports (shop_id, login_id, lower(name)) WHERE deleted_at IS NULL;

ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saved_reports_shop_isolation ON saved_reports;
CREATE POLICY saved_reports_shop_isolation ON saved_reports
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
