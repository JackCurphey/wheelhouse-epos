-- Refunding an online order (openspec/changes/website-buy-online design 1 and
-- 6, task 5.0): there is no sale refund on main (till refunds are WP-3.1), so
-- an order keeps its own refund records, which the takings and VAT reports
-- read. Each refund says which order and sale, why (a customer's cancel, the
-- shop's cancel, Can't supply), how much went back to the card and to store
-- credit, who, when, and whether the card part is still owed or made; its
-- lines say which of the order's lines and how many. A store credit entry can
-- name the order it was spent on or given back for, and a stock line the
-- refund that put the stock back.
-- New tables and nullable columns only: nothing already here is changed. Safe
-- to run twice.

-- The tables a refund points at first, then the two this alters ACCESS
-- EXCLUSIVE, as ALTER TABLE will need, so the migration never waits part way
-- for a stronger lock while holding others (as 154 orders its locks).
LOCK TABLE online_orders, online_order_lines, sales, employees IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE store_credit_entries, stock_movements IN ACCESS EXCLUSIVE MODE;

-- The order's lines carry their shop in links, as the orders do (154).
CREATE UNIQUE INDEX IF NOT EXISTS idx_online_order_lines_id_shop ON online_order_lines (id, shop_id);

CREATE TABLE IF NOT EXISTS online_order_refunds (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  order_id INTEGER NOT NULL,
  -- The sale the order became when it was paid.
  sale_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('customer_cancel', 'shop_cancel', 'cant_supply')),
  card_pence INTEGER NOT NULL DEFAULT 0 CHECK (card_pence >= 0),
  credit_pence INTEGER NOT NULL DEFAULT 0 CHECK (credit_pence >= 0),
  reason TEXT CHECK (char_length(reason) <= 500),
  -- Who: nobody when the customer cancelled on the website. The name is kept
  -- as it was, so a person removed later is still named.
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  who_name TEXT CHECK (char_length(who_name) <= 120),
  -- The card part: owed inside the transaction, made after the commit.
  card_refund_state TEXT CHECK (card_refund_state IN ('owed', 'made')),
  card_refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT online_order_refunds_amount_check CHECK (card_pence + credit_pence > 0),
  -- A card part has a state; no card part has none.
  CONSTRAINT online_order_refunds_card_state_check CHECK ((card_pence > 0) = (card_refund_state IS NOT NULL)),
  CONSTRAINT online_order_refunds_made_check CHECK ((card_refund_state = 'made') = (card_refunded_at IS NOT NULL)),
  FOREIGN KEY (order_id, shop_id) REFERENCES online_orders (id, shop_id),
  FOREIGN KEY (sale_id, shop_id) REFERENCES sales (id, shop_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_online_order_refunds_id_shop ON online_order_refunds (id, shop_id);
CREATE INDEX IF NOT EXISTS idx_online_order_refunds_order ON online_order_refunds (order_id);
-- Owed card refunds, which settling orders looks for.
CREATE INDEX IF NOT EXISTS idx_online_order_refunds_owed ON online_order_refunds (shop_id, id) WHERE card_refund_state = 'owed';

CREATE TABLE IF NOT EXISTS online_order_refund_lines (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  refund_id INTEGER NOT NULL,
  order_line_id INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  CONSTRAINT online_order_refund_lines_once UNIQUE (refund_id, order_line_id),
  FOREIGN KEY (refund_id, shop_id) REFERENCES online_order_refunds (id, shop_id),
  FOREIGN KEY (order_line_id, shop_id) REFERENCES online_order_lines (id, shop_id)
);
CREATE INDEX IF NOT EXISTS idx_online_order_refund_lines_line ON online_order_refund_lines (order_line_id);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['online_order_refunds', 'online_order_refund_lines'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_shop_isolation', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (shop_id = current_setting(''app.current_shop_id'')::int) WITH CHECK (shop_id = current_setting(''app.current_shop_id'')::int)', t || '_shop_isolation', t);
  END LOOP;
END $$;

-- A store credit spend or refund names its order. The columns are new and
-- empty, so the links are NOT VALID with nothing to check (as 154's).
ALTER TABLE store_credit_entries ADD COLUMN IF NOT EXISTS online_order_id INTEGER;
ALTER TABLE store_credit_entries DROP CONSTRAINT IF EXISTS store_credit_entries_online_order_fk;
ALTER TABLE store_credit_entries ADD CONSTRAINT store_credit_entries_online_order_fk
  FOREIGN KEY (online_order_id, shop_id) REFERENCES online_orders (id, shop_id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_store_credit_entries_online_order ON store_credit_entries (online_order_id) WHERE online_order_id IS NOT NULL;

-- Stock put back by an order's refund, beside sale_id.
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS online_order_refund_id INTEGER;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_online_order_refund_fk;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_online_order_refund_fk
  FOREIGN KEY (online_order_refund_id, shop_id) REFERENCES online_order_refunds (id, shop_id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_stock_movements_online_order_refund ON stock_movements (online_order_refund_id) WHERE online_order_refund_id IS NOT NULL;
