# Proposal: document what the workshop diary already does

## Why

On 8 October 2026 the project moved to OpenSpec (Mark's suggestion, Jack's
decision): `openspec/specs/` is to say what the app does today, one area at
a time, checked against the code. The workshop diary is built, but what it
does is spread across five design documents, two decisions files, the code
and about forty test files. This change writes it down in one place, as it
is, so the next piece of diary or booking work starts from a spec that
matches the app. It follows `workshop-jobs`, the first area written this way.

## What Changes

- Adds a new spec, `workshop-diary`, describing behaviour that is **already
  built and tested** on `main`. Every requirement is backed by a named test
  or a named place in the code (the Evidence table in `design.md`).
- **Changes no code, no database and no screens.** Nothing is added, fixed
  or removed. Where the app does something surprising, the spec describes
  what it does and `design.md` flags it for Jack under "Surprising"; it does
  not change it.
- The older documents it replaces become history (a pointer line at the top
  of each is a task in `tasks.md`; three of them also describe the customer
  side, which stays theirs until `online-booking` is written):
  - `docs/superpowers/specs/2026-10-03-staff-diary-view-design.md`
  - `docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md`
  - `docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md` (the staff side)
  - `docs/superpowers/specs/2026-09-26-book-server-10-notice-timezone-design.md`
  - `docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md`

**In scope** (the `workshop-diary` area):

- The staff diary at `/workshop/diary`: the Week and Day views, the people
  chips, the colours and legend, the "No time" row, overlapping and stacked
  jobs, a job's block on each of its days, the phone layout, moving a job by
  dragging or from the keyboard and the moves it refuses, the New job
  button and form, the job menu, the hover summary and View overview.
- The old app's Workshop diary (`public/app.js`), as far as "Waiting for
  you", its review pop-up and its refusals.
- "Waiting for you" (`GET /api/workshop-waiting`) and staff answering what
  is in it: new online booking requests (with the plain accept and decline
  routes), customers' change requests (`POST /api/workshop-jobs/:id/accept-change`,
  `/decline-change`) and customers' cancellations
  (`/cancellation-seen`).
- Capacity: opening hours for each weekday, lunch, leave and shop closures
  (`/api/workshop-unavailability`), each mechanic's free time and the shared
  queue, capacity holds, the reserve, minimum notice, the shop's own "today"
  in its time zone, the staff capacity view (`GET /api/workshop-capacity`),
  and the capacity rules the customer booking pages share
  (`GET /api/portal/:shopSlug/availability` and the checks on a booking or
  change).
- Workshop settings (`GET` and `PUT /api/workshop-settings`), including the
  booking mode and a mode change scheduled for a later date.

**Out of scope** (other areas, specified separately):

- `workshop-jobs` (done): the job record, its states and actions, its days,
  attachments and the job page. Where diary behaviour rests on a job rule
  (the shop's opening-day and overlap checks, the version check, plain
  accept and decline refusing a change request), this spec refers to it.
- `workshop-quotes`, `workshop-services` (the service catalogue) and
  `online-booking` (the customer booking pages, the private link, what a
  customer sees). Only the capacity rules both sides share are here.
- Planned and not built: the Overview page, the working bar, WP-1.10
  "Workshop today", and everything in
  `docs/decisions/2026-10-07-stage-1-drawing-gaps.md`.

## Lane and work package

Jack's lane: the whole workshop is Jack's
(`docs/superpowers/plans/2026-10-04-release-2-two-person-split.md` §3).
`server/capacity.js` and `server/clock.js` are Mark's and shared: the
diary and New job read them, so a change to what the workshop gets needs
Jack's approval, and a change to them needs Mark's (§3.1). This change
edits neither, nor `server/server.js`, so it needs no approval from Mark.
This is not a work package; it documents work already merged.

## Drawings and decisions it follows

- Drawings (`docs/design/user-journeys/generator/diary.mjs`, ids in
  `journeys.mjs`): diary, diary-phone, request-new, request-decline,
  request-change, request-cancel, new-job, new-job-day,
  diary-hover-summary, diary-stack-hover, diary-stack-open,
  diary-context-menu.
- `docs/decisions/2026-09-27-workshop-day-review.md` (journey 12, Workshop
  day): decisions 14 (Waiting cards: one click highlights, then open),
  15 (requests open as a pop-up), 18 (New job picks the mechanic), 19
  (change requests in the Waiting column), 22 (New job is a button), 37
  (right-click, View overview), 52 (one block per day), 58, 59 and 61
  (stacks and lanes), 60 (the toolbar), 65 (hover summary), 66 (pills),
  68 (phone and tablet).
- `docs/decisions/2026-09-04-booking-mode-and-downtime.md`: booking mode
  per shop (§2), downtime as blocks (§4.4), staff are not capacity-gated
  (§7.7).
- No decision is reopened. Where the built app differs from a decision or
  from the older specs, `design.md` says so for Jack to look at.

## Capabilities

### New Capabilities

- `workshop-diary`: the staff diary and its views, "Waiting for you" and
  staff answers to customers, capacity (hours, blocks, free time, holds,
  notice, the shop's today) and the workshop settings that feed them.

### Modified Capabilities

None. `workshop-jobs` is unchanged; this spec refers to it.

## Impact

- New files only, under `openspec/changes/document-workshop-diary/`.
- No effect on code, database, routes, screens, dependencies or hosting.
