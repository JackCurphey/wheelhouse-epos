## Why

Stock control decisions 3, 4, 7, 10 and 11 give a product's page Edit, its details, its price and cost changes in its history, and a product with sizes its own page with a grid; decision 10 redraws receiving's Add this product with its category's details. Pieces 4 to 6 built the server for all of it, and pieces 8 and 9 the categories screens and the list; a product still can't be added, edited or repriced on the new screens. Receiving stock's later change (walk-through 3 M3) adds "Cost went up? Change it" on a booked-in delivery. WP-1.5, piece 10 (`openspec/changes/wp-1-5-products/tasks.md`; WP-2.1). It keeps "Prices are shown, not edited, until products move to pence" and "Left out because they change things: + Add a product … Edit" (`decided-while-building.md`, 26 Oct), and piece 9's "A product with sizes' row opens nothing until its page is built".

## What Changes

- **A product's page:** Edit (the Owner's) opens one box with its name, codes, supplier, cost, price, low-stock level, category and that category's details; "Details · [Category]" shows each answer, with its own Edit. A price or cost saved goes into its history as "Price changed · £28.00 → £[price]" or "Cost changed", with a "Price changes" filter, for the Owner (staff's history leaves them out, as `st-product-staff` draws).
- **A product with sizes' page** (`st-product-sizes`): its codes, total in stock, prices, the grid of sizes across and colours down, each cell opening that size, "+ Add a size or colour", Edit (name and category), and one history for all its sizes. The Stock list's row for it opens it.
- **Adding a product:** "+ Add a product" on Stock, "+ Add “[typed]” as a product" when nothing matches, and on a new shop's empty list, open the same box empty. On receiving, a barcode Wheelhouse doesn't know offers the Owner "Add this product" (`rs-add-product`), which adds it with that barcode and counts 1.
- **Cost went up? Change it:** on a booked-in delivery, the Owner changes a line's cost; the line, the product's cost and its history ("Cost changed · delivery from [Supplier]") follow.
- **Server (money and stock; a migration, so risky):** migration 122 `product_price_changes` (each price or cost change: product, was, now, who, when, and the delivery when it came from one), written by a product's save, a size's save and Cost went up; `GET /api/products/:id` and `GET /api/product-groups/:id` send them to the Owner in the history; `GET /api/product-groups/:id` gains its sizes' stock history; `PUT /api/deliveries/booked-in/:id/lines/:lineId/cost`.

## Out of scope

Changing many prices at once with Undo (`st-prices`, next in WP-2.1's order), bike frame numbers on stock, Send to another shop, the invoice check (`rs-invoice-*`, later), the left-for list (`rs-add-left`), photos on the new screens, Show on website, taking a product off sale on the new screens, the Citrus Lime import's sizes (piece 7, waiting).

## Who and risk

WP-1.5, piece 10, Jack's side. Adding and changing stays the Owner's until Mark's roles (WP-1.1). Risky: **migrations** (122) and **money and stock** (prices, costs, a delivery's cost). `/review` before each merge that touches them, and a hand-run CI. Pull requests, stacked: (1) price changes in the history and the server; (2) a product's page Edit and details; (3) a product with sizes' page; (4) adding a product, on Stock and receiving; (5) Cost went up? Change it, then the archive.

## Follows

- Decisions: `docs/decisions/2026-10-01-stock-control-review.md` 3, 4, 7, 10, 11; `docs/decisions/2026-09-30-receiving-stock-review.md` (the 3 Oct later change, walk-through 3 M3); `docs/decisions/2026-11-04-answers.md` answers 5, 9, 11.
- Drawings: `st-product`, `st-product-staff`, `st-product-sizes`, `st-list`, `st-list-none`, `st-list-new` (`stock.mjs`); `rs-add-product`, `rs-delivery` (`receiving.mjs`).
- Server: `openspec/changes/archive/2026-11-06-product-editing`, `2026-11-05-sizes-and-colours`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `stock`: a product's page with Edit, details and price changes; a product with sizes' page; adding a product.
- `deliveries`: Cost went up? Change it; adding an unknown barcode's product while receiving.

## Impact

`server/migrations/122_product_price_changes.sql`, `server/lib/price-changes.js` (new), `server/routes/products.js`, `product-groups.js`, `stock-list.js`, `purchase-orders.js`; `src/screens/stock/product-page.tsx`, `stock-page.tsx`, `stock-bits.tsx`, new `product-box.tsx` and `sizes-page.tsx`; `src/screens/deliveries/receive-page.tsx`, `delivery-page.tsx`; `src/staff/routes.ts`. Tests: new `tests/price-changes.test.js`, `tests/delivery-cost-change.test.js`, `tests/screens/product-edit.test.js`, `tests/screens/sizes-page.test.js`, `tests/screens/add-product.test.js`, `tests/browser/product-edit.spec.ts`.
