-- Accounts software: connecting and choosing (openspec/changes/reports-accounts-and-reopen, design 4 and 5;
-- Reports part 4, PR 2). One connection a shop (provider Xero or QuickBooks, who connected it and when, and
-- whether it is connected, lost or disconnected: disconnecting keeps the row's history in `disconnected_at` and
-- never deletes the choices) and the account chosen for each line of a day's summary ("sales:Accessories",
-- "money:cash", "other:vat"), per service (Xero's accounts are not QuickBooks'), kept when disconnected or when
-- the other service is connected, in case the shop comes back. Built behind an adapter with a
-- pretend service (server/accounts/); nothing here talks to an outside service. Additive and safe to run
-- twice; row-level security as every shop table.
CREATE TABLE IF NOT EXISTS accounts_connections (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  provider TEXT NOT NULL CHECK (provider IN ('xero', 'quickbooks')),
  status TEXT NOT NULL CHECK (status IN ('connected', 'lost', 'disconnected')),
  connected_by INTEGER REFERENCES logins(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  UNIQUE (shop_id)
);

CREATE TABLE IF NOT EXISTS accounts_choices (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  provider TEXT NOT NULL CHECK (provider IN ('xero', 'quickbooks')),
  line_key TEXT NOT NULL CHECK (char_length(line_key) BETWEEN 1 AND 400),
  account_id TEXT NOT NULL CHECK (char_length(account_id) BETWEEN 1 AND 80),
  account_name TEXT NOT NULL CHECK (char_length(account_name) BETWEEN 1 AND 200),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, provider, line_key)
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts_connections', 'accounts_choices'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_shop_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (shop_id = current_setting(''app.current_shop_id'')::int) WITH CHECK (shop_id = current_setting(''app.current_shop_id'')::int)',
      t || '_shop_isolation', t
    );
  END LOOP;
END $$;
