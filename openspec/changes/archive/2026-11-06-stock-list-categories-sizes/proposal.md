## Why

Stock control decisions 2, 4, 10 and 11 give the Stock list a Category pill, a category's details as columns and filters, a product with sizes on one row, and a searched size on its own row. Pieces 4 to 6 built what sits underneath; the list on screen still reads the old `/api/products` and shows none of it. WP-1.5, piece 9 (`openspec/changes/wp-1-5-products/tasks.md`; WP-2.1): `st-list`, `st-filter-bearings`, `st-filter-derailleurs`, `st-search-measure`, `st-search-size`. It keeps "Left out until WP-1.5: the Category pill, each category's details (the Details box and detail columns), and sizes and colours" (`decided-while-building.md`) for the list; the Details box, a product's page with sizes, Edit and adding a product are piece 10.

## What Changes

- The list reads `/api/stock-list`, built for it in piece 5.
- A product with sizes is one row: "[Category] · [n] sizes · [n] colours · [n] size below zero", its stock the total, its price from lowest to highest.
- Searching a size or colour shows each size found on its own row: "Size M · [Colour] · [barcode]", opening that size.
- The Category pill: a search for a category, picked from a list by keyboard, shown as a dark pill with ✕.
- A picked category's details become filters ("Bearings details:"; a number box with its unit, or the choices) and columns, Margin making room. A measurement searched shows each row's details on its line, the matched one in bold.
- **Server (small; stock and costs, so risky):** `GET /api/stock-list` adds each row's `vatRateBp`, a product with sizes' only when its sizes share one, for the margin it already shows, and each product's and size's answers, `details: { [detailId]: value }`, only when a category is picked or a measurement searched.

## Out of scope

A product with sizes' own page and Edit (piece 10), so its row opens nothing yet. Ticking, Print labels, Send to another shop and Change prices (their own work). Adding a product on screen (piece 10).

## Who and risk

WP-1.5, piece 9, Jack's side. Risky: **money and stock**, as the list's answer changes (it adds the VAT rate and answers; no cost or stock rule changes, and a cost is still sent only to someone who can see costs). No migration. Two stacked pull requests: the server and sizes on the list, then categories on the list.

## Follows

- Decisions: `docs/decisions/2026-10-01-stock-control-review.md` 2, 4, 10, 11; audit M11 (the Category pill), M12 (details as columns); `docs/decisions/2026-11-04-answers.md` answer 5.
- Drawings: `st-list`, `st-filter-bearings`, `st-filter-derailleurs`, `st-search-measure`, `st-search-size` (`docs/design/user-journeys/generator/stock.mjs`).
- Server: `openspec/changes/archive/2026-11-05-sizes-and-colours`, `2026-11-06-product-editing`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `stock`: the list's categories, details and sizes on screen.

## Impact

`server/routes/stock-list.js`; `src/screens/stock/stock-page.tsx`, `stock-bits.tsx`, a new `stock-list-bits.tsx`. Tests: `tests/product-details.test.js`, `tests/sizes-and-colours.test.js`, `tests/screens/stock-list.test.js`, a new `tests/screens/stock-list-categories.test.js`, `tests/browser/stock-list.spec.ts`.
