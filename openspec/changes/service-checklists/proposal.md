# Service checklists: the shop's own, and the job's full service checklist

## Why
The job page's "Full service checklist" is drawn (`job-checklist`, and its
bar on `job-overview`'s `job-mechanic`), shown "only for jobs whose service
has a checklist" (Workshop day 39, 27 Sep). On 22 Oct Jack decided each shop
writes its own checklists in Settings and chooses which services have each,
with a ready-made full service template, and approved the Settings drawings
(`docs/decisions/2026-10-22-service-checklists.md`; `set-workshop-checklists`,
`set-workshop-checklists-empty`, `set-workshop-checklist-edit`). Built ahead
of stage 4 on Jack's word (22 Oct).

## What changes
- **Settings › Workshop › Checklists** (Owner only, as all Settings until
  roles): list, add (blank or from the full service template), edit the name
  and items, choose the services that use it, remove.
- **A job's checklist** is its first service's checklist (the online
  booking's services in order, else the services on its order). The job page
  shows the bar ("8 of 10 done · 1 note") and the pop-up, where staff tick
  items and add a note per item. A job keeps the checklist it began with:
  the first tick or note copies it onto the job.
- **New job remembers its service**, so a staff job can have one.
- Not here: per-line Done ticks and notes (after sales in pence, which
  rewrites the same order lines), and the customer's booking page checklist
  (a later piece, its contract already agreed).

## Risky areas
A migration (052). Not money, sign-in or the messaging core. Needs `/review`.

## Impact
- **Code:** `server/migrations/052_service_checklists.sql`,
  `server/workshop/checklists.js` (new), `server/routes/workshop-settings.js`,
  `server/routes/workshop.js`, `src/screens/settings/`, `src/screens/diary/`.
- **Tests:** `tests/workshop-checklists.test.js` (new), screen tests for the
  Settings fold and the job's checklist, a browser spec.
