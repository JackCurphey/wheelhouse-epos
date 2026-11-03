# Proposal: Staff aren't sent what the shop pays for stock

## Why

Stock's list hides the cost and margin on the screen, but `GET /api/products`
sends every product's cost to everyone signed in. A product's page checks the
sign-in, not the person, so Jo at the Owner's till gets it too. And hiding a
cost has a danger of its own: a screen that was never told the cost can save it
back as £0, overwriting the real one.

Work package: follows **WP-2.3**'s `delivery-booked-in` (`canSeeCosts`, #594).
Taken by Jack. **Risky area:** money and stock (a product's cost, an order's
lines), so `/review` runs first. No migration.

## What Changes

- Every reply carrying a product's cost, a supplier's trade price or a value at
  cost goes through `canSeeCosts`: the product routes, the low stock list on the
  dashboard, a supplier's catalogue, stock take's finished counts, its check,
  its download and what Apply answers, and Today's stock adjusted line.
- **A save never overwrites a cost it wasn't given.** A product saved with no
  cost, an empty one or a null keeps the one stored; someone who can't see costs
  can't change it, whatever they send; and a product they add starts with none.
- **An order's line takes its cost on the server** for someone who can't see
  costs: the cost already on that draft's line, otherwise the product's.
- **New order**, opened by someone who can't see costs: no costs and no total.
  With a line that has no cost yet it can be saved as a draft, not marked as ordered.
- **The old app** shows a dash where a cost isn't sent and doesn't write back an
  empty cost.
- What the last person was sent goes when the person changes: `['product']`,
  `['products']`, `['stock']`, `['stock-takes']`, `['stock-take-check']` and
  `['needs-attention']` join the reset.

## Drawings and decisions

- `docs/decisions/2026-10-01-reports-and-accounts-review.md` decisions 5 and 9;
  `docs/decisions/2026-10-01-stock-control-review.md` decision 11 and its later
  change ("Staff see no cost or margin, unless given Can see costs and margin").
- Jack's comment of 3 Nov: the Owner decides this. Until roles (WP-1.1) bring the
  person's switch it is the Owner only.
- `docs/decisions/2026-09-30-receiving-stock-review.md` decision 4 (ordering) and
  drawings `rs-order`, `rs-hub-staff`, `st-list`, `st-product`, `st-product-staff`
  and `tk-diff`. No drawing shows a new order without costs: logged in
  `decided-while-building.md`.

## Out of scope

- The "Can see costs and margin" switch itself, and any setting (WP-1.1).
- Who can order, or apply a count: those stay the sign-in's check, `ownerOnly`,
  until roles.
- Staff being refused other edits to a product (stock decision 11): only the cost
  is closed here.
