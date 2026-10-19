# Proposal: Preview what the customer sees

## Why

Jack, 19 Oct (`docs/decisions/2026-10-19-booking-preview.md` answers 1 and 2): while editing Online booking, a Preview button shows the booking-confirmed page as the customer sees it, using the shop's current settings. Drawn as `bk-settings-preview` and approved.

## What Changes

- **Settings › Workshop › Online booking:** "Preview" under the Additional note on the confirmation opens "What the customer sees" ("An example booking, with your settings as they are now"): "Booking confirmed", "See you on Thursday 17 September, Maya", the drop-off sentence and the shop's note, then Service, Bike and When; the note "Customers see this once a booking is confirmed. Change a setting and preview again to see the difference."; Close.
- The example booking is the drawings' (Maya Patel, Trek Domane AL 3 · green, Standard service £65.00, Thursday 17 September at 11:30); the drop-off time, note, prices and set time or whole day are the shop's own saved settings.

## Lane, work package, drawings and decisions

- **Lane:** screens only, Jack's (`src/screens/settings/`). No server change: everything comes from `GET /api/workshop-settings`.
- **Drawings:** `bk-settings-preview`, `bk-confirmed`.
- **Decisions:** `2026-10-19-booking-preview.md` answers 1 and 2.

## Out of scope

- Previews of texts and emails (none are sent yet).

## Impact

- `src/screens/settings/settings-page.tsx`, a new `src/screens/settings/booking-preview.ts`; tests
