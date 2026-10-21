# The old app never takes a workshop job's payment

## Why
Mark's 21 Oct review (working agreement task 3.11) found that a workshop job's order could still be paid in the old app with no sign-off. The 16 Oct sign-off decision had kept that. Jack, 21 Oct (`docs/decisions/2026-10-21-old-app-placeholder.md`): "the old app should never take payment for a finished workshop job. Nobody uses the old till… Maybe for now we can send it to new till, but ultimately, I want to get rid of the old app completely."

## What changes
- In the old app, the till's "Load into sale" and an order's "Convert to sale" on a workshop job's order now open the new till for that job (`/workshop/till?job=`), where the sign-off is asked.
- `POST /api/sale-documents/:id/convert` refuses a workshop job's order when the payment doesn't answer the sign-off question (no `signedOffBy` key). It replies 400 `use_till` and sells nothing. The new till always sends the key (`null` when it didn't ask). Orders with no job are unchanged.

## Impact
- Code: `public/app.js`, `server/routes/sales.js`. That is money, a risky area, so it gets a fresh review.
- Tests:
  - `tests/sale-documents-sign-off.test.js` replaces the "old app pays unsigned" test.
  - `tests/workshop-work-actions.test.js` and `tests/sale-documents-job-payment.test.js` now pay as the till does.
  - `tests/browser/old-app-workshop.spec.ts` covers the two old-app buttons.
