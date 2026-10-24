-- Use my phone (walk-through 8 decision 6; docs/decisions/2026-10-23-use-my-phone.md;
-- openspec/changes/use-my-phone). Additive only.
--
-- A code that adds one photo to one line of a draft quote from a phone, with
-- no sign-in, for 15 minutes. Only the code's hash is kept, as for booking
-- links. A draft's lines get new ids on every save, so the line is held by
-- its place and its words, and checked against the draft when the photo
-- arrives.
CREATE TABLE quote_photo_codes (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  code_hash TEXT NOT NULL UNIQUE,
  workshop_job_id INTEGER NOT NULL REFERENCES workshop_jobs(id) ON DELETE CASCADE,
  workshop_quote_id INTEGER NOT NULL REFERENCES workshop_quotes(id) ON DELETE CASCADE,
  line_position INTEGER NOT NULL CONSTRAINT quote_photo_codes_position_check CHECK (line_position >= 0),
  line_description TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  attachment_id INTEGER REFERENCES workshop_job_attachments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quote_photo_codes_job ON quote_photo_codes(shop_id, workshop_job_id);
ALTER TABLE quote_photo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_photo_codes FORCE ROW LEVEL SECURITY;
CREATE POLICY quote_photo_codes_shop_isolation ON quote_photo_codes
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
