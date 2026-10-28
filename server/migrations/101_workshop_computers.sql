-- The shared workshop computer (openspec/changes/workshop-computer, the
-- contract; walk-through 8 decisions 1 and 3; stage-1 gaps 4). A workshop
-- computer stands in one of the shop's sites, has an optional name and no
-- till number, and is known by the hash of a key its browser keeps (as a
-- till's, migration 100). Each PIN check-in records the workshop computer it
-- was made on, null elsewhere, and when it was last used there, so the
-- server can stop counting it after 10 minutes idle. Additive, with
-- row-level security, and safe to run twice.
CREATE TABLE IF NOT EXISTS workshop_computers (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  site_id INTEGER NOT NULL REFERENCES sites(id),
  name TEXT CHECK (name IS NULL OR char_length(name) <= 60),
  browser_token_hash TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE workshop_computers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_computers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workshop_computers_shop_isolation ON workshop_computers;
CREATE POLICY workshop_computers_shop_isolation ON workshop_computers
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

ALTER TABLE pin_checkins ADD COLUMN IF NOT EXISTS workshop_computer_id INTEGER REFERENCES workshop_computers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pin_checkins_workshop_day ON pin_checkins(workshop_computer_id, day);
ALTER TABLE pin_checkins ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
