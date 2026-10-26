-- Receiving a delivery without an order (openspec/changes/receive-without-order,
-- migration 094; receiving decisions 2, 3 and 9). Additive.
-- 1. Who booked stock in: stock_movements.login_id. jack/adjust-stock's 093
--    adds the same column the same way, so either can run first.
-- 2. A problem on an item not on an order: no order or order line, kept with
--    its supplier (for To return to [Supplier] later); damaged or wrong item
--    only, since Missing is offered only when there's an order (rs-problem).
-- Safe to run twice: columns are added only when missing, and the check is
-- dropped and made again.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'stock_movements' AND column_name = 'login_id') THEN
    ALTER TABLE stock_movements ADD COLUMN login_id INTEGER REFERENCES logins(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'delivery_problems' AND column_name = 'supplier_id') THEN
    ALTER TABLE delivery_problems ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id);
  END IF;
END $$;
ALTER TABLE delivery_problems ALTER COLUMN purchase_order_id DROP NOT NULL;
ALTER TABLE delivery_problems ALTER COLUMN purchase_order_item_id DROP NOT NULL;
ALTER TABLE delivery_problems DROP CONSTRAINT IF EXISTS delivery_problems_order_check;
ALTER TABLE delivery_problems ADD CONSTRAINT delivery_problems_order_check CHECK (
  (purchase_order_id IS NULL) = (purchase_order_item_id IS NULL)
  AND (purchase_order_id IS NOT NULL OR kind IN ('damaged', 'wrong_item'))
);
