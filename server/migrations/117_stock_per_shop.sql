-- Stock per shop (openspec/changes/stock-per-shop; Release 2 rule 3; WP-1.4 spec §4).
-- Every business gets a first shop, each product's stock is held per shop in
-- product_stock, and existing stock goes to the business's oldest shop. products.stock_qty
-- stays as the total: server/lib/stock.js changes both together, and nothing else does.
--
-- One transaction, so what's locked here stays locked until it ends: products against
-- writes, not reads, from building its key, which also holds still the stock being
-- copied; stock_takes wholly. So the copy comes before the second index and the links,
-- rather than checking each row as it goes. Measured in the change's design, section 5.
-- Older lines' shop is 118, on its own, as that takes longer and holds up nothing a shop does.
-- Additive and safe to run twice.

-- Keys that include the business, so a row can't point at another business's shop or
-- product (WP-1.4 spec §5, rule 1: a link isn't checked by row-level security).
-- CREATE UNIQUE INDEX rather than ADD CONSTRAINT: reads carry on while it builds.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_shop_id_id ON sites (shop_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_shop_id_id ON products (shop_id, id);

CREATE TABLE IF NOT EXISTS product_stock (
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int,
  site_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  PRIMARY KEY (shop_id, site_id, product_id)
);
ALTER TABLE product_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stock FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_stock_shop_isolation ON product_stock;
CREATE POLICY product_stock_shop_isolation ON product_stock
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- A count belongs to the shop it was started at. Empty column, so no rewrite; the link
-- NOT VALID as 115's, so nothing reads other businesses' rows with no shop set.
ALTER TABLE stock_takes ADD COLUMN IF NOT EXISTS site_id INTEGER;
ALTER TABLE stock_takes DROP CONSTRAINT IF EXISTS stock_takes_site_id_fkey;
ALTER TABLE stock_takes ADD CONSTRAINT stock_takes_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL NOT VALID;

-- A business at a time, as 002, 030 and 037 do: row-level security holds in here too.
DO $$
DECLARE
  business RECORD;
  oldest INTEGER;
BEGIN
  FOR business IN SELECT id FROM shops ORDER BY id LOOP
    PERFORM set_config('app.current_shop_id', business.id::text, true);
    -- As server/lib/first-site.js, which does the same for a business made from now on.
    IF NOT EXISTS (SELECT 1 FROM sites) THEN
      INSERT INTO sites (shop_id, name, code)
      SELECT id, name, COALESCE(upper(substring(name from '[A-Za-z]')), 'A') FROM shops WHERE id = business.id;
    END IF;
    SELECT id INTO oldest FROM sites ORDER BY id LIMIT 1;
    -- Only a product with no row at any shop: run again after stock has moved, this
    -- must not add it a second time. No row is none, so a product at nothing needs none.
    INSERT INTO product_stock (shop_id, site_id, product_id, qty)
    SELECT business.id, oldest, p.id, p.stock_qty FROM products p
     WHERE p.stock_qty <> 0 AND NOT EXISTS (SELECT 1 FROM product_stock s WHERE s.product_id = p.id);
    UPDATE stock_takes SET site_id = oldest WHERE site_id IS NULL;
  END LOOP;
  PERFORM set_config('app.current_shop_id', '', true);
END $$;

-- A product's stock at each shop. Plain columns compared with =, so row-level security
-- doesn't stop it being used.
CREATE INDEX IF NOT EXISTS idx_product_stock_product ON product_stock (shop_id, product_id);
-- NOT VALID as 115's: what's above can only be each business's own, and every new row is checked.
ALTER TABLE product_stock DROP CONSTRAINT IF EXISTS product_stock_shop_id_fkey;
ALTER TABLE product_stock ADD CONSTRAINT product_stock_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) NOT VALID;
ALTER TABLE product_stock DROP CONSTRAINT IF EXISTS product_stock_site_fkey;
ALTER TABLE product_stock ADD CONSTRAINT product_stock_site_fkey FOREIGN KEY (shop_id, site_id) REFERENCES sites (shop_id, id) NOT VALID;
ALTER TABLE product_stock DROP CONSTRAINT IF EXISTS product_stock_product_fkey;
ALTER TABLE product_stock ADD CONSTRAINT product_stock_product_fkey FOREIGN KEY (shop_id, product_id) REFERENCES products (shop_id, id) NOT VALID;
