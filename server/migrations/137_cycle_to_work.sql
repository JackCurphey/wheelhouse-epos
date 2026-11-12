-- Cycle to Work (openspec/changes/cycle-to-work, design 2; WP-7.1 pull request 1):
-- the shop's settings and scheme providers, each order from quote to the
-- provider's payment, its history, the provider's payments, and the links that
-- hold a frame or put a bike on a purchase order for an order. Every new table
-- is the shop's own under row-level security. Money is in pence. Additive; safe
-- to run twice. (130 to 136 are claimed by other pieces in progress.)

-- The tables an order points at first, before the new tables' links take a
-- lock on shops (as 131 orders its locks).
LOCK TABLE products, sites, customers, stock_frames, purchase_order_items, sales, employees IN SHARE ROW EXCLUSIVE MODE;

-- An order's customer, frame and sale must be its own shop's: row-level
-- security hides other shops' rows but doesn't check what a link names. These
-- let the links carry the shop, as products and sites already do. Always true
-- of existing rows, since id alone is unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_id_shop ON customers (id, shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_frames_id_shop ON stock_frames (id, shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_id_shop ON sales (id, shop_id);

-- One row per shop, made on first read. The day counts start empty: the
-- drawings leave them "[n]" and the Owner fills them in. The ordering rule and
-- the deposit choices start on the options the drawings show ticked.
CREATE TABLE IF NOT EXISTS c2w_settings (
  shop_id INTEGER PRIMARY KEY DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  hold_days INTEGER CHECK (hold_days BETWEEN 1 AND 365),
  remind_days INTEGER CHECK (remind_days BETWEEN 0 AND 365),
  quote_valid_days INTEGER CHECK (quote_valid_days BETWEEN 1 AND 365),
  order_rule TEXT NOT NULL DEFAULT 'certificate' CHECK (order_rule IN ('certificate', 'applied', 'deposit')),
  -- pence when 'pounds', hundredths of a percent when 'percent'
  deposit_kind TEXT NOT NULL DEFAULT 'pounds' CHECK (deposit_kind IN ('pounds', 'percent')),
  deposit_value INTEGER CHECK (deposit_value >= 0 AND (deposit_kind = 'pounds' OR deposit_value <= 10000)),
  deposit_on_certificate TEXT NOT NULL DEFAULT 'refund' CHECK (deposit_on_certificate IN ('refund', 'count')),
  deposit_on_pull_out TEXT NOT NULL DEFAULT 'refund' CHECK (deposit_on_pull_out IN ('refund', 'keep')),
  how_to_apply TEXT NOT NULL DEFAULT '' CHECK (char_length(how_to_apply) <= 2000),
  today_lines BOOLEAN NOT NULL DEFAULT true,
  -- The On Today fold: "No certificate after [n] days · payment [n] days late".
  no_certificate_days INTEGER CHECK (no_certificate_days BETWEEN 1 AND 365),
  payment_late_days INTEGER CHECK (payment_late_days BETWEEN 1 AND 365),
  -- The shop's own quote counter (design 3), taken under this row's lock.
  next_quote_number INTEGER NOT NULL DEFAULT 1 CHECK (next_quote_number >= 1)
);

CREATE TABLE IF NOT EXISTS c2w_providers (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  -- pence when 'pounds', hundredths of a percent when 'percent'; empty until filled in
  commission_kind TEXT NOT NULL DEFAULT 'percent' CHECK (commission_kind IN ('percent', 'pounds')),
  commission_value INTEGER CHECK (commission_value >= 0 AND (commission_kind = 'pounds' OR commission_value <= 10000)),
  pays_in_days INTEGER CHECK (pays_in_days BETWEEN 0 AND 365),
  accessories_inside BOOLEAN NOT NULL DEFAULT true,
  handover_note TEXT NOT NULL DEFAULT '' CHECK (char_length(handover_note) <= 2000),
  retired_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_c2w_providers_id_shop ON c2w_providers (id, shop_id);

CREATE TABLE IF NOT EXISTS c2w_orders (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  customer_id INTEGER NOT NULL,
  provider_id INTEGER NOT NULL,
  site_id INTEGER,
  stage TEXT NOT NULL DEFAULT 'quote' CHECK (stage IN ('quote', 'waiting', 'certificate', 'ready', 'collected', 'paid', 'cancelled', 'closed')),
  quote_number INTEGER NOT NULL,
  quote_given_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  quote_revised_at TIMESTAMPTZ,
  valid_until DATE,
  hold_until DATE,
  hold_wanted BOOLEAN NOT NULL DEFAULT true,
  product_id INTEGER NOT NULL,
  frame_id INTEGER,
  accessories JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_pence INTEGER NOT NULL CHECK (total_pence >= 0),
  applied_at TIMESTAMPTZ,
  application_reference TEXT CHECK (char_length(application_reference) <= 60),
  certificate_number TEXT CHECK (char_length(certificate_number) <= 60),
  certificate_pence INTEGER CHECK (certificate_pence >= 0),
  certificate_received_on DATE,
  difference_choice TEXT,
  sale_id INTEGER,
  collected_at TIMESTAMPTZ,
  expected_pence INTEGER CHECK (expected_pence >= 0),
  expected_by DATE,
  paid_pence INTEGER CHECK (paid_pence >= 0),
  paid_on DATE,
  provider_reference TEXT CHECK (char_length(provider_reference) <= 60),
  customer_code TEXT NOT NULL UNIQUE,
  close_reason TEXT CHECK (char_length(close_reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (provider_id, shop_id) REFERENCES c2w_providers (id, shop_id),
  FOREIGN KEY (customer_id, shop_id) REFERENCES customers (id, shop_id),
  FOREIGN KEY (frame_id, shop_id) REFERENCES stock_frames (id, shop_id),
  FOREIGN KEY (sale_id, shop_id) REFERENCES sales (id, shop_id),
  FOREIGN KEY (product_id, shop_id) REFERENCES products (id, shop_id),
  FOREIGN KEY (site_id, shop_id) REFERENCES sites (id, shop_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_c2w_orders_id_shop ON c2w_orders (id, shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_c2w_orders_quote_number ON c2w_orders (shop_id, quote_number);
CREATE INDEX IF NOT EXISTS idx_c2w_orders_stage ON c2w_orders (shop_id, stage);
CREATE INDEX IF NOT EXISTS idx_c2w_orders_customer ON c2w_orders (customer_id);

-- "What's happened" on an order: only ever added to.
CREATE TABLE IF NOT EXISTS c2w_order_events (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  order_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 40),
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  reason TEXT CHECK (char_length(reason) <= 500),
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (order_id, shop_id) REFERENCES c2w_orders (id, shop_id)
);
CREATE INDEX IF NOT EXISTS idx_c2w_order_events_order ON c2w_order_events (order_id, created_at);

-- A provider's payment that covers one or more orders.
CREATE TABLE IF NOT EXISTS c2w_payments (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  provider_id INTEGER NOT NULL,
  amount_pence INTEGER NOT NULL CHECK (amount_pence >= 0),
  received_on DATE NOT NULL,
  reference TEXT CHECK (char_length(reference) <= 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (provider_id, shop_id) REFERENCES c2w_providers (id, shop_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_c2w_payments_id_shop ON c2w_payments (id, shop_id);

CREATE TABLE IF NOT EXISTS c2w_payment_orders (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  payment_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  amount_pence INTEGER NOT NULL CHECK (amount_pence >= 0),
  UNIQUE (payment_id, order_id),
  FOREIGN KEY (payment_id, shop_id) REFERENCES c2w_payments (id, shop_id),
  FOREIGN KEY (order_id, shop_id) REFERENCES c2w_orders (id, shop_id)
);

-- A held frame names its order; a bike ordered in for an order names it on
-- the purchase order line, as workshop_job_id does. The link carries the shop,
-- so a frame or a line can only name its own shop's order. Cleared if the
-- order is removed (removing a shop), so the frame and the order never block
-- each other; only the link is cleared, never the row's shop. NOT VALID, as
-- 124's link: the columns are new and empty, so there is nothing to check.
ALTER TABLE stock_frames ADD COLUMN IF NOT EXISTS c2w_order_id INTEGER;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS c2w_order_id INTEGER;
ALTER TABLE stock_frames DROP CONSTRAINT IF EXISTS stock_frames_c2w_order_fk;
ALTER TABLE stock_frames ADD CONSTRAINT stock_frames_c2w_order_fk
  FOREIGN KEY (c2w_order_id, shop_id) REFERENCES c2w_orders (id, shop_id) ON DELETE SET NULL (c2w_order_id) NOT VALID;
ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_c2w_order_fk;
ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_c2w_order_fk
  FOREIGN KEY (c2w_order_id, shop_id) REFERENCES c2w_orders (id, shop_id) ON DELETE SET NULL (c2w_order_id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_stock_frames_c2w_order ON stock_frames (c2w_order_id) WHERE c2w_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_c2w_order ON purchase_order_items (c2w_order_id) WHERE c2w_order_id IS NOT NULL;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['c2w_settings', 'c2w_providers', 'c2w_orders', 'c2w_order_events', 'c2w_payments', 'c2w_payment_orders'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_shop_isolation', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (shop_id = current_setting(''app.current_shop_id'')::int) WITH CHECK (shop_id = current_setting(''app.current_shop_id'')::int)', t || '_shop_isolation', t);
  END LOOP;
END $$;
