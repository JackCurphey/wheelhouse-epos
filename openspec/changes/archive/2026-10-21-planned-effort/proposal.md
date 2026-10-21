# Planned effort on the Workshop Overview, and the bike's colour on its tag

## Why
The Workshop Overview (#346) left out Planned effort until the capacity figures could give it. Jack approved this on 21 Oct (`docs/decisions/2026-10-21-workshop-overview.md` answer 2), and the contract is in `openspec/changes/archive/2026-10-21-workshop-overview/design.md`. The bike tag (#347) printed the bike without the colour the drawing shows ("Trek Domane AL 3 · green"), because the job didn't send it. Under the working agreement (#349) Jack builds both.

## What changes
- **`computeCapacity`** gives each day:
  - `plannedMinutes`: bookings that stand (not a change request's held time, nor a request or offer waiting for an answer), their timed work inside each mechanic's working time with overlaps counted once, plus their untimed work and the shared queue;
  - `availableMinutes`: the mechanics' working time.

  `GET /api/workshop-capacity` sends both.
- **The Overview** shows Planned effort as "Nh / Nh" to the half hour, with "Shared and assigned, counted once" and the drawn fill bar. It's left out while the figures can't be read.
- **Jobs** carry `bikeColour`, and the bike tag prints "[bike] · [colour]".

## Impact
- **Code:** `server/capacity.js`, `server/routes/workshop-settings.js`, `server/workshop/jobs.js`, `src/screens/overview/overview-page.tsx`, `src/screens/diary/job-dialog.tsx`.
- **Tests:** `tests/capacity.test.js`, `tests/workshop-capacity-view.test.js`, `tests/screens/overview-page.test.js`, `tests/screens/bike-tag.test.js`.
