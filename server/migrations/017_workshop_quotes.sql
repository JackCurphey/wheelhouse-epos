-- Quotes and their lines. A quote is a revision of a proposal; approving is a
-- per-line decision, because the approval contract is line-level - a customer
-- approves the pads, declines the cable, and the agreed total must reflect
-- exactly that.
--
-- Revisions supersede rather than mutate (see quote in
-- server/workshop/state-machines.js), so the amounts a customer saw when they
-- agreed stay readable afterwards. That is why lines belong to a quote revision
-- and carry their own amount snapshot rather than pointing at a catalogue price
-- that can change underneath them.

CREATE TABLE workshop_quotes (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  workshop_job_id INTEGER NOT NULL REFERENCES workshop_jobs(id),
  revision INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft', 'sent', 'partly_approved', 'approved', 'declined', 'superseded', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A customer's approval link is bound to a revision. Two rows claiming the same
-- revision would make "is this link still current?" unanswerable.
CREATE UNIQUE INDEX idx_workshop_quotes_job_revision
  ON workshop_quotes (workshop_job_id, revision);

ALTER TABLE workshop_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_quotes FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_quotes_shop_isolation ON workshop_quotes
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE workshop_quote_lines (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  workshop_quote_id INTEGER NOT NULL REFERENCES workshop_quotes(id),
  -- Labour never moves physical stock; a part does. Phase 5's Lightspeed
  -- handoff depends on telling them apart.
  kind TEXT NOT NULL CHECK (kind IN ('labour', 'part')),
  description TEXT NOT NULL,
  product_id INTEGER REFERENCES products(id),
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  -- A snapshot, not a lookup. A catalogue price change must not alter what a
  -- customer already agreed to.
  unit_amount NUMERIC(10,2) NOT NULL,
  decision TEXT NOT NULL DEFAULT 'pending'
    CHECK (decision IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workshop_quote_lines_quote ON workshop_quote_lines (workshop_quote_id);

ALTER TABLE workshop_quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_quote_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_quote_lines_shop_isolation ON workshop_quote_lines
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
