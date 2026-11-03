# Proposal: A delivery, once it's booked in

## Why

Pressing Book in today leaves you on the scanning page with one line of
text. Nothing keeps the delivery itself: the stock goes up and the orders move
on, but there is no record of "what came on Tuesday from [Supplier]", so
nobody can look a delivery up afterwards, or see what it cost. Receiving
decision 10 (the UI audit, M10) says the page after Book in should say what
happened and what's next, and the hub drawing has Recent deliveries.

Work package: **WP-2.3** (deliveries and purchase orders), slice C, taken by
Jack. It is the earliest open piece that needs nothing of Mark's: slice A and
B's open pieces wait on step C, the till deposit or roles, and WP-2.1's rest
(categories, sizes and colours, changing prices) is WP-1.5's. Who sees costs
is the Owner until roles, as orders already are.

**Risky areas:** a migration (110, the delivery and its lines), and money and
stock, because booking in writes the record inside the transaction that adds
stock. Stock itself is added exactly as before.

## What Changes

- **A delivery is kept** when it's booked in, from either route (Receive a
  delivery and the old app's order route): who, when, from which supplier,
  what was booked in and at what cost, and what was set aside.
- **Delivery booked in** (`rs-booked`, `rs-booked-staff`): Book in now lands
  here. "[n] items booked in · stock updated", then what was set aside and
  what's still to come on the order, then Receive another delivery.
- **A booked-in delivery** (`rs-delivery`, `rs-delivery-staff`): its lines,
  the booked-in cost before VAT, and what was set aside. Staff see it without
  costs, on the server as well as the screen.
- **Recent deliveries** on Deliveries and orders (`rs-hub`, `rs-hub-staff`),
  each with Open.
- Migration 110. Server: `GET /api/deliveries`, `GET /api/deliveries/booked-in/:id`;
  `POST /api/deliveries/receive` also answers `deliveryId`.

## Drawings and decisions

- Drawings, in `docs/design/user-journeys/generator/receiving.mjs`: `rs-booked`
  and `rs-booked-staff` (`bookedBoard`), `rs-delivery` and `rs-delivery-staff`
  (`deliveryBoard`), `rs-hub` and `rs-hub-staff` (`hubBoard`'s Recent
  deliveries). `journeys.mjs` lists them all.
- Decisions: `docs/decisions/2026-09-30-receiving-stock-review.md` 4, 9 and 10
  (audit M10, M12 and H4); issue #116 question 6 (the invoice check is later,
  so no Invoice section or tags); walk-through 3 M4 (the board Staff land on).

## Out of scope

- **Print labels** (`rs-labels`): its own change, `delivery-labels`, the next
  pull request. Until it merges this page has no Print labels button.
- **A job waiting for a part** (the job line on `rs-booked`, "Held for job"):
  order lines and stock don't record a job yet.
- **The invoice check** (`rs-invoice*`): later, issue #116 question 6.
- **"Cost went up? Change it"** (the written line on `rs-delivery`): a
  product's cost isn't edited anywhere until products move to pence (WP-1.5).
- **Add this product, frame numbers, Cycle to Work** (`rs-add-product`,
  `rs-frame`, `rs-booked-c2w`).
- Deliveries booked in before this piece: nothing recorded them as deliveries,
  so they aren't shown; none is made up from the stock history.
