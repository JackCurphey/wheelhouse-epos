# Proposal: a request cancelled at any time gets its deposit back

## Why

Jack's decision of 24 Oct (`docs/decisions/2026-10-24-request-deposit-refund.md`):
a shop can't keep a deposit for a booking it hasn't confirmed. Until now a
request cancelled after its cut-off kept the deposit (deposit-refunds design
3). WP-4.4, Jack. **Risky areas: money and a public route**, so `/review` runs.

## What Changes

- The customer cancelling a request waiting for the shop (pending, or a time
  the shop offered) gets the deposit back at any time.
- The booking link says such a deposit is refundable, so the cancel pop-up
  says it will be refunded and "Free to cancel until" stays shown.

## Capabilities

### Modified Capabilities

- `book`: the deposit comes back when a request is cancelled, whenever.

## Impact

`server/routes/portal.js` (the cancel, the link), tests.
