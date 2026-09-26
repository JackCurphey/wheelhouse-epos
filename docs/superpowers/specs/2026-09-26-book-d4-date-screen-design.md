# Book (d4): the date screen

**Date:** 2026-09-26. **Follows:** d3 (#82) and **server piece 10** (no
past or too-soon times; own spec and PR), which must merge first.
**Changes:**
- the atlas mock-up for `date` (`docs/design/release-1-journey/screens.js`):
  no "Drop-off day / Exact appointment" toggle (the shop's mode is per day,
  from `/availability`); timed days use the mechanic diary from piece (c);
  the "No suitable day?" link is dropped here (its `full` screen is the
  "that day was just taken" case, which belongs to sending, d5).
- d3's `RequireDraft`: it gains a redirect target.

## Why

The third step of the customer booking journey at `/book`: the customer
picks a day, and on a timed-appointment day a mechanic and a start time.

## Decisions (Jack, 26 Sep)

1. **Mechanic: "Any mechanic" by default, with the option to choose.**
2. **Timed days use the one-day mechanic diary** approved in piece (c)
   (decision 5 of `2026-09-26-book-c-form-controls-design.md`, brought over
   from the original booking page): mechanic pills, hours down the side,
   booked time as grey blocks, one button per free start time. When it opens
   **every mechanic is shown**, one column each; tapping a free time picks
   that mechanic and time. Chosen over showing two and over a merged "Any
   mechanic" column.
3. **Drop-off days**: the drop-off window and a mechanic choice starting on
   "Any mechanic", unavailable mechanics greyed.
4. **About two months ahead**: this month and next, starting today.
5. **No past or too-soon times**, enforced by the server (piece 10), not
   only hidden on screen.

## The screen: `date` (`/book/:shopSlug/date`)

- `BookFrame` step 3. Back link to `/book/:shopSlug/problem`. Heading: "When
  can you drop in?". Action: "Continue".
- **Guard:** once `/services` has loaded, the screen requires
  `hasProblem(draft, services)`; otherwise it redirects to
  `/book/:shopSlug/problem`.
- **Job length:** the ticked services' summed `minutes`
  (`service-selection.ts` `totalMinutes`), or 60 for "Not sure" (the
  server's "not sure hour").
- **Calendar:** `MonthCalendar`, this month and next only. A day is
  available when `/availability` returns it with at least one mechanic who
  has a start time (timed) or is `bookable` (drop-off). Other days are
  greyed and struck through (the control's own behaviour).
- **Timed day:**
  - a multi-select `PillGroup` of the shop's mechanics, all on when the day
    is picked; the last one on cannot be turned off;
  - a `DayDiary` with one column per selected mechanic: hours from the
    shop's widest opening and closing times (`/mechanics`), start times from
    that day's `startTimes`, and grey "Unavailable" wherever the column has
    no start time (too soon, too short, booked, not working) — Jack, 26 Sep;
  - tapping a free time saves the day, mechanic and start time.
- **Drop-off day:**
  - "Drop off between <start> and <end>" from the day's `dropoffWindow`,
    then "We'll confirm once the shop has looked at your request";
  - a single-choice `PillGroup` "Mechanic": "Any mechanic" (default), then
    each mechanic, those not `bookable` that day disabled;
  - on Continue, "Any mechanic" becomes the first bookable mechanic in the
    shop's order; the draft records `anyMechanic` too, so going back shows
    "Any mechanic" selected again rather than the resolved mechanic (Jack,
    26 Sep, `.superpowers/sdd/d4-followups/brief.md`).
- **Pinned summary** above Continue: "<Weekday> <d> <Month>, <HH:MM> with
  <mechanic>" (timed) or "<Weekday> <d> <Month>, drop off <start>–<end>"
  (drop-off); empty until a day is picked.
- **Continue** stays on the screen with a message under the summary
  (announced to screen readers):
  - no day picked: "Choose a day";
  - a timed day with no time: "Choose a time";
  - otherwise it saves and goes to `/book/:shopSlug/details`.
- **Saved choice no longer free** (after a refresh, or availability
  refetched): the day, mechanic and time are cleared and "Your chosen time is
  no longer available - please choose another" shows above the calendar
  until the next pick (wording, Jack, 26 Sep,
  `.superpowers/sdd/d4-followups/brief.md`). A drop-off choice made with "Any
  mechanic" whose stored mechanic stops being bookable is not treated as
  taken: it is silently re-resolved to another bookable mechanic, with no
  message; only when no mechanic is bookable that day is it cleared as taken
  (same brief).
- **No free day at all** in the range: "There are no free days in the next
  two months - please contact the shop" in place of the calendar.
- Loading and errors for `/availability` and `/mechanics` follow
  `BookFrame`'s existing states (loading; failed with "Try again").

## Draft changes (`draft.tsx`, `require-draft.tsx`)

- The draft's existing `date`, `mechanicId` and `startTime` are used as they
  are. A drop-off day stores no `startTime`. `mechanicId` is always a real
  mechanic, resolved on Continue when "Any mechanic" was chosen. A new
  optional `anyMechanic?: true` (drop-off days only) records that the
  customer chose "Any mechanic": it is not resolved away, so going back shows
  it selected again; picking a named mechanic, a new day, or a timed time
  clears it (Jack, 26 Sep, `.superpowers/sdd/d4-followups/brief.md`). d5 must
  send the real `mechanicId` and may ignore `anyMechanic`.
- `RequireDraft` gains an optional redirect target (default: the first
  screen, as today). `date` uses `problem`.
- A new guard `hasDate(draft)` (a date and a mechanic, and a start time
  when one was chosen) for d5 to apply.

## Rules (`src/screens/book/date-rules.ts`)

Pure functions, no React: available days; the diary's columns for the
selected mechanics; whether a saved choice is still free; resolving "Any
mechanic"; the summary text; the Continue message. The screen only calls
these.

## Data

- `GET /api/portal/:shopSlug/mechanics`: names, `openingTime`,
  `closingTime`.
- `GET /api/portal/:shopSlug/availability?start=<today>&end=<last day of
  next month>&minutes=<job length>`: `days` (mode, per-mechanic start times
  or `bookable`, drop-off window) and `busy`. "Today" is the shop's today
  as piece 10 defines it.
- New React Query hooks beside `services-query.ts`.

## Open items settled here

- The diary stretching for very short services (piece (c)): left as is;
  judged on the built screen with real services.
- `MonthCalendar`'s `h2` sits under the screen's `h1`: correct order, no
  change.
- Whether available days stand out enough on the grey page: Jack judges on
  the built screen (a screenshot with the PR).
- A shop subdomain showing another shop's `/book/<slug>`: not d4; waits for
  the hosting decision.

## Tests (written first, each watched failing)

- `tests/customer/date-rules.test.js`: available days (timed and drop-off,
  none), columns and busy blocks, saved-choice still free, "Any mechanic"
  resolution, summary text for both modes, each Continue message.
- `tests/customer/date-screen.test.js` (jsdom, the d2/d3 helper): both
  kinds of day; pills keep at least one on; picking a time; drop-off
  mechanic choice with a disabled mechanic; summary; each Continue message;
  a good Continue saves and navigates; the back link; the guard redirects
  to `problem`; the "just been taken" message; the "no free days" message.
- `tests/customer/require-draft.test.js`: `hasDate`, and the redirect
  target.
- `tests/browser/book-date.spec.ts` (Playwright, 320×568, mocked data): with
  three mechanics, the diary's last row is entirely above the pinned area
  when scrolled to the bottom.

## Not in this piece

- Sending the booking, the "that day was just taken" screen (`full`),
  `details` and `pending` (d5).
- A per-shop limit on how far ahead customers can book.
