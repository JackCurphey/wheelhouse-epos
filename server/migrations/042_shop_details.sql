-- Shop details (Jack, 18 Oct, docs/decisions/2026-10-18-shop-details.md):
-- one set of details for the whole business, for now, shown on receipts.
-- When WP-1.4 gives every business its sites, the address and phone move
-- onto the first site (the 1 and 5 Oct decisions put them per site) and the
-- VAT number stays here (one VAT number per business). Null until set.
-- Additive only.
-- Spec: openspec/changes/shop-details/design.md
ALTER TABLE shops
  ADD COLUMN address TEXT,
  ADD COLUMN phone TEXT,
  ADD COLUMN email TEXT,
  ADD COLUMN vat_number TEXT;
