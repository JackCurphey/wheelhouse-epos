# Proposal: month view in the diary

## Why

The retired old diary had a month view (CAL-02, `docs/decisions/2026-08-31-feature-catalogue.md`).
Jack, 18 Oct, kept it for the new diary (`docs/decisions/2026-10-18-old-diary-features.md`
answer 1, and its "Month view on tablet and phone" section).

## What Changes

- **Desktop and tablet:** "Month" joins Week and Day. The grid holds the
  month's weeks, Monday to Sunday, with days from the next or last month
  dimmed. Each day shows up to three jobs, earliest first (start time and
  bike, coloured by status), then "+[n] more", which opens the day's list:
  time, bike and job, status, customer and mechanic, and "Open this day in
  the Day view". A job opens its page, and a day's date opens it in the
  Day view. The arrows move a month at a time. Waiting for you and the
  people buttons stay.
- **Touch screens:** a day's jobs are too small to tap one by one, so a tap
  anywhere in a day opens its list, with rows at least 44px tall.
- **Phone:** the week label opens "Choose a day", the month with each day's
  number of jobs. A tap on a day goes to it.

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/diary-page.tsx`, `rules.ts`.
  Screens only; the jobs route already takes any date range.
- **Drawings:** `diary-month`, `diary-month-more`, `diary-month-tablet`,
  `diary-month-more-tablet` and `diary-month-phone`
  (`oldDiaryFeatureDrawings()` in `docs/design/user-journeys/generator/diary.mjs`).
- **Decisions:** `docs/decisions/2026-10-18-old-diary-features.md` (answer 1
  and the month section); gaps in `decided-while-building.md`, 18 Oct.

## Out of scope

- Dragging or stretching in the month (CAL-05: "month is click-to-open").
- Change details and the menu's till actions, each its own change.

## Impact

- `src/screens/diary/diary-page.tsx`, `rules.ts`
- `tests/screens/diary-month.test.js`, `tests/screens/diary-rules.test.js`,
  `tests/screens/diary-phone.test.js`, `tests/browser/diary-month.spec.ts`
