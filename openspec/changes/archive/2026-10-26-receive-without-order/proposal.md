# Proposal: receiving a delivery without an order

## Why

Receiving decision 2 (Jack, 30 Sep,
`docs/decisions/2026-09-30-receiving-stock-review.md`): "shops that order on
supplier websites skip orders and just receive deliveries". Decision 3: pick
the supplier if you like, scan each item; if there's an order for that
supplier the list shows what's still to come. Decision 4: everyone, Staff
included, can receive.

Receive a delivery was built against one order only
(`openspec/changes/archive/2026-10-26-receive-delivery`, out of scope there:
"Receiving without an order … stock without an order needs a new write").
Its decided-while-building entry 1 left the drawing's supplier pills and
"Works with or without an order" for this piece.

WP-2.3, slice C, Jack's lane. Third piece of WP-2.3, built on
`jack/receive-delivery` (#533).

**Drawings** (`docs/design/user-journeys/generator/receiving.mjs`):
- `rs-receive`: From as supplier pills, "Shows what’s still to come on its
  orders"; scanned lines "[Supplier code] · on your order: [n]" beside
  "[Supplier code] · not on an order", each with "Problem?".
- `rs-problem`: Something wrong? (Damaged, Wrong item, Missing); Missing is
  "offered only when there's an order" (the drawing's own note).
- `rs-problem-missing` (the no-order state): no "Still to come on the order".
- `rs-hub`: "Scan each item as it comes out of the box. Works with or without
  an order."

**Risky areas:** money and stock (receiving raises `stock_qty`) and a
migration (094). `/review` before merging. Who booked it in is read through
main's `rememberSession` (design, "Who's asking"); sign-in isn't changed.

## What Changes

- **From is the supplier, as drawn**: supplier pills (the one with the newest
  order still to come first, then by name; three, then "Other…", as New
  order). Picking one is optional. A supplier's orders still to come give the
  scanned lines their "on your order" and the "Still to come on the order"
  list.
- **Not on an order**: a product with no line still to come on the picked
  supplier's orders (or with no supplier picked) is scanned in as
  "[code] · not on an order", counted, and booked in the same way.
- **Problem?** on a line not on an order offers Damaged and Wrong item (not
  Missing): they aren't added to stock and are recorded with the supplier,
  for To return later.
- **One booking for the whole delivery**: a new route,
  `POST /api/deliveries/receive`, books order lines and lines not on an order
  in one transaction, with the same stock safety as the order route, which
  now shares its code. Both record who booked it in.
- **Deliveries and orders**: the drawn "Works with or without an order."

## Capabilities

### Modified Capabilities

- `deliveries`: receiving a delivery with or without an order.

## Out of scope

- Unchanged from the last piece: frame numbers, a part a job is waiting for
  (and so Missing on a job's line with no order, `rs-problem-missing`'s
  job wording), Add this product, the booked-in board and labels, and the
  hub's To return, Products to add and Recent deliveries.
- A record of the delivery itself (for Recent deliveries): nothing reads one
  yet.
