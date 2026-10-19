# Proposal: telling the customer when to drop the bike off

## Why

Jack, 19 Oct (`docs/decisions/2026-10-19-retire-old-workshop-settings.md`
answers 3 and 7): set-time customers drop the bike off before their booking,
by the shop's lead time (30 minutes to start); the customer is told so.
Today the booking page shows only the booked time.

## What Changes

- **The booking link** (the customer's booking page): once the booking is confirmed (or a change to it waits), a line under the heading: "Drop your Trek Domane AL 3 off by 11:00, half an hour before your booking at 11:30." (`bk-confirmed`). A whole-day booking says "Drop your bike off between 09:00 and 10:00." (`bk-when-dropoff`'s words).
- **Settings › Workshop › Online booking:** "Drop off before the booking", in minutes (drawn in `bk-settings-reserve`), saved when the box is left, Owner only. Shown while bikes are booked in for a set time.
- **Server:** the booking link's reply carries `dropOff`: `{ by, booked }` for a set time (the booked time less `timed_lead_minutes`), `{ from, to }` for the whole day (the shop's drop-off window), or `null`.

## Lane, work package, drawings and decisions

- **Work package:** WP-2.x booking (customer link) and an early piece of WP-5.1.
- **Lane:** screens are Jack's (`src/screens/book/`, `src/screens/settings/`). **Mark's, flagged for him:** `server/routes/portal.js` (`bookingLinkView`).
- **Drawings:** `bk-confirmed`, `bk-when-dropoff` (`book.mjs`), `bk-settings-reserve`.
- **Decisions:** `2026-10-19-retire-old-workshop-settings.md` answers 3 and 7; `2026-09-04-booking-mode-and-downtime.md` §2 item 3 (the drop-off expectation by mode).

## Out of scope

- The set time / whole day switch, notice in days, and the booking flow's own steps.

## Impact

- `server/routes/portal.js`; `src/screens/book/pending.tsx`, `pending-query.ts`, `pending-rules.ts`; `src/screens/settings/settings-page.tsx`
- tests for each
