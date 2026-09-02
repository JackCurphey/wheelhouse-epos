-- A shop's own named services: what it charges for its time, and how long a
-- job of that kind takes. Replaces the category = 'Services' product fake for
-- new work; existing Services products keep working untouched.
CREATE TABLE workshop_services (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  minutes INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workshop_services_shop ON workshop_services(shop_id, active);
ALTER TABLE workshop_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_services FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_services_shop_isolation ON workshop_services
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Both line tables carry the same three columns: the editable order line and
-- the immutable receipt line written at tender. A labour line is product_id
-- NULL, qty 1, and a typed unit_price.
ALTER TABLE sale_document_items
  ADD COLUMN line_type  TEXT NOT NULL DEFAULT 'product',
  ADD COLUMN service_id INTEGER REFERENCES workshop_services(id),
  ADD COLUMN minutes    INTEGER;

ALTER TABLE sale_items
  ADD COLUMN line_type  TEXT NOT NULL DEFAULT 'product',
  ADD COLUMN service_id INTEGER REFERENCES workshop_services(id),
  ADD COLUMN minutes    INTEGER;

-- NOT VALID on the two product_id rules is deliberate. product_id has been
-- nullable since 001 with nothing enforcing it, and migrations here are
-- forward-only with no way back, so a single legacy null row would abort this
-- migration permanently. NOT VALID enforces the rule on every new and updated
-- row while leaving history unscanned. A later migration can VALIDATE
-- CONSTRAINT once the existing rows have been checked in place.
ALTER TABLE sale_document_items
  ADD CONSTRAINT sale_document_items_line_type_valid
    CHECK (line_type IN ('product','labour')),
  ADD CONSTRAINT sale_document_items_labour_has_no_product
    CHECK (line_type <> 'labour' OR product_id IS NULL) NOT VALID,
  ADD CONSTRAINT sale_document_items_product_has_product
    CHECK (line_type <> 'product' OR product_id IS NOT NULL) NOT VALID;

ALTER TABLE sale_items
  ADD CONSTRAINT sale_items_line_type_valid
    CHECK (line_type IN ('product','labour')),
  ADD CONSTRAINT sale_items_labour_has_no_product
    CHECK (line_type <> 'labour' OR product_id IS NULL) NOT VALID,
  ADD CONSTRAINT sale_items_product_has_product
    CHECK (line_type <> 'product' OR product_id IS NOT NULL) NOT VALID;
