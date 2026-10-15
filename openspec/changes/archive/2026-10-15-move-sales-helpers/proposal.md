# Proposal: the sale helpers move to server/lib/sales.js (WP-0.4)

## Why

Jack's workshop moves (#180–#184) are in. Answering a quote
(`answerAndAddToOrder`) still has to stay in `server.js`, because it needs
`loadDocumentLine`, and `server/workshop/jobs.js` must never import
`server.js` (Jack's question 3 on #180). Moving the sale helpers to the
shared file the split plan names unblocks Jack's quote move. The till,
orders, customers and Shopify route moves that come next will need it too.

## What Changes

- New `server/lib/sales.js`, holding exactly the split plan's list (§4.1,
  the shared-helpers table): `createSale`, `serializeSale`, `SALE_SELECT`,
  `resolveCashierId`, `loadDocumentLine`, the Shopify push helpers
  (`firePendingShopifyPushes`, with `registerPendingShopifyPushSlot`
  private), `pendingShopifyPushes`, and with them
  `pendingPushSlotRequestStorage` (private) and
  `runRequestWithPushSlotCleanup`.
- `resolveGroupDiscount` moves too, private, because only `createSale`
  uses it.
- Moved, not rewritten. The code is unchanged apart from these:
  - `export` added to the three helpers `server.js` now imports;
  - three comments that said "below" now point at `server.js`.
- `server.js` imports them, and keeps re-exporting the five names tests
  import from it, so no test changes.
- The sales routes (`GET /api/sales`, `GET /api/sales/:id`) stay in
  `server.js` for now. They move with the till and customers.
- No behaviour changes, so there's no spec change (`skip_specs`).

## Lane, drawings and decisions

- **Lane:** Mark's. `server/lib/**` and `server.js` are Mark's files (split
  plan §3). Nothing in Jack's area changes.
- **Drawings:** none. Nothing on any screen changes.
- **Decisions followed:** split plan §4.1, which makes this a move, not a
  rewrite, proven by the route-list test and the existing tests passing
  unchanged. It also follows Mark's answer to Jack's question 3 on #180.

## Out of scope

- Moving `answerAndAddToOrder` into `jobs.js`. That's Jack's next move, now
  unblocked.
- Moving the sales, till, customers or Shopify routes.

## Impact

- `server/lib/sales.js` (new), `server/server.js`, and the new test
  `tests/sales-lib-module.test.js`.
