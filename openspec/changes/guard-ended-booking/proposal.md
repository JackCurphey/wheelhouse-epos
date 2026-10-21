# Proposal: a booking that has ended can't be booked in or started

## Why

Issue #190 A: the `workshop-jobs` spec lets staff book in a bike, or start
work, on a booking that was cancelled, declined or has expired ("These moves
SHALL NOT depend on the booking"). The job page already offers no next step, and
"Bike is here" can't be turned on, for an ended booking (the `workshop-jobs`
spec's job page requirements; Jack's section of `decided-while-building.md`,
15 Oct, plain refusals, item 3), but the server still obeys a request sent
anyway, from an old screen or a stale tab. Jack, 16 Oct, item 5 of the same
file: an ended booking whose bike is already in the shop keeps "Bike is here"
on, because the bike really is there; stopping the server booking in or
starting work on an ended booking "is Mark's, when he is back".

## What Changes

- **Server:** on a cancelled, declined or expired booking, the job's book in,
  start, hold (of work not yet started) and work reopen are refused with the
  code "illegal" and words naming why, such as "This booking was cancelled, so
  the job can't be booked in." or "This booking expired, so the job can't be
  started."
- A bike already in the shop on an ended booking can still be collected, and
  a collected one brought back (custody reopen): the bike is really there
  (item 5).
- A booking request still waiting (pending) can still be booked in, as before.
- No screen changes: the job page already offers none of these buttons on an
  ended booking, and shows the shop's words for any refusal.

## Lane, work package, drawings and decisions

- **Work package:** the job page's fixes from #190, taken early with stage 1's
  workshop (as `job-page-hold-words-notes` was).
- **Lane:** Mark's (server). The guard is in `server/workshop/transitions.js`
  (`applyEvent`, the one place a job's state changes); Jack's
  `server/routes/workshop.js` is not touched.
- **Drawings:** none show it (the decision says "No screen change").
- **Decisions:** `docs/decisions/2026-10-15-job-page-fixes.md` item 5
  (16 Oct, issue 190 A); the refusal words follow Jack's plain refusals
  (`decided-while-building.md`, Jack's section, 15 Oct). Two calls are
  logged in Mark's section of `decided-while-building.md` for Jack to overrule.

## Out of scope

- Any screen change; the job page's words for this refusal (Jack's).
- Work already under way when staff cancel a booking: it can still be held,
  wait for parts, resume and be finished, so it can be wrapped up.
- The old app's save: it no longer changes a job's status at all.
- Payment finishing the work (`sales.js`): unchanged.

## Impact

- Server: `server/workshop/transitions.js`
- Tests: `tests/workshop-ended-booking-actions.test.js`
- Spec: `workshop-jobs` (the bike and work move requirements; a new refusal)
