-- One row per sale, in pence, from both records (openspec/changes/wp-1-6-sales-in-pence,
-- design.md Decision 3, step B). `source` says which record a row is and `id`
-- is that record's own number, so old sale 12 and till sale 12 never mix.
--   old:  total is ROUND(total * 100); the time is created_at; VAT was never
--         recorded, so it is empty; there is no receipt number.
--   till: total_pence and vat_pence as sent; the time is till_clock_at (the
--         till's clock, so an offline sale lands on the day it was made).
-- security_invoker makes the view read as the caller, so each shop's
-- row-level security on both tables still applies. Additive only; it goes
-- when the old tables do.
CREATE VIEW all_sales WITH (security_invoker = true) AS
  SELECT 'old'::text AS source,
         s.id,
         s.shop_id,
         s.created_at AS made_at,
         s.customer_id,
         s.cashier_id AS employee_id,
         ROUND(s.total * 100)::int AS total_pence,
         NULL::int AS vat_pence,
         NULL::int AS receipt_number
    FROM sales s
  UNION ALL
  SELECT 'till'::text,
         t.id,
         t.shop_id,
         t.till_clock_at,
         t.customer_id,
         t.employee_id,
         t.total_pence,
         t.vat_pence,
         t.receipt_number
    FROM till_sales t;
