-- Store credit and pay-later accounts (openspec/changes/finish-customers, design 1 and 7;
-- cs-credit, cs-account, cs-transfer, set-pay-ways; Jack's 9 Nov answers 2 and 5). Every
-- change to money is its own entry in whole pence, never edited; a balance is the sum of a
-- customer's entries. The kinds for the till's half (earned, spent, refund, sale on account,
-- a till payment) are here already, so that later piece needs no migration. New tables and
-- nullable columns only, so nothing already here is rewritten. Additive and safe to run twice.

CREATE TABLE IF NOT EXISTS store_credit_entries (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  change_pence INTEGER NOT NULL CHECK (change_pence <> 0),
  kind TEXT NOT NULL CHECK (kind IN ('added', 'taken', 'undo', 'lost_on_deletion', 'earned', 'spent', 'refund')),
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 200),
  sale_id INTEGER,
  till_sale_id INTEGER,
  undoes_entry_id INTEGER REFERENCES store_credit_entries(id),
  login_id INTEGER,
  -- Kept as it was, so a person removed later is still named (as a stock line's who_name).
  who_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_store_credit_entries_customer ON store_credit_entries (shop_id, customer_id, created_at);
-- An entry is undone at most once.
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_credit_entries_undoes ON store_credit_entries (undoes_entry_id) WHERE undoes_entry_id IS NOT NULL;
ALTER TABLE store_credit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_credit_entries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS store_credit_entries_shop_isolation ON store_credit_entries;
CREATE POLICY store_credit_entries_shop_isolation ON store_credit_entries
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE IF NOT EXISTS account_entries (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  -- Signed: + owed, − paid.
  change_pence INTEGER NOT NULL CHECK (change_pence <> 0),
  kind TEXT NOT NULL CHECK (kind IN ('opening', 'sale_on_account', 'bank_transfer', 'till_payment', 'undo')),
  reference TEXT CHECK (reference IS NULL OR char_length(reference) <= 100),
  -- A bank transfer's "Date it arrived".
  received_on DATE,
  sale_id INTEGER,
  till_sale_id INTEGER,
  undoes_entry_id INTEGER REFERENCES account_entries(id),
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 200),
  login_id INTEGER,
  who_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_account_entries_customer ON account_entries (shop_id, customer_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_entries_undoes ON account_entries (undoes_entry_id) WHERE undoes_entry_id IS NOT NULL;
-- What was owed from before Wheelhouse is entered once per customer (Jack's answer 5).
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_entries_opening ON account_entries (customer_id) WHERE kind = 'opening';
ALTER TABLE account_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_entries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_entries_shop_isolation ON account_entries;
CREATE POLICY account_entries_shop_isolation ON account_entries
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Only customers the Owner gives an account can owe (Jack's answer 2); their own limit, or
-- null for the shop's.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS account_opened_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS account_limit_pence INTEGER CHECK (account_limit_pence IS NULL OR account_limit_pence >= 0);

-- Ways to pay (set-pay-ways): one row per shop, made the first time it's read. Both start
-- off (design question 11). earn_back_percent is for the till's half.
CREATE TABLE IF NOT EXISTS payment_settings (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  store_credit_on BOOLEAN NOT NULL DEFAULT false,
  earn_back_percent NUMERIC(5,2) CHECK (earn_back_percent IS NULL OR earn_back_percent BETWEEN 0 AND 100),
  accounts_on BOOLEAN NOT NULL DEFAULT false,
  account_limit_pence INTEGER CHECK (account_limit_pence IS NULL OR account_limit_pence >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_settings_shop ON payment_settings (shop_id);
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_settings_shop_isolation ON payment_settings;
CREATE POLICY payment_settings_shop_isolation ON payment_settings
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- How a request logged by hand came (design question 7).
ALTER TABLE privacy_requests ADD COLUMN IF NOT EXISTS how TEXT CHECK (how IS NULL OR how IN ('in_person', 'phone', 'email', 'letter'));
