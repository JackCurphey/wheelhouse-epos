# Book journey: customer screens under /book; all three booking modes in Release 1

Date: 23 September 2026. **Status: decided by Jack in session.** Record of
four decisions raised by the stopped journey plan 4a
(`docs/superpowers/plans/2026-09-20-phase-4a-book.md`, J1-J4). No code
behaves this way yet.

## J1 - the customer screens live under `/book`

All six book screens are customer screens on a phone. They go under `/book`,
replacing today's customer booking page (`public-portal/`, served at `/book`),
not under the staff app's `/workshop`.

Consequences:
- A second Vite entry and a customer route table. The staff `ROUTES`
  (`src/staff/routes.ts`) stays `/workshop`-only, as
  `tests/screens/routes.test.js` enforces.
- Replacing a live page: the old booking page keeps serving until the new
  journey is green end to end.
- The parent plan puts the five customer edge screens (reschedule, cancel,
  expired, preferences, service-status) in the staff `ROUTES` under
  `/workshop`. Moving them is a follow-on this decision implies; it is not
  done yet.

## J3 - drop-off and "appointment only" are both Release 1

The shop's booking mode has three values: timed, drop-off, and appointment
only, where walk-ins join an untimed shared queue (recorded in
`docs/superpowers/plans/2026-09-20-phase-0-atlas-revision.md:24`). Today the
settings route accepts only `timed` or `dropoff` (`server/server.js:3484`),
and the portal booking POST can make only a timed booking (it requires
`startTime` and `mechanicId`). Both gaps belong in the server prerequisite
plan for 4a.

## J4 - deposits are not blocked on Mark

Deposits are out of Release 1, as the scope reduction (Later) and the Phase 0
atlas revision already said. The two lines that still said "blocked on Mark's
Tallboys reference" (the Phase 4 screens plan, and the screen-build design's
note table) are corrected to point here.

## J2 - all four gaps are Release 1

Service questions, customer photo/video upload, the update-channel choice
(Email / SMS / WhatsApp), and guest read-back of a booking request are all in
Release 1, and belong in the server prerequisite plan for 4a with the
endpoints listed in the plan's item 3 table.
