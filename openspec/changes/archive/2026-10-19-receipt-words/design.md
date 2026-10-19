# Design: words at the bottom

## Contract

`GET /api/shop-details` gains `receiptFooter` (text or `null`). `PUT` accepts it: trimmed, blank clears it, up to 500 characters ("Words at the bottom can be up to 500 characters"), line breaks kept.

## Data (migration 043, additive)

`ALTER TABLE shops ADD COLUMN receipt_footer TEXT;`

## Screens

- **Settings:** a "Till" section ("What staff see and use at the till.") with a "Receipts" box: the labelled "Words at the bottom" text area, its placeholder and the drawn note, saved when left if changed ("Saved." or the failure message), like Shop details.
- **Receipt:** after the address, phone and VAT number, the words (line breaks kept), then the barcode. The till and diary already pass the shop details, which now carry the words.
