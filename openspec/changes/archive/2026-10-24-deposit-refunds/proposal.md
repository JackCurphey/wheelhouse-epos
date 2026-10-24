# Proposal: refunding the deposit when a booking is cancelled or declined

## Why

Part 3 of online deposits (Jack, 24 Oct answers 1–5; book a repair review
decisions 3 and 4: "If the shop can't fit you in, it comes back in full";
free to cancel until the cut-off, kept after it). With 2a–2c a booking takes
a deposit; this piece gives it back when it should and keeps it when it
should, as drawn in `bk-cancel`, `bk-cancel-late`, `bk-cancelled`,
`bk-cancelled-late`, `bk-declined`, the expired request page and
`bk-staff-decline` ("Their £[deposit] deposit is refunded automatically").
This is 3a, the server; 3b is the customer's pages. WP-4.4, Jack.
**Risky areas: a migration (071), money, and public routes**, so `/review`
runs.

## What Changes

- **Cancelling in time refunds**: a customer cancelling before "Free to
  cancel until" gets the deposit back automatically.
- **Cancelling late keeps it**: after the cut-off the deposit is kept, and
  the cancel is refused unless the customer chose "Cancel and lose the
  deposit" (`losesDeposit: true`), so a page opened before the cut-off can't
  lose it unawares.
- **The shop declining, a request expiring, or the shop cancelling refunds**
  automatically.
- **A refund owed is recorded with the cancel or decline**, then made; one
  the provider can't make then is made when deposits are next touched.
- **The booking link says where the deposit stands**: paid, refunded or kept,
  and whether cancelling now would refund it.

## Capabilities

### Modified Capabilities

- `book`: the deposit is refunded when the booking is cancelled in time,
  declined, expired or cancelled by the shop, and kept when cancelled late.

## Out of scope

The customer's pages (3b); refunding by hand and "Didn't come" (part 4).

## Impact

`server/migrations/071_deposit_refunds.sql`, `server/payments/refund.js`,
`server/payments/settle.js`, `server/routes/portal.js` (cancel, the link),
`server/routes/workshop.js` (decline, expire, cancel), tests.
