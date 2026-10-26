# Proposal: purchase orders and the Deliveries page

## Why

Receiving stock decision 2 (Jack, 30 Sep,
`docs/decisions/2026-09-30-receiving-stock-review.md`): orders are built by
hand, then marked as ordered once they're placed on the supplier's website
or by phone; shops that order on the website skip orders and just receive.
Decision 10 (the UI audit) adds that orders open, and a part-delivered order
can be received against or closed. The staff app's Stockroom › Deliveries and
orders is still a placeholder; purchase orders live only in the old app.
The server already lists, shows, makes, marks as ordered and cancels them
(`server/routes/purchase-orders.js`).

WP-2.3 (Deliveries and purchase orders), slice C of the replan, Jack's lane.
This is the first piece of WP-2.3: the page and purchase orders. Receiving a
delivery is the next piece.

**Risky area:** money and stock, lightly: who may make, order and close a
purchase order changes on the server (Owner only), and each order gains a
read-only total. No stock moves, no migration. `/review` before merging.

## What Changes

- **Stockroom › Deliveries and orders** (`rs-hub`, `rs-hub-empty`,
  `rs-hub-staff`): the Orders list (each open order's supplier, lines, when
  it was ordered, how many are still to come, its status and Open), "+ New
  order", and the drawn empty note.
- **New order** (`rs-order`): the supplier as pills, "Add a product: scan,
  or type to search", each line's count (−, a typed number, +), its cost and
  Remove, the total cost, "Save as draft" and "Mark as ordered", and the
  drawn note.
- **An order** (`rs-order-ordered`, `rs-order-close`): its supplier and
  date, its status, each line's "ordered [n] · arrived [n]" with "All
  arrived" or "[n] to come", the total cost, and "Close the order", which
  asks first.
- **Server:** making, changing, ordering and cancelling a purchase order is
  for the Owner only until roles are built; each order gives its
  `totalCost`, in pounds, as stored.

## Who

Every signed-in staff member can open Deliveries and orders. Decision 4
shows orders and the restock list only to people who can order stock ("Can
order stock", which waits for WP-1.1 roles); until then that is the Owner.

## Capabilities

### New Capabilities

- `deliveries`: the Deliveries page and purchase orders.

## Out of scope

- **Receiving a delivery** (`rs-receive`, `rs-problem`, `rs-add-product`,
  labels, frame numbers), To return, Products to add and Recent deliveries:
  the next piece. "Receive a delivery" and "Receive against this order" are
  left off until then.
- **The restock list** (`rs-restock`): it needs answers first (design 5).
- **Closing an order that has partly arrived:** the server refuses to cancel
  one, and closing it needs a new write (design 4).
- **"for job WH-1042" on an order line:** order lines don't record a job yet.
- **Adding a supplier:** the Suppliers screen waits for a later release
  (receiving later change, 2 Oct).
- **The old app's purchase-order screens** (`public/app.js`,
  `#/stock/purchase-orders`) stay for now; they go once this merges
  (CLAUDE.md rule 5), with receiving still on them until the next piece.
