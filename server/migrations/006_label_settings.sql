-- The physical dimensions of the sticker/barcode labels a shop's label
-- printer takes. One row per shop (same pattern as workshop_settings) -
-- editable from the Print Stickers modal itself (server.js's
-- GET/PUT /api/label-settings), since it's only ever touched right before
-- printing rather than deserving its own settings page.
CREATE TABLE label_settings (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL UNIQUE DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  width_mm NUMERIC(5,1) NOT NULL DEFAULT 50,
  height_mm NUMERIC(5,1) NOT NULL DEFAULT 25,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE label_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY label_settings_shop_isolation ON label_settings
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
