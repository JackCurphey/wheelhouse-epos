-- One-off SMS texts sent to a customer from Front Desk (via Twilio - see
-- server/sms.js). A failed send is still recorded, not silently dropped, so
-- staff can see what was actually attempted. direction/provider_sid exist
-- ahead of need for a later automated/triggered-texts pass.

CREATE TABLE customer_messages (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  direction TEXT NOT NULL DEFAULT 'outbound',
  body TEXT NOT NULL,
  status TEXT NOT NULL, -- 'sent' | 'failed'
  error TEXT,
  provider_sid TEXT,
  sent_by_login_id INTEGER REFERENCES logins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_messages_customer ON customer_messages(customer_id, created_at DESC);
ALTER TABLE customer_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_messages_shop_isolation ON customer_messages
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
