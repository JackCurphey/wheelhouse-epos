# Proposal: paying a workshop job's order at the till (first piece)

## Why

The diary menu's "Open in the till" waited for a till that could open a
job's order (`docs/decisions/2026-10-18-old-diary-features.md`). Jack, 18 Oct,
chose to build the full payment now and the rest as its server pieces arrive
(`docs/decisions/2026-10-18-till-job-payment.md`).

## What Changes

- **The till opens a job's order** at `/workshop/till?job=[id]`:
  - The job's agreed lines are locked ("· agreed on the job"), with the customer and job ("Maya Patel · workshop job WH-1042").
  - "Bike collected when paid" is on by default, shown while the bike is in the shop.
  - "Take payment" pays the whole order by card, cash or both (`POST /api/sale-documents/:id/convert`), which finishes work in progress. Then the bike is recorded as collected (`POST /api/workshop-jobs/:id/collect`) unless the pill is off.
  - An order already paid says so. Work not yet in progress or finished can't be paid.
  - Extras are added on the job's Work and parts, as paying charges the order's own lines.
- **The amount due, and stock:** the till asks the server what paying the order takes, with the order's and the customer's group discounts off (`GET /api/sale-documents/:id/due`, new). Paying a job's order sells past zero stock, as the plain till does (`sellPastStock` on convert). Both change `server/routes/sales.js`, Mark's, on Jack's 18 Oct answer.
- **The diary menu's "Open in the till"** opens it. It's greyed with "Not booked yet" on a request, "Already paid" once paid, or "No order on this job".
- **The job page's "Take payment"** replaces "Hand over" on finished work whose order isn't paid (collect and pay decision 3). Paid work keeps "Hand over".

## Lane, drawings and decisions

- **Lane:** Jack's screens: `src/screens/till/`, `src/screens/diary/`.
  The server already pays and collects.
- **Drawings:** `till-job` (`till.mjs`), `job-finished`'s "Take payment" and
  `diary-menu-job` / `diary-menu-pending` (`diary.mjs`).
- **Decisions:** `2026-10-18-till-job-payment.md`; collect and pay decision 3;
  Workshop day decision 63; selling at the till decision 10;
  `2026-10-08-paying-for-finished-work.md`.

## Out of scope

- Deposits and paying in parts (Mark's sales-in-pence server work, stage 3).
- The till's "Who's signing this off?" (once the sign-off is built).
- The "job changed while you were paying" warning (not drawn yet), and receipts.

## Impact

- `src/screens/till/till-page.tsx`, `pay-dialog.tsx`; `src/screens/diary/job-extras.tsx`,
  `diary-page.tsx`, `job-dialog.tsx`
- `tests/screens/till-job.test.js`, `tests/browser/till-job.spec.ts`, and
  the menu and job page tests
