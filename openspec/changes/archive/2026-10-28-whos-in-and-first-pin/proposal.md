# Proposal: Who's in and Tills on Today, and the first PIN by itself

## Why

The PIN check-in is built (`openspec/changes/archive/2026-10-28-pins-and-checkin`),
so Today can now say who is in and whether the till is open. Today's Who's
in and Tills cards were left out until check-ins existed (Jack, 23 Oct,
`decided-while-building.md` 23 Oct entry 4; stage-1 gaps 12). And a new
person still has to find Your settings to get a PIN: the drawings open
"Your till PIN" by itself at their first sign-in, and again after their PIN
was cleared (UX walk-through 4 H1).

Work packages: **WP-1.10** (Today's Who's in; `op-today`, `op-today-staff`,
`op-today-late`) and **WP-1.7 task 3.2** (`pin-first`, `pin-cleared`),
slice B, taken by Jack.

**Risky areas:** a migration (098), and sign-in (PINs). No money, no public
route. No PIN is ever shown on Today; Tills stays the Owner's, as Needs
attention is, until roles.

## What Changes

- **Who's in** on Today: everyone who checked in at the till today, "Checked
  in at [time] · [Owner, Mechanic or Staff]" with "In"; and each mechanic
  due today who hasn't, "Due in at [start time] · Mechanic" with "Not in
  yet", turning to "Late" once that time has passed. No alert. Everyone who
  can open Today sees it (decision 4).
- **Tills** on Today, for the Owner: one line for the shop's till until tills
  have names, "Open · float checked by [Name] at [time]", with "Float short"
  or "Float short · seen by [Name]" when it was.
- **The first PIN by itself:** someone on the team who has no PIN and has
  never been asked gets "Your till PIN" over the page they land on, with
  "Skip for now"; after the Owner clears their PIN, the next page they open
  shows the "Your old PIN was cleared" version. Skip or Keep, and they are
  not asked again until their PIN is next cleared.
- Migration 098: when each sign-in was last asked, and when each person's
  PIN was last cleared.

## Drawings and decisions

- Drawings: `op-today`, `op-today-staff`, `op-today-late`, `op-today-short`,
  `op-today-seen` (`docs/design/user-journeys/generator/opening.mjs`
  `today()`, :87-107, :217); `pin-first`, `pin-cleared`
  (`generator/signin.mjs` :221-263, `PIN_TEXT`); the clear-PIN note
  (`generator/setup.mjs` :245-247).
- Decisions: opening the shop 3, 4, 5, 6 (`docs/decisions/2026-09-30-opening-the-shop-review.md`);
  stage-1 gaps 12 (`2026-10-07-stage-1-drawing-gaps.md`); UX walk-through 4
  H1 (`docs/design/user-journeys/ux-walkthrough-4*.md`); the 27 and 28 Oct
  entries in `decided-while-building.md` (no till name until tills have
  names; a check-in covers the whole shop).

## Out of scope

- Till names, more than one till, "sales waiting to send" and "All sales
  sent" (step C: the till has no offline queue yet).
- Managers and "Can close the day" seeing Tills (roles, WP-1.1).
- The Owner's own first PIN: the Owner made the shop rather than joining
  it, and gets a PIN from Your settings as now.
- The practice band (`op-today-practice`) and the Lightspeed version.
