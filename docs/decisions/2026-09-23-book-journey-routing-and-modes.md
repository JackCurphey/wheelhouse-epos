# Book journey: customer screens under /book; two booking modes, both in Release 1

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
  journey is green end to end. **Changed 25 Sep (Jack):** nobody uses the old
  page, so the new customer app takes all of `/book` straight away (piece (b),
  `docs/superpowers/specs/2026-09-25-book-b-customer-shell-design.md`). The
  old page stops being served; its `public-portal/` files are deleted in a
  later clean-up.
- The parent plan puts the five customer edge screens (reschedule, cancel,
  expired, preferences, service-status) in the staff `ROUTES` under
  `/workshop`. Moving them is a follow-on this decision implies; it is not
  done yet.

## J3 - two booking modes, both Release 1 (corrected 24 Sep)

The shop picks one of **two** modes: **exact appointments only** or
**drop-off days only**. There is no "both, customer chooses" option.

*Correction:* on 23 Sep this record said three modes (timed, drop-off,
appointment only). Jack clarified on 24 Sep: two. The atlas `booking-settings`
screen offers a third, "Both - customer chooses"; that option is not to be
built. "Appointment only" in the Phase 0 plan (:24, :236) is the exact-
appointments mode. Under it customers get no drop-off day, and staff put a
walk-in into an untimed shared queue that uses capacity without holding a slot.

The settings route already accepts exactly these two, as `timed` and
`dropoff` (`server/server.js:3484`). What is missing is the booking itself:
the portal booking POST can make only a timed booking (it requires
`startTime` and `mechanicId`), and the portal does not read the mode. Both
belong in the server prerequisite work for 4a.

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

## 24 Sep - service categories and the first booking screen

- **Categories are one level deep:** category -> services, no subcategories.
- **The first booking screen has three fixed options:** Full services (opens
  a short list of the shop's full services), Individual services (opens the
  category list), and Not sure (skips to describing the problem). Each online
  service is marked full or individual. Detail:
  `docs/superpowers/specs/2026-09-24-book-server-1-service-list-design.md`.

## 24 Sep - booking modes and capacity (piece 2)

Decided by Jack in session. Detail:
`docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md`.
- **Drop-off mode: the customer picks a mechanic**; capacity is per mechanic
  per day.
- **A mode change takes effect from a date the shop picks**; existing
  bookings keep their shape.
- **Timed-mode walk-ins** with no mechanic use capacity split evenly across
  the mechanics working that day.
- **Blocks are Release 1**: per-mechanic weekly (lunch), per-mechanic dates
  (leave), shop-wide closed dates. Bookings on a newly blocked date stay and
  are reported to staff.
- **Opening hours per weekday.**
