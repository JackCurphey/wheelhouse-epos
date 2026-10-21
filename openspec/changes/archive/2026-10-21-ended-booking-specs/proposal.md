# The workshop-jobs spec says what ended bookings can't do

## Why
#351 made the server refuse to book in, start, hold or reopen a job whose booking was cancelled, declined or expired (issue #190 A; decision 5 of `docs/decisions/2026-10-15-job-page-fixes.md`). Collecting a bike already in the shop stays allowed. But `openspec/specs/workshop-jobs/spec.md` still says those moves "SHALL NOT depend on the booking", with scenarios booking in and starting a cancelled job. It also says the old app's save can reopen an ended booking, and #351 removed that save's status. Mark's review issue #354 (item 4) lists this.

## What changes
- Three requirements are reworded to match the server as built. No code changes.
  - **Bike moves:** booking in is refused on an ended booking. Collecting and bringing a bike back are not.
  - **Work moves:** start, hold and reopen are refused on an ended booking, with the server's own words.
  - **Booking moves:** declined, expired and cancelled are final. Nothing reopens them.

## Impact
`openspec/specs/workshop-jobs/spec.md`, through this change's delta. The scenarios match `tests/workshop-ended-booking-actions.test.js`.
