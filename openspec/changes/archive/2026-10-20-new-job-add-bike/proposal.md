# New job: + Add a bike

## Why
New job's drawings (`new-job`, `new-job-day`, `new-job-entered`) show "+ Add a bike" under the Bike list, but nothing is built: a walk-in customer's new bike has to be added somewhere else first. Split plan §7.2 lists New job's extras as buildable early with nothing to wait for. The page it opens isn't drawn; the not-drawn pages decision (row 22, `docs/decisions/2026-10-08-not-drawn-pages.md`) answers C: follow a built pattern.

## What changes
"+ Add a bike" (waiting for a customer) opens the old job form's inline fields (`public/app.js`, the workshop job form's new-bike subform): Make ("e.g. Trek"), Model ("e.g. FX2"), Colour, Serial number, with Cancel and **Add bike**, which adds the bike to the customer and chooses it. A bike needs a make or a model.

## Impact
`src/screens/diary/new-job-dialog.tsx`; `tests/screens/diary-new-job.test.js`. No server change: `POST /api/customers/:id/bikes` exists.
