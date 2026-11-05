## Why

WP-1.5, piece 6 (`openspec/changes/wp-1-5-products/`): the server for adding and editing a product, its details and its sizes. Stock control decision 11 says Staff can't change prices, edit or add products, but today anyone signed in can through the server. Decision 10 has staff find products by their measurements ("bearing 30 mm"). Decision 4, with Jack's answers 5 and 9, has a product with sizes made of one product per size and colour, each named with its size and colour. Earlier pieces left this piece the categories of a product with sizes and the lock order.

## What Changes

- **Who:** adding and changing a product, its price and cost, taking it off sale, its photo and its details, a supplier's item brought in, and making or changing a product with sizes are the Owner's, until "Can order stock" exists (roles, WP-1.1). The Owner's sign-in with someone else checked in by PIN is that person. Staff still adjust and count stock and receive deliveries.
- **A product's details:** its answers to its category's details and those passed down; read with the product, saved by the Owner.
- **Finding by them:** "bearing 30 mm" and "30mm" find a number detail with that unit and value; a category picked takes those inside it, and each of its details narrows it. Searched under row-level security by an index (migration 121).
- **A product with sizes:** made and changed on the server, each size its own product named "Jersey M Blue", its category the product's, kept in step in one transaction; missing categories in its path made; starting stock through `moveStock`.
- **The stock list** reads a business's products with sizes by its own index (migration 121).
- Jack's answers 9 and 10 recorded in `docs/decisions/2026-11-04-answers.md`.

## Out of scope

The screens: Add this product (`rs-add-product`, `rs-add-left`), Edit, "+ Add a size or colour" and the filters (pieces 8 to 10). Matching a product's supplier to a supplier (answer 10: the restock list's own piece). Linking the Citrus per-code products (piece 7).

## Who and risk

WP-1.5, piece 6, Jack's side. Risky: **migrations** (121), **money and stock** (prices, costs, starting stock).

## Follows

- Decisions: `docs/decisions/2026-10-01-stock-control-review.md` 2, 4, 10, 11 and the 5 Oct later change; `docs/decisions/2026-11-04-answers.md` answers 5, 9 and 10; `docs/decisions/2026-09-30-receiving-stock-review.md` 3 and 4.
- Drawings: `rs-add-product`, `rs-add-left`, `st-product` (Details · [Category]), `st-product-sizes`, `st-search-measure`, `st-filter-bearings`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `stock`: who changes a product; a product's details and finding by them; making a product with sizes.

## Impact

Migration 121; new `server/lib/product-editor.js`, `server/lib/product-details.js`, `server/routes/product-groups.js`; `server/routes/products.js`, `suppliers.js`, `stock-list.js`, `index.js`. Three stacked pull requests.
