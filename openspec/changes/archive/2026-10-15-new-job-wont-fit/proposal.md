# Proposal: New job warns when the work won't fit

## Why

Decision 23 (`docs/decisions/2026-09-27-workshop-day-review.md`): "New job
warns when the job won't fit. Choosing the work sets the job's time; if the
free time at the chosen slot is shorter, the form says so before saving."
It is drawn but not built (issue #192, "Decided but not built"). Today staff
can save a 90-minute service into a 30-minute gap and only see the overlap
afterwards on the diary.

## What Changes

- Once work is chosen, New job reads the mechanic's free time for the day
  (`GET /api/workshop-capacity`, already on the server) and, when the free
  time from the chosen start is shorter than the work, shows the drawn
  warning: "Only 30 minutes free at 12:00 — this job needs 60. Choose
  another time, or save anyway and the diary will show the overlap." Save
  stays available.
- The warning's link, "Find the next free [n] minutes", moves the job to the
  same mechanic's next gap long enough for the work, later that day or on a
  following day (Jack, 15 Oct, `docs/decisions/2026-10-15-new-job-wont-fit.md`).
- Works the same from a grid click and from "Enter a time instead".

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/new-job-dialog.tsx` (split plan §3).
  No server change: the capacity answer is Mark's, read as it is.
- **Drawings:** `new-job` (warning shown, 30 minutes free at 12:00 for a
  60-minute Standard service), `new-job-day` (120 free, no warning),
  `docs/design/user-journeys/generator/diary.mjs` lines 2057–2133 and
  2199–2229. Drawn on desktop, tablet and phone.
- **Decisions:** decision 23; Jack's answer of 15 Oct on the link.
- **Decided here** (logged in `decided-while-building.md`, Jack's section):
  no warning for the Shared queue (it has no free windows of its own); a
  start inside busy time reads "No free time at [time]"; the link looks 60
  days ahead, as Add another day does, and says so when nothing is found.

## Out of scope

- Untimed work, lunch and leave screens, the reserve (decision 2.x settings).
- Any change to how the server works out free time.
- The rest of #192.

## Impact

- `src/screens/diary/new-job-dialog.tsx`, `tests/screens/diary-new-job.test.js`,
  `workshop-diary`'s New job requirements.
