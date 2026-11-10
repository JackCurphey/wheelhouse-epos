-- Finishing the account (openspec/changes/finish-account design 4, 6, 7 and 8;
-- Jack's answers of 9 Nov 2, 3 and 4). Additive; safe to run twice.
--
-- The columns first: each takes its table's strongest lock before the new
-- table's links take a lighter one on shops, so nothing upgrades a lock part-way
-- (which deadlocked against a running server).
-- A new sign-in email waiting for its code (design 6): nothing changes until
-- the code sent to it is entered; ten minutes after it was asked for, it's gone.
ALTER TABLE customer_logins ADD COLUMN IF NOT EXISTS pending_email TEXT
  CHECK (pending_email IS NULL OR char_length(pending_email) <= 254);
ALTER TABLE customer_logins ADD COLUMN IF NOT EXISTS pending_email_at TIMESTAMPTZ;

-- The shop's own privacy notice, typed by the Owner, as booking terms are (design 7).
ALTER TABLE shops ADD COLUMN IF NOT EXISTS privacy_notice TEXT
  CHECK (privacy_notice IS NULL OR char_length(privacy_notice) BETWEEN 1 AND 20000);

-- A service reminder's own booking link (ac-reminder-landing): a code that
-- fills the booking with the customer, their bike and the service, with no
-- sign-in and no expiry (question 10), made with the reminder, as its stop
-- code is. Only the code's hash is kept. A removed bike or service leaves the
-- code, with that part empty.
CREATE TABLE IF NOT EXISTS reminder_book_codes (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  code_hash TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  bike_id INTEGER REFERENCES customer_bikes(id) ON DELETE SET NULL,
  service_id INTEGER REFERENCES workshop_services(id) ON DELETE SET NULL,
  job_id INTEGER REFERENCES workshop_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reminder_book_codes_customer ON reminder_book_codes(shop_id, customer_id);
ALTER TABLE reminder_book_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_book_codes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reminder_book_codes_shop_isolation ON reminder_book_codes;
CREATE POLICY reminder_book_codes_shop_isolation ON reminder_book_codes
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
