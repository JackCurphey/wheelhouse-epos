# Book server work, piece 2: booking modes and capacity

**Date:** 2026-09-24. **Approved in session by Jack** (design, 24 Sep; each
section below approved in turn).
**Serves:** book screen `date` (04) and its branches `appointment` (42) and
`full` (43); staff screens `diary` (25), `queue` (26), `week` (36), `month`
(37), `hours` (67), `booking-settings` (68). Screens themselves are not built
here.
**Part of:** the server prerequisite work for journey plan 4a, piece 2 of six
(`2026-09-24-book-server-1-service-list-design.md:8`). **Built as two pull
requests, 2a then 2b, each with its own plan.**

**Changed during build (24 Sep):** the 2a schema section below was updated to
match what 2a actually built - see the plan's decision log,
`.superpowers/sdd/2026-09-24-book-server-2a-availability/decision-log.md`,
decisions 1-5.

## Decisions this rests on

Earlier, and not re-opened:
- Booking mode is **per shop**, two modes only: `timed` (exact appointments)
  and `dropoff` (drop-off days); no "both" option
  (`docs/decisions/2026-09-04-booking-mode-and-downtime.md` §2;
  `2026-09-23-book-journey-routing-and-modes.md` J3).
- Drop-off capacity is **summed minutes against the day**; timed capacity is
  **slot collision** (4 Sep §3).
- **Staff are never capacity-gated** (4 Sep §7.7).
- Downtime is modelled as **blocks**, not only a flat reserve (4 Sep §4.4).

Decided by Jack in this session (24 Sep):
1. **Drop-off mode: the customer picks a mechanic**, and capacity is per
   mechanic per day. Closes 4 Sep §6.2.
2. **A mode change takes effect from a date the shop chooses.** Bookings made
   before the switch keep their shape: nothing is converted. Closes 4 Sep §6.1.
3. **Timed-mode walk-ins in the shared queue** (no mechanic, no time) use
   capacity **split evenly across the mechanics working that day**.
4. **Blocks are in piece 2**, three kinds: per-mechanic weekly repeats (lunch),
   per-mechanic date ranges (leave), shop-wide closed dates. A booking already
   on a date that later gets blocked **stays**, and is reported to staff.
5. **Opening hours per weekday** are in piece 2 (atlas screen 67 shows
   Saturday 09:00-17:00).
6. **Approach: one capacity calculator, computed on every read** - no stored
   tallies. Piece 2 splits into 2a and 2b.
7. The reserve (`full_day_threshold_minutes`) stays; **its default becomes 0**
   for new shops, since blocks now carry lunch. Existing shops keep theirs.

## What exists (verified 24 Sep on `main` 9291119)

- `015_booking_mode.sql`: `workshop_settings.booking_mode` (`timed` default),
  `dropoff_window_start/end` ('09:00'/'10:00'), `timed_lead_minutes` (30),
  `unspecified_job_minutes` (60). Only the settings route reads the mode
  (`server/server.js:3443`, `:3484-3487`).
- `016`: `workshop_jobs.planned_minutes` - declared for drop-off, never read or
  written.
- `018`: `workshop_capacity_holds`, written only for timed jobs by
  `createWorkshopJob` (`:2581-2635`); partial unique index on exact start time
  only (`018:29-31`). No lock: overlapping bookings with different start times
  are caught only by the unlocked `checkJobSlot` (`:2646-2691`).
- `GET /api/portal/:shopSlug/availability` (`:4151-4196`): counts only rows
  with a start time, **ignores booking state** (cancelled jobs count), returns
  `{busy, fullDays}`.
- `POST /api/portal/:shopSlug/bookings` (`:4232-4366`): requires `startTime`
  and `mechanicId`; length from hardcoded `PORTAL_JOB_TYPES` (`:4092`); 409 on
  hold conflict carries no `code` (`:4357-4361`).
- `PUT /api/workshop-jobs/:id` re-checks the slot but **does not move the
  hold** (`:2746-2844`).
- The old booking page (`public-portal/portal.js`) asks availability one
  mechanic at a time over **7 days** (`:255-263`) on a **30-minute** grid, and
  reads `busy[]`, `fullDays[]` and `/mechanics`' `openingTime`, `closingTime`,
  `openingDays`. It must keep working until the new journey is green (J1).
- "Today" on the server is the UTC date (`:3978`); there is no shop timezone.

## 2a - when a mechanic is available

### Schema: migration `023_capacity_blocks.sql` (one file)

- **`workshop_settings.weekday_hours`**: `TEXT NOT NULL DEFAULT '{}'`, JSON
  keyed by weekday (0 = Sunday, as `opening_days`), holding **only the days
  whose hours differ** from `opening_time`/`closing_time` -
  `{"6": {"open": "09:00", "close": "17:00"}}`. `'{}'` means every open day
  uses the usual hours, which is today's behaviour, so **no backfill** is
  needed. `opening_days` still says which days are open.
- **`workshop_unavailability`**: `id`, `shop_id`, `employee_id` (NULL =
  shop-wide), `kind TEXT CHECK IN ('weekly','dates')`, `weekdays SMALLINT[]`
  (weekly only), `start_date`, `end_date` (dates only, `end_date >=
  start_date`), `start_time`, `end_time` (both NULL = all day), `reason TEXT`,
  timestamps. Checks: weekly rows have a mechanic and times; shop-wide rows are
  `dates` and all-day.
- **`workshop_settings`** gains `next_booking_mode` (NULL or `timed`/`dropoff`)
  and `next_booking_mode_from TEXT` (format-checked `YYYY-MM-DD`, matching
  `job_date` - `pg` would otherwise hand back JavaScript `Date` objects that
  compare wrongly against string dates), both NULL or both set. (Written by
  2b; added here so the schema is one migration.)
- `full_day_threshold_minutes` stays default 120 at the column; `createShop`
  inserts 0 for every new shop, so existing tests that rely on the column
  default keep working. Existing shops keep theirs.
- Both new tables: ENABLE and FORCE row-level security with a
  `*_shop_isolation` policy, as `014`/`022`.

### The calculator (one module, server-side)

For a shop, a date range, and optionally one mechanic, per mechanic per day:

1. **Working windows** = that weekday's opening hours, if the mechanic's
   `working_days` include it and no shop-wide block covers the date.
2. **Minus blocks**: weekly blocks for this weekday, date blocks covering this
   date (all-day blocks remove the day).
3. **Minus live work**: jobs whose `booking_state` is `pending`, `scheduled` or
   `reschedule_requested`. Timed jobs cut their interval out of the windows.
   Untimed jobs assigned to the mechanic subtract `planned_minutes`. Unassigned
   untimed jobs on that date subtract `planned_minutes / n`, n = mechanics with
   non-empty working windows that day (none working: counted nowhere).
4. **Minus the reserve.**

Output: `freeMinutes` and `freeWindows` per mechanic-day, plus the mode for
the date (`next_booking_mode` if `date >= next_booking_mode_from`, else
`booking_mode`). Rules, for a job of N minutes:
- **timed**: a start time on the 30-minute grid is offered if `[start,
  start+N)` lies inside one free window and `freeMinutes >= N`.
- **dropoff**: the day is bookable if `freeMinutes >= N`.

### Customer calendar: `GET /api/portal/:shopSlug/availability`

- Existing fields unchanged in shape. `busy[]` now **also** carries blocks and
  closed time as intervals with no reason (the old page already shades busy
  time as "Unavailable"). `fullDays[]` comes from the calculator.
- New optional `minutes` query parameter. When present, the response adds
  `days: [{date, mode, dropoffWindow?, mechanics: [{mechanicId, startTimes? |
  bookable?}]}]` - `startTimes` for timed dates, `bookable` and the shop's
  drop-off window for drop-off dates.
- Never returned to a customer: block reasons, other customers' jobs, minute
  totals.
- Range capped at **62 days** (400 beyond); the old page asks for 7.
- `GET /api/portal/:shopSlug/mechanics` keeps `openingTime`/`closingTime` as
  the earliest open and latest close across the week, so the old page's grid
  still spans the day; the server's booking check is the authority.

### Staff endpoints

- **Opening hours**: `GET/PUT /api/workshop-settings` gains `openingHours:
  [{weekday, open, close}]`. The legacy `openingTime`/`closingTime`/
  `openingDays` still work: saving them changes the usual hours; a day with
  its own hours (in `weekday_hours`) keeps them, since the old page sends
  opening time on every save (including a save that only changes the
  reserve), and rewriting every open weekday would silently delete a day's
  own shorter hours.
- **Blocks**: `GET /api/workshop-unavailability?start&end`, `POST`, `PUT /:id`,
  `DELETE /:id`. `POST`/`PUT` return `{block, clashes: [...]}` - live bookings
  the block overlaps.
- **Capacity view**: `GET /api/workshop-capacity?start&end` - the calculator's
  full output per mechanic-day, reasons and clashes included. For the diary,
  week, month and hours screens.
- Same staff authentication as the existing settings routes; shop isolation by
  row-level security. Each route carries its `screens:` comment.

### Refused (400, with a message)

End before start; weekly block without a mechanic or times; shop-wide block
that is not whole days; a mechanic from another shop (404, no disclosure);
weekday outside 0-6; opening close not after open.

Note: the customer booking POST already uses the calculator in 2a (not only
from 2b) - without it, 2a would show lunch as unavailable on the calendar
while the booking route still accepted a booking into it. 2b still owns
drop-off bookings, the lock, and the `capacity` code.

## 2b - booking in either mode

- **Customer booking POST** reads the mode for `jobDate`:
  - timed: `startTime` and `mechanicId` required (as now);
  - dropoff: `mechanicId` required, `startTime` refused (400).
  Every new booking writes `planned_minutes` (the job's length).
- **One at a time per shop and date**: every booking write (customer or staff,
  create or move) takes a transaction-scoped advisory lock on `(shop_id,
  job_date)`, runs the calculator, then writes. A move to another date locks
  both dates, lower first. The `018` unique index stays as a second guard.
- **Capacity refusal**: 409 with `code: 'capacity'`; the message text the old
  page shows is unchanged. `src/lib/api/client.ts` learns the code.
- **Holds**: drop-off bookings take a hold with minutes and no start time.
  Moving or resizing a job moves its hold (fixes `PUT /api/workshop-jobs/:id`).
- **Walk-in queue**: `POST /api/workshop-jobs` accepts `plannedMinutes` with no
  mechanic and no time. Assigning a mechanic moves its whole length onto that
  mechanic. Staff are never refused for capacity.
- **Scheduled mode change**: `PUT /api/workshop-settings` accepts
  `nextBookingMode` + `nextBookingModeFrom` (must be after today, UTC as the
  server's existing convention), or both null to cancel. Existing bookings are
  untouched.

## Testing

Test first for every behaviour; each new test is watched failing against a
named break, and the break is confirmed to have landed. At least:
- a weekly lunch block removes those start times; a shop-wide closed date
  removes the day for every mechanic; leave removes it for one;
- no block reason appears in any portal response;
- Saturday's shorter hours are honoured; the backfill copies existing hours
  onto each open day, on a database with shops in it and from empty;
- cancelled, declined and expired jobs no longer use capacity;
- a date before the switch uses the old mode, on/after it the new one;
- a drop-off day accepts bookings until full, then refuses with `capacity`;
- two simultaneous bookings for Sam at 14:00 (90 min) and 14:30: exactly one
  succeeds, the other gets 409 `capacity`;
- an unassigned walk-in's minutes split across the mechanics working;
- a moved booking's hold moves with it;
- adding a block returns the bookings it clashes with;
- every existing old-page test passes unchanged.

## Done when

For each of 2a and 2b: every command in STATUS's canonical list exits 0 on
the branch and in CI, each new test has been seen to fail against its break,
and migration 023 applies on an empty database.

## Not in scope

The React customer and staff screens (plan 4a, the screens plan); booking
length from the chosen service and 60 minutes for "Not sure" (piece 3); a
mechanic's own hours differing from the shop's other than by blocks; a shop
timezone; deposits (out of Release 1).
