# Proposal: the mechanic sign-off, piece 1 (on "Mark ready for collection")

## Why

Workshop day decision 64: a mechanic puts their name to a finished job,
saying it's fine to go out, so a job that comes back shows who passed it.
Jack designed it on 16 Oct (`docs/decisions/2026-10-16-mechanic-sign-off.md`,
answers 1–8) and approved the pictures on 17 Oct. On 18 Oct he chose piece 1
first, with a table keeping every sign-off (that file's "Building it").

## What Changes

- **"Mark ready for collection" asks "Who's signing this off?"** with the shop's mechanics as pills. The job's own mechanic is picked for you (answer 2); a shared-queue job has nobody picked (answer 7). "Sign off and mark ready" finishes the work and records who and when. No PIN (answer 6).
- **The finished job page shows "Signed off by [name] · [day], [time]"** (answer 3).
- **Reopening the work clears the sign-off** (answer 4). Finishing again asks again. The earlier sign-off stays in a new sign-off table, so the job's history keeps it.
- **Server:** `POST /api/workshop-jobs/:id/finish` needs `signedOffBy`, an active mechanic. The job carries `signedOffBy`, `signedOffByName` and `signedOffAt`. Migration 040 adds the two job columns and the `workshop_job_sign_offs` table.

## Lane, work package, drawings and decisions

- **Work package:** WP-4.1 (Workshop day, the rest): "mechanic sign-off". Built early on Jack's 18 Oct answer.
- **Lane:** Jack's whole workshop area (split plan §3): `server/routes/workshop.js`, `server/workshop/**`, the workshop migration, and `src/screens/diary/`. Every server change Jack makes needs Mark's approval (split plan §3, CLAUDE.md), so the server half is flagged for him.
- **Drawings:** `signOffDrawings()` in `diary.mjs`: the pop-up over `job-mechanic`, and the finished job page with the "Signed off by" line. Desktop only; tablet and phone follow the job page's pop-ups (`decided-while-building.md`).
- **Decisions:** `2026-10-16-mechanic-sign-off.md` answers 1, 2, 3 (staff side), 4, 6, 7 and "Building it"; Workshop day decision 64.

## Out of scope

- The till asking when a payment finishes a job (answer 5): `server/routes/sales.js` is Mark's. Until then a job finished by paying at the till goes out unsigned.
- "Show who signed off to customers" and "Checked by [name]" on receipts and the booking link (answer 3, customer side).
- A screen showing the sign-off history (the job history is WP-1.2).
- The old app (`public/app.js`), which finishes jobs through its own form and is unchanged (decision file).

## Impact

- `server/migrations/040_job_sign_off.sql` (new), `server/routes/workshop.js`, `server/workshop/jobs.js`
- `src/lib/api/types.ts`, `src/screens/diary/job-dialog.tsx`, `src/screens/diary/sign-off-dialog.tsx` (new)
- `tests/workshop-sign-off.test.js` (new), `tests/screens/job-sign-off.test.js` (new), a browser test
