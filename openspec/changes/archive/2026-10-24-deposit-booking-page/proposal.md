# Proposal: the deposit on the booking page

## Why

Part 2c of online deposits (Jack, 24 Oct answers 1–5). With 2a and 2b (#455,
#456) a booking can be paid for; the customer's booking page then shows it,
as drawn in `bookingLines` (`book.mjs` line 230: "Deposit paid £[deposit]",
"Free to cancel until [date and time]") and `bk-request-deposit` (line 247:
"If we can't fit you in, your deposit comes back in full."). WP-4.4, Jack. A
public route's answer changes (`/api/portal/*`), so `/review` runs. No
migration.

## What Changes

- The booking link's answer adds `deposit`: the amount and when it's free to
  cancel until, in the shop's time, while the booking took one.
- The booking page shows "Deposit paid" and "Free to cancel until" rows above
  "Your repair", and a request adds "If we can't fit you in, your deposit
  comes back in full."

## Capabilities

### Modified Capabilities

- `book`: the booking page shows the deposit paid and when it's free to
  cancel until.

## Out of scope

Refunds and the cancel pop-up's deposit words (part 3); the diary (part 4).

## Impact

`server/routes/portal.js` (`bookingLinkView`), `src/screens/book/pending.tsx`,
`pending-query.ts`, tests.
