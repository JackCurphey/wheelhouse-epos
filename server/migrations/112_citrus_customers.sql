-- Customers and bikes from Citrus Lime (openspec/changes/citrus-import-customers,
-- design 1). Who came across, by their Citrus Lime account number, kept when
-- their details are deleted so a file can't bring them back; the date of their
-- yes to offers (build plan WP-2.4); indexes for finding the same person.
-- Additive and safe to run twice.
ALTER TABLE move_files DROP CONSTRAINT IF EXISTS move_files_report_check;
ALTER TABLE move_files ADD CONSTRAINT move_files_report_check
  CHECK (report IN ('price_list', 'barcodes', 'customers', 'bikes'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS citrus_account TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_consent_on DATE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_citrus_account ON customers(shop_id, citrus_account) WHERE citrus_account IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON customers(shop_id, lower(trim(email))) WHERE email <> '';
CREATE INDEX IF NOT EXISTS idx_customers_phone_digits ON customers(shop_id, regexp_replace(coalesce(phone, ''), '\D', '', 'g')) WHERE phone <> '';
