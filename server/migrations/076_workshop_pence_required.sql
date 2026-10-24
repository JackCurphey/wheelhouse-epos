-- Sales in pence, step A′, fresh review (openspec/changes/wp-1-6-sales-in-pence):
-- the readers now read only the pence, so a write that forgets them must be
-- refused rather than stored as £0.00 (075's DEFAULT 0 was only there to add
-- the columns to rows that already existed, and every row is backfilled).
-- A booked service's price is either unknown in both or known in both.
ALTER TABLE workshop_services ALTER COLUMN price_pence DROP DEFAULT;
ALTER TABLE workshop_quote_lines ALTER COLUMN unit_amount_pence DROP DEFAULT;
ALTER TABLE workshop_job_services
  ADD CONSTRAINT workshop_job_services_booked_price_pence_known
  CHECK ((booked_price IS NULL) = (booked_price_pence IS NULL));
