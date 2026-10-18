# Proposal: Change details notes a waiting change request

## Why

Jack, 18 Oct: when a customer's change request is waiting, Change details
should say so, so nobody changes the job without knowing. It's an addition
only: the request still shows in Waiting for you and is answered there
(`docs/decisions/2026-10-18-old-diary-features.md`, "A waiting change request
in Change details").

## What Changes

- With a change request waiting, Change details shows an amber "Change
  requested" note at its top: "[customer] asked to move this to [day],
  [time]. Setting that time here accepts it; any other change leaves the
  request waiting in Waiting for you." When the request also moves the job
  to another mechanic, it adds "with [mechanic]".
- Nothing else changes. Saving the requested day, start and mechanic already
  accepts the request (the server's rule, as a diary drop).

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/change-details-dialog.tsx`.
- **Drawings:** `job-change-details-request`, `job-change-details-request-phone`
  (`docs/design/user-journeys/generator/diary.mjs`).
- **Decisions:** as above; "with [mechanic]" is in `decided-while-building.md`, 18 Oct.

## Out of scope

- Answering the request from Change details (it is answered in Waiting for you).

## Impact

- `src/screens/diary/change-details-dialog.tsx`, `tests/screens/job-change-details.test.js`
