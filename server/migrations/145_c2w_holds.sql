-- Holding bikes for Cycle to Work orders (openspec/changes/cycle-to-work,
-- design 4; tasks 5.1–5.3). An order's hold is now recorded on its own:
-- held_at says when the bike was put aside (a frame, or for a bike with no frame
-- numbers a count on the order), released_at when someone let it go. A hold
-- never ends by itself; hold_until only drives the reminder and "hold ended —
-- choose". Two new columns on a table no shop uses yet, so nothing already
-- here is rewritten. Additive and safe to run twice.

ALTER TABLE c2w_orders ADD COLUMN IF NOT EXISTS held_at TIMESTAMPTZ;
ALTER TABLE c2w_orders ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

-- Quotes made before this, with a hold date, were held when they were given,
-- as a count, for a bike with no frame numbers. For a bike with frame numbers no
-- frame was put aside, so the quote is not held and loses its hold date.
-- Each shop in turn, as the table's row security asks (pattern: 127).
DO $$
DECLARE
  business RECORD;
BEGIN
  FOR business IN SELECT id FROM shops ORDER BY id LOOP
    PERFORM set_config('app.current_shop_id', business.id::text, true);
    UPDATE c2w_orders o SET hold_until = NULL
      WHERE o.held_at IS NULL AND o.frame_id IS NULL AND o.hold_until IS NOT NULL
        AND EXISTS (SELECT 1 FROM stock_frames f WHERE f.product_id = o.product_id);
    UPDATE c2w_orders SET held_at = quote_given_at
      WHERE held_at IS NULL AND released_at IS NULL AND hold_until IS NOT NULL;
  END LOOP;
  PERFORM set_config('app.current_shop_id', '', true);
END $$;

-- The orders holding a bike at a site: the stock check's "held" figure, and for a
-- bike with no frame numbers what comes off the free number.
CREATE INDEX IF NOT EXISTS idx_c2w_orders_held ON c2w_orders (shop_id, product_id, site_id)
  WHERE held_at IS NOT NULL;
