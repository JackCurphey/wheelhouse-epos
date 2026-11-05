-- Older stock lines say which shop (openspec/changes/stock-per-shop; WP-1.4 spec §4): a
-- till sale's line is the till's shop, any other the business's oldest. On its own, as
-- this one rewrites every older line: it holds only those lines, which nothing changes
-- but marking one Seen on Today, and sales, counts and history carry on. Measured in the
-- change's design, section 5. Only lines with no shop, so safe to run twice.
DO $$
DECLARE
  business RECORD;
  oldest INTEGER;
BEGIN
  FOR business IN SELECT id FROM shops ORDER BY id LOOP
    PERFORM set_config('app.current_shop_id', business.id::text, true);
    SELECT id INTO oldest FROM sites ORDER BY id LIMIT 1;
    UPDATE stock_movements m SET site_id = t.site_id FROM till_sales t
     WHERE m.site_id IS NULL AND t.id = m.till_sale_id;
    UPDATE stock_movements SET site_id = oldest WHERE site_id IS NULL;
  END LOOP;
  PERFORM set_config('app.current_shop_id', '', true);
END $$;
