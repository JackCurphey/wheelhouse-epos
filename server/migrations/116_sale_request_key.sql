-- A sale sent twice counts once (openspec/changes/sale-request-key, design 1): its
-- request key and details, hashed, as a delivery keeps them (110), and what the first
-- answer to an order's payment warned about, so a repeat gets the same answer. Additive
-- and safe to run twice.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS request_key_hash TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS request_body_hash TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS request_job_warning TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_request_key ON sales(shop_id, request_key_hash) WHERE request_key_hash IS NOT NULL;
