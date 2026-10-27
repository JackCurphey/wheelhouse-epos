# Proposal: close an order that has partly arrived

## Why

An order can partly arrive (say 3 of 5 brake pads) and the supplier won't
send the rest. Until now Wheelhouse refused to close an order once anything
on it had arrived, so it sat on "still to come" for good. Jack's answer on
27 Oct (`docs/decisions/2026-10-27-answers.md`, answer 1, "Mark the rest not
coming"): Close the order keeps what arrived in stock and on the order's
history, marks the rest as not coming, and the order drops off "still to
come". Nothing that arrived is undone.

## What Changes

- **Close the order works on a partly delivered order.** The server's close
  (`POST /api/purchase-orders/:id/cancel`) closes an order whose status is
  "partly delivered" as well as a draft or an ordered one with nothing in.
  A partly delivered order becomes **closed**; one with nothing in is
  **cancelled**, as before. Both show as "Closed".
- **Nothing that arrived is undone.** Each line keeps its arrived count; stock
  and the stock history are not touched.
- **The rest is not coming.** On a closed or cancelled order each line has
  nothing still to come; what had been to come is sent as "not coming", and
  the order's page shows "[n] not coming" on that line.
- **A closed order can't be received against.** Booking in refuses it, as it
  refuses any order not awaiting delivery; Receive a delivery leaves it out
  of what is still to come, and `?order=` naming it says "This order is all
  in.".
- **Race-safe both ways.** A close made while a delivery is being booked in
  waits for it and then closes what is there; a booking made while a close is
  being written waits and is then refused. Built on the existing order-row
  lock (`design.md`).
- The order page shows "Close the order" to the Owner on every open order,
  as drawn on `rs-order-ordered` (it was hidden once anything had arrived).

## Capabilities

### Modified Capabilities

- `deliveries`: an order can be closed after part of it has arrived; the rest
  is not coming, and a closed order can't be received against.

## Work package, owner, risky areas

WP-2.3 (Deliveries and orders), Jack's lane. **Risky area: money and stock**
(purchase orders and booking stock in), so it wants `/review` before
merging. No migration: `purchase_orders.status` is plain text with no check
on its values (`server/migrations/007_purchase_orders.sql`), and nothing new
is stored per line (`design.md` 1). No `server.js`, messaging core or
sign-in.

## Drawings and decisions followed

- `rs-order-ordered` and `rs-order-close` in
  `docs/design/user-journeys/generator/receiving.mjs` (audit M2: "an ordered
  order, part delivered — receive against it, or close it when the rest isn't
  coming"): "Close the order", the box "Close the order?", "Keep it open",
  "Closing drops everything still to come on this order."
- `docs/decisions/2026-10-27-answers.md` answer 1.
- Receiving decision 4: ordering, and closing, is for the Owner until roles.

## Out of scope

- The amber warning in `rs-order-close` when a job is waiting for a line
  still to come, and the job's "Order closed" (`rs-part-order-closed`): jobs
  waiting for parts aren't linked to order lines yet.
- Reopening a closed order. A reorder is a new order.
- The restock list (waits for Mark's WP-1.5; answer 2 of the same file).
- The old app (`public/app.js`), a placeholder to delete.
