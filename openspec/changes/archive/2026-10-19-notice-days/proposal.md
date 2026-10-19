# Proposal: notice in hours or days

## Why

Jack, 19 Oct (`docs/decisions/2026-10-19-retire-old-workshop-settings.md`
answers 4 and 8): with notice in hours, "24 hours" at 3pm means nothing
before 3pm tomorrow. Notice in days counts whole days: 1 day lets a
customer book any time tomorrow, whatever the time now.

## What Changes

- **Server:** `workshop_settings.min_notice_days` (migration 044, empty = notice in hours). When set, the earliest bookable moment is the start of the day that many days from the shop's today; otherwise it stays now plus `min_notice_minutes`. `GET`/`PUT /api/workshop-settings` carry `minNoticeDays` (1 to 28, or null for hours: the booking page shows dates to the end of next month).
- **Settings › Workshop › Online booking:** "Notice", "How far ahead customers must book", a number with hours or days (drawn as `bk-settings-notice-days`), saved when changed, Owner only, with the drawn note.

## Lane, work package, drawings and decisions

- **Work package:** WP-2.x booking rules, and an early piece of WP-5.1.
- **Lane:** **Mark's, flagged for him** (Jack, 19 Oct): `server/clock.js`, `server/routes/workshop-settings.js`, `server/workshop/jobs.js` (capacity settings), migration 044. Screen: `src/screens/settings/settings-page.tsx` (Jack's).
- **Drawings:** `bk-settings-notice-days`, `bk-settings-reserve` (`book.mjs`).
- **Decisions:** `2026-10-19-retire-old-workshop-settings.md` answers 4 and 8.

## Out of scope

- The set time / whole day switch; changes to the booking pages' own steps.

## Impact

- `server/migrations/044_notice_days.sql` (new), `server/clock.js`, `server/workshop/jobs.js`, `server/routes/workshop-settings.js`
- `src/screens/settings/settings-page.tsx`
- `tests/clock.test.js`, `tests/workshop-settings.test.js`, `tests/portal-availability-capacity.test.js`, `tests/screens/settings-page.test.js`
