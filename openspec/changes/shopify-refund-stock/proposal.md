# Proposal: a Shopify refund never undoes another stock change

## Why

A review of `server/server.js` (28 Oct) found that the Shopify refund
webhook puts stock back with an absolute figure. It reads the product, then
writes `stock_qty = <what it read> + <refunded qty>`, with no lock in between.
If a till sale, a stock adjustment or a delivery changes that product's stock
in that gap, the refund overwrites it and the other change is lost: the stock
figure is wrong and no longer matches the product's stock history.

## What Changes

- The refund webhook adds the refunded quantity to whatever is stored when it
  writes (`stock_qty = stock_qty + ?`), the way adjust stock, receiving a
  delivery and a sale already do.
- Its stock change and its stock history line ("Shopify refund #…") are made
  in one transaction, so both happen or neither does. A refund of several
  lines is all or nothing.
- The figure sent back to Shopify is the stock after the write, and it is sent
  after the transaction ends, so a slow Shopify never holds the product's row
  while a till waits to sell it.

## Capabilities

### Modified Capabilities

- `stock`: a Shopify refund and another stock change at the same moment both count.

## Work package, owner, risky areas

A fix found in review, not a work package; Jack's lane. **Risky areas:**
`server/server.js`, and money and stock (`stock_qty`). `/review` runs before
merging, and CI is run by hand on the branch
(`docs/decisions/2026-10-28-ci-once-a-day.md`). No migration, no screen.

## Drawings and decisions

No drawing: nothing on screen changes. Keeps to stock control decision 6's
rule that every stock change goes into the product's stock history
(`docs/decisions/2026-10-01-stock-control-review.md`): the refund's history
line is now written in the same transaction as its stock change.

## Out of scope

- The Shopify order webhook: it sells through `createSale`
  (`server/lib/sales.js`), which already writes relatively.
- Pulling stock levels from Shopify: Wheelhouse doesn't do this; it registers
  only the `orders/paid` and `refunds/create` webhooks.
- Moving the refund's Shopify push to after the webhook's reply (as sales and
  adjust stock do): a separate change to how the webhook answers.
