-- Your settings › Accessibility (workshop day 57; Jack, 23 Oct,
-- docs/decisions/2026-10-23-overnight-questions.md answer 1: saved on the
-- signed-in account until PINs; openspec/changes/your-settings-accessibility).
-- One row per login, made when they first change something; a switch not in
-- `accessibility` is off. 063 and 064 are taken by open pull requests (#404,
-- #440). Additive only.
CREATE TABLE login_preferences (
  login_id INTEGER PRIMARY KEY REFERENCES logins(id) ON DELETE CASCADE,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  accessibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_preferences_shop ON login_preferences(shop_id);
ALTER TABLE login_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY login_preferences_shop_isolation ON login_preferences
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
