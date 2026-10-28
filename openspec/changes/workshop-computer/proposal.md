# Proposal: The shared workshop computer, first part

## Why

The workshop has one computer that every mechanic uses. Walk-through 8
(decision 1) makes it a "workshop computer": the Owner sets it up once, it
stays signed in, and each person takes over by typing their PIN; a bar on
every page says who is working, and after a while with nobody touching it,
it goes back to "Enter your PIN" so nothing is done under the last person's
name (decision 3; build plan Q6: 10 minutes). Set up this till
(`openspec/changes/archive/2026-10-28-till-setup`) offers only a till; its
proposal leaves the workshop computer to this piece (stage-1 gaps 4).

Work package: **WP-1.7 task 3.6** (`openspec/changes/archive/2026-10-28-pins-and-checkin/tasks.md`
section 3), slice B, taken by Jack. Built on `jack/till-setup-screens`
(#564, #565), which this needs and which isn't merged yet.

**Risky areas:** a migration (101), and sign-in (a cookie of the workshop
computer's own, the PIN check-in and when it ends). No money, stock or
public route.

The whole of task 3.6 is more than one piece (about 1,800 lines with trust
PIN, its settings, the names screen and both sets of pills), so this change
is its first playable part: a computer becomes a workshop computer, Enter
your PIN with no till number, "Working: [name] · Switch" on every page, and
back to Enter your PIN after 10 minutes idle, enforced by the server. Trust
PIN and the pills are listed as later tasks.

## What Changes

- **Set up this computer** (`till-setup`): the Owner chooses "A till" or "A
  workshop computer" (stage-1 gaps 4). A workshop computer takes a shop and
  an optional name, no number, and "Make this computer a workshop computer".
  The browser keeps it in a cookie of its own; the server stores only its
  hash, as for a till.
- **Enter your PIN on a workshop computer** (`till-checkin-workshop`): before
  anyone is working, every page of the staff app is the PIN screen under a
  charcoal bar reading "Workshop computer", "Bolton · North Street Cycles"
  and "Nobody working — enter your PIN". The same pad as the till; no
  "Checked in today", no "No PIN yet?" line, no float check. The PIN opens
  the page that was asked for; the front page opens the diary.
- **"Working: Alex Morgan · Switch"** (block 26, `diary.mjs` workingBar;
  stage-1 gaps 10) across the top of every page while someone is working;
  Switch goes back to Enter your PIN. A screen reader hears "Now working:
  Alex Morgan".
- **Back to Enter your PIN after 10 minutes idle** (walk-through 8 decision
  3, build plan Q6, roles and switches 9 with trust PIN off). The server
  keeps when the person last did something on that computer and stops
  counting their check-in 10 minutes after; the screen tells it while
  someone is using it, and goes back to the PIN screen itself at 10 minutes.
- Migration 101: workshop computers (a shop, an optional name, the hash of
  the browser's key, switched on or off), with row-level security; which
  workshop computer a check-in was made on, and when it was last used.

## Drawings and decisions

- Drawings: `till-checkin-workshop` (`docs/design/user-journeys/generator/signin.mjs`
  :160-187, `workshopBar`, `checkinWorkshop`); the Working bar
  (`generator/diary.mjs` :2948-2952, `workingBar`); `till-setup`
  (`signin.mjs` :100-113). The idle line on `till-checkin`
  (`generator/consolidate/jb.mjs` :40) and "Now working: [name]" (:47).
- Decisions: walk-through 8 decisions 1, 3 and 4
  (`docs/decisions/2026-10-03-ux-walkthrough-8.md`) and its later changes;
  third walk answer 8 (`2026-10-03-ux-walkthrough-third-walk.md`); build
  plan Q6 (`2026-10-03-build-plan-questions.md`); roles and switches 2, 3, 8
  and 9 (`2026-10-05-roles-and-switches.md`); stage-1 gaps 1, 4, 9 and 10
  (`2026-10-07-stage-1-drawing-gaps.md`); till-setup design 1, 7
  (`openspec/changes/archive/2026-10-28-till-setup/design.md`).

## Out of scope (later tasks, each its own change)

- **Trust PIN** and its settings, Owner only, in a "Signing in" fold on Till
  settings (the two lines on `set-till-quick`; stage-1 gaps 9; roles and
  switches 3, 9, 10): "Who's working?" (`till-checkin-workshop-names`), the
  Working pills (`workshop-working-pills`), the till's Serving pills
  (`till-serving-pills`; stage-1 gaps 11), and the server's check that a
  pill takes over only for someone who typed their PIN on that device today.
  With trust PIN on, the idle time can be 5, 10, 15 or 30 minutes or off;
  until it is built, trust PIN is off for every shop, which is always 10
  minutes.
- **Owner and Manager pages asking for a PIN every time** on a workshop
  computer (walk-through 8 decision 3; stage-1 gaps 1), and pages following
  the person working's role (WP-1.1, roles). Until then (design 9) Owner
  pages there are the Owner's only while the Owner is the person working.
- **Work recorded under the person working** (task 3.8): until then the
  drawn line "What you do on this computer is recorded under your name and
  role." isn't shown.
- The diary's "Me" as the person working (walk-through 8 M2); Your settings
  belonging to the PIN person and no "Change PIN" on a shared computer (M3);
  Signed-in devices listing it; switching a workshop computer off or
  renaming it (WP-5.1, with the Tills list).
