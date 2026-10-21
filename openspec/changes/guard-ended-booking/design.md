# Design: a booking that has ended can't be booked in or started

## Where the check sits

In `applyEvent` (`server/workshop/transitions.js`), after the machine's own
check and before the version check. Every staff move goes through it:
`jobActionRoute` in `server/routes/workshop.js`, the portal's booking moves
(`server/workshop/jobs.js`) and payment finishing the work (`server/routes/sales.js`).
Nothing else writes `custody_state` or `work_state` (checked with grep), so one
check covers every way in, and `server/routes/workshop.js` (Jack's file)
needs no change.

Order of checks, unchanged in spirit from "A refused move says why":

1. Job not found (or another shop's) → `not_found`.
2. The machine doesn't allow the move from where the job is → `illegal`,
   "cannot [move] a job that is [state]; from here you can [moves]".
3. **New:** the booking has ended and the move is one this change refuses →
   `illegal`, "This booking [was cancelled|was declined|expired], so the job
   can't be [booked in|started|put on hold|reopened]."
4. The version is out of date → `stale`.

The new check comes before the version check so that, as with the machine's,
a move that is not allowed is never reported as a race.

## Which moves

| Booking | Refused | Still allowed |
|---|---|---|
| cancelled (by customer or staff), declined, expired | book in; start; hold of work not started; work reopen | collect; custody reopen; hold, waiting for parts, parts arrived, resume and finish of work already under way; every booking move the booking machine allows |
| pending, scheduled, reschedule requested | — | as before |

- **Book in, start:** what #190 A and item 5 name.
- **Hold, before the work starts:** decided here, for Jack to overrule. From not started, hold puts
  the job into the workshop's work as surely as starting it, and the job
  page offers no next step on an ended booking (spec: "It SHALL show none
  for… a cancelled, declined or expired booking").
- **Work already under way:** staff can cancel a scheduled booking whose
  work has started (the booking machine allows it; the customer's own
  cancel refuses once work has started). That work can still be held, wait
  for parts, resume and be finished, so it can be wrapped up; hold is
  refused only from not started.
- **Work reopen:** decided here, for Jack to overrule. Reopening finished
  work on an ended booking would start it again; the job page shows no
  button for it either.
- **Collect and custody reopen:** allowed, because item 5 keeps "Bike is
  here" on for a bike that really is in the shop; the bike must be able to
  leave, and a collected bike brought back must be recordable (its work
  then can't be reopened on that booking; a new job would be needed).
- **Pending:** not ended. A request still to be answered can still be
  booked in, as the spec already says; this change leaves it alone.

## The refusal

The decision gives no code or words. The nearest refusal is the machine's own
(`illegal`, HTTP 409): the move is never allowed from here, and retrying won't
help, so a screen branches the same way. `settle_first` (job delete) was
considered and not copied: that code tells the screen to send staff to the
till, which is a different next step. The words follow item 2's plain-words
pattern ("The bike is already here."), starting with Jack's own words for
the booking: "This booking was cancelled.", "This booking was declined.",
"This booking expired." (Jack's section of `decided-while-building.md`,
15 Oct, plain refusals, item 1).

## Contract

`POST /api/workshop-jobs/:id/{book-in,start,hold,reopen-work}` on an ended
booking → `409 { "error": "This booking was declined, so the job can't be started.", "code": "illegal" }`.
The job and its version are unchanged. No new fields, no migration.

## Known limit

Work put on hold before it started, whose booking then ends, can still be
resumed, which starts it: the work's state can't tell held-before-starting
from held-while-under-way. Left for Jack and Mark to decide whether that
needs its own refusal.
