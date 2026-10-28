# Proposal: Set up this till, check-ins per till, and the till's name

## Why

Today any signed-in browser is "the till", so a check-in covers the whole
shop, "Checked in today" lists everyone in the shop, and Today's Tills is one
line headed "Till" with no number (`decided-while-building.md`, 28 Oct, PINs
entry 3 and Who's in entries 1 and 6; 27 Oct, float check entries 2 and 1).
Tills already exist on the server (migration 036, `POST /api/tills`), but no
screen turns a computer into one. "Set up this till" (`till-setup`) does: the
Owner, signed in, picks the shop and the till number, and this computer
becomes Till B1. From then on a check-in belongs to that till, and the till,
the float check and Today say "Till B1".

Work package: **WP-1.7 task 3.4** (`openspec/changes/archive/2026-10-28-pins-and-checkin/tasks.md`
section 3), slice B, taken by Jack.

**Risky areas:** a migration (100), and sign-in (the till's own cookie,
check-ins). It touches the float check's record (which till it was counted
at), but not how much money is expected or counted: one float check and one
close a shop a day stay as they are (design 4). No public route.

## What Changes

- **Set up this till** (`till-setup`): a page for the Owner with the shop as
  pills, the till number as pills with taken ones "In use", "Name
  (optional)", and "Make this computer Till B1". The browser keeps the till
  in a cookie of its own; the server stores only its hash.
- **Settings › Front desk › Till › Tills**: "Make this computer a till", with
  the drawn note, for the Owner; not shown on a computer that is already a
  till (stage-1 gaps decision 4).
- **Check-ins per till:** a check-in made on a set-up till belongs to that
  till; it counts only there, and "Checked in today" on the PIN screen lists
  that till's check-ins.
- **The till's name**: "Till B1" and "Bolton · North Street Cycles" at the top
  of the till, where the till bar will be; on the float check's pop-ups
  ("Till B1 · first in today to take payments"); and on Today: one Tills line
  per till, and "Till B1’s float was [£] short this morning".
- Migration 100: a till's name optional; which till a check-in and a float
  check were made on.

## Drawings and decisions

- Drawings: `till-setup` (`docs/design/user-journeys/generator/signin.mjs`
  :100-113, `tillSetupAt`); `set-till-tills-owner` (`generator/setup.mjs`
  :126-129, `tillsOpen`); the till bar (`generator/app-map.mjs` :32-40,
  `tillBar`; `tillPhoneBar` :305); `op-float-check`, `op-float-count`,
  `op-float-matched`, `op-float-short`, `op-today`, `op-today-short`
  (`generator/opening.mjs` :45-114).
- Decisions: signing in 9 (`docs/decisions/2026-09-29-signing-in-review.md`);
  Workshop day 62 and 66 (pills); UX walk-through 7 M2 and L1 (taken numbers
  "In use", "Shop" not "Site"); stage-1 gaps 4 and 23
  (`docs/decisions/2026-10-07-stage-1-drawing-gaps.md`); roles and switches 2
  (registering tills needs an email sign-in, never a PIN,
  `2026-10-05-roles-and-switches.md`); cash-up 6 ("each till closes on its
  own", `2026-09-29-cash-up-review.md`); multiple sites 9
  (`2026-10-01-multiple-sites-review.md`).

## Out of scope

- **The shop switcher and "Where are you working today?"** (`auth-site`,
  block 13): stage-1 gaps decision 23 (Jack, 7 Oct) puts switching shops in
  WP-5.2, "when a shop can have more than one"; it also needs the shop on the
  session (WP-1.4). Logged, not built.
- **A float check and a close per till.** Cash-up decision 6 says each till
  closes on its own, but neither sales record knows which till a sale was on
  (26 Oct entry 2; task 3.8), so a till's own drawer can't be worked out yet.
  Both stay one a shop a day (design 4).
- A workshop computer as the setup's second choice (stage-1 gaps 4; task 3.6).
- The till bar itself (charcoal, Online, Past sales): the name sits in the
  till's existing strip until it is built.
- The Tills list with Rename and Remove (`set-till-tills`, WP-5.1); moving a
  till (`ms-till-move`, WP-5.2); a business's first site (WP-1.4).
- Staying signed in and working offline (step C).
