# The Workshop Overview page

## Why
Workshop › Overview in the staff app's sidebar opens "Not built yet: overview". It is drawn as `overview` in `generator/diary.mjs`, and the workshop day review of 27 Sep keeps it as the Workshop room's second page. Jack moved it forward from stage 4 and settled what it counts and lists (21 Oct, `docs/decisions/2026-10-21-workshop-overview.md`).

## What changes
- The page shows today's date (the shop's own) with "one shop, one view of the work", then two figures:
  - **Expected today**: bikes booked for today, with "N still to arrive".
  - **In the workshop**: bikes in the shop now, with "N ready to collect".
- **Planned effort** is left out, handed to Mark (design.md).
- A "Show jobs" choice of four tabs, each with its count:
  - **Arrivals**: today's bookings not in yet.
  - **Shared queue**: no mechanic, work not finished.
  - **Needs attention**: waiting for parts or on hold.
  - **Ready**: in the shop, work finished.
- Under the tabs, a table of jobs (Job / customer, Bike, Work, Custody, and an action), or rows on a phone, sorted by time.
  - **Arrivals** have Book in when due. Otherwise they show the appointment time, or "Drop-off".
  - Each job's number and name open its page in the diary.
- `GET /api/workshop-jobs` takes `custody=in_shop` and returns every job with the bike in the shop, whatever its days. A ready bike from an earlier day has no part today. This is a workshop server change, built on Jack's word and flagged for Mark.

## Impact
- New page: `src/screens/overview/overview-page.tsx`, registered in `src/staff/app-shell.tsx`.
- Server: `server/routes/workshop.js`, the jobs list's `custody` filter.
- Tests: `tests/screens/overview-page.test.js` and `tests/workshop-jobs-custody.test.js`.
