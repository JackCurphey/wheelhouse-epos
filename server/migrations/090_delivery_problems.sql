-- What was wrong with a delivery (openspec/changes/receive-delivery, the
-- contract; receiving decision 9; rs-problem): marked at booking in as
-- damaged, wrong item or missing, how many and an optional note. Damaged and
-- wrong items aren't added to stock and are set aside, off what's still to
-- come (missing ones stay to come); To return to [Supplier] and Returned read
-- these later. Additive.
CREATE TABLE delivery_problems (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
  purchase_order_item_id INTEGER NOT NULL REFERENCES purchase_order_items(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  kind TEXT NOT NULL CHECK (kind IN ('damaged', 'wrong_item', 'missing')),
  qty INTEGER NOT NULL CHECK (qty > 0),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_problems_order ON delivery_problems(purchase_order_id);
ALTER TABLE delivery_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_problems FORCE ROW LEVEL SECURITY;
CREATE POLICY delivery_problems_shop_isolation ON delivery_problems
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
