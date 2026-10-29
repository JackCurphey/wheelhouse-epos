# Proposal: The Working pills on the workshop computer

## Why

With trust PIN on (`openspec/changes/archive/2026-10-29-trust-pin-workshop`),
someone who typed their PIN on the workshop computer today taps their name
on "Who's working?" after a break. Jack also wanted a quicker swap while
someone else is still working (roles and switches 9, 5 Oct: "there should
just a pill switch or something at the bottom of the page so that someone
hopping on a computer can just swap it over to them without having to go to
another screen"). This builds that strip.

Work package: **WP-1.7 task 3.6**, later task 2.3
(`openspec/changes/archive/2026-10-29-workshop-computer/tasks.md` section 2),
slice B, taken by Jack.

**Risky area:** sign-in (who is working on a workshop computer). No
migration, money, stock or public route. A pill uses the same server rules
as "Who's working?" (`POST /api/till-checkin/tap`); there is no second way in.

## What Changes

- **The Working pills** (`workshop-working-pills`): on a workshop computer
  with trust PIN on, while someone is working, a strip at the bottom of
  every page reads "Working:", then a pill for each person who typed their
  PIN there today, the person working highlighted, then "Someone else". It
  takes the place of "Working: [name] · Switch" at the top.
- **Tapping your own pill** makes you the person working, on the same page,
  through `POST /api/till-checkin/tap`, with its rules unchanged.
- **"Someone else"** ends the check-in and shows the PIN pad.
- `GET /api/till-checkin` gains `trustPin`, so the screen knows which to show.
- With trust PIN off, nothing changes: the Working bar with Switch.

## Drawings and decisions

- Drawing: `workshop-working-pills` (`docs/design/user-journeys/generator/signin.mjs`
  :206-218, `workPill`, `workingPills`); listed in `journeys.mjs` :110 and
  `consolidate/jb.mjs` :18.
- Decisions: roles and switches 3 and 9 (`docs/decisions/2026-10-05-roles-and-switches.md`);
  stage-1 gaps 10 (`2026-10-07-stage-1-drawing-gaps.md`); trust-pin-workshop
  design 3 to 5 and 8.

## Out of scope

- The till's Serving pills (`till-serving-pills`, task 2.4).
- Owner and Manager pages asking for a PIN every time (task 2.5); until
  then the Owner is never a pill to tap (trust-pin-workshop design 3).
