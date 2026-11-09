## Why

Stock control decision 11 (the UI audit, L1) asked for the stock list's missing states, among them "an unknown barcode" (`st-list-unknown`): searching Stock for a barcode Wheelhouse doesn't know says so and offers to add it. The others (no results, a size search, a new shop) were built with the stock list and #635; this one wasn't. It is the last unbuilt screen of WP-2.1, Stock control, found while finishing it on 9 Nov.

## What Changes

- On Stock, a search of only digits, 8 to 14 of them (as a barcode is), that matches nothing shows "Barcode [barcode] isn’t in Wheelhouse yet" with "Add it now, with its category and details — or look it up in a supplier’s catalogue." and, for the Owner, **Add this product**, which opens the product box with the barcode filled in; added, its page opens.
- Staff see the heading and "Only the shop’s owner can add products for now." in place of the note and button (adding is the Owner's, stock control decision 11).

## Out of scope

Looking a barcode up in a supplier's catalogue from here (the note says it; supplier feeds are their own piece).

## Who and risk

WP-2.1, Jack's side. A screen only; no server change, no risky area. One pull request with its archive.

## Follows

- Decisions: `docs/decisions/2026-10-01-stock-control-review.md` decision 11 (audit L1, and Staff can't add products).
- Drawings: `st-list-unknown` (`docs/design/user-journeys/generator/stock.mjs`, line 99).
- Built: `openspec/specs/stock` (adding a product from Stock, #635).

## Capabilities

### New Capabilities

### Modified Capabilities
- `stock`: an unknown barcode searched on Stock.

## Impact

`src/screens/stock/stock-page.tsx`; `tests/screens/add-product.test.js`.
