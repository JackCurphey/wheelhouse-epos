-- When the shop's VAT quarter starts (openspec/changes/reports-ready-made,
-- design 4; audit H6): 1 for January, April, July, October; 2 for February,
-- May, August, November; 3 for March, June, September, December. Null until
-- the Owner says, when the VAT report asks (rp-vat-first). One setting for the
-- whole business, as the VAT number is. Additive; safe to run twice.
ALTER TABLE shops ADD COLUMN IF NOT EXISTS vat_quarter_start_month SMALLINT
  CHECK (vat_quarter_start_month IN (1, 2, 3));
