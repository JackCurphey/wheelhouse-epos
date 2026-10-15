# Proposal: sales and sale documents move to server/routes/sales.js (WP-0.4)

## Why

One of WP-0.4's last moves: the sales routes and the quotes and orders
(sale documents) are still in `server.js`. The step A work in #203 (orders
in pence) will change these routes, so it's better done in their own file.

## What Changes

- New `server/routes/sales.js`, Mark's file, with 9 routes: `/api/sales`
  (list, one, record a sale) and `/api/sale-documents` (list, one, create,
  update, update lines, convert). Their helpers (`serializeSaleDocument`,
  `DOC_SELECT`, `DOC_KINDS`) come with them.
- `shopDayWindow` moves to `server/lib/sales.js`, because the sales list and
  the dashboard (still in `server.js`) share it.
- The Shopify order and refund webhook functions stay in `server.js`, where
  the dispatcher calls them outside the route table (split plan §4.1 rule
  1). They're grouped under their own heading above the remaining code.
- Moved, not rewritten. The only changes are the 2-space indent inside
  `register(route)`, `export` on `shopDayWindow`, the imports, and the one
  new heading. No behaviour changes (`skip_specs`).

## Lane, drawings and decisions

- **Lane:** Mark's. Sales and orders are Mark's (split plan §3), and so is
  `server.js`. Convert's job-finishing step follows Jack's
  paying-for-finished-work decision and is moved unchanged.
- **Drawings:** none.
- **Decisions followed:** split plan §4.1.

## Out of scope

- The dashboard and employees (the next moves), and the Shopify webhook
  functions.

## Impact

- `server/routes/sales.js` (new), `server/routes/index.js`,
  `server/lib/sales.js`, `server/server.js`, and the new test
  `tests/sales-routes-file.test.js`. Built on #212.
