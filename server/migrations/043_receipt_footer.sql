-- Words at the bottom of receipts (Jack, 19 Oct,
-- docs/decisions/2026-10-19-receipt-words.md): a returns policy or a
-- thank-you, one set for the whole business, kept with the shop's details
-- (042). Null when the shop has none. Additive only.
-- Spec: openspec/changes/receipt-words/design.md
ALTER TABLE shops ADD COLUMN receipt_footer TEXT;
