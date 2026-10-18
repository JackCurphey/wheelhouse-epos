# Design: the mechanic sign-off, piece 1

## Contract (server half first, then screens)

**Finish asks who.** `POST /api/workshop-jobs/:id/finish` with body
`{ version, signedOffBy }`:
- `signedOffBy` must be an active mechanic of the shop (`employees.active = 1 AND is_mechanic = 1`). Missing or not a mechanic → 400 `{ error: 'Choose who is signing this off', code: 'sign_off_required' }`, and nothing changes.
- On success, in one transaction with the work move: `workshop_jobs.signed_off_by` and `signed_off_at = now()` are set, and a row goes into `workshop_job_sign_offs` (job, mechanic, time).
- The reply is the job as now, with the three fields below.

**Reopening clears it.** `POST /api/workshop-jobs/:id/reopen-work`, and the
old app's `PUT /api/workshop-jobs/:id` when it moves the work away from
complete, set `signed_off_by` and `signed_off_at` to null and stamp
`cleared_at = now()` on the job's open row in `workshop_job_sign_offs`. The row
stays (answer 4: "the earlier sign-off stays in the job's history").

**Every job read carries:** `signedOffBy` (employee id or null),
`signedOffByName` (or null), `signedOffAt` (ISO time or null).

**Not changed:** the till's convert still finishes a job without asking
(answer 5, a later piece in Mark's `sales.js`).

## Data (migration 040)

```sql
ALTER TABLE workshop_jobs
  ADD COLUMN signed_off_by INTEGER REFERENCES employees(id),
  ADD COLUMN signed_off_at TIMESTAMPTZ;
CREATE TABLE workshop_job_sign_offs (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  workshop_job_id INTEGER NOT NULL REFERENCES workshop_jobs(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  signed_off_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cleared_at TIMESTAMPTZ
);
```
with the shop index and row security every shop table has. Additive only.

## Screens

- `SignOffDialog` (new): title "Who’s signing this off?", subtitle "[title] · [reference]", the drawn note, a radio group "Signed off by" with the active mechanics as pills, Cancel and "Sign off and mark ready" (greyed until someone is picked). The job's mechanic is picked when they're in the list; a shared-queue job has nobody picked.
- The job page's "Mark ready for collection" opens it instead of finishing straight away.
- The finished job page shows, under the customer strip: a tick, "Signed off by **[name]** · [day], [time]" (London time, as `Thu 17 Sep, 15:30`).
