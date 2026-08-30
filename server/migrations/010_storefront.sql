-- Per-shop public storefront configuration (branding, opt-in visibility),
-- shown at <slug>.wheelhouseepos.com. One row per shop, created lazily the
-- first time an owner opens storefront settings - same singleton-per-shop
-- pattern as shop_theme (009_shop_theme.sql).
CREATE TABLE storefront_settings (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL UNIQUE DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  tagline TEXT,
  description TEXT,
  logo_url TEXT,
  hero_image_url TEXT,
  theme_preset TEXT NOT NULL DEFAULT 'forest',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE storefront_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY storefront_settings_shop_isolation ON storefront_settings
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Per-product opt-in for public storefront visibility, plus the fields a
-- storefront listing needs that the till/inventory UI never required.
ALTER TABLE products ADD COLUMN show_online BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN description TEXT;
ALTER TABLE products ADD COLUMN photo_url TEXT;
