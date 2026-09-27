-- Migration 036 (Release 2, offline core): sites and registered tills, staff
-- PINs and daily check-ins, till sales recorded exactly once in whole pence
-- with VAT per line, and the attention list ("check these" / "needs attention").
-- New tables sit beside the legacy sales tables, which the legacy till still
-- uses until piece 3 replaces it.
-- Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md

ALTER TABLE employees ADD COLUMN pin_hash TEXT;
-- UK standard rate. Basis points: 2000 = 20.00%, 500 = 5%, 0 = zero-rated.
ALTER TABLE products ADD COLUMN vat_rate_bp INTEGER NOT NULL DEFAULT 2000
  CHECK (vat_rate_bp BETWEEN 0 AND 10000);
-- Set when a till creates the customer offline, so a re-sent customer is
-- recognised rather than created twice.
ALTER TABLE customers ADD COLUMN client_id UUID;
CREATE UNIQUE INDEX idx_customers_client_id ON customers(shop_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE sites (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL CHECK (code ~ '^[A-Z]{1,3}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, code)
);

CREATE TABLE tills (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  site_id INTEGER NOT NULL REFERENCES sites(id),
  code TEXT NOT NULL CHECK (code ~ '^[A-Z]{1,3}[0-9]{1,2}$'),
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  last_pending_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, code)
);

CREATE TABLE staff_checkins (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  till_id INTEGER NOT NULL REFERENCES tills(id),
  client_id UUID NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, client_id)
);

CREATE TABLE till_sales (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  client_id UUID NOT NULL,
  till_id INTEGER NOT NULL REFERENCES tills(id),
  site_id INTEGER NOT NULL REFERENCES sites(id),
  receipt_number INTEGER NOT NULL CHECK (receipt_number > 0),
  employee_id INTEGER REFERENCES employees(id),
  customer_id INTEGER REFERENCES customers(id),
  made_offline BOOLEAN NOT NULL,
  till_clock_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_pence INTEGER NOT NULL,
  vat_pence INTEGER NOT NULL,
  UNIQUE (shop_id, client_id)
);
CREATE INDEX idx_till_sales_till_receipt ON till_sales(shop_id, till_id, receipt_number);

CREATE TABLE till_sale_lines (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  till_sale_id INTEGER NOT NULL REFERENCES till_sales(id) ON DELETE CASCADE,
  -- Null when the till sold a product the server no longer has.
  product_id INTEGER REFERENCES products(id),
  description TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price_pence INTEGER NOT NULL,
  line_total_pence INTEGER NOT NULL,
  vat_rate_bp INTEGER NOT NULL CHECK (vat_rate_bp BETWEEN 0 AND 10000),
  vat_pence INTEGER NOT NULL
);

CREATE TABLE till_sale_payments (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  till_sale_id INTEGER NOT NULL REFERENCES till_sales(id) ON DELETE CASCADE,
  -- Not constrained: a method the server does not know yet is recorded and
  -- flagged, never refused.
  method TEXT NOT NULL,
  amount_pence INTEGER NOT NULL
);

CREATE TABLE till_attention (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  kind TEXT NOT NULL CHECK (kind IN (
    'stock_below_zero', 'unknown_product', 'unknown_customer', 'unknown_employee',
    'payments_do_not_match', 'unsupported_payment_method', 'possible_duplicate_customer',
    'receipt_number_reused'
  )),
  detail TEXT NOT NULL,
  till_sale_id INTEGER REFERENCES till_sales(id),
  product_id INTEGER REFERENCES products(id),
  customer_id INTEGER REFERENCES customers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by_login_id INTEGER
);
-- One open "below zero" item per product, however many sales push it lower.
CREATE UNIQUE INDEX idx_till_attention_open_stock ON till_attention(shop_id, product_id)
  WHERE kind = 'stock_below_zero' AND resolved_at IS NULL;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sites', 'tills', 'staff_checkins', 'till_sales', 'till_sale_lines', 'till_sale_payments', 'till_attention'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (shop_id = current_setting(''app.current_shop_id'')::int) WITH CHECK (shop_id = current_setting(''app.current_shop_id'')::int)',
      t || '_shop_isolation', t
    );
  END LOOP;
END $$;
