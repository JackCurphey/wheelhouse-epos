# Proposal: the time kept free each day, and retiring the old Edit workshop

## Why

Jack, 19 Oct (`docs/decisions/2026-10-19-retire-old-workshop-settings.md`):
the old app's Office › Edit shop › Workshop edits the opening hours (now in
the new Settings, #281) and the full-day threshold. Give the threshold its
drawn home, then remove the old screen.

## What Changes

- **Settings › Workshop › Online booking:** "Time kept free each day", in hours (drawn as `bk-settings-reserve`), "For lunches, admin and little jobs between bikes", with "Online booking treats a day as full once less than this is left." Saved when the box is left (`PUT /api/workshop-settings` `fullDayThresholdMinutes`), Owner only (#283).
- **The old app:** Office › Edit shop › Workshop is removed. Its menu item opens the new Settings instead, and Edit shop opens on Front desk.

## Lane, work package, drawings and decisions

- **Work package:** an early, partial WP-5.1 (Settings › Workshop › Online booking).
- **Lane:** Jack's: `src/screens/settings/settings-page.tsx`; `public/app.js` (removing an old screen once its replacement is merged, CLAUDE.md allowed rule 5). No server change.
- **Drawings:** `bk-settings-reserve` (`book.mjs`).
- **Decisions:** `2026-10-19-retire-old-workshop-settings.md` answers 1 and 5; `2026-09-04-job-type-before-diary.md` §2.2 (the reserve, default 2 hours).

## Out of scope

- The rest of Online booking as drawn, including the set time / whole day switch and its start date, drop off before the booking, notice in days, and the customer's drop-off line (answer 5: later pieces).

## Impact

- `src/screens/settings/settings-page.tsx`, `public/app.js`
- `tests/screens/settings-page.test.js`, an old-app test, a browser test
