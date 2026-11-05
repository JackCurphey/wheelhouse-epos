-- The category tree and each category's details (openspec/changes/category-tree; stock
-- control decision 10). A product's text category stays, for every old reader, and is
-- the link: it's always a category's whole path ("Drivetrain › Derailleurs"), so no
-- column is added to products and products aren't rewritten, except text that isn't
-- tidy yet. Built from that text, a business at a time. Additive and safe to run twice.
-- Measured in the change's design, section 4.

CREATE TABLE IF NOT EXISTS product_categories (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  parent_id INTEGER,
  name TEXT NOT NULL CHECK (name <> '' AND position('›' IN name) = 0),
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- id first, as 117's: a link's key that can't lead a read of a whole business.
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_id_shop ON product_categories (id, shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_path ON product_categories (shop_id, path);
CREATE INDEX IF NOT EXISTS idx_product_categories_parent ON product_categories (shop_id, parent_id);
-- NOT VALID, as 115 and 117: run again, nothing reads other businesses' rows with no business set.
ALTER TABLE product_categories DROP CONSTRAINT IF EXISTS product_categories_parent_fkey;
ALTER TABLE product_categories ADD CONSTRAINT product_categories_parent_fkey
  FOREIGN KEY (parent_id, shop_id) REFERENCES product_categories (id, shop_id) NOT VALID;

CREATE TABLE IF NOT EXISTS category_details (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL CHECK (name <> ''),
  kind TEXT NOT NULL CHECK (kind IN ('number', 'choice', 'text')),
  unit TEXT CHECK (unit IS NULL OR kind = 'number'),
  choices TEXT[] NOT NULL DEFAULT '{}' CHECK (kind = 'choice' OR cardinality(choices) = 0),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (category_id, shop_id) REFERENCES product_categories (id, shop_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_details_id_shop ON category_details (id, shop_id);
CREATE INDEX IF NOT EXISTS idx_category_details_category ON category_details (shop_id, category_id);

-- A product's answers. Nothing writes them until product-editing (WP-1.5 piece 6), which
-- adds what searching by them needs. Removing a detail takes its answers.
CREATE TABLE IF NOT EXISTS product_details (
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  detail_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  value_number NUMERIC,
  value_text TEXT,
  PRIMARY KEY (shop_id, detail_id, product_id),
  FOREIGN KEY (detail_id, shop_id) REFERENCES category_details (id, shop_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id, shop_id) REFERENCES products (id, shop_id)
);
CREATE INDEX IF NOT EXISTS idx_product_details_product ON product_details (shop_id, product_id);

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['product_categories', 'category_details', 'product_details'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_shop_isolation', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (shop_id = current_setting(''app.current_shop_id'')::int) WITH CHECK (shop_id = current_setting(''app.current_shop_id'')::int)', t || '_shop_isolation', t);
  END LOOP;
END $$;

-- Products of one category are found by their text: a category count, the stock list's
-- filter, and renaming a category. Plain = on plain columns, so row-level security allows it.
CREATE INDEX IF NOT EXISTS idx_products_shop_category ON products (shop_id, category);

-- The tree, from each business's text, as server/lib/categories.js tidies it: split on
-- "›", each part trimmed, empty parts dropped, joined with " › ". Nothing left is
-- Uncategorised, which isn't a category. Letters keep their case: "bearings" and
-- "Bearings" stay two, as the shop wrote them.
DO $$
DECLARE
  business RECORD;
  written RECORD;
  parts TEXT[];
  tidy TEXT;
  parent INTEGER;
  here TEXT;
  i INTEGER;
BEGIN
  FOR business IN SELECT id FROM shops ORDER BY id LOOP
    PERFORM set_config('app.current_shop_id', business.id::text, true);
    FOR written IN SELECT DISTINCT category FROM products WHERE category <> 'Uncategorised' LOOP
      SELECT coalesce(array_agg(btrim(part) ORDER BY n) FILTER (WHERE btrim(part) <> ''), '{}')
        INTO parts FROM unnest(string_to_array(written.category, '›')) WITH ORDINALITY AS u(part, n);
      tidy := CASE WHEN cardinality(parts) = 0 THEN 'Uncategorised' ELSE array_to_string(parts, ' › ') END;
      parent := NULL;
      FOR i IN 1 .. cardinality(parts) LOOP
        here := array_to_string(parts[1:i], ' › ');
        INSERT INTO product_categories (shop_id, parent_id, name, path) VALUES (business.id, parent, parts[i], here)
          ON CONFLICT (shop_id, path) DO NOTHING;
        SELECT id INTO parent FROM product_categories WHERE path = here;
      END LOOP;
      IF tidy <> written.category THEN
        UPDATE products SET category = tidy WHERE category = written.category;
      END IF;
    END LOOP;
  END LOOP;
  PERFORM set_config('app.current_shop_id', '', true);
END $$;
