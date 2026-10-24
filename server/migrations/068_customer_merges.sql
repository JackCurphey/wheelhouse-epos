-- Merge, with a 30-day undo (customer service review 5 and 12; Jack, 24 Oct,
-- docs/decisions/2026-10-24-morning-questions.md answer 6;
-- openspec/changes/customer-merge). A merged customer is hidden
-- (merged_into_id, active 0), the merge records what moved so it can be put
-- back, and a pair staff said are different people isn't flagged again.
-- Additive only.
ALTER TABLE customers ADD COLUMN merged_into_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

CREATE TABLE customer_merges (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  -- Cleared, not cascaded, if the kept record goes, so the merge record stays.
  kept_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  -- The hidden record; cleared when it's removed for good after 30 days.
  other_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  -- Its number and its till id, kept after removal so a till that was
  -- offline still finds the kept record.
  other_was_id INTEGER NOT NULL,
  other_client_id UUID,
  other_name TEXT NOT NULL,
  moved JSONB NOT NULL,
  merged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  merged_by_login_id INTEGER REFERENCES logins(id),
  undone_at TIMESTAMPTZ
);
CREATE INDEX idx_customer_merges_kept ON customer_merges(shop_id, kept_id);
CREATE INDEX idx_customer_merges_other_was ON customer_merges(shop_id, other_was_id);
CREATE INDEX idx_customer_merges_other_client ON customer_merges(shop_id, other_client_id) WHERE other_client_id IS NOT NULL;
ALTER TABLE customer_merges ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_merges FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_merges_shop_isolation ON customer_merges
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Two records staff said are different people, the lower id first.
CREATE TABLE customer_not_duplicates (
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  first_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  second_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  said_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  said_by_login_id INTEGER REFERENCES logins(id),
  PRIMARY KEY (first_id, second_id),
  CONSTRAINT customer_not_duplicates_order_check CHECK (first_id < second_id)
);
ALTER TABLE customer_not_duplicates ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_not_duplicates FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_not_duplicates_shop_isolation ON customer_not_duplicates
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
