# Design

`serializeWorkshopJob` (server/workshop/jobs.js) adds
`plannedMinutes: row.planned_minutes ?? null`. Every job reply is built from
it, so the list, one job, new job, the day routes, edits and actions all
carry it. The column is already selected (`w.*`). What it holds is set
when the job is made (`createWorkshopJob`: what staff gave, else the length of
its times, else null) or booked online (its services' total), and kept by an
edit (a timed job's length is its times).

The screens' `WorkshopJob` type already declares `plannedMinutes`;
`requestMinutes` already prefers it. `WORKSHOP_JOB` and
`WORKSHOP_JOB_CHANGED` in `src/lib/api/shapes.ts` gain
`plannedMinutes: number or null`, and `tests/helpers/fake-job.js` sends null
(a fake job with no times).
