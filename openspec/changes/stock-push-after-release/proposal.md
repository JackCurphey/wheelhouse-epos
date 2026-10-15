# Proposal: stock changes push to Shopify after the request lets go of its connection

## Why

Jack's third point on #151 (7 Oct): `POST /api/products/:id/stock` waits on
the Shopify stock push, with its retries, while the request still holds one
of the ten pooled database connections. Booking in a purchase order
(`POST /api/purchase-orders/:id/receive`) does the same after its COMMIT. A
sale already avoids this: it answers first and pushes afterwards, from a
fresh connection (`firePendingShopifyPushes`, `server/lib/sales.js`). During
a Shopify outage, a few stock changes at once could otherwise hold enough
connections to stall every till.

## What Changes

- New `deferShopifyPushes(afterRelease, shopId, pushes)` in
  `server/lib/sales.js`, next to the sale's push helpers. It registers the
  pushes for graceful shutdown at once, the way `createSale` does, and fires
  them once the request has released its connection.
- The stock adjustment and purchase-order booking routes use it instead of
  awaiting `pushInventoryLevel`.
- What the shop sees is unchanged: the stock change, the reply and the push
  itself (still logged, never failing the request). The reply simply no
  longer waits for Shopify. No area spec covers products or purchase orders
  yet, and nothing a shop would describe changes, so `skip_specs`.

## Lane, drawings and decisions

- **Lane:** Mark's (`server/routes/products.js`,
  `server/routes/purchase-orders.js`, `server/lib/sales.js`; split plan §3).
- **Drawings:** none.
- **Follows:** Jack's review on #151 (7 Oct), point 3, and the sale's
  existing push pattern.

## Out of scope

- The other Shopify calls in `products.js` (product sync and unpublish on
  save and delete). They are a different call with no stock connection
  pattern yet, and are noted for the Shopify package.

## Impact

- `server/lib/sales.js`, `server/routes/products.js`,
  `server/routes/purchase-orders.js`, and the new
  `tests/stock-shopify-push-after-release.test.js`.
