# Proposal: The workshop computer's Owner lock, held on the server

## Why

A workshop computer is usually left signed in as the Owner. Its Owner pages
open only while the Owner is the one checked in there by PIN (workshop
computer design 9). Today the server knows a browser is a workshop computer
only from its `wh_workshop` cookie. Someone using the browser's developer
tools could delete that cookie, and the browser would then count as the
Owner everywhere (`decide()` in `server/lib/workshop-owner.js`). Jack asked
for this to be fixed soon, as its own piece with the full sign-in review
(`docs/decisions/2026-10-29-answers.md`, answer 4: "Fix it soon").

Work package: **WP-1.7 task 3.6** (the shared workshop computer, the follow-up
to #568), slice B, taken by Jack. Nothing of Mark's is needed.

**Risky areas:** sign-in, and a migration (105). No money, stock or public
route.

## What Changes

- **A signed-in session belongs to the workshop computer it was used on.**
  Setting a computer up as a workshop computer, or any request from a
  workshop computer's browser, records that computer on the server against
  the session (migration 105, `sessions.workshop_computer_id`).
- **A session that belongs to a workshop computer stays locked**, whatever
  cookies the browser sends: the Owner's sign-in counts as the Owner only
  while the Owner is checked in by PIN on that same workshop computer.
  Deleting or changing the `wh_workshop` cookie, or adding a till's key,
  only locks it further. That lasts until the session ends: signing out, as
  with a removed workshop computer (#575).
- No screen changes.

## Drawings and decisions

- No new drawing: this changes who counts as the Owner, not what a screen
  shows. The drawn lock is `till-checkin-workshop` (`signin.mjs`) and
  walk-through 8 decision 3.
- Decisions: 29 Oct answer 4 (`docs/decisions/2026-10-29-answers.md`); 29 Oct
  answer 3 (a removed workshop computer stays closed); walk-through 8
  decisions 1 and 3 (`2026-10-03-ux-walkthrough-8.md`); roles and switches 2
  (`2026-10-05-roles-and-switches.md`); workshop computer design 1 and 9
  (`openspec/changes/archive/2026-10-29-workshop-computer/design.md`).

## Out of scope

- The browser carrying on as the workshop computer (its PIN screen) once the
  cookie is gone: the session is only locked, not shown the PIN screen.
- Owner and Manager pages asking for a PIN every time (task 2.5, with roles).
- Local development's automatic sign-in, which has no session to mark
  (design 4).
