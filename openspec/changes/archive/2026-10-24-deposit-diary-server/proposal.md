# Proposal: the diary job's deposit, the server

## Why

Part 4 of online deposits (Jack, 24 Oct answers 2 and 3: staff refund by hand
on the job with a reason, at any stage; a no-show keeps the deposit, marked
"Didn't come", and staff can still refund it). Jack approved the drawings on
24 Oct (#454): `bk-staff-deposit`, `bk-staff-deposit-refund`,
`bk-staff-deposit-refunded`, `bk-staff-no-show`, `bk-staff-no-show-kept`.
This is 4a, the server; 4b is the job pop-up. WP-4.4, Jack. **Risky areas:
a migration (072) and money**, so `/review` runs.

## What Changes

- The job carries its deposit: the amount, when it was paid, and whether it
  is paid, refunded (when, why, by whom) or kept.
- **Refund the deposit**: staff refund it by hand with a reason, at any stage,
  once; it goes back to the card.
- **Didn't come**: once a booking's day has gone and the bike never came in,
  staff mark it, keeping the deposit; Undo takes the mark off.

## Capabilities

### Modified Capabilities

- `workshop-jobs`: a job shows its deposit; staff refund it by hand and mark
  a no-show.

## Out of scope

The job pop-up (4b); the till's deposit (after #404); refunding part of a
deposit.

## Impact

`server/migrations/072_didnt_come.sql`, `server/workshop/jobs.js`
(the job's select and its serialiser), `server/routes/workshop.js` (three
routes), `src/lib/api/types.ts`, `shapes.ts`, tests.
