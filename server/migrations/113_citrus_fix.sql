-- Fix, Leave it out and Ask us to help on the Citrus Lime import
-- (openspec/changes/citrus-import-fix, design 1, 7, 8 and 15; mv-fix, mv-sorted,
-- mv-help). A row left out is kept for Settings › Your data, counted apart. Who
-- sorted a row and when; its request key, so a save sent twice counts once. What
-- was asked of the Wheelhouse team, kept here until a real inbox exists. Additive
-- and safe to run twice, including over an earlier draft of this file: delete this
-- file's row from schema_migrations there.
ALTER TABLE move_rows DROP CONSTRAINT IF EXISTS move_rows_state_check;
ALTER TABLE move_rows ADD CONSTRAINT move_rows_state_check CHECK (state IN ('waiting', 'in', 'same', 'skipped', 'look', 'left_out'));
ALTER TABLE move_files ADD COLUMN IF NOT EXISTS rows_left_out INTEGER NOT NULL DEFAULT 0;
ALTER TABLE move_files ADD COLUMN IF NOT EXISTS rows_fixed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE move_files ADD COLUMN IF NOT EXISTS stock_left_out INTEGER NOT NULL DEFAULT 0;
ALTER TABLE move_rows ADD COLUMN IF NOT EXISTS sorted_by_login_id INTEGER REFERENCES logins(id);
-- Removing a staff record must still work: the row stays, naming nobody, as a delivery does.
-- NOT VALID, as 096's are: checking existing rows would read them without a shop set.
ALTER TABLE move_rows ADD COLUMN IF NOT EXISTS sorted_by_employee_id INTEGER;
ALTER TABLE move_rows DROP CONSTRAINT IF EXISTS move_rows_sorted_by_employee_id_fkey;
ALTER TABLE move_rows ADD CONSTRAINT move_rows_sorted_by_employee_id_fkey FOREIGN KEY (sorted_by_employee_id) REFERENCES employees(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE move_rows ADD COLUMN IF NOT EXISTS sorted_at TIMESTAMPTZ;
ALTER TABLE move_rows ADD COLUMN IF NOT EXISTS request_key_hash TEXT;
ALTER TABLE move_rows ADD COLUMN IF NOT EXISTS request_body_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_move_rows_request_key ON move_rows(shop_id, request_key_hash) WHERE request_key_hash IS NOT NULL;
-- Finding a customer from a row of a file, while holding the move files. Row-level
-- security stops an index on lower(...) or regexp_replace(...) being used, as those
-- functions aren't marked safe to run before the shop check: every row read every
-- customer, 20ms a row with 20,000 customers (citrus-import-fix, design 22). A plain
-- column compared with = can use an index, so these hold the same values.
-- An account number is the same in any case, with or without spaces around it (the review, 4 Nov).
DROP INDEX IF EXISTS idx_customers_citrus_account_key;
DROP INDEX IF EXISTS idx_customers_name_key;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_key TEXT GENERATED ALWAYS AS (lower(trim(coalesce(email, '')))) STORED;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone_key TEXT GENERATED ALWAYS AS (regexp_replace(coalesce(phone, ''), '\D', '', 'g')) STORED;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS name_key TEXT GENERATED ALWAYS AS (lower(trim(coalesce(name, '')))) STORED;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS citrus_account_key TEXT GENERATED ALWAYS AS (lower(trim(citrus_account))) STORED;
CREATE INDEX IF NOT EXISTS idx_customers_email_key ON customers(shop_id, email_key) WHERE email_key <> '';
CREATE INDEX IF NOT EXISTS idx_customers_phone_key ON customers(shop_id, phone_key) WHERE phone_key <> '';
CREATE INDEX IF NOT EXISTS idx_customers_name_key2 ON customers(shop_id, name_key);
CREATE INDEX IF NOT EXISTS idx_customers_citrus_account_key2 ON customers(shop_id, citrus_account_key) WHERE citrus_account_key IS NOT NULL;
-- The list of rows needing a look, oldest first, however many a file has.
CREATE INDEX IF NOT EXISTS idx_move_rows_look ON move_rows(shop_id, id) WHERE state = 'look';

CREATE TABLE IF NOT EXISTS move_help_requests (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  what_looks_wrong TEXT NOT NULL,
  card TEXT NOT NULL,
  asked_by_login_id INTEGER REFERENCES logins(id),
  asked_by_employee_id INTEGER,
  asked_by_name TEXT NOT NULL,
  reply_to TEXT NOT NULL DEFAULT '',
  provider_id TEXT,
  asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_key_hash TEXT NOT NULL,
  request_body_hash TEXT NOT NULL
);
ALTER TABLE move_help_requests DROP CONSTRAINT IF EXISTS move_help_requests_asked_by_employee_id_fkey;
ALTER TABLE move_help_requests ADD CONSTRAINT move_help_requests_asked_by_employee_id_fkey FOREIGN KEY (asked_by_employee_id) REFERENCES employees(id) ON DELETE SET NULL NOT VALID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_move_help_request_key ON move_help_requests(shop_id, request_key_hash);
ALTER TABLE move_help_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_help_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS move_help_requests_shop_isolation ON move_help_requests;
CREATE POLICY move_help_requests_shop_isolation ON move_help_requests
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
