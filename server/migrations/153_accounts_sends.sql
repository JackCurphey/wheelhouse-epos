-- Sending each closed day to the accounts software (openspec/changes/reports-accounts-and-reopen, design 5 to 7;
-- Reports part 4, PR 3). One row a shop a day saying where that day's summary stands (sent, waiting for a
-- connection, or failed with the reason and the line that has no account), the summary exactly as it was sent
-- (so what was sent is kept even if the rules change), the amount, the lines Wheelhouse doesn't record yet, and a
-- version that goes up when a reopened day is sent again. And the pretend service's own copy: one summary a day,
-- replaced when the day is corrected, kept in Wheelhouse's tables because the pretend service makes no outside
-- call. Additive and safe to run twice; row-level security as every shop table.
CREATE TABLE IF NOT EXISTS accounts_sends (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  day DATE NOT NULL,
  close_id INTEGER REFERENCES day_closes(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('sent', 'waiting', 'failed')),
  reason TEXT,
  failed_line TEXT,
  amount_pence INTEGER,
  external_id TEXT,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  summary JSONB,
  not_recorded TEXT[] NOT NULL DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, day)
);

CREATE TABLE IF NOT EXISTS accounts_pretend_summaries (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  provider TEXT NOT NULL CHECK (provider IN ('xero', 'quickbooks')),
  external_id TEXT NOT NULL,
  day DATE NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  summary JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, day),
  UNIQUE (shop_id, external_id)
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts_sends', 'accounts_pretend_summaries'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_shop_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (shop_id = current_setting(''app.current_shop_id'')::int) WITH CHECK (shop_id = current_setting(''app.current_shop_id'')::int)',
      t || '_shop_isolation', t
    );
  END LOOP;
END $$;
