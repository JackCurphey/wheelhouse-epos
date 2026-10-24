# Proposal: paying a booking's deposit, the server

## Why

Part 2 of online deposits (Jack, 24 Oct, `docs/decisions/2026-10-24-morning-questions.md`
answers 1–5; 23 Oct answer 2: built now, behind a pretend payment provider).
Part 1 (`deposit-settings`, #452) lets the shop say whether it takes a deposit
and how much. This piece lets a booking pay it: the online payments adapter
the build plan puts in WP-1.11 ("the online payments adapter with its fake
provider"), a pretend provider behind it, and the booking request taking a
paid deposit. The booking page's part (the deposit line, the card form, "The
card didn't go through", checking after a dropped connection) is the next
piece, 2b; refunds on cancelling and declining are part 3.

WP-4.4 (deposits) and WP-1.11's adapter, taken by Jack (`.agents/STATUS.md`).
**Risky areas: a migration (070), money, and a public route**
(`/api/portal/*`), so `/review` runs before merging.

## What Changes

- **A payments adapter** (`server/payments/`): hold an amount on a card, take
  it, let it go, refund it, and read where it stands. The pretend provider
  keeps its own records, as a real one would on its side, and answers as test
  cards say (a card that's accepted, one that's declined).
- **A deposit hold for a booking**: before sending, the booking page asks for
  the deposit on the services chosen; the server works it out (part 1's rule,
  from the stored prices, never the page's) and holds it, once per booking
  request.
- **The booking request takes the held deposit**: it is checked (held,
  this request's, the right amount), the booking is saved with it, and only
  then is the money taken; a booking that can't be saved lets the hold go,
  so nothing is taken. Sending again books once and takes once (drawing
  `bk-checking-payment`: "Nothing will be taken twice").
- **When it's free to cancel until** is worked out at booking from the shop's
  hours-before setting and kept on the booking, as the deposit is ("worked
  out on the price then and fixed").

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `book`: a booking takes the shop's deposit, held then taken once the
  booking is saved.

## Out of scope

- The booking page's deposit screens (2b), refunds (part 3), the diary job's
  deposit (part 4, drawn first for Jack), the till's deposit (after #404).
- Stripe itself, which waits for Mark's account.

## Impact

`server/migrations/070_online_payments.sql`, `server/payments/*`,
`server/routes/portal.js` (two new routes and the booking request), tests.
