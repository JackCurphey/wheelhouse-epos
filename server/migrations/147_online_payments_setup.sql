-- Online payments set up per shop, and the Online orders settings
-- (openspec/changes/website-management, design 6). Additive; safe to run twice.
--
-- online_payment_account: this shop's own account with the payment provider,
-- connected by an Owner through the adapter (server/payments/). Deposits,
-- "Pay now" and Buying online need it connected (server/payments/provider.js).
CREATE TABLE IF NOT EXISTS online_payment_account (
  shop_id INTEGER PRIMARY KEY DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  provider TEXT NOT NULL,
  status TEXT NOT NULL CONSTRAINT online_payment_account_status_check CHECK (status IN ('connected', 'failed', 'needs_details')),
  connected_by INTEGER REFERENCES logins(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ,
  -- What the provider asks for, and by when, or online payments stop.
  needs_details_by DATE,
  needs_what TEXT,
  -- The £1 test payment, taken and refunded.
  test_paid_at TIMESTAMPTZ,
  payout_last4 TEXT,
  payout_timing TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only Buying online for now; WP-6.3 adds the rest of the Online orders
-- settings here (defaults taken 12 Nov, item 4).
CREATE TABLE IF NOT EXISTS online_order_settings (
  shop_id INTEGER PRIMARY KEY DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  buying_online BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['online_payment_account', 'online_order_settings'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_shop_isolation', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (shop_id = current_setting(''app.current_shop_id'')::int) WITH CHECK (shop_id = current_setting(''app.current_shop_id'')::int)', t || '_shop_isolation', t);
  END LOOP;
END $$;

-- A shop already taking booking deposits keeps taking them: deposits could
-- only be switched on with a provider connected, and the pretend one is the
-- only provider there has been. Whether this server has that provider is
-- checked when the account is read, so on a server with none it stays off.
DO $$
DECLARE business RECORD;
BEGIN
  FOR business IN SELECT id FROM shops ORDER BY id LOOP
    PERFORM set_config('app.current_shop_id', business.id::text, true);
    -- shop_id named as well as set, for a role row-level security doesn't apply to.
    IF EXISTS (SELECT 1 FROM workshop_settings WHERE shop_id = business.id AND deposit_on = 1) THEN
      INSERT INTO online_payment_account (shop_id, provider, status, connected_at)
        VALUES (business.id, 'pretend', 'connected', now())
        ON CONFLICT (shop_id) DO NOTHING;
    END IF;
  END LOOP;
  PERFORM set_config('app.current_shop_id', '', true);
END $$;
