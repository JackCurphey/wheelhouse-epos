# Proposal: the deposit on the customer's cancel, cancelled, declined and expired pages

## Why

Part 3b of online deposits (Jack, 24 Oct answers 1–5). 3a (`deposit-refunds`,
#458) refunds or keeps the deposit; this shows the customer what happens, as
drawn in `bk-cancel`, `bk-cancel-late`, `bk-cancelled`, `bk-cancelled-late`,
`bk-declined` and the expired request page (`book.mjs` lines 291–313). WP-4.4,
Jack. **Risky area: money** (the cancel's choice to lose the deposit), so
`/review` runs. No migration.

## What Changes

- The cancel pop-up says the deposit will be refunded, or, past the cut-off,
  that it isn't refundable, with the shop's number; its button then reads
  "Cancel and lose the deposit", and sends that choice.
- The cancelled page says the deposit comes back, or was kept and why.
- The declined and expired pages say the deposit comes back.
- Past the cut-off, the booking page no longer shows "Free to cancel until".

## Capabilities

### Modified Capabilities

- `book`: the customer's pages say what happens to the deposit.

## Out of scope

The diary job (part 4); "we've kept your details" on the declined page.

## Impact

`src/screens/book/pending.tsx`, `pending-rules.ts`, `pending-query.ts`, tests.
