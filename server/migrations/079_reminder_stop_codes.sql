-- "Stop these" for service reminders (openspec/changes/stop-reminders;
-- account and reminders decision 6; Jack's answer 5 of 25 Oct). Additive,
-- except that 077's check on where a yes came from also allows the stop page.
--
-- A code that stops one kind of reminder for one customer, with no sign-in
-- and no expiry (a reminder can be months old when it's opened). Only the
-- code's hash is kept, as for booking links and photo codes.
CREATE TABLE reminder_stop_codes (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  code_hash TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('service_reminders')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reminder_stop_codes_customer ON reminder_stop_codes(shop_id, customer_id);
ALTER TABLE reminder_stop_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_stop_codes FORCE ROW LEVEL SECURITY;
CREATE POLICY reminder_stop_codes_shop_isolation ON reminder_stop_codes
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- A message's fixed ending (the service reminder's "Stop these: …"), kept as
-- it was made at set-up and put back after the shop's words when it goes:
-- the timer that sends it has no request to make a link from.
ALTER TABLE customer_messages ADD COLUMN ending TEXT;

-- Turning reminders back on from the stop page is a yes from there.
ALTER TABLE customers DROP CONSTRAINT customers_reminders_said_yes_via_check;
ALTER TABLE customers ADD CONSTRAINT customers_reminders_said_yes_via_check
  CHECK (reminders_said_yes_via IN ('booking', 'collection', 'stop_page'));
