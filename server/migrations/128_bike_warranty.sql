-- Bike warranties (openspec/changes/finish-customers, design 6; Jack, 9 Nov, answers 3 and 4).
-- The Owner lists bike brands, each with Frame, Components and Electronics lines of whole years
-- or lifetime; a product holds a brand (text, matched to the list by name ignoring capitals and
-- spaces, as a product's supplier is) and can have its own lines in place of its brand's
-- (question 17). A customer's bike bought here keeps the end of each line, worked out when it
-- became bought here, so later changes to a brand's lines never change a sold bike's. Whether a
-- product is an e-bike comes from its category's mark (migration 127). Additive; safe to run twice.

ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT CHECK (brand IS NULL OR char_length(brand) BETWEEN 1 AND 60);

CREATE TABLE IF NOT EXISTS bike_brand_warranties (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  brand TEXT NOT NULL CHECK (char_length(brand) BETWEEN 1 AND 60),
  -- What's compared: listed once per business, capitals and spaces at either end ignored.
  brand_key TEXT GENERATED ALWAYS AS (lower(btrim(brand))) STORED,
  UNIQUE (shop_id, brand_key)
);

-- A brand's lines, or one model's own (exactly one of the two). years NULL is lifetime.
CREATE TABLE IF NOT EXISTS warranty_lines (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  brand_warranty_id INTEGER REFERENCES bike_brand_warranties(id) ON DELETE CASCADE,
  product_id INTEGER,
  part TEXT NOT NULL CHECK (part IN ('frame', 'components', 'electronics')),
  years INTEGER CHECK (years IS NULL OR years BETWEEN 1 AND 50),
  CHECK ((brand_warranty_id IS NULL) <> (product_id IS NULL)),
  FOREIGN KEY (product_id, shop_id) REFERENCES products (id, shop_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_warranty_lines_brand ON warranty_lines (brand_warranty_id, part) WHERE brand_warranty_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_warranty_lines_product ON warranty_lines (product_id, part) WHERE product_id IS NOT NULL;

-- A customer's bike bought here: when, and what its lines were worked out from.
ALTER TABLE customer_bikes ADD COLUMN IF NOT EXISTS bought_here_on DATE;
ALTER TABLE customer_bikes ADD COLUMN IF NOT EXISTS is_ebike BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customer_bikes ADD COLUMN IF NOT EXISTS warranty_brand TEXT;
ALTER TABLE customer_bikes ADD COLUMN IF NOT EXISTS warranty_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;

-- Each line's end, written when the bike became bought here. ends_on NULL is lifetime.
CREATE TABLE IF NOT EXISTS bike_warranty_lines (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  customer_bike_id INTEGER NOT NULL REFERENCES customer_bikes(id) ON DELETE CASCADE,
  part TEXT NOT NULL CHECK (part IN ('frame', 'components', 'electronics')),
  ends_on DATE,
  UNIQUE (customer_bike_id, part)
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['bike_brand_warranties', 'warranty_lines', 'bike_warranty_lines'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_shop_isolation', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (shop_id = current_setting(''app.current_shop_id'')::int) WITH CHECK (shop_id = current_setting(''app.current_shop_id'')::int)', t || '_shop_isolation', t);
  END LOOP;
END $$;
