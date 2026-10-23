# Proposal: Today, the Owner's start-of-day page

## Why

The Owner lands on Office › Today, which today says "Not built yet". Jack
decided on 30 Sep that Today is where owners and managers start the day
(opening the shop, decision 3), and on 7 Oct that for now it shows only what
works (stage-1 drawing gaps, item 12). The quotes work left one line waiting
for it: "No answer yet" belongs on Today too (decided while building, 22 Oct).

## What Changes

- Office › Today shows the date and the shop, then **Needs attention** (for
  the Owner) and **Workshop today** (for everyone who has Today), two columns
  on a computer or tablet and one on a phone, as drawn (`op-today`).
- **Workshop today**: "Expected today [n] bikes" with "[n] still to arrive",
  "Repairs ready to collect [n]" with "In the workshop now", the "Still to
  arrive" list (reference, customer, bike, work, time or Drop-off) with Book in
  when it's due, and "Open the diary". The figures are the Workshop
  Overview's own.
- **Needs attention**, with a count in its heading, carries the two lines
  whose data exists now:
  - "[reference] · [customer] — no answer to the quote yet", "Sent [time] ·
    reminder sent [time] · [phone]", with Record their answer, which opens
    the job (`dq-today-no-answer`).
  - "[n] messages need a reply", "From customers · oldest from [name] at
    [time]", with Open Messages (`ac-today`).
  - With nothing to show: "Nothing needs you right now".
- Staff see Workshop today only (`op-today-staff`).

Work package WP-1.10, taken by Jack (it was Mark's half in the split plan; the
working agreement builds by feature). No risky area: a new staff route that
reads only, no migration, money, sign-in or public route.

Follows: drawings `op-today`, `op-today-staff`, `dq-today-no-answer`,
`ac-today` (`docs/design/user-journeys/generator/opening.mjs` `today()`);
decisions `2026-09-30-opening-the-shop-review.md` 3 and 4,
`2026-10-07-stage-1-drawing-gaps.md` 12 and 20, quotes' "No answer yet"
(`decided-while-building.md`, 22 Oct).

Out of scope:
- **Who's in**: there are no check-ins until sign-in and PINs (WP-1.7), and
  no start times; it comes then (Jack, 23 Oct).
- **Tills**: comes with the float check (WP-3.3), as decided on 7 Oct.
- **Seen**: no line here has one; the first that does (a short float, WP-3.3)
  brings it.
- Every other Needs attention line: each comes with its own package.
- Takings: decided not on Today (stage-1 gaps, item 20).

## Capabilities

### New Capabilities

- `today`: the start-of-day page, Office › Today.

### Modified Capabilities

None.

## Impact

- Server: `GET /api/needs-attention` (Owner only, until roles), in a new
  route file; the route list and its screen-trace comment.
- Screens: `src/screens/today/`, registered for `/workshop/today`; the
  Overview's figures shared rather than copied.
- No dependency, no migration.
