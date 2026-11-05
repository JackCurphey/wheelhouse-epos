-- Sizes and colours (openspec/changes/sizes-and-colours; stock control decision 4; Jack's
-- answer 5, 4 Nov): each size and colour stays its own row in products, with its own
-- barcode, joined in a group, the one product people see. A product with no sizes has no
-- group. New columns are empty and their checks NOT VALID, as 115's links, so no product
-- is rewritten or read under another business's rules. Additive and safe to run twice.
-- Measured in the change's design, section 4.

CREATE TABLE IF NOT EXISTS product_groups (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  category TEXT NOT NULL DEFAULT 'Uncategorised',
  description TEXT NOT NULL DEFAULT '',
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- id first, as 117's and 119's.
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_groups_id_shop ON product_groups (id, shop_id);
ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_groups FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_groups_shop_isolation ON product_groups;
CREATE POLICY product_groups_shop_isolation ON product_groups
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS group_id INTEGER,
  ADD COLUMN IF NOT EXISTS size TEXT,
  ADD COLUMN IF NOT EXISTS colour TEXT;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_group_fkey;
ALTER TABLE products ADD CONSTRAINT products_group_fkey
  FOREIGN KEY (group_id, shop_id) REFERENCES product_groups (id, shop_id) NOT VALID;
-- In a group, a size or a colour; out of one, neither. Neither is blank.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_size_colour_check;
ALTER TABLE products ADD CONSTRAINT products_size_colour_check CHECK (
  (group_id IS NULL AND size IS NULL AND colour IS NULL)
  OR (group_id IS NOT NULL AND (size IS NOT NULL OR colour IS NOT NULL)
      AND (size IS NULL OR btrim(size) <> '') AND (colour IS NULL OR btrim(colour) <> ''))
) NOT VALID;
-- Each size and colour once in a group, whatever its case; and a group's sizes found
-- from it. Only grouped rows, so it costs nothing on what's here.
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_group_size_colour
  ON products (shop_id, group_id, lower(coalesce(size, '')), lower(coalesce(colour, '')))
  WHERE group_id IS NOT NULL;
