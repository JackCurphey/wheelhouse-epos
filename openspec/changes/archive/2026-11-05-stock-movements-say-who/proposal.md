## Why

Stock control decision 6 has every change to stock in the product's history with who made it. Today nine parts of the server each write stock their own way: a line on a till says the Owner's sign-in even with Jo Taylor checked in, sales and refunds name nobody, a supplier import writes no line at all, and only some of them have any limit on waiting for a locked product. WP-1.5, piece 2 (`openspec/changes/wp-1-5-products/`). Stock per shop (piece 3) needs one place to change.

## What Changes

- One function, `moveStock`, is the only thing that changes stock or writes a stock line: every writer goes through it.
- Each line says who (the person checked in, not only the sign-in), why (its reason or note), which shop, and what caused it (a sale, till sale, delivery, order, count or Shopify refund).
- A product's history and Today say the person who was actually there.
- On a till or workshop computer with nobody checked in, adjusting stock, adding a product with stock, importing with stock, and applying or undoing a count ask for a PIN. Sales, as the old till works, don't.
- Every stock writer waits at most a set time for a held product, then answers busy and changes nothing. The till's sync re-sends; Shopify's refund retries.
- A supplier import now writes its stock line.

## Out of scope

Stock counted per shop, a first shop for every business and filling in old lines' shop (piece 3). The shop switcher (WP-1.4, WP-5.2). Links on history lines (piece 10). Showing who, shop or cause on screens beyond the name already drawn. Roles.

## Who and risk

WP-1.5, piece 2, Jack's side. Risky: **migrations** (115), **money and stock**, and **`server/server.js`** (the busy answer; the refund writer).

## Follows

- Decisions: stock control 3 and 6; `docs/superpowers/specs/2026-10-05-wp-1-4-shops-and-sites.md` §3 and §4 (a till and workshop computer's own site; a line's site); `docs/decisions/2026-11-04-answers.md`.
- Drawings: `st-product`, `st-today-adjust` (who is named; nothing new drawn).
- Pattern: `whoIsBooking` and `CHECK_IN_FIRST` (`delivery-booked-in`); `lock_timeout` and 503 busy (`citrus-import-fix`, `products-in-pence`).

## Capabilities

### New Capabilities

### Modified Capabilities
- `stock`: every line says who, why, which shop and what caused it; one place; lock limits.

## Impact

Migration 115; new `server/lib/stock.js`; `server/routes/products.js`, `purchase-orders.js`, `stock-takes.js`, `suppliers.js`, `today.js`; `server/lib/sales.js`, `routes/sales.js`; `server/till/sync.js`, `this-till.js`, `this-workshop.js`; `server/move/bring-across.js`, `fix-row.js`; `server/server.js`. Two stacked pull requests: the function and staff's own stock changes, then sales, the till, Shopify, the imports and the check that nothing else writes stock.
