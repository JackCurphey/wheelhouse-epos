# Phase 4a - Book journey plan

> **Status (25 Sep): the Task 7 item 3 stop is lifted.** The server
> prerequisite pieces 1-6 are merged (#64-#71) and every book screen has a
> supplying route (re-checked below against `main` at `86f814b`). Two things
> still block the `pending` screen (below), and the design calls (Task 7 item
> 12) are Jack's. The task list is not written yet; no code has come from this
> plan.
>
> **23 Sep, Jack decided J1-J4** (`docs/decisions/2026-09-23-book-journey-routing-and-modes.md`): customer screens under
> `/book`; two booking modes (exact appointments, drop-off days), both
> Release 1; deposits out, not blocked; all four J2 gaps are Release 1.

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

## Contract item 3: endpoints - re-checked 25 Sep, no longer a stop

Re-read against `server/server.js` on `main` at `86f814b` (a read of the code,
no requests run). The 23 Sep gap table is closed by #64-#71. Line numbers are
from that commit and will drift.

| Screen | Supplied by | Status |
|---|---|---|
| `service`, `service-list` | `GET /api/portal/:shopSlug/services` (:4464). `showPrices`, `full[]`, `categories[]`, `uncategorised[]`; each service `{id, name, price, minutes, questions}`; `price` is null when the shop hides prices; only active, bookable-online services. "Not sure" is `notSure: true` on the booking POST. | Ready |
| `problem` | Booking POST (:4597): `description` (required), bike as `newBike` or `bikeId`, `answers` checked against the service's `questions`, `photos` (up to 5, 10 MB each, JPEG/PNG/WebP, sent as bare base64 - see `server/booking-photos.js`). | Ready |
| `date` | `GET .../mechanics` (:4442) and `GET .../availability?start&end&minutes` (:4516): mode is **per date** (`timed` or `dropoff`), with start times per mechanic or a drop-off window. A mechanic must be chosen in both modes. 409 refusals carry `code: 'capacity'`. | Ready |
| `details` | Booking POST: `guestName`, `guestPhone`, `email`, `updateChannel` (one choice, not several), `termsAccepted` (must be true), `marketingPermission`. Rules in `server/booking-request.js`. | Ready |
| `pending` | POST 201: `reference`, `jobDate`, `startTime`, `status`, plus `privateLink` (shown once). `GET .../booking-links/:code` (:4829): `reference`, `shopName`, `jobDate`, `startTime`, `serviceName`, `description`, `answers`, `bike`, `stage`, `photoCount`; 404 unknown, 410 after 30 days past the booked date, 429 over 30 tries per 15 minutes. | **Partial** - see below |

**Item 4 (version rule):** does not apply; the booking POST is not one of the
version-guarded job actions, so the client uses `apiMutate`.
**Item 5 (409 with a code):** closed; the booking POST's capacity 409s now carry
`code: 'capacity'`, which `src/lib/api/client.ts` classifies. 400s are
`{ error }` with a message written to be shown, which the client classes
`unknown`.
**Item 6 (money never totalled in JavaScript):** the server totals nothing;
screens show a service's `price` as given.
**Items 7-12:** client, test and design work; unaffected by the server.

### Decided 25 Sep (Jack), both checked directly in the code first

1. **Automatic acceptance does not exist** (the booking POST always writes
   `booking_state = 'pending'`). **Decision A1:** it stays out of Release 1;
   `pending` is the only outcome and screen 06 loses its `confirmed` branch.
2. **The booked price never reached the customer.** **Decision B1:** `pending`
   shows it, following the shop's `show_prices_online` setting (off means no
   price after booking either). Server change is piece (a):
   `docs/superpowers/specs/2026-09-25-book-a-booked-price-design.md`.
3. **Split into four pieces, each with its own spec and pull request:**
   (a) booked price in the booking reply and link read-back; (b) the customer
   shell at `/book` (second Vite entry, customer route table, serving); (c) the
   missing form controls in the registry, each approved by Jack; (d) the six
   screens and their journey test.

### Smaller points

- `/mechanics`, the booking POST and `/booking-links/:code` have no `screens:`
  comment; `/services` and `/availability` do. Whether the screen-trace check
  needs them has not been looked at.
- Nothing serves the private-link page: the link is `/book/<slug>/booking/<code>`
  but `/book` still serves `public-portal/`. Front-end scope (J1's second Vite
  entry), not a server gap.
- The atlas `date` note says a shop can offer both modes; J3 forbids it and the
  server supports one mode per date. The atlas wording is stale.
- The server records `update_channel` but sends nothing; screens must not
  promise a message goes out.
- A "not sure" booking takes a 60-minute slot.

## Decisions for Jack

- **J1 - DECIDED 23 Sep: `/book`.** Where the customer screens live. (1) Under `/workshop` in the staff
  app, as the parent plan says. One React app, but the customer's pages sit
  in the staff app's URL space, beside its sign-in. (2) Under `/book`,
  replacing the current `public-portal/` booking page. Matches where
  customers already go; needs a second Vite entry and a `/book` route table,
  and it replaces the live booking page when it ships.
- **J2 - DECIDED 23 Sep: all four are Release 1.** Which gaps are Release 1. Service questions, customer photo
  upload, the update-channel choice, and guest read-back could each be in or
  deferred. (The spec's note table, rows 27 and 68, records Jack's note for
  "a variable number of customer questions" - that may already settle service
  questions.) The scope file
  (`docs/decisions/2026-09-10-release-1-scope-reduction.md`) does not settle
  them. Service categories are already decided in:
  `2026-09-20-phase-0-atlas-revision.md:24` says "grouped by shop-defined
  category on the second page".
- **J3 - DECIDED (corrected 24 Sep): two modes, exact appointments or
  drop-off days, both Release 1; no "both" option.** The settings route
  already accepts these two (`timed`/`dropoff`, :3484), but the portal can
  make only a timed booking and never reads the mode. So the prerequisite
  work needs an untimed (drop-off) booking.
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
