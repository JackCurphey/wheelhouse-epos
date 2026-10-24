# Proposal: a Done tick and a note on each line of a job's work and parts

## Why

The job page's "Work and parts" is drawn with a Done tick and a Note on every
line, on desktop, tablet and phone (`job-page.mjs:276-277`, `:287`, `:368-375`;
`job-overview`, `job-mechanic`, `job-waiting-parts`, `job-finished`). The
example note is "Rear pads worn — replacing" (`diary.mjs:2445`). Both waited
for Mark's sales in pence (#404), which rewrote the order lines they live on
(Jack, 23 Oct, `docs/decisions/2026-10-23-overnight-questions.md` item 4).
#404 has merged. Jack decided on 24 Oct that a line's note is for staff only,
with a quote line's reason copied in (`docs/decisions/2026-10-24-line-notes.md`).
Jack's lane.

## What Changes

- Each order line keeps whether it's done and a note (migration 074).
- `PUT /api/sale-documents/:id/items/:itemId/progress` sets one line's Done
  and note. It is refused once the work is finished, as the checklist is.
- Replacing a job's lines (`PUT …/items`, when a part's quantity changes or
  an item is added) keeps each line's Done and note, matched by its id.
- An approved quote line joins the order with its reason as the note.
- The job page shows the Done tick and Note column, with "+ Add note".

## Capabilities

### Modified Capabilities

- `workshop-jobs`: work and parts lines are ticked done and carry a staff
  note.

## Out of scope

- The customer's approval per line (the quote stage's own column).
- Who ticked a line (waits for PINs, WP-1.7).
- Anything the customer sees: the note never reaches them (Jack, 24 Oct).

## Impact

- `server/migrations/074_line_done_notes.sql`, `server/routes/sales.js`,
  `server/workshop/jobs.js` (`addApprovedLinesToOrder`);
  `src/screens/diary/work-parts.tsx`; tests.
- **Risky areas:** a migration, and money (the order lines). `/review` runs.
