-- Sales in pence, step A′ (Jack's side, openspec/changes/wp-1-6-sales-in-pence
-- task 2.1): the workshop's own amounts gain pence columns beside their
-- pounds, as 073 did for orders. Pence is the authority; the pounds stay,
-- written by the same statement, until nothing reads them. Additive only.
--
-- A quote line's quantity is a count (hours of labour can be 1.5), not money,
-- so it stays as it is; a line's total is ROUND(quantity * unit_amount_pence)
-- (design.md, step A′ note). A booked service with no price stays null.
ALTER TABLE workshop_services ADD COLUMN price_pence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workshop_quote_lines ADD COLUMN unit_amount_pence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workshop_job_services ADD COLUMN booked_price_pence INTEGER;

-- The backfill, per shop, because row-level security is forced on these
-- tables (as 073's). Converting is ROUND(pounds * 100), the money contract's
-- rule, which the totals check holds every row to.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM shops LOOP
    PERFORM set_config('app.current_shop_id', r.id::text, true);
    UPDATE workshop_services SET price_pence = ROUND(price * 100)::int WHERE shop_id = r.id;
    UPDATE workshop_quote_lines SET unit_amount_pence = ROUND(unit_amount * 100)::int WHERE shop_id = r.id;
    UPDATE workshop_job_services SET booked_price_pence = ROUND(booked_price * 100)::int WHERE shop_id = r.id AND booked_price IS NOT NULL;
  END LOOP;
END $$;
