-- Every stock line says who, why, which shop and what caused it
-- (openspec/changes/stock-movements-say-who; stock control decision 6; Release 2 rule
-- 3). login_id stays the sign-in; the person is employee_id and who_name, as a
-- delivery keeps them: a shared computer stays signed in as the Owner, and a team
-- member can be deleted, so the name stays when the link goes. site_id can be empty:
-- older lines recorded none, and a business may have no shop yet (stock-per-shop
-- gives every business one and fills these in). No backfill here, so no rewrite: the
-- new columns are empty and the links NOT VALID, as 096's are, so nothing reads
-- existing rows without a shop set. Additive and safe to run twice.
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS employee_id INTEGER,
  ADD COLUMN IF NOT EXISTS who_name TEXT,
  ADD COLUMN IF NOT EXISTS site_id INTEGER,
  ADD COLUMN IF NOT EXISTS sale_id INTEGER,
  ADD COLUMN IF NOT EXISTS delivery_id INTEGER,
  ADD COLUMN IF NOT EXISTS shopify_refund_id TEXT;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_employee_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL NOT VALID;
-- Removing a staff member, sale or delivery checks its link, so each needs an index or
-- every removal reads every line, even lines a shop's removal has just deleted. Only
-- lines with the link, so these cost nothing on what's already there.
CREATE INDEX IF NOT EXISTS idx_stock_movements_employee ON stock_movements (employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_sale ON stock_movements (sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_delivery ON stock_movements (delivery_id) WHERE delivery_id IS NOT NULL;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_site_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_sale_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_delivery_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE SET NULL NOT VALID;
