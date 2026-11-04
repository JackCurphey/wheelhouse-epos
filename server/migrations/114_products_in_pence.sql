-- A product's price and cost in whole pence (openspec/changes/products-in-pence,
-- design 1 and 2; WP-1.5, piece 1). Worked out by the database from the pounds, so
-- every old writer (the old till and app, the Citrus and supplier imports) stays
-- correct and the two can't disagree. NUMERIC(10,2) is a true decimal, so this is
-- exact; BIGINT because the column holds up to £99,999,999.99, past an INTEGER, and
-- one absurd row mustn't stop this running. A negative cost, which the old form can
-- save, converts too. Rewrites the table under its lock, once: 3.7s for 1,000,000
-- products when measured. Safe to run twice.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_pence BIGINT GENERATED ALWAYS AS (round(price * 100)::bigint) STORED,
  ADD COLUMN IF NOT EXISTS cost_pence BIGINT GENERATED ALWAYS AS (round(cost * 100)::bigint) STORED;
