# Proposal: opening the shop with a float check

## Why

Each morning the first person in who takes payments checks the cash drawer
holds the shop's float before the first sale, so an overnight problem is
caught at the start of the day, not at Close the day (opening the shop
decision 2, `docs/decisions/2026-09-30-opening-the-shop-review.md`). This is
WP-3.3 Opening the shop (`docs/superpowers/plans/2026-10-03-release-2-build-plan.md`),
given to Jack whole by the split plan (Stage 3: "block 18, float check (a
small server change), 2 screens, Today lines"), and part of slice B of the
replan Jack accepted on 26 Oct (`docs/decisions/2026-10-26-day-answers.md`,
section 1). Jack chose it on 27 Oct. Taken by Jack.

**Risky areas:** a migration (095), and money (the float and a cash count,
whole pence throughout). `/review` runs before each pull request merges.

## What it is built on, and what it isn't

The drawings open the float check after a PIN check-in at a named till
("Hello, Jo", "Till B1 · first in today to take payments"). Neither exists
in the new app yet: the PIN check-in is WP-1.7 and a till that knows its own
name comes with Mark's step C. This change builds the float check on what
exists today, and says where it differs:

- **"First in" is the first person to open the till page that day** who
  takes payments, signed in as themselves; the float check is one per shop
  per day. When PIN check-in arrives it becomes the trigger instead.
- **No till name** on the pop-ups or Today's line until tills have names in
  the new app (step C); a shop has one float check a day.
- **"Takes payments"** is the Owner, or a team member marked as a cashier
  (the team's existing switch), until roles (WP-1.1) replace it.
- **The float itself** is set in Settings › Front desk › End of day › Float
  (`set-eod`, drawn; planned in WP-5.1), built here as that one fold, since
  the check has nothing to check without it. It is stored on the shop, like
  the receipt words, until Mark's settings store (WP-1.2) exists.

## What Changes

- **Server:** the shop's float; a float check per shop per day (looked
  right, or counted, with what was counted and an optional reason); who
  checked and when; "Seen" on a short float, by the Owner; a short float on
  Today's Needs attention.
- **Screens** (second pull request, stacked): the float check pop-ups on the
  till, the Float fold in Settings, and the short float line on Today.

## Drawings and decisions

- Drawings (`docs/design/user-journeys/generator/opening.mjs`):
  `op-float-check` (and its situation `op-float-check-first`),
  `op-float-count` (the note-and-coin counter, `consolidate/j10.mjs:11`),
  `op-float-matched`, `op-float-short` and `op-float-over`; Today's
  `op-today-short` and `op-today-seen`; the written line on `op-float-check`
  ("Looks right: … 'Float checked · looked right · [Name]'; only a count
  says 'counted by'", `consolidate/j10.mjs:31`). `set-eod`
  (`generator/setup.mjs:150`) for the Float fold.
- Decisions: opening the shop 2 (the one-tap check), 4 (the money side of
  Today is for owners and managers), 7 and 8 (audit H1: a match closes with
  "Float checked"; over and short pop-ups; "Done counting" off until a box
  has a number; an over float goes to Needs attention only when yesterday
  was closed; H3: "Seen" clears a short float in one click; M1: no ✕); UX
  walk-through 4 M4 (the first real day: "Count it" only); cash-up 2, 3 and
  4 (blind counting, the counter, the standard float); Jack's 23 Oct answer
  on Today (Tills and Who's in wait for check-ins,
  `decided-while-building.md`); owner-only settings
  (`docs/decisions/2026-10-19-owner-only-settings.md`).

## Out of scope

- `op-float-check-unclosed` (yesterday not closed): it needs Close the day
  (WP-3.4) to know a day wasn't closed. Until then no day is "closed", so by
  decision 8 H1 an over float doesn't go to Needs attention either.
- Today's Tills and Who's in parts (Jack, 23 Oct: they wait for check-ins).
- The PIN check-in, till names, roles, the activity log and the settings
  store (WP-1.7, step C, WP-1.1, WP-1.2).
- The rest of Settings › End of day (when Close the day appears, blind
  counting).
