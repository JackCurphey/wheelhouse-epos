-- Returned (openspec/changes/to-return, design 1; receiving decision 9;
-- rs-hub): when a damaged or wrong item set aside at booking in was sent
-- back to its supplier, and who marked it. Null until then, and for every
-- item set aside before 107. Additive and safe to run twice; the table keeps
-- its row-level security (migration 092).
ALTER TABLE delivery_problems ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;
ALTER TABLE delivery_problems ADD COLUMN IF NOT EXISTS returned_by_login_id INTEGER REFERENCES logins(id);
