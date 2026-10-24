-- Online payments, starting with a booking's deposit (WP-1.11's adapter;
-- Jack, 23 Oct answer 2 and 24 Oct answers 1–5; openspec/changes/deposit-payments
-- design 2–5). Money in whole pence. Additive only.

-- The pretend provider's own records: what a real provider (Stripe) keeps on
-- its side. Only the pretend provider reads or writes them.
CREATE TABLE pretend_payments (
  ref TEXT PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  idempotency_key TEXT NOT NULL,
  amount_pence INTEGER NOT NULL CONSTRAINT pretend_payments_amount_check CHECK (amount_pence > 0),
  status TEXT NOT NULL DEFAULT 'waiting'
    CONSTRAINT pretend_payments_status_check CHECK (status IN ('waiting', 'held', 'declined', 'taken', 'released', 'refunded')),
  refunded_pence INTEGER NOT NULL DEFAULT 0,
  card_last4 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pretend_payments_key_unique UNIQUE (shop_id, idempotency_key)
);
ALTER TABLE pretend_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pretend_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY pretend_payments_shop_isolation ON pretend_payments
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Wheelhouse's own record of each online payment: one per booking request.
CREATE TABLE online_payments (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  provider TEXT NOT NULL,
  provider_ref TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'deposit' CONSTRAINT online_payments_purpose_check CHECK (purpose IN ('deposit')),
  amount_pence INTEGER NOT NULL CONSTRAINT online_payments_amount_check CHECK (amount_pence > 0),
  status TEXT NOT NULL DEFAULT 'waiting'
    CONSTRAINT online_payments_status_check CHECK (status IN ('waiting', 'held', 'declined', 'taken', 'released', 'refunded')),
  request_key_hash TEXT NOT NULL,
  job_id INTEGER REFERENCES workshop_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT online_payments_request_unique UNIQUE (shop_id, request_key_hash)
);
CREATE INDEX idx_online_payments_job ON online_payments(job_id) WHERE job_id IS NOT NULL;
ALTER TABLE online_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY online_payments_shop_isolation ON online_payments
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- The booking's deposit and when it's free to cancel until, worked out at
-- booking and fixed (book a repair review 3).
ALTER TABLE workshop_jobs ADD COLUMN deposit_pence INTEGER CONSTRAINT workshop_jobs_deposit_check CHECK (deposit_pence > 0);
ALTER TABLE workshop_jobs ADD COLUMN deposit_cancel_until TIMESTAMPTZ;
