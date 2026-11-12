-- Changes made in Wheelhouse go to the shop's Shopify as they happen (Jack's
-- answer to Q2, 12 Nov evening; drawing ws-shopify-on: "sent as you change
-- them in Wheelhouse"). Additive; safe to run twice.
--
-- shopify_changed: the products whose price, photo, name, stock or held
-- bikes changed since they were last sent, for a shop linked to Shopify and
-- not stopped. The database fills it, so every way stock moves (a sale, a
-- refund, receiving, a count, a hold) is caught without touching that code;
-- the background job (server/shopify/sending.js) sends them and takes them
-- off. changed_at moves on with each change, so a change made while the
-- product is with Shopify stays queued.
CREATE TABLE IF NOT EXISTS shopify_changed (
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (shop_id, product_id)
);

ALTER TABLE shopify_changed ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_changed FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shopify_changed_shop_isolation ON shopify_changed;
CREATE POLICY shopify_changed_shop_isolation ON shopify_changed
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Queues one product. Never stops the change that called it: a sale or a
-- stock count must go through even if queueing fails, so a failure is only a
-- warning in the log (Send in Wheelhouse still catches the product up).
-- The checks before the inner block keep its savepoint to shops linked to
-- Shopify, so a big delivery or count in any other shop costs nothing extra:
-- with no shop set (a script), or another shop's, it can't be queued anyway.
CREATE OR REPLACE FUNCTION shopify_queue_product(sid INTEGER, pid INTEGER) RETURNS void AS $$
BEGIN
  IF sid IS NULL OR pid IS NULL OR current_setting('app.current_shop_id', true) IS DISTINCT FROM sid::text THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM shopify_link WHERE shop_id = sid AND state <> 'stopped') THEN RETURN; END IF;
  BEGIN
    INSERT INTO shopify_changed (shop_id, product_id)
      SELECT sid, pid
       WHERE EXISTS (SELECT 1 FROM products WHERE id = pid AND shop_id = sid AND active = 1 AND show_online)
      ON CONFLICT (shop_id, product_id) DO UPDATE SET changed_at = clock_timestamp();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Shopify: product % not queued: %', pid, SQLERRM;
  END;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION shopify_product_changed() RETURNS trigger AS $$
BEGIN
  PERFORM shopify_queue_product(NEW.shop_id, NEW.id);
  RETURN NULL;
END $$ LANGUAGE plpgsql;

-- A frame held, sold or put back changes the stock Shopify sells (held bikes
-- show as sold out: server/shopify/link.js productsToSend).
CREATE OR REPLACE FUNCTION shopify_frame_changed() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN PERFORM shopify_queue_product(OLD.shop_id, OLD.product_id); END IF;
  IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW.product_id IS DISTINCT FROM OLD.product_id) THEN
    PERFORM shopify_queue_product(NEW.shop_id, NEW.product_id);
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_shopify_changed_insert ON products;
CREATE TRIGGER products_shopify_changed_insert AFTER INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION shopify_product_changed();
DROP TRIGGER IF EXISTS products_shopify_changed_update ON products;
CREATE TRIGGER products_shopify_changed_update
  AFTER UPDATE OF sku, name, price, photo_url, stock_qty, show_online, active ON products
  FOR EACH ROW WHEN ((OLD.sku, OLD.name, OLD.price, OLD.photo_url, OLD.stock_qty, OLD.show_online, OLD.active)
                     IS DISTINCT FROM (NEW.sku, NEW.name, NEW.price, NEW.photo_url, NEW.stock_qty, NEW.show_online, NEW.active))
  EXECUTE FUNCTION shopify_product_changed();
DROP TRIGGER IF EXISTS stock_frames_shopify_changed ON stock_frames;
CREATE TRIGGER stock_frames_shopify_changed AFTER INSERT OR DELETE OR UPDATE OF state, product_id ON stock_frames
  FOR EACH ROW EXECUTE FUNCTION shopify_frame_changed();
