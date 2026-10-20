-- The messages engine (Jack, 20 Oct, docs/decisions/2026-10-20-messages-engine.md:
-- pretend for now). A shop's own wording and on/off per message; what the
-- outbox needs on each message; and the 'undone' state. Additive apart from
-- the re-made intent_state CHECK, which only widens what it allows.
-- Spec: openspec/changes/messages-engine/design.md

-- A shop's own wording, subject and on/off for one message. A row exists
-- only once the shop changes something; null wording or subject means
-- Wheelhouse's (server/messaging/templates.js).
CREATE TABLE message_templates (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  wording TEXT,
  subject TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, key)
);
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY message_templates_shop_isolation ON message_templates
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- What each message needs for the engine and the outbox.
ALTER TABLE customer_messages
  ADD COLUMN job_id INTEGER REFERENCES workshop_jobs(id),
  ADD COLUMN channel TEXT CHECK (channel IN ('sms', 'whatsapp', 'email')),
  ADD COLUMN template_key TEXT,
  ADD COLUMN subject TEXT,
  ADD COLUMN to_address TEXT,
  ADD COLUMN send_after TIMESTAMPTZ,
  ADD COLUMN sent_at TIMESTAMPTZ,
  ADD COLUMN pretend BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_customer_messages_due ON customer_messages (send_after) WHERE intent_state = 'intended';
CREATE INDEX idx_customer_messages_job ON customer_messages (job_id, created_at DESC);

-- Messages already here were sent (or failed) before the engine: 020's
-- default left them reading 'intended'. Settle them, so the engine's timer,
-- which only claims rows with a send_after, never sends one again.
-- Shop by shop, under each shop's own row-level security (as 037 does).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM shops LOOP
    PERFORM set_config('app.current_shop_id', r.id::text, true);
    UPDATE customer_messages SET intent_state = CASE WHEN status = 'sent' THEN 'delivered' ELSE 'failed' END
      WHERE shop_id = r.id AND intent_state = 'intended';
  END LOOP;
END $$;

-- 'undone': staff took a message back within its minute. The CHECK below is
-- rendered from the messageIntent machine by server/workshop/render-constraints.mjs;
-- the drift test holds this file to it (MIGRATION_COLUMNS now points here).
ALTER TABLE customer_messages DROP CONSTRAINT customer_messages_intent_state_check;
ALTER TABLE customer_messages ADD CONSTRAINT customer_messages_intent_state_check
  CHECK (intent_state IN ('intended', 'sending', 'delivered', 'failed', 'unknown', 'undone'));
