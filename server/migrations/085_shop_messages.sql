-- A shop's own automatic messages (openspec/changes/own-messages-server
-- design 1; owner setup decision 14; set-msg-new; Jack's answers of 26 Oct,
-- docs/decisions/2026-10-26-receipt-and-own-messages.md). Additive, apart
-- from widening 080's stop-code kinds.
CREATE TABLE shop_messages (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  send_when TEXT NOT NULL CHECK (send_when IN ('after_collected', 'before_booked', 'after_sale')),
  amount INTEGER NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('days', 'months')),
  by_text BOOLEAN NOT NULL,
  by_email BOOLEAN NOT NULL,
  wording TEXT NOT NULL CHECK (length(trim(wording)) BETWEEN 1 AND 2000),
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Nothing that came due before this goes: set on adding, a new time, and
  -- switching back on (design 2), so no backlog goes at once.
  active_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (by_text OR by_email),
  CHECK ((unit = 'days' AND amount BETWEEN 1 AND 365) OR (unit = 'months' AND amount BETWEEN 1 AND 24))
);
ALTER TABLE shop_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY shop_messages_shop_isolation ON shop_messages
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Who stopped which of the shop's own messages (Jack's answer 2: Stop stops
-- just that message for that customer).
CREATE TABLE shop_message_stops (
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  shop_message_id INTEGER NOT NULL REFERENCES shop_messages(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stopped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_message_id, customer_id)
);
ALTER TABLE shop_message_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_message_stops FORCE ROW LEVEL SECURITY;
CREATE POLICY shop_message_stops_shop_isolation ON shop_message_stops
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- The outbox knows which own message a row is, and for which job or sale
-- ('job:<id>', 'sale:old:<id>', 'sale:till:<id>'), so one goes per job or
-- sale even with two servers. A removed message leaves what went.
ALTER TABLE customer_messages
  ADD COLUMN shop_message_id INTEGER REFERENCES shop_messages(id) ON DELETE SET NULL,
  ADD COLUMN event_key TEXT;
CREATE UNIQUE INDEX customer_messages_own_once ON customer_messages (shop_message_id, event_key)
  WHERE shop_message_id IS NOT NULL AND event_key IS NOT NULL;

-- A stop code can stop one of the shop's own messages.
ALTER TABLE reminder_stop_codes
  ADD COLUMN shop_message_id INTEGER REFERENCES shop_messages(id) ON DELETE CASCADE;
ALTER TABLE reminder_stop_codes DROP CONSTRAINT reminder_stop_codes_kind_check;
ALTER TABLE reminder_stop_codes ADD CONSTRAINT reminder_stop_codes_kind_check
  CHECK (kind IN ('service_reminders', 'review_requests', 'own_message'));
ALTER TABLE reminder_stop_codes ADD CONSTRAINT reminder_stop_codes_own_message_check
  CHECK ((kind = 'own_message') = (shop_message_id IS NOT NULL));
