# Book (d2): the service screens

**Date:** 2026-09-26. **Follows:** d1 (#75), server pieces 7 (#76) and 8
(#77). **Changes:**
- piece 8's spec (`2026-09-26-book-server-8-service-includes-design.md`,
  decision 2 "warn and offer to remove; both can still be booked"): the list
  now hints and locks, and the server refuses the pair. That refusal was added
  to #77 on 26 Sep, and the piece 8 spec was updated to match.
- d1's spec (`2026-09-26-book-d1-groundwork-design.md`): the draft's single
  `serviceId` becomes `serviceIds[]`, and the frame gains loading and error
  states.
- the atlas mock-ups for `service` and `service-list`, which predate the
  24 Sep three-option decision.

## Why

These are the first two screens of the customer booking journey at `/book`.
The customer says what they want done: one or more of the shop's services
(any mix of full and individual), or "Not sure" on its own.

## Decisions (Jack, 26 Sep)

1. **One shared list.** The first screen keeps the three fixed options
   (24 Sep). "Full services" and "Individual services" both open the same
   list, starting at the section picked. "Not sure" goes to `problem`.
   Chosen over separate lists (mixing means going back, and the atlas has no
   second list screen) and over dropping the first screen (reverses 24 Sep).
2. **Hint and lock.** Ticking a full service marks each service it includes
   "Included in your <full service>" and greys it out, so it can't be ticked.
   Chosen over hint-only (a customer could still pay twice). Replaces piece
   8's warning and "Remove" link.
3. **The server refuses the pair too**: "<full service> already includes
   <service>". Added to #77, so the rule holds however a booking arrives.
4. **Tapping a first-screen option goes straight on.** That screen has no
   Continue button. Chosen over select-then-Continue (an extra tap for a
   final choice).
5. **Prices read "From £X"**, under one line at the top of the list:
   "Prices are for labour. Parts are quoted separately." Only when the shop
   shows prices online. Chosen over a plain "£X" with or without the note.
6. **A running summary above the pinned Continue**: "2 services · from £95",
   or "2 services" when prices are hidden. Chosen over the button alone.

Section 1 of the design, including the wording marked "proposed" at the
time, was approved by Jack on 26 Sep.

## First screen: `service` (`/book/:shopSlug`)

- `BookFrame` step 1, no back link and no action. Heading: "What do you
  need?"
- Three `ChoiceCard`s, each navigating on tap:
  - **Full services**, "Whole-bike services", opens
    `/book/:shopSlug/services?start=full`.
  - **Individual services**, "Single jobs, like brakes or gears", opens
    `/book/:shopSlug/services?start=individual`.
  - **Not sure**, "Tell us what's wrong and we'll advise", sets
    `notSure: true` and `serviceIds: []`, drops every answer, and opens
    `/book/:shopSlug/problem`.
- A kind with no services in `/services` hides its card. "Individual" counts
  both `categories` and `uncategorised`. If both kinds are empty, the screen
  shows "This shop isn't taking bookings online at the moment - please
  contact them directly" in place of the cards, and "Not sure" is hidden too.
- Opening either list clears `notSure`. Ticked services are kept.

## List screen: `service-list` (`/book/:shopSlug/services`)

- `BookFrame` step 1, back link to `/book/:shopSlug`. Heading: "Choose your
  services".
- When `showPrices` is true, a line under the heading reads "Prices are for
  labour. Parts are quoted separately."
- The sections, in order:
  1. "Full services" (`full`)
  2. each category, by the server's order, headed by its name
  3. "Other" (`uncategorised`)
  Empty sections are not shown. `?start=full` or `?start=individual` scrolls
  to the "Full services" heading or to the first individual section when the
  screen opens. Any other value, or none, starts at the top.
- Each service is a toggle (`ChoiceCard` with `selected`, `aria-pressed`),
  showing:
  - the name
  - the price "From £X" (when `price` is not null; two decimal places only if
    pence, e.g. "From £22.50", "From £80")
  - on a full service with a non-empty `includes`, "Includes " followed by
    the first three names exactly as the shop typed them, joined with ", ",
    then " and N more" past three. Names are not lower-cased: that would
    mangle names such as "Shimano Di2 setup".
- **Lock:** an individual service is locked while any ticked full service
  includes it.
  - A locked row is greyed, cannot be ticked (`aria-disabled="true"`, the
    tap does nothing), and shows "Included in your <full service>". If
    several ticked full services include it, the first by list order is
    named.
  - Ticking a full service unticks any ticked service it includes. The row
    shows "<service> is part of your <full service>, so we've taken it off"
    until the next tick or untick.
  - Unticking the full service unlocks those rows without re-ticking them.
- A link at the end of the list: "Not sure what you need? Describe the
  problem". It does the same as the first screen's "Not sure" (clears ticks
  and answers, goes to `problem`).
- **Pinned area:** a summary line, then the `BookFrame` action "Continue".
  - The summary reads "1 service" or "N services". When `showPrices` is true
    and at least one is ticked, it adds " · from £T", where T is the sum of
    the ticked prices. With nothing ticked, the summary line is empty.
  - Continue checks, in this order, and shows the message under the summary
    (announced to screen readers) while staying on the screen:
    1. nothing ticked: "Choose at least one service"
    2. more than 10 ticked: "You can book up to 10 services at once"
    3. summed `minutes` over 720: "That's too much work for one visit -
       please book the jobs separately" (piece 7's wording)
  - Otherwise it saves `serviceIds` (in list order), drops answers whose
    `serviceId` is no longer ticked, and goes to `/book/:shopSlug/problem`.
- Ticks are written to the draft as they change, so they survive a refresh
  in the same tab (d1).

## Both screens

- **Loading and errors**, handled in `BookFrame` for every book screen while
  `/services` is not ready:
  - loading: "Loading…"
  - 404 (`ApiError.code === 'not_found'`): heading "We can't find this
    shop", with no shop name
  - any other failure: "We couldn't load this shop's services", with a
    "Try again" button that refetches
  This settles d1's deferred "blank header" item.
- **Focus:** when the screen changes, focus moves to its `h1`, which has
  `tabIndex={-1}`. This settles d1's deferred focus item.

## Draft changes (`src/screens/book/draft.tsx`, `require-draft.tsx`)

- `BookingDraft`: `serviceIds?: number[]` replaces `serviceId`,
  `serviceName` and `serviceMinutes`.
- `Answer`: gains `serviceId: number`, matching piece 7's request shape.
- `hasService`: true when `serviceIds` holds at least one id, or when
  `notSure === true`.
- Total minutes are not stored. Later screens (d4) derive them from
  `serviceIds` and `/services` through `service-selection.ts`.
- A draft saved before this change (in a tab left open) is treated as
  having no service. Nothing converts it.

## Selection rules (`src/screens/book/service-selection.ts`)

Pure functions, with no React, taking the `ServicesResponse` and the ticked
ids:
- `toggle`: returns the new ids and any "taken off" notices
- `lockedBy(id)`: returns the full service locking an id, or null
- `includesLine`
- `summary`: count, and total or null
- `continueError`: the message, or null
- `totalMinutes`
- `formatFrom`: the price text

The screens only call these.

## Tests (written first, each watched failing)

- `tests/customer/service-selection.test.js`:
  - lock and unlock
  - untick with its notice
  - several full services including the same one (the first by list order)
  - "Includes…" with 0, 3 and 5 names
  - price text, including £22.50 and £80
  - summary with prices shown and hidden
  - each Continue message and its order
  - `totalMinutes`
- `tests/customer/service-screen.test.js` (jsdom, the d1 pattern):
  - each card navigates to the right address
  - Not sure sets the draft and clears ticks and answers
  - a kind with no services hides its card
  - the no-services message
- `tests/customer/service-list-screen.test.js`:
  - sections in order, and empty ones hidden
  - `?start` scrolls, with `scrollIntoView` stubbed and its target checked
  - ticking locks rows and updates the summary
  - a locked row ignores taps
  - the "taken off" notice
  - each Continue message
  - a good Continue saves `serviceIds` in list order, drops orphaned
    answers and navigates
  - ticks survive a remount from sessionStorage
  - prices hidden: no "From", no note, count-only summary
- `tests/customer/frame.test.js` and `require-draft.test.js`, updated:
  - loading, unknown shop and failed-with-retry states
  - focus lands on the `h1`
  - the new `hasService`
- `tests/customer/draft.test.js`, updated for the new shape.
- `tests/browser/book-service-list.spec.ts` (Playwright, 320×568, `/services`
  mocked with enough services to scroll): scrolled to the bottom, the last
  service's card is entirely above the pinned area.

## Not in this piece

- `problem`, `date`, `details`, `pending` (d3-d5).
- The on-screen keyboard position check (no text fields here; it moves to
  d3).
- Enter-to-submit on `details`, long action labels, the shop's own colours.
- The staff screens 65 and 66.
