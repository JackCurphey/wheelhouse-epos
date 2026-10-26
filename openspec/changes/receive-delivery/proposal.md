# Proposal: receiving a delivery

## Why

Receiving decision 3 (Jack, 30 Sep,
`docs/decisions/2026-09-30-receiving-stock-review.md`): deliveries are
scanned in, each scan adds one, a count can be typed, and the list shows
what's still to come on the order. Decision 9: each scanned line has
"Problem?" (Damaged, Wrong item or Missing, how many, an optional note);
damaged and wrong items aren't added to stock, missing items stay "to come".
Decision 4: everyone can receive. Decision 10 (audit M2): a part-delivered
order can be received against.

The order page and Deliveries and orders were built without receiving
(`openspec/changes/deliveries-orders`); the server already books a delivery
in against an order (`POST /api/purchase-orders/:id/receive`).

WP-2.3, slice C, Jack's lane. Second piece of WP-2.3. Drawings: `rs-receive`
and `rs-problem` in `docs/design/user-journeys/generator/receiving.mjs`.

**Risky areas:** money and stock (receiving raises `stock_qty`) and a
migration (090, the problems). `/review` before merging.

## What Changes

- **Receive a delivery** (`rs-receive`): the order it's from as pills,
  "Scan a barcode, or type to search", each scanned line with its count
  (−, a typed number, +) and "Problem?", "Still to come on the order",
  "[n] items to book in" and "Book in [n] items".
- **Something wrong?** (`rs-problem`): Damaged, Wrong item or Missing, how
  many, a note, and "Mark as …".
- **Deliveries and orders** gains "A delivery arrived?" with "Receive a
  delivery", for everyone; an order still to come gains "Receive against
  this order".
- **Server:** the receive route locks the order before it checks what's
  still to come, so two people booking the same line in at once can't count
  it twice, and adds stock with one `stock_qty = stock_qty + n`. It also
  takes the problems, recorded in a new table (migration 092).

## Capabilities

### Modified Capabilities

- `deliveries`: receiving a delivery against an order.

## Out of scope

- **Receiving without an order** ("Works with or without an order";
  "[Product] · not on an order"): the receive route books in against one
  order; stock without an order needs a new write.
- **Frame numbers** (`rs-frame`, `rs-frame-dup`) and **a part a job is
  waiting for** ("Job WH-1042 is waiting for 1", holding it for the job):
  order lines and stock don't record a job or a frame yet.
- **Add this product** (`rs-add-product`, `rs-receive-staff`): an unknown
  barcode is said, not added.
- **After Book in** (`rs-booked`, `rs-labels`): the page says what was
  booked in; the booked-in board and labels come later.
- **To return to [Supplier]** and Returned on the hub, Products to add and
  Recent deliveries: the problems are recorded for them; the lists come
  later.
