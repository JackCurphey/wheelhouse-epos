# Phase 4a - Book journey plan

> **Status: STOPPED at the Task 7 contract, item 3** (written 23 Sep). Every
> book screen needs at least one endpoint that does not exist. Task 7 says a
> plan in that position "says so and stops - it does not invent one". This
> file records the contract check so far, the missing endpoints, and the
> decisions Jack needs to make before the tasks can be written. No code comes
> from it yet.
>
> **23 Sep, Jack decided J1, J3 and J4** (`docs/decisions/2026-09-23-book-journey-routing-and-modes.md`): customer screens under
> `/book`; timed, drop-off and appointment-only all Release 1; deposits out,
> not blocked. **J2 is still open.**

**Parent plan:** `docs/superpowers/plans/2026-09-20-phase-4-screens.md` (Task 7
is the contract; execution order row 2).
**Spec:** `docs/superpowers/specs/2026-09-20-release-1-screen-build-design.md`.
**Screen data:** `docs/design/release-1-journey/screen-index.json` (ids,
numbers, branches), `docs/design/release-1-journey/screens.js:32-37` (markup).

## Contract item 1: the screens (count 6, matches)

All six have `"group": "book"`, `"role": "Customer · phone"`, `"mobile": true`.

| # | id | Title | Next | Branches |
|---|---|---|---|---|
| 01 | `service` | Choose a service | problem | Unknown problem -> `diagnosis` |
| 02 | `service-list` | Choose an individual service | problem | - |
| 03 | `problem` | Describe the bike & problem | date | - |
| 04 | `date` | Choose drop-off or appointment | details | Timed booking -> `appointment`; No availability -> `full` |
| 05 | `details` | Contact & update preferences | pending | - |
| 06 | `pending` | Request received | requests | Automatic acceptance -> `confirmed` |

Entered from outside the group: `appointment` (42), `full` (43), `rejected`
(49), `expired` (50) -> `date`; `cancelled` (47), `service-status` (63) ->
`service`.

## Contract item 2: files and routes - blocked on a decision

The planned files are `src/screens/book/<id>.tsx`, one per screen above. But
**all six are customer screens**, and `ROUTES` must sit under `/workshop`
(`tests/screens/routes.test.js`), the staff app. The existing customer booking
page is `/book`, served from `public-portal/`. STATUS already asks Jack this
about five customer edge screens; the book group makes it six more, and the
whole of the customer's first journey. **Decided (J1): `/book`**, with a
second Vite entry and a customer route table, `src/screens/book/<id>.tsx`
unchanged.

## Contract item 3: endpoints - STOP

Checked 23 Sep against `server/server.js` on this branch. No route's
`screens:` comment names a book screen.

| Screen | Exists | Missing |
|---|---|---|
| `service` | `GET /api/portal/:shopSlug/mechanics` (:3975) returns three hardcoded job types (`PORTAL_JOB_TYPES`, :3968), no prices | **A public list of the shop's bookable services with prices.** `GET /api/workshop-services` (:3564) exists but is staff-only. `bookable_online` exists in the schema (migration 015) and the portal ignores it. |
| `service-list` | - | **Services grouped by shop-defined category** (note 01). There is no category column (migration 014), so this is a schema change too. |
| `problem` | Bike inline as `newBike` on the booking POST (:4154-4170) | **Service questions** (the atlas's radio question): no table, no route. Customer photo/video upload: attachments (:3072) are staff-only. |
| `date` | `GET /api/portal/:shopSlug/availability` (:3994) returns `{busy, fullDays}` | **A drop-off (untimed) booking**: the POST rejects a request with no `startTime` (:4113) or no `mechanicId` (:4117). **The shop's booking mode** (note 03) is not returned to the portal. |
| `details` | `POST /api/portal/:shopSlug/bookings` (:4075): `guestName`, `guestPhone`, `jobDate`, `description`, `jobType`, `startTime`, `mechanicId`, `bikeId`/`newBike` | **Email, update channel (Email/SMS/WhatsApp), terms consent, marketing permission**: no field, no column. |
| `pending` | The POST's response (`serializePortalBooking`, :2395) | **A booking reference** (atlas shows WH-1042) and **a way for a guest to read the request back**: `GET /api/portal/:shopSlug/bookings` (:4066) needs a customer session, which a guest does not have. |

**None of the book writes is a version-guarded job action** (the fifteen are
at :2982-3017), so contract item 4's `version` rule does not apply here. The
booking POST's capacity-race 409 (:4203) carries no `code`, so
`src/lib/api/client.ts` classifies it `unknown`. That matters for contract
item 5 on `date`/`details`, and it is a server change as well.

Items 4-12 are not assessed until the endpoints exist.

## What unblocks it

A server-side prerequisite plan, like Phase 3's quote reads were for the quote
journey. Its scope depends on J2-J4 below. Each gap above is one task with a
test first. Two need schema changes (service categories; contact and consent
fields), which are ask-first changes under the project rules.

## Decisions for Jack

- **J1 - DECIDED 23 Sep: `/book`.** Where the customer screens live. (1) Under `/workshop` in the staff
  app, as the parent plan says. One React app, but the customer's pages sit
  in the staff app's URL space, beside its sign-in. (2) Under `/book`,
  replacing the current `public-portal/` booking page. Matches where
  customers already go; needs a second Vite entry and a `/book` route table,
  and it replaces the live booking page when it ships.
- **J2 - which gaps are Release 1.** Service questions, customer photo
  upload, the update-channel choice, and guest read-back could each be in or
  deferred. (The spec's note table, rows 27 and 68, records Jack's note for
  "a variable number of customer questions" - that may already settle service
  questions.) The scope file
  (`docs/decisions/2026-09-10-release-1-scope-reduction.md`) does not settle
  them. Service categories are already decided in:
  `2026-09-20-phase-0-atlas-revision.md:24` says "grouped by shop-defined
  category on the second page".
- **J3 - DECIDED 23 Sep: all three modes are Release 1.** Booking modes. The same line records three modes: timed,
  drop-off, and "appointment only", where walk-ins join an untimed shared
  queue. The settings route accepts only `timed` or `dropoff` (:3484), and
  the portal can make only a timed booking. So the prerequisite plan needs
  the third mode and an untimed booking. Confirm both are Release 1.
- **J4 - DECIDED 23 Sep: out, not blocked; the two stale lines are
  corrected.** Deposits (note 04). The sources disagree. Out: the scope reduction
  (Later, :19), `docs/design/release-1-journey/README.md:54`, and the Phase 0
  atlas revision plan (:24, under "decisions already made - do not re-open").
  Open: the parent plan (:1207) and the spec's note table (:97), "blocked on
  Mark". Probably those two lines are stale. Confirm, and they get corrected.

Design calls (Task 7 item 12) also wait: the registry has no date picker,
calendar, radio, checkbox, select, textarea or file input, and `date`,
`problem` and `details` need them. Adding each one is a design decision for
Jack.
