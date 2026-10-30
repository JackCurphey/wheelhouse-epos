-- Privacy requests (openspec/changes/your-data-copy, design 1; account and
-- reminders decision 4; cs-privacy): a customer asking for a copy of what the
-- shop holds about them, or for it to be deleted, from their account or
-- logged by the shop. Asked when, done when (null while open). A copy from
-- the account is done the moment it's asked. The log outlives the customer
-- record it was about. A request from the account also records the sign-in
-- that asked, so undoing a merge sends it back with that sign-in (review of
-- #587). Kept to its shop by row-level security, for reading and writing.
--
-- Safe to run twice: the table and column only when missing, the policy
-- dropped first. The sign-in column is added on its own, as the shared
-- development database ran this file before it existed.
CREATE TABLE IF NOT EXISTS privacy_requests (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('copy', 'delete')),
  source TEXT NOT NULL CHECK (source IN ('account', 'shop')),
  asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  done_at TIMESTAMPTZ
);
ALTER TABLE privacy_requests ADD COLUMN IF NOT EXISTS customer_login_id INTEGER REFERENCES customer_logins(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_privacy_requests_customer ON privacy_requests(customer_id);
ALTER TABLE privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS privacy_requests_shop_isolation ON privacy_requests;
CREATE POLICY privacy_requests_shop_isolation ON privacy_requests
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
