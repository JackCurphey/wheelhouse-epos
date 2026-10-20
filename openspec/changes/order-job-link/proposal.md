# An order's workshop job opens in the new diary

## Why
The old app's order screen still opened the old job form for an order's workshop job, the one place the old form was left after the old diary was retired (`docs/decisions/2026-10-18-retire-old-diary.md` item 3). Jack changed that on 20 Oct: "1: yes — an order's 'Show in workshop diary' and 'View / edit workshop job' open the new diary and job page now, before the order screen is rebuilt."

## What changes
- "View / edit workshop job" on an order opens the new diary on the job's day with its page open (`/workshop/diary?date=…&job=…`).
- Ticking "Show in workshop diary" saves what's typed on the order, then opens the new diary with New job, as "Enter a time instead" opens it, filled in from the order: its title, customer and note (`/workshop/diary?order=…`). Saving the job links it to the order, as the old form did. A refused link says the job is saved but not linked.
- Unticking it (removing the job) stays in the old app until the order screen is rebuilt.
- The old job form is no longer opened from anywhere; removing its code is a separate pull request (rule 5).

## Impact
`public/app.js` (the two buttons), `src/screens/diary/diary-page.tsx` (the two openers), `src/screens/diary/new-job-dialog.tsx` (filled from an order, the link). No server change: the order's existing `PUT /api/sale-documents/:id` takes `workshopJobId`. Tests: `tests/screens/diary-from-order.test.js`, `tests/browser/old-app-workshop.spec.ts` (the two old-form version tests go with the form's last opener).
