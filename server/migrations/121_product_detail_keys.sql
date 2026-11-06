-- Finding products by a measurement under row-level security (openspec/changes/product-editing;
-- stock control decision 10: "bearing 30 mm"). Comparing numeric isn't leakproof, so an index
-- on value_number can't be used ahead of the business's own rows; comparing bigint is. So a
-- number answer is also kept as a whole number of ten-thousandths, value_key, which the
-- database holds equal to value_number, and that's what's searched. Nothing writes answers
-- before this piece, so there's nothing to fill. Additive and safe to run twice.
ALTER TABLE product_details ADD COLUMN IF NOT EXISTS value_key BIGINT;
ALTER TABLE product_details DROP CONSTRAINT IF EXISTS product_details_value_key_check;
ALTER TABLE product_details ADD CONSTRAINT product_details_value_key_check CHECK (
  (value_number IS NULL AND value_key IS NULL)
  OR (value_number IS NOT NULL AND value_key IS NOT NULL AND value_number = round(value_number, 4) AND value_key = (value_number * 10000)::bigint)
);
-- "30 mm" across the business's details with that unit; and a category's filter on one detail.
CREATE INDEX IF NOT EXISTS idx_product_details_detail_key ON product_details (shop_id, detail_id, value_key) WHERE value_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_details_detail_text ON product_details (shop_id, detail_id, value_text) WHERE value_text IS NOT NULL;
-- The stock list reads a business's products with sizes by its own index, not by reading
-- every business's (the review of sizes-and-colours); its products already have one (119).
CREATE INDEX IF NOT EXISTS idx_product_groups_shop ON product_groups (shop_id, category, name);
