-- The restock list (openspec/changes/restock-list, design 1; receiving decision 2, walk-through
-- 3 M1 and M7). An order line can say which job it is for ("for job WH-1042"), so a job's part
-- added to an order leaves For customers; and each person's last look at the list, so Today
-- counts what's new since. A new column that starts empty and a new table, so nothing already
-- here is rewritten. Additive and safe to run twice.

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS workshop_job_id INTEGER;
ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_workshop_job_id_fkey;
-- NOT VALID, as 115's links: the column is new and empty, so there is nothing to check.
ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_workshop_job_id_fkey
  FOREIGN KEY (workshop_job_id) REFERENCES workshop_jobs(id) ON DELETE SET NULL NOT VALID;
-- Removing a job checks its link, and For customers reads lines by job: only lines with one.
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_job
  ON purchase_order_items (shop_id, workshop_job_id) WHERE workshop_job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS restock_seen (
  login_id INTEGER PRIMARY KEY REFERENCES logins(id) ON DELETE CASCADE,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  -- The list's lines when this person last opened it or downloaded from it: low:[product],
  -- fast:[product], job:[job]:[product].
  seen_keys TEXT[] NOT NULL DEFAULT '{}',
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE restock_seen ENABLE ROW LEVEL SECURITY;
ALTER TABLE restock_seen FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS restock_seen_shop_isolation ON restock_seen;
CREATE POLICY restock_seen_shop_isolation ON restock_seen
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
