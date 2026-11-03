# Proposal: Print labels, after a delivery is booked in

## Why

Receiving decision 8 (Jack, 30 Sep): after "Book in", "Print labels" lists what
was booked in; products without their own barcode start at one label per item
received; items with the maker's barcode start at 0; any count can be changed.
Delivery booked in (`rs-booked`) has the button, and without a label a product
with no barcode can't be scanned at the till.

Work package: **WP-2.3**, slice C, taken by Jack. Nothing of Mark's: it reads
the delivery kept by `delivery-booked-in`, and prints through the browser as
receipts and bike tags do (Jack's 26 Oct answer 5, browser printing only).

**Risky areas:** none. It reads what a delivery booked in, and adds a product's
barcode and price to that reply, both already open to anyone signed in. No
migration, no money or stock write.

## What Changes

- **Print labels** on Delivery booked in, for everyone: first for Staff, under
  the line that says what was booked in (`rs-booked-staff`), beside Receive
  another delivery for someone who can order stock (`rs-booked`). Not shown when
  nothing was booked in.
- **The Print labels box** (`rs-labels`): each line, "No barcode of its own · [n]
  received" starting at [n], or "Has its own barcode · [n] received" starting at
  0; any count can be stepped or typed; Cancel and "Print [n] labels".
- **The labels themselves:** one per page at the shop's label size, with the
  product's name, price, barcode and code.
- `GET /api/deliveries/booked-in/:id` lines also carry `barcode` and `price`.

## Drawings and decisions

- Drawings, in `docs/design/user-journeys/generator/receiving.mjs`: `rs-labels`
  (`labelsPopup`), `rs-booked`, `rs-booked-staff` (`bookedBoard`).
- Decisions: `docs/decisions/2026-09-30-receiving-stock-review.md` 8 and 10 (audit
  H2, a count can be typed); `docs/decisions/2026-10-26-day-answers.md` 5 (the
  print helper dropped, browser printing only); walk-through 3 M4.

## Out of scope

- **"Printing on [Label printer], the one used last" and Change:** the browser's
  own print window chooses the printer now (26 Oct answer 5).
- **"New in this delivery":** Add this product isn't built, so nothing is new yet.
- **A label template:** Jack wants shops to design their own printouts later; as
  the bike tag, this label is a stand-in until then.
- Labels from a delivery's page or a product's page: drawn only after Book in.
