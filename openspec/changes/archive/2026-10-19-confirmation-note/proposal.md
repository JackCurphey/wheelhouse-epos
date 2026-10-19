# Proposal: the shop's additional note on the booking confirmation

## Why

The drawn booking confirmation (`bk-confirmed`) reads "Drop your Trek Domane
AL 3 off by 11:00, half an hour before your booking at 11:30. Please bring the
lock key, and tell us about any accessories." The drop-off sentence was built
in #287; the second was left off because no shop setting held it. Jack, 19 Oct
(`docs/decisions/2026-10-19-confirmation-note.md` answers 1 and 2): each shop
writes its own, in Settings › Online booking, starting with the drawn
sentence, named "Additional note on the confirmation".

## What Changes

- **Settings › Workshop › Online booking:** "Additional note on the confirmation", a text box under the drop-off row, starting with "Please bring the lock key, and tell us about any accessories."; the hint "Shown after the drop-off time once a booking is confirmed. Leave it empty to show nothing."; saved when the box is left, Owner only.
- **The booking link** (the customer's booking page): once the booking stands (confirmed, or a change to it waiting), the shop's note follows the drop-off sentence in the same paragraph.
- **Server:** `workshop_settings.confirmation_note` (migration 045); `GET`/`PUT /api/workshop-settings` carry `confirmationNote`; the booking link's reply carries `confirmationNote`.

## Lane, work package, drawings and decisions

- **Work package:** WP-2.x booking (customer link) and an early piece of WP-5.1, as the drop-off line (#287).
- **Lane:** screens are Jack's (`src/screens/book/`, `src/screens/settings/`). **Mark's, flagged for him:** migration 045, `server/routes/workshop-settings.js`, `server/routes/portal.js` (`bookingLinkView`).
- **Drawings:** `bk-settings` (the box), `bk-confirmed` (the sentence).
- **Decisions:** `2026-10-19-confirmation-note.md` answers 1 and 2.

## Out of scope

- The same note in texts and emails (messages are their own package), deposits.

## Impact

- `server/migrations/045_confirmation_note.sql`, `server/routes/workshop-settings.js`, `server/routes/portal.js`
- `src/screens/settings/settings-page.tsx`; `src/screens/book/pending.tsx`, `pending-query.ts`
- tests for each
