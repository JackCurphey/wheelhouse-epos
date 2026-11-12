-- Buy online and click and collect (openspec/changes/website-buy-online,
-- design 1; WP-6.3 pull request 1): an online order, its lines and its
-- history; online_payments taking an order's payment as well as a deposit;
-- the bank's check and "no answer" statuses; the rest of the Online orders
-- settings; and a Show online switch on each category. Every new table is the
-- shop's own under row-level security. Money is in pence. Additive; safe to
-- run twice. (150 to 153 are claimed by other pieces in progress.)
--
-- The refund tables, store_credit_entries.online_order_id and the
-- stock_movements refund cause come in pull request 5, as their shape follows
-- Jack's answer to question 9.

-- The tables an order points at first, before the new tables' links take a
-- lock on shops (as 137 orders its locks).
LOCK TABLE products, sites, customers, sales, employees, customer_messages, online_payments, pretend_payments,
  online_order_settings, product_categories IN SHARE ROW EXCLUSIVE MODE;

-- products (id, shop_id), sites (id, shop_id), customers (id, shop_id) and
-- sales (id, shop_id) are already unique (137 and before), so links carry the
-- shop: row-level security hides other shops' rows but doesn't check what a
-- link names.

CREATE TABLE IF NOT EXISTS online_orders (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  -- The collecting shop.
  site_id INTEGER NOT NULL,
  -- A guest order makes its own customer (design, decided while planning 10);
  -- empty until then, as checkout and paying are built in pull requests 4 and 5.
  customer_id INTEGER,
  -- The shop's own count, given when the order is paid (server/online-orders/numbers.js).
  number INTEGER,
  stage TEXT NOT NULL DEFAULT 'awaiting_payment'
    CHECK (stage IN ('awaiting_payment', 'payment_unsure', 'to_get_ready', 'ready', 'collected', 'cancelled', 'not_paid')),
  -- Collect only for now (journey 2, decision 1).
  how TEXT NOT NULL DEFAULT 'collect' CHECK (how IN ('collect')),
  -- As typed at checkout.
  name TEXT NOT NULL,
  email TEXT NOT NULL CHECK (char_length(email) <= 254),
  phone TEXT,
  total_pence INTEGER NOT NULL CHECK (total_pence >= 0),
  credit_pence INTEGER NOT NULL DEFAULT 0 CHECK (credit_pence >= 0),
  card_pence INTEGER NOT NULL DEFAULT 0 CHECK (card_pence >= 0),
  sale_id INTEGER,
  paid_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  ready_message_id INTEGER REFERENCES customer_messages(id) ON DELETE SET NULL,
  reminded_at TIMESTAMPTZ,
  keep_until DATE,
  contacted_at TIMESTAMPTZ,
  contacted_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  collected_at TIMESTAMPTZ,
  collected_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancelled_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  cancel_reason TEXT CHECK (char_length(cancel_reason) <= 500),
  cancelled_by_customer BOOLEAN NOT NULL DEFAULT false,
  -- The customer's private link (as c2w_orders.customer_code).
  order_code TEXT NOT NULL UNIQUE,
  -- One order per Pay.
  request_key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT online_orders_money_check CHECK (card_pence + credit_pence = total_pence),
  -- The number is given in the same step that marks it paid, never before.
  CONSTRAINT online_orders_number_check CHECK ((number IS NULL) = (paid_at IS NULL)),
  CONSTRAINT online_orders_paid_stage_check CHECK (paid_at IS NOT NULL OR stage IN ('awaiting_payment', 'payment_unsure', 'not_paid', 'cancelled')),
  CONSTRAINT online_orders_request_unique UNIQUE (shop_id, request_key_hash),
  FOREIGN KEY (site_id, shop_id) REFERENCES sites (id, shop_id),
  FOREIGN KEY (customer_id, shop_id) REFERENCES customers (id, shop_id),
  FOREIGN KEY (sale_id, shop_id) REFERENCES sales (id, shop_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_online_orders_id_shop ON online_orders (id, shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_online_orders_number ON online_orders (shop_id, number) WHERE number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_online_orders_stage ON online_orders (shop_id, stage);
CREATE INDEX IF NOT EXISTS idx_online_orders_customer ON online_orders (customer_id) WHERE customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS online_order_lines (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  -- The price when it was paid for.
  unit_pence INTEGER NOT NULL CHECK (unit_pence >= 0),
  FOREIGN KEY (order_id, shop_id) REFERENCES online_orders (id, shop_id),
  FOREIGN KEY (product_id, shop_id) REFERENCES products (id, shop_id)
);
CREATE INDEX IF NOT EXISTS idx_online_order_lines_order ON online_order_lines (order_id);
CREATE INDEX IF NOT EXISTS idx_online_order_lines_product ON online_order_lines (product_id);

-- "What's happened" on an order: only ever added to (as c2w_order_events).
CREATE TABLE IF NOT EXISTS online_order_events (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  order_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 40),
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  reason TEXT CHECK (char_length(reason) <= 500),
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (order_id, shop_id) REFERENCES online_orders (id, shop_id)
);
CREATE INDEX IF NOT EXISTS idx_online_order_events_order ON online_order_events (order_id, created_at);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['online_orders', 'online_order_lines', 'online_order_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_shop_isolation', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (shop_id = current_setting(''app.current_shop_id'')::int) WITH CHECK (shop_id = current_setting(''app.current_shop_id'')::int)', t || '_shop_isolation', t);
  END LOOP;
END $$;

-- An order's payment, beside a booking's deposit (070). The link carries the
-- shop, so a payment can only name its own shop's order. NOT VALID, as 137's
-- links: the column is new and empty, so there is nothing to check. No ON
-- DELETE: a payment keeps its order.
ALTER TABLE online_payments ADD COLUMN IF NOT EXISTS online_order_id INTEGER;
ALTER TABLE online_payments DROP CONSTRAINT IF EXISTS online_payments_online_order_fk;
ALTER TABLE online_payments ADD CONSTRAINT online_payments_online_order_fk
  FOREIGN KEY (online_order_id, shop_id) REFERENCES online_orders (id, shop_id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_online_payments_online_order ON online_payments (online_order_id) WHERE online_order_id IS NOT NULL;
ALTER TABLE online_payments DROP CONSTRAINT IF EXISTS online_payments_purpose_check;
ALTER TABLE online_payments ADD CONSTRAINT online_payments_purpose_check CHECK (purpose IN ('deposit', 'order'));
-- An order payment names its order; a deposit doesn't.
ALTER TABLE online_payments DROP CONSTRAINT IF EXISTS online_payments_order_check;
ALTER TABLE online_payments ADD CONSTRAINT online_payments_order_check CHECK ((purpose = 'order') = (online_order_id IS NOT NULL));

-- The bank's check (checking) and no answer (unknown), on Wheelhouse's record
-- and on the pretend provider's.
ALTER TABLE online_payments DROP CONSTRAINT IF EXISTS online_payments_status_check;
ALTER TABLE online_payments ADD CONSTRAINT online_payments_status_check
  CHECK (status IN ('waiting', 'held', 'declined', 'taken', 'released', 'refunded', 'checking', 'unknown'));
ALTER TABLE pretend_payments DROP CONSTRAINT IF EXISTS pretend_payments_status_check;
ALTER TABLE pretend_payments ADD CONSTRAINT pretend_payments_status_check
  CHECK (status IN ('waiting', 'held', 'declined', 'taken', 'released', 'refunded', 'checking', 'unknown'));

-- The rest of the Online orders settings (147 left room for them). What the
-- website sells: only what's on the shelf for now (question 10). Wallets and
-- store credit start on. Remind after 3 days, keep for 7 (question 12); the
-- ranges follow the bikes' (064). The shelf is unnamed until the Owner names
-- it. The shop's own order counter, taken in one statement.
ALTER TABLE online_order_settings
  ADD COLUMN IF NOT EXISTS sells TEXT NOT NULL DEFAULT 'shelf' CONSTRAINT online_order_settings_sells_check CHECK (sells IN ('shelf')),
  ADD COLUMN IF NOT EXISTS wallets_on BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS store_credit_on BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS remind_days INTEGER NOT NULL DEFAULT 3
    CONSTRAINT online_order_settings_remind_days_check CHECK (remind_days BETWEEN 1 AND 60),
  ADD COLUMN IF NOT EXISTS keep_days INTEGER NOT NULL DEFAULT 7
    CONSTRAINT online_order_settings_keep_days_check CHECK (keep_days BETWEEN 2 AND 90),
  ADD COLUMN IF NOT EXISTS shelf_name TEXT
    CONSTRAINT online_order_settings_shelf_name_check CHECK (char_length(shelf_name) BETWEEN 1 AND 60),
  ADD COLUMN IF NOT EXISTS next_order_number INTEGER NOT NULL DEFAULT 1
    CONSTRAINT online_order_settings_next_order_number_check CHECK (next_order_number >= 1);
ALTER TABLE online_order_settings DROP CONSTRAINT IF EXISTS online_order_settings_days_order_check;
ALTER TABLE online_order_settings ADD CONSTRAINT online_order_settings_days_order_check CHECK (keep_days > remind_days);

-- Showing products: a switch on each category, starting on so nothing leaves
-- the website (design, decided while planning 15).
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS show_online BOOLEAN NOT NULL DEFAULT true;
