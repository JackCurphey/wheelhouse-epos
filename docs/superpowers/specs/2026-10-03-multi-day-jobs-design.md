> **History (8 Oct 2026).** What the app does today for workshop jobs is now in `openspec/specs/workshop-jobs/spec.md`; this document is kept as the record of how it was designed.

# Jobs over several days

**Decided by Jack, 3 Oct 2026.** Workshop day decision 52: "one block per
day". The database change is approved ("yeah go ahead with the database
change"). On how a job gets more days: "1 and 1", meaning **Add another day**
on the job page, and **automatic carry-over** of unfinished jobs.

## Intent

A job worked over several days shows as its own part on each day, in that
day's column ("Day 1 of 2"). Every day it takes really does take that
mechanic's time: the clash check, free-time sums and online availability all
count it. A job that isn't finished carries over to the next working day by
itself.

## Data (migration 037, additive only)

- New table `workshop_job_parts`: `id`, `shop_id` (row-level security, as in
  030), `workshop_job_id` (cascade on delete), `part_date`, `start_time`,
  `end_time`, `mechanic_id`, `position` (1, 2, 3 …; unique per job), with an
  index on `(shop_id, part_date)`.
- **Part 1 is the job's own date, time and mechanic.** Database triggers keep
  it identical: inserting a job creates part 1, and changing the job's date,
  times or mechanic changes part 1. That way every existing write path stays
  correct without being touched: the old app, the booking link, accepting a
  change request.
- Every existing job is backfilled as a one-part job, guarded per shop as in
  030.
- No columns are dropped, so deploying needs no special backup step.

## Server

- `GET /api/workshop-jobs?start&end` returns jobs with **any** part in the
  range, and each job carries `parts` ordered by position (`id`,
  `position`, `date`, `startTime`, `endTime`, `mechanicId`,
  `mechanicName`). `GET /api/workshop-jobs/:id` carries `parts` too.
- **Add another day:** `POST /api/workshop-jobs/:id/parts` with
  `{ version }`. It adds the next working day after the last part (a day the
  shop opens and the part's mechanic works), at the same time with the same
  mechanic. The usual slot rules apply.
- **Move a day:** `PUT /api/workshop-jobs/:id/parts/:partId` with
  `{ jobDate, startTime, endTime, mechanicId?, version }`. Part 1 moves the
  job itself (the existing PUT rules); later parts are checked by the same
  slot rules.
- **Remove a day:** `DELETE /api/workshop-jobs/:id/parts/:partId` with
  `{ version }`. It works for any part except part 1, and the parts after it
  close up.
- Every part change bumps the job's version, so the usual stale checks
  apply.
- **Slot rules, clashes and capacity read parts.** The same-mechanic overlap
  check, the clashes for a time-off block, and the free-time sums
  (`/api/workshop-capacity` and online availability) all count every part.
  Adding or moving a part takes the booking lock for its date.
- **Carry-over:** when the jobs list is read, an unfinished job whose last
  part's day has passed gets a new part. "Unfinished" means the bike is in
  the shop and the work isn't finished, with the booking scheduled or a
  change request open. The new part goes on the next day from today that the
  shop opens and the mechanic works, at the same time, with the same
  mechanic. It isn't refused for overlapping another job; the diary shows
  the overlap. It is idempotent, because once a part is today or later the
  job no longer qualifies. Shop days come from the shop's opening hours; a
  job with no mechanic uses shop days only.
- **Online bookings stay single-day.** Customers can't book more than one
  day, and a change request moves part 1 only.

## The staff app

- **Diary:** a block for each part, each saying "Day N of M" when there's
  more than one. Dragging or keyboard-moving a block moves that part.
- **Job page:** the days are listed under the job details; **Add another
  day** adds one; "Ready by" is the last part's day (decision 51).

## Not in this piece

- The old staff diary (`public/app.js`) shows day 1 only. It's being
  replaced.
- Online booking holds are kept for part 1 only. Later parts block online
  availability through the free-time sums, but not through the hold index.
  A staff member adding a day at the same instant a customer books that slot
  could double-book it, as can happen today with staff-made jobs.
- Removing a day isn't on the job page yet. The server route exists.

## Tests first

- `tests/migration-037.test.js`: the table, the triggers, the cascade, the
  backfill.
- `tests/workshop-job-parts.test.js`: GET range and `parts`, add, move,
  remove, version checks, overlap with another job's later part, capacity
  and clashes counting later parts, carry-over.
- The React diary and job page tests for the blocks and Add another day.

Each test is watched failing first.
