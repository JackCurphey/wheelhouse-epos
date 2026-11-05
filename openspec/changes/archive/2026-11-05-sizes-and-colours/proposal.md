## Why

Stock control decision 4: a product with sizes and colours is one product, with a grid on its page; the stock list keeps one row for it with its total and "[n] sizes · [n] colours", and scanning a barcode or searching "jersey M" opens that size and colour. Jack's answer 5 (`docs/decisions/2026-11-04-answers.md`) settled what sits underneath: each size and colour stays its own row in `products`, with its own barcode, joined in a group. WP-1.5, piece 5 (`openspec/changes/wp-1-5-products/`, design 3).

## What Changes

- New table `product_groups` (the one product people see: name, category, description, photo) and three new columns on `products`: `group_id`, `size`, `colour`. A product with no sizes has no group, exactly as today. Nothing else changes for a product, so every sale, order, delivery, count, Shopify and the old till keep working with each size as its own product, and `moveStock` stays the only stock writer.
- The server for the new stock list: one row per group, with its total, its sizes and colours, how many sizes are below zero or running low, and its lowest and highest price; one row per product with no group, as now.
- Search: a barcode or code lands on its size; "jersey M" lands on that size in each colour; "jersey" lands on the group.
- A group's page: its sizes and colours, each with its own barcode, stock and price, for the grid.
- A count's lines name a size by its group and "Size M · [Colour 1]", as `tk-count-below` and `tk-diff` draw it (stock take's "sizes and colours on a line").

## Out of scope

Making and editing groups, sizes and colours (piece 6, product-editing); linking the Citrus per-code products (piece 7); the stock list's and product page's screens (pieces 9 and 10). The old stock list and the old till's search show each size separately until they're retired (answer 5).

## Who and risk

WP-1.5, piece 5, Jack's side. Risky: **migrations** (120), **money and stock** (the count's lines). It writes no stock.

## Follows

- Decisions: `docs/decisions/2026-10-01-stock-control-review.md` 2, 4, 5, 9 and 11; `docs/decisions/2026-11-04-answers.md` answer 5; Release 2 rule 3 (each size and colour its own barcode).
- Specs: `openspec/changes/wp-1-5-products/design.md` section 3.
- Drawings: `st-list` (the row with sizes), `st-search-size`, `st-product-sizes`, `tk-count-below`, `tk-diff`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `stock`: a product with sizes and colours.
- `stock-take`: a size on a count's line.

## Impact

Migration 120; new `server/routes/stock-list.js`; `server/lib/serializers.js`, `server/routes/stock-takes.js`, `server/lib/stock-take-differences.js`, `server/routes/index.js`; `src/screens/stock-take/`.
