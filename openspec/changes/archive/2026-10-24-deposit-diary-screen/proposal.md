# Proposal: the diary job's deposit, the job pop-up

## Why

Part 4b of online deposits: the job pop-up shows the deposit and lets staff
refund it by hand and mark Didn't come, as Jack approved on 24 Oct (#454:
`bk-staff-deposit`, `bk-staff-deposit-refund`, `bk-staff-deposit-refunded`,
`bk-staff-no-show`, `bk-staff-no-show-kept`; `diary.mjs` lines 3209–3270).
4a (`deposit-diary-server`, #460) is the server. WP-4.4, Jack. **Risky area:
money**, so `/review` runs. No migration.

## What Changes

- A strip under the customer strip: "Deposit paid £13.00 · [date]" with
  Refund the deposit; "Deposit refunded £13.00 · [date] · [reason]"; "Deposit
  kept £13.00 · Didn't come · marked by Jo Taylor · [date]" with Refund the
  deposit.
- The refund pop-up: the whole deposit, a reason (needed), "It goes back to
  the card they paid with, within 5 to 10 working days.", Cancel / Refund £13.00.
- Once the booked day has gone with the bike not in: "Not come in · Booked for
  Thu 17 Sep · 11:30 · the bike hasn't come in", and Didn't come beside Book in.
  Pressing it marks the job (its badge reads Didn't come) with the dark bar
  "Marked Didn't come · the deposit is kept" and Undo, which stays until the
  job is closed (Jack's 24 Oct answer 9: nothing closes by itself).
- The booking request's decline pop-up adds "Their £13.00 deposit is refunded
  automatically." (`bk-staff-decline`).

## Capabilities

### Modified Capabilities

- `workshop-diary`: the job pop-up shows the deposit, refunds it by hand and
  marks Didn't come.

## Impact

`src/screens/diary/job-dialog.tsx`, a new `job-deposit.tsx`,
`src/screens/diary/request-dialog.tsx`, tests.
