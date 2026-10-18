# Proposal: Change details on the job page

## Why

The retired old diary's job form let staff change a job's title, date,
times, customer, bike and mechanic after it was made; the new job page
couldn't. Jack, 18 Oct, kept it as "Change details"
(`docs/decisions/2026-10-18-old-diary-features.md` answer 3, and its tablet
and phone section).

## What Changes

- **"Change details"** on the job page opens a pop-up filled in from the
  job, with the job title, customer (Change customer, then find by name,
  phone or email), bike, date, start and end time, and the mechanic as pills
  (each mechanic, then Shared queue). There are Cancel and "Save changes".
- **Where the button sits:** beside Close on a computer or tablet. On a
  phone it sits in the job's details box, under Diary time and Ready by,
  and the pop-up fills the screen in one column.
- **Saving** sends every field with the version the page saw. The bike
  always goes too, so a new customer never keeps the old customer's bike, and
  a new customer's only bike is chosen for them. A refusal shows in plain
  words, and the pop-up stays open.
- **Not offered for finished work**, which is frozen until reopened. **A job
  over several days** changes its title, customer, bike and mechanic here;
  each day's date and time are changed in the diary.
- This changes Workshop day decision 32: the page itself still shows the
  mechanic as plain text, and dragging in the Day view still works.

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/job-dialog.tsx`, a new
  `change-details-dialog.tsx`. Screens only; the save route already takes
  every field.
- **Drawings:** `job-change-details`, `job-change-details-tablet`,
  `job-change-details-phone` and `job-change-button-phone`
  (`docs/design/user-journeys/generator/diary.mjs`).
- **Decisions:** `docs/decisions/2026-10-18-old-diary-features.md` (answer 3
  and the Change details section); gaps in `decided-while-building.md`, 18 Oct.

## Out of scope

- Deleting a job (#225, then its screen).
- The menu's till actions, its own change.

## Impact

- `src/screens/diary/job-dialog.tsx`, `src/screens/diary/change-details-dialog.tsx`
- `tests/screens/job-change-details.test.js`, `tests/browser/job-change-details.spec.ts`
