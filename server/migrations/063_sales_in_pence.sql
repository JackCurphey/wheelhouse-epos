-- Sales in pence, step A: open orders stay in sale_documents and gain pence
-- columns beside their pounds (Mark, 15 Oct; #134). Pence is the authority;
-- the pounds columns stay, written by the same statement, until the old app
-- stops reading them. Additive only.
-- Spec: openspec/changes/wp-1-6-sales-in-pence/design.md Decisions 1 and 6.
--
-- vat_rate_bp is nullable: a labour line's VAT rate is Jack's call (asked on
-- #134), so nothing is assumed for it. paid_pence is what has been paid
-- towards the order: today only convert pays one, with its old sale.
ALTER TABLE sale_documents
  ADD COLUMN subtotal_pence INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN discount_pence INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN total_pence    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN paid_pence     INTEGER NOT NULL DEFAULT 0;

ALTER TABLE sale_document_items
  ADD COLUMN unit_price_pence INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN line_total_pence INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN vat_rate_bp      INTEGER CHECK (vat_rate_bp BETWEEN 0 AND 10000);

-- The backfill, per shop, because row-level security is forced on these
-- tables (as 048's backfill). Converting is ROUND(pounds * 100), the money
-- contract's rule, which the totals check holds every row to. A product
-- line takes its product's VAT rate as it is today (no rate was recorded at
-- the time, so an old order's rate is not a historical fact); a labour line
-- keeps none, and so does an old product line with no product (014 left
-- product_id unchecked on old rows), with no product to take one from.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM shops LOOP
    PERFORM set_config('app.current_shop_id', r.id::text, true);
    UPDATE sale_documents d SET
      subtotal_pence = ROUND(d.subtotal * 100)::int,
      discount_pence = ROUND(d.discount * 100)::int,
      total_pence    = ROUND(d.total * 100)::int,
      paid_pence     = COALESCE((SELECT ROUND(s.total * 100)::int FROM sales s
                                  WHERE s.id = d.converted_sale_id AND s.shop_id = d.shop_id), 0)
      WHERE d.shop_id = r.id;
    UPDATE sale_document_items i SET
      unit_price_pence = ROUND(i.unit_price * 100)::int,
      line_total_pence = ROUND(i.line_total * 100)::int,
      vat_rate_bp      = CASE WHEN i.line_type = 'product'
                         THEN (SELECT p.vat_rate_bp FROM products p WHERE p.id = i.product_id AND p.shop_id = i.shop_id) END
      WHERE i.shop_id = r.id;
  END LOOP;
END $$;
