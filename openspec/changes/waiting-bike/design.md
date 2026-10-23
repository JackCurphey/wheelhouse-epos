# Design: each "Waiting for you" item carries the bike

## Contract

`GET /api/workshop-waiting` items gain one field, beside `customerName`:

| Field | Type | Meaning |
|---|---|---|
| `bikeLabel` | string or `null` | The job's bike, make then model (`trim(make || ' ' || model)`), the same words and field name diary jobs carry from `WORKSHOP_JOB_SELECT`. `null` when the job has no bike. |

Every kind carries it: `new_booking`, `change_request` and
`customer_cancelled`. Nothing else in the item changes.

## How

The waiting query joins `customer_bikes` on `workshop_jobs.bike_id`, as
`WORKSHOP_JOB_SELECT` does, and `waitingItem` passes `bike_label` through.
An online booking links a bike when the customer chose one of theirs or
registered a new one (`server/routes/portal.js`); a staff-made job is never
in the list.

## Choices

- The same name and words as the diary's jobs, so a screen shows a Waiting
  card's bike exactly as it shows that job's block (`job.bikeLabel || 'Bike'`
  in `src/screens/diary/diary-page.tsx`). The fallback for `null` is the
  screen's to choose.
- An inactive bike still shows: the booking was made with it.
