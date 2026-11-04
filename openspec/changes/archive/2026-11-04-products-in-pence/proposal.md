## Why

Programme rule 3 of the sales-in-pence work and WP-1.5: money is whole pence. Products are the last place the new screens read pounds from, and Stock's Edit waits on it (`decided-while-building.md`, 26 Oct: "Prices are shown, not edited, until products move to pence"). First of WP-1.5's pieces (`openspec/changes/wp-1-5-products/`).

## What Changes

- Each product has its price and cost in whole pence, worked out by the database from the pounds, so the two can never disagree and old code carries on writing pounds.
- A product can be saved with a price or cost in whole pence; fractions of a penny, negatives and too-large figures are refused.
- A product's save waits a short time for a locked row, then answers busy, rather than holding a connection.
- The Stock list, a product's page, its margin, delivery labels, the till's snapshot, stock take values and adjustment values read pence. Nothing on screen changes.
- The totals check covers products.

## Out of scope

Editing a price on screen (piece 6, then 10). The till's screens, sales and old sale tables (step C). Purchase order and supplier catalogue pounds. Dropping the pounds columns: when the old app has gone. Request keys: a product save sets values rather than adding them, and the Edit screen brings its own.

## Who and risk

WP-1.5, piece 1, taken by Jack's side. Risky: **migrations** (114 rewrites `products`) and **money and stock**.

## Follows

- Drawings: `st-list`, `st-product`, `st-product-staff` (unchanged on screen).
- Decisions: stock control 3 and 11; Reports and accounts 5 and 9 (who sees costs); `openspec/changes/wp-1-6-sales-in-pence/design.md` lists `products.price`, `.cost` under WP-1.5.
- Pattern: migration 113's generated columns; `lock_timeout` and 503 busy from `server/routes/move.js`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `stock`: prices and costs in whole pence.

## Impact

Migration 114; `server/routes/products.js`, `server/lib/serializers.js`, `server/lib/pence.js` (new), `server/lib/stock-take-differences.js`, `server/till/snapshot.js`, `server/routes/purchase-orders.js`; `src/screens/stock/`, `src/screens/deliveries/`; `scripts/ci/check-money-totals.mjs`. Old till, old sales and Shopify untouched.
