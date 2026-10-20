# New job: what the customer told us

## Why
New job's drawings (`new-job`, `new-job-day`, `new-job-entered`) show "Note for the customer", "Printed on their receipt.", apart from "Staff notes"; New job had one "Notes" box. Jack, 20 Oct (`docs/decisions/2026-10-20-new-job-customer-note.md`): it is what the customer tells us about the problem, shown as "From the customer" on the job page and printed on their receipt.

## What changes
- New job gains "Note for the customer" ("Printed on their receipt."); its "Notes" box is labelled "Staff notes", as drawn.
- `POST /api/workshop-jobs` takes `customerDescription` (text, up to 2,000 characters; blank is none) and keeps it as the job's `customer_description`, which the job page shows as "From the customer" and online bookings already fill.
- A job's receipt, from the diary or the till, prints "From the customer: [words]" under the job and bike.

## Impact
`server/routes/workshop.js` (workshop server, flagged for Mark); `src/screens/diary/new-job-dialog.tsx`, `diary-page.tsx`; `src/screens/till/receipt.tsx`, `till-page.tsx`. Tests: `tests/workshop-jobs.test.js`, `tests/screens/diary-new-job.test.js`, `receipt.test.js`, `diary-stretch.test.js`, `till-job.test.js`.
