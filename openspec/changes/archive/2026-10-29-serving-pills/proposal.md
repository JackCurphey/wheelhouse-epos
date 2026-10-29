# Proposal: The till's Serving pills

## Why

Jack wanted the workshop computer's pills on the till too (roles and
switches 10, 5 Oct: "so a staff member can quickly make sure the sales are
recorded under their name"). With trust PIN on, the till shows a "Serving:"
row of today's people; tapping your own makes you the person serving, with
no PIN. Stage-1 gaps 11 adds the same tap to the till's PIN screen: a name
in "Checked in today" checks that person back in.

Work package: **WP-1.7 task 3.6**, later task 2.4
(`openspec/changes/archive/2026-10-29-workshop-computer/tasks.md` section 2),
slice B, taken by Jack.

**Risky area:** sign-in (checking in at the till by a tap, with no PIN).
No migration, money, stock or public route.

## What depends on Mark, and what doesn't

- **Built here, needing neither step C nor task 3.8:** the pills, the tap
  on a till, and the tap in "Checked in today". The till already checks in
  online (pins-and-checkin), and Take payment already sends the person
  serving at the moment of payment (`pay-dialog.tsx`), so **the sale on
  screen moves to the new name** (roles and switches 10, proposed) with no
  change: whoever is serving when the sale is paid is the name it goes under.
- **Waits for Mark:** the server recording a sale under the person checked
  in rather than the name the till sends (task 3.8, after step C), and
  tapping a name with the till offline (task 3.5, step C). Until step C the
  till checks in online only, as it does today. Issue #560 lists both.

## What Changes

- **The Serving pills** (`till-serving-pills`): on a till with trust PIN
  on and someone serving, the product side ends in "Serving:", a pill for
  each person a tap would check in, the person serving highlighted, and
  "Someone else".
- **A pill** makes that person the one serving, with the sale on screen
  kept, through `POST /api/till-checkin/tap`. **"Someone else"** ends the
  check-in and shows Enter your PIN.
- **Checked in today on the till's PIN screen** (stage-1 gaps 11): with
  trust PIN on, the names a tap would check in are buttons; the others, and
  every name with trust PIN off, stay a list.
- **The tap on a till**: `POST /api/till-checkin/tap` and `names` now work
  on a till as on a workshop computer, with the same rules: a typed PIN on
  that same till today, under the same sign-in, never the Owner, the PIN
  not cleared or changed since.

## Drawings and decisions

- Drawing: `till-serving-pills` (`docs/design/user-journeys/generator/till.mjs`
  :63-68 and :135, `servePill`, `servingPills`, `leftSide({ pills: true })`);
  `consolidate/j11.mjs` :10.
- Decisions: roles and switches 3 and 10 (`docs/decisions/2026-10-05-roles-and-switches.md`);
  shops and sites 1; stage-1 gaps 11 (`2026-10-07-stage-1-drawing-gaps.md`);
  trust-pin-workshop design 3 and 4; working-pills design 1 to 4.

## For Jack

The drawing shows **Jack Lewis**, the Owner, as a pill. This change keeps
the rule every tap follows: the Owner is never checked in by a tap, and
types their PIN (trust-pin-workshop design 3; decided-while-building, 29 Oct,
trust PIN entry 5). On the till a tapped-in Owner could give PINs with no
PIN. So the Owner's pill shows only while the Owner is the one serving.
Showing it to tap is a one-line change if Jack prefers the drawing.

## Out of scope

- Sales recorded under the checked-in person on the server (task 3.8).
- Tapping a name, or checking in at all, with the till offline (task 3.5).
- Owner and Manager pages asking for a PIN every time (task 2.5).
