# Proposal: opening hours in Settings

## Why

Jack, 19 Oct (`docs/decisions/2026-10-19-opening-hours.md`): the shop's
opening hours, drawn as `set-shop-hours`, on the new Settings page. Today
only the old app edits them, though the diary and online booking use them.

## What Changes

- **Settings › Shop and sites › Opening hours:** Monday to Sunday, each day Open or Closed, an open day with its opening and closing times. Each change saves at once (`PUT /api/workshop-settings` with `openingHours`), and a refusal is shown in plain words.

## Lane, work package, drawings and decisions

- **Work package:** an early, partial WP-5.1 (`set-shop-hours`).
- **Lane:** Jack's screens only (`src/screens/settings/`). No server change: `GET`/`PUT /api/workshop-settings` already carry `openingHours`.
- **Drawings:** `set-shop-hours` (`setup.mjs`).
- **Decisions:** `2026-10-19-opening-hours.md`; `2026-10-18-shop-details.md` answer 1 (one set for the business until sites).

## Out of scope

- Hours per site (WP-1.4, WP-5.2) and End of day's Close the day.

## Impact

- `src/screens/settings/settings-page.tsx`; `tests/screens/settings-page.test.js`; a browser test
