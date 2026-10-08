# Proposal: document what workshop jobs already do

## Why

On 8 October 2026 the project moved to OpenSpec (Mark's suggestion, Jack's
decision): `openspec/specs/` is to say what the app does today, one area at
a time, checked against the code. Workshop jobs are the heart of the
workshop and are already built, but what they do is spread across two
design documents, a decisions file, the code and about twenty test files.
This change writes it down in one place, as it is, so the next piece of
workshop work starts from a spec that matches the app.

## What Changes

- Adds a new spec, `workshop-jobs`, describing behaviour that is **already
  built and tested** on `main`. Every requirement is backed by a named test
  or a named place in the code (the Evidence table in `design.md`).
- **Changes no code, no database and no screens.** Nothing is added, fixed
  or removed. Where the app does something surprising, the spec describes
  what it does and `design.md` flags it for Jack; it does not change it.
- Adds a pointer line at the top of the two older documents this spec
  replaces, so they read as history:
  - `docs/superpowers/specs/2026-10-03-staff-job-page-design.md`
  - `docs/superpowers/specs/2026-10-03-multi-day-jobs-design.md`

**In scope** (the `workshop-jobs` area):

- The job record and its per-shop reference (WH-1000 onwards); creating,
  reading, listing, editing and deleting a job; what a job links to
  (customer, bike, mechanic) and the checks on those links.
- The three separate facts about a job (the booking, where the bike is, the
  work) and the fifteen staff actions that move them: accept, decline,
  request a reschedule, cancel, expire, book in, collect, reopen (bike back),
  start, waiting for parts, parts arrived, hold, resume, finish, reopen
  (work). Which moves are allowed, which are refused, and how.
- The version check that refuses a change made from an out-of-date screen.
- Jobs over several days: adding, moving and removing later days, and
  automatic carry-over of unfinished work.
- Files attached to a job; the job's work and parts lines (on its linked
  order); the private link staff can make for the customer.
- The old five-value status, still worked out for the old app.
- The staff job page that shows all of the above.

**Out of scope** (other areas, specified separately later):

- `workshop-diary`: the diary views and blocks, "Waiting for you", answering
  a customer's change request, capacity, unavailability and workshop
  settings.
- `workshop-quotes`: quotes. `workshop-services`: the service catalogue.
  `online-booking`: the customer booking pages and what the private link
  shows a customer.
- Anything only planned and not built: storage slots, the checklist, a
  "Mark ready" sign-off, collect-and-pay, the "Bike ready" message, the
  "Change requested" badge.

## Lane and work package

Jack's lane: the whole workshop is Jack's
(`docs/superpowers/plans/2026-10-04-release-2-two-person-split.md` §3, the
`server/workshop/**` row). This is not a work package; it documents work
already merged. Because it changes no server file, it needs no approval from
Mark under §3.

## Drawings and decisions it follows

- Drawings (`docs/design/user-journeys/generator/`, ids in `journeys.mjs`):
  job-overview, job-book-in, job-mechanic, job-waiting-parts, job-finished,
  job-collection.
- `docs/decisions/2026-09-27-workshop-day-review.md` (journey 12, Workshop
  day): decisions 16 (job opens as a pop-up), 30 and 35 (one page; the stage
  button), 38 (one notes box), 46 (labour above parts), 50 ("Bike is here"
  pill), 51 (ready-by is the diary day), 52 (one block per day, carry-over;
  settled 3 Oct), 58 (customer strip).
- No decision is reopened. Where the built app differs from a decision or
  from the old specs, `design.md` says so for Jack to look at.

## Capabilities

### New Capabilities

- `workshop-jobs`: a workshop job from creation to deletion: its reference,
  its links, the booking, bike and work states and the staff actions that
  move them, the version check, days, attachments, work and parts lines, the
  private customer link, the old derived status, and the staff job page.

### Modified Capabilities

None. There are no specs in `openspec/specs/` yet.

## Impact

- New files only, under `openspec/changes/document-workshop-jobs/`, plus one
  pointer line in each of the two older specs.
- No effect on code, database, routes, screens, dependencies or hosting.
