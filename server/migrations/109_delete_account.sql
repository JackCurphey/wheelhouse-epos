-- Deleting a customer's account (openspec/changes/delete-account, design 1;
-- Jack's 30 Oct answer 3; ac-delete, cs-privacy). A privacy request the
-- customer cancelled ("Cancel my request"); a request is open while neither
-- done nor cancelled. A customer whose details the shop deleted: the record
-- stays, blanked, for the sales and jobs that point at it. At most one open
-- deletion request per customer, so two asks at once make one. A till's
-- "possible duplicate" alert also names the record it matched, so deleting
-- that person's details can find it (review of #590).
--
-- Safe to run twice: columns and index only when missing. privacy_requests
-- keeps its forced row-level security (108).
ALTER TABLE privacy_requests ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS privacy_requests_one_open_delete
  ON privacy_requests (customer_id)
  WHERE kind = 'delete' AND done_at IS NULL AND cancelled_at IS NULL;
ALTER TABLE till_attention ADD COLUMN IF NOT EXISTS matched_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
