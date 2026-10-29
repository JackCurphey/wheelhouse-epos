# Proposal: Trust PIN on the workshop computer

## Why

The shared workshop computer (`openspec/changes/archive/2026-10-29-workshop-computer`)
goes back to "Enter your PIN" after 10 minutes with nobody using it, and
everyone types their PIN again. Jack asked for a shop setting so people
don't have to (roles and switches 3, 5 Oct: "some shops might not want to
have to enter a pin every time they use the computer"): with **trust PIN**
on, someone who has typed their PIN on that computer today taps their name
instead. Each business can also change how long the computer waits before
going back, or switch that off (roles and switches 9).

Work package: **WP-1.7 task 3.6**, its later tasks 2.1 and 2.2
(`openspec/changes/archive/2026-10-29-workshop-computer/tasks.md` section 2),
slice B, taken by Jack.

**Two pull requests**, to keep each near the 250–600 lines the project
aims for: the first (`jack/trust-pin`) builds 2.1 and migration 103 whole
(the tap column with it, so 2.2 needs no migration of its own); the second
(`jack/trust-pin-names`, stacked on it) builds 2.2 and archives this change.

**Risky areas:** a migration (103) and sign-in (who counts as checked in on
a workshop computer, and checking in by a tap with no PIN). No money,
stock or public route.

## What Changes

- **Settings › Front desk › Till › Signing in** (2.1), a new fold after
  Tills, the Owner only (stage-1 gaps 9; until roles, "Owner and Manager"
  is the Owner): **Trust PIN**, off to start; and, only while it is on,
  how long before a workshop computer goes back to the start when left
  alone: 5, 10, 15 or 30 minutes, or Off. 10 minutes to start. With trust
  PIN off it is always 10 minutes, as today. One setting for the whole
  business (shops and sites 1).
- **The server's idle time follows the setting.** A workshop computer's
  check-in stops counting after the shop's time (10 minutes with trust PIN
  off), or never with trust PIN on and Off chosen; the screen goes back at
  the same time.
- **"Who's working?"** (2.2, `till-checkin-workshop-names`): on a workshop
  computer with trust PIN on and nobody working, the people who typed their
  PIN on that computer today are listed as names to tap, with "Someone else
  — enter your PIN" for the PIN pad. Tapping a name makes that person the
  one working. The server accepts a tap only for someone who typed their
  PIN on that computer today, with trust PIN on.
- Migration 103: the two settings on the shop's row (as the float and
  #569's stock amount), and whether each check-in was made by a tap.

## Drawings and decisions

- Drawings: the Trust PIN and go-back-to-the-start lines on `set-till-quick`
  (`docs/design/user-journeys/generator/consolidate/j08.mjs` :59-60); the
  Till page's folds (`settings-frame.mjs` `tillFolds`); "Who's working?"
  (`till-checkin-workshop-names`, `generator/signin.mjs` :189-204,
  `checkinWorkshopNames`, `nameTile`); its listing in `journeys.mjs` :109.
- Decisions: roles and switches 3 and 9 (`docs/decisions/2026-10-05-roles-and-switches.md`);
  shops and sites 1 (`2026-10-05-shops-and-sites.md`: trust PIN is one
  setting for the whole business); stage-1 gaps 9 and 10
  (`2026-10-07-stage-1-drawing-gaps.md`); build plan Q6 and its later
  changes (`2026-10-03-build-plan-questions.md`); walk-through 8 decision 3
  and its later change (`2026-10-03-ux-walkthrough-8.md`);
  workshop-computer design 2 and 9.

## Out of scope (later tasks of 3.6, each its own change)

- The Working pills at the bottom of every workshop page
  (`workshop-working-pills`, 2.3).
- The till's Serving pills and tapping a name in Checked in today
  (`till-serving-pills`, stage-1 gaps 11; 2.4). The settings' words speak
  of workshop computers only until then.
- Owner and Manager pages asking for a PIN every time (stage-1 gaps 1,
  2.5). Until then the Owner is never offered as a name to tap (design 3).
- Work recorded under the person working (task 3.8).
