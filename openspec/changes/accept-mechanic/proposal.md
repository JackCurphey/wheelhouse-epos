# Choosing the mechanic as a booking request is accepted

## Why
Workshop day decision 62 (Jack, 29 Sep): "Choosing the mechanic on a booking request uses pills … the shop's mechanics and the shared queue … on the request pop-up." Drawn on `request-new`; not built (`request-dialog.tsx` said "Not here yet"; the board's "Things the server cannot do yet").

## What changes
- The request pop-up shows **Mechanic** pills: each active mechanic, then Shared queue, with the request's own mechanic picked.
- **Accept** sends the mechanic when another was picked. The server checks that mechanic is free at the booked time under the day's lock, accepts, and moves the job and its held time to them, together; a clash is refused as the job's own save refuses it, and the request waits as it was.

## Impact
`server/routes/workshop.js` (workshop server, flagged for Mark); `src/screens/diary/request-dialog.tsx`, `change-details-dialog.tsx` (its Pill shared). Tests: `tests/workshop-accept-mechanic.test.js`, `tests/screens/diary-answer.test.js`.
