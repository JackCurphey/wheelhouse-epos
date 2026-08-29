-- Which colour scheme a shop has chosen (see public/app.js's THEME_PRESETS
-- for what each preset key actually means - only the key is stored here,
-- the presets themselves are a small fixed frontend lookup).
CREATE TABLE shop_theme (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL UNIQUE DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  preset TEXT NOT NULL DEFAULT 'forest',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE shop_theme ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_theme FORCE ROW LEVEL SECURITY;
CREATE POLICY shop_theme_shop_isolation ON shop_theme
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
