-- Files an email message carries (openspec/changes/message-attachments,
-- design 1): the Cycle to Work quote as a PDF, drawn on cw-email and
-- cw-email-certificate-revised ("Attached: Quote [n]"). A table of its own so
-- the outbox's reads never load file contents. Each file goes with its message
-- (ON DELETE CASCADE), so a customer's privacy deletion and a shop's removal
-- take the files too. The shop's own rows under row-level security. Additive;
-- safe to run twice.

LOCK TABLE customer_messages IN SHARE ROW EXCLUSIVE MODE;

-- A file belongs to a message of its own shop: the link carries the shop too,
-- as migration 117 does. id first, so the link's check finds it as the primary
-- key would.
CREATE UNIQUE INDEX IF NOT EXISTS customer_messages_id_shop_id ON customer_messages (id, shop_id);

CREATE TABLE IF NOT EXISTS customer_message_attachments (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  message_id INTEGER NOT NULL,
  filename TEXT NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 200),
  content_type TEXT NOT NULL CHECK (char_length(content_type) BETWEEN 1 AND 100),
  content BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (message_id, shop_id) REFERENCES customer_messages (id, shop_id) ON DELETE CASCADE
);

-- message_id first: deleting a message finds its files by message_id alone.
CREATE INDEX IF NOT EXISTS customer_message_attachments_message ON customer_message_attachments (message_id, shop_id);

ALTER TABLE customer_message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_message_attachments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_message_attachments_shop_isolation ON customer_message_attachments;
CREATE POLICY customer_message_attachments_shop_isolation ON customer_message_attachments
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
