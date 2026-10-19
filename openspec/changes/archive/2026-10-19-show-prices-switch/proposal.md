# Proposal: the "Show prices on the booking page" switch

## Why

Jack, 19 Oct (`docs/decisions/2026-10-19-retire-old-workshop-settings.md`
answer 11): the drawn switch for showing service prices on the online
booking page (`bk-settings`), stored already as `show_prices_online` but with
no screen.

## What Changes

- **Settings › Workshop › Online booking:** "Show prices on the booking page", On or Off, after the time kept free, as drawn. It saves at once (`PUT /api/workshop-settings` `showPricesOnline`), Owner only.

## Lane, work package, drawings and decisions

- **Work package:** an early piece of WP-5.1.
- **Lane:** Jack's screens only (`src/screens/settings/settings-page.tsx`). No server change.
- **Drawings:** `bk-settings`, `bk-settings-reserve` (`book.mjs`).
- **Decisions:** `2026-10-19-retire-old-workshop-settings.md` answer 11.

## Out of scope

- Confirming bookings automatically (a later piece, mostly Mark's WP-4.2) and deposits.

## Impact

- `src/screens/settings/settings-page.tsx`; `tests/screens/settings-page.test.js`; a browser test
