-- A bike held by count for a Cycle to Work order changes the stock Shopify
-- sells, as a held frame does (150: stock_frames_shopify_changed). A count
-- hold is an open order with held_at set and no frame (145; server/c2w/orders.js
-- heldCounts), and productsToSend leaves it out of the stock sent. Taking or
-- letting go such a hold queues the bike. Additive; safe to run twice.

CREATE OR REPLACE FUNCTION c2w_count_held(o c2w_orders) RETURNS boolean AS $$
  SELECT o.held_at IS NOT NULL AND o.frame_id IS NULL AND o.stage IN ('quote', 'waiting', 'certificate', 'ready')
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION shopify_c2w_hold_changed() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (c2w_count_held(OLD), OLD.product_id) IS NOT DISTINCT FROM (c2w_count_held(NEW), NEW.product_id) THEN
    RETURN NULL;
  END IF;
  IF TG_OP <> 'INSERT' AND c2w_count_held(OLD) THEN PERFORM shopify_queue_product(OLD.shop_id, OLD.product_id); END IF;
  IF TG_OP <> 'DELETE' AND c2w_count_held(NEW) THEN PERFORM shopify_queue_product(NEW.shop_id, NEW.product_id); END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS c2w_orders_shopify_changed ON c2w_orders;
CREATE TRIGGER c2w_orders_shopify_changed AFTER INSERT OR DELETE OR UPDATE OF held_at, frame_id, stage, product_id ON c2w_orders
  FOR EACH ROW EXECUTE FUNCTION shopify_c2w_hold_changed();
