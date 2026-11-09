-- Bike frame numbers on stock (openspec/changes/frame-numbers, design 2; receiving decision 5,
-- stock control decision 3): each bike booked in is known by its frame number, at a shop, from
-- a delivery, in stock until the till sells it. Room for the sale (when, to whom, the customer's
-- bike it becomes) is here for the till's "Which one?" and the warranty, empty until then. A new
-- table, so nothing already here is rewritten. Additive and safe to run twice.

CREATE TABLE IF NOT EXISTS stock_frames (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  product_id INTEGER NOT NULL,
  site_id INTEGER REFERENCES sites(id),
  -- As scanned or typed, trimmed; frame_key is what's compared: capitals, no spaces.
  frame_number TEXT NOT NULL CHECK (char_length(frame_number) BETWEEN 1 AND 60),
  frame_key TEXT NOT NULL CHECK (frame_key <> ''),
  state TEXT NOT NULL DEFAULT 'in_stock' CHECK (state IN ('in_stock', 'held', 'sold')),
  delivery_id INTEGER REFERENCES deliveries(id),
  delivery_line_id INTEGER REFERENCES delivery_lines(id),
  stock_movement_id INTEGER,
  -- Kept as it was, so a person removed later is still named (as a stock line's who_name).
  received_by_name TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sold_at TIMESTAMPTZ,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_bike_id INTEGER REFERENCES customer_bikes(id) ON DELETE SET NULL,
  -- The product is this business's own (117's (id, shop_id) key).
  FOREIGN KEY (product_id, shop_id) REFERENCES products (id, shop_id) ON DELETE CASCADE
);
-- No frame in stock (or held) twice in a business; two deliveries booking it at once can't both win.
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_frames_in_stock ON stock_frames (shop_id, frame_key) WHERE state <> 'sold';
CREATE INDEX IF NOT EXISTS idx_stock_frames_product ON stock_frames (shop_id, product_id, state);
ALTER TABLE stock_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_frames FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_frames_shop_isolation ON stock_frames;
CREATE POLICY stock_frames_shop_isolation ON stock_frames
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
