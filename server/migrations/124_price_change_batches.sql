-- Changing prices in bulk (openspec/changes/bulk-price-change, design 1; stock control decisions
-- 7 and 11): each bulk change, with who made it and when it was undone, and the bulk change on
-- each price line it wrote, so Undo can find them. A new table and a new column that starts
-- empty, so nothing already here is rewritten. Additive and safe to run twice.

CREATE TABLE IF NOT EXISTS price_change_batches (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  login_id INTEGER REFERENCES logins(id) ON DELETE SET NULL,
  -- Kept as it was, so a person removed later is still named (as a price line's who_name).
  who_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  undone_at TIMESTAMPTZ
);
-- A price line names its business's own bulk change only (as 117's (id, shop_id) keys).
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_change_batches_id_shop ON price_change_batches (id, shop_id);
ALTER TABLE price_change_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_change_batches FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS price_change_batches_shop_isolation ON price_change_batches;
CREATE POLICY price_change_batches_shop_isolation ON price_change_batches
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

ALTER TABLE product_price_changes ADD COLUMN IF NOT EXISTS batch_id INTEGER;
ALTER TABLE product_price_changes DROP CONSTRAINT IF EXISTS product_price_changes_batch_fkey;
-- NOT VALID, as 123's link: the column is new and empty, so there is nothing to check.
ALTER TABLE product_price_changes ADD CONSTRAINT product_price_changes_batch_fkey
  FOREIGN KEY (batch_id, shop_id) REFERENCES price_change_batches (id, shop_id) ON DELETE CASCADE NOT VALID;
-- Undo reads a bulk change's lines.
CREATE INDEX IF NOT EXISTS idx_product_price_changes_batch
  ON product_price_changes (shop_id, batch_id) WHERE batch_id IS NOT NULL;
