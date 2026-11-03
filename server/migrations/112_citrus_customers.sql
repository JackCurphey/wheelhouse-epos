-- Customers and bikes from Citrus Lime (openspec/changes/citrus-import-customers,
-- design 1 and 10 to 16). Who came across, by their Citrus Lime account number,
-- blanked when their details are deleted; the date of their yes to offers (build
-- plan WP-2.4), which goes when the yes or no changes; which row of Citrus Lime's a
-- bike came from; indexes for finding the same person. A row needing a look
-- points at the customer it's about rather than holding their name.
-- What a deleted person leaves behind (Jack, 3 Nov, docs/decisions/2026-11-03-answers.md):
-- one-way codes, unique to each shop, linked to nothing, used only to spot and
-- skip them on import.
-- Additive and safe to run twice, including over an earlier draft of this file:
-- delete this file's row from schema_migrations there.
ALTER TABLE move_files DROP CONSTRAINT IF EXISTS move_files_report_check;
ALTER TABLE move_files ADD CONSTRAINT move_files_report_check
  CHECK (report IN ('price_list', 'barcodes', 'customers', 'bikes'));
ALTER TABLE move_rows ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_move_rows_customer ON move_rows(customer_id) WHERE customer_id IS NOT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS citrus_account TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_consent_on DATE;
ALTER TABLE customer_bikes ADD COLUMN IF NOT EXISTS citrus_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_citrus_account ON customers(shop_id, citrus_account) WHERE citrus_account IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_bikes_citrus_ref ON customer_bikes(shop_id, citrus_ref) WHERE citrus_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON customers(shop_id, lower(trim(email))) WHERE email <> '';
CREATE INDEX IF NOT EXISTS idx_customers_phone_digits ON customers(shop_id, regexp_replace(coalesce(phone, ''), '\D', '', 'g')) WHERE phone <> '';

-- A date of a yes that's since changed says nothing: it goes, by whichever route.
CREATE OR REPLACE FUNCTION customers_consent_date_follows() RETURNS trigger AS $$
BEGIN
  IF NEW.marketing_permission IS DISTINCT FROM OLD.marketing_permission
     AND NEW.marketing_consent_on IS NOT DISTINCT FROM OLD.marketing_consent_on THEN
    NEW.marketing_consent_on := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS customers_consent_date_follows ON customers;
CREATE TRIGGER customers_consent_date_follows BEFORE UPDATE OF marketing_permission ON customers
  FOR EACH ROW EXECUTE FUNCTION customers_consent_date_follows();

CREATE TABLE IF NOT EXISTS move_deleted_salt (
  shop_id INTEGER PRIMARY KEY DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  salt TEXT NOT NULL
);
ALTER TABLE move_deleted_salt ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_deleted_salt FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS move_deleted_salt_shop_isolation ON move_deleted_salt;
CREATE POLICY move_deleted_salt_shop_isolation ON move_deleted_salt
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE IF NOT EXISTS move_deleted_codes (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  kind TEXT NOT NULL CHECK (kind IN ('account', 'email', 'phone')),
  code TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_move_deleted_codes ON move_deleted_codes(shop_id, code);
ALTER TABLE move_deleted_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_deleted_codes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS move_deleted_codes_shop_isolation ON move_deleted_codes;
CREATE POLICY move_deleted_codes_shop_isolation ON move_deleted_codes
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
