# Proposal: Cancel booking on the booking page

## Why

Book a repair decision 10 (Jack, 1 Oct, `docs/decisions/2026-10-01-book-a-repair-review.md`): changing and cancelling happen on the booking's own page. Jack, 19 Oct, chose Change the date and Cancel booking next. The server's cancel route already exists (`POST /api/portal/:slug/booking-links/:code/cancel`, piece 12) and the link says when a customer can cancel (`canCancel`); no screen uses them yet. Cancel comes first; Change the date needs data the server doesn't send yet and follows separately.

## What Changes

- **Confirmed booking page:** "Cancel booking" under the card, while the booking can still be cancelled online (`canCancel`).
- **"Cancel this booking?"** pop-up (`bk-cancel`): the day, time and bike under the title; "There's nothing to pay or refund." (no shop takes deposits yet); Keep my booking / Cancel booking; a refusal shown in the server's words.
- **Cancelled page** (`bk-cancelled`): "Cancelled", "Your booking is cancelled", the day, service and bike, "There's nothing to pay or refund.", Book another time, the shop's name.
- The contact line becomes "Need to change the date? Contact [shop]" until Change the date is built.

## Lane, work package, drawings and decisions

- **Work package:** part of WP-4.4 (bk-cancel, block 8; bk-cancelled on the bk-page board), taken early. **Lane:** Jack's screens; no server change.
- **Drawings:** `bk-cancel`, `bk-cancel-ls` (the no-deposit wording), `bk-cancelled` (`book.mjs` `cancelDialog`, `cancelled`, `pageButtons`).
- **Decisions:** `2026-10-01-book-a-repair-review.md` decisions 4, 10 and 12; Jack, 19 Oct (this piece).

## Out of scope

- Deposit wording and the late cut-off (no deposits yet); Cancel request on a request's page; Change the date; Add a note for the shop; texts confirming the cancellation (none are sent yet).

## Impact

- `src/screens/book/pending.tsx`, `pending-rules.ts`, `pending-query.ts`; tests
