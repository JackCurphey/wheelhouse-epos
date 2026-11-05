## Why

A sale whose answer was lost, then a second press, recorded the sale twice: the reviewer sent a sale, reset the connection once it was saved, and sent it again; stock went from 10 to 8 with two lines. The same lost answer on a job's order was told "already converted", which can't tell it from another till's payment.

## What Changes

- `POST /api/sales` and `POST /api/sale-documents/:id/convert` take a request key. A repeat with the same key and the same details gets the first answer and changes nothing.
- A sale's key with different details is refused, saying the sale was recorded and which it is. On an order, a different payment or another till's gets the already-paid answer.
- A refused or failed sale keeps no key, so it can be tried again.
- The till sends a key per sale, kept across retries, until Next sale or Clear. The old till sends one too.

## Out of scope

Other routes. The till's "Lost touch" wording. Making the key required: other callers have none yet (the Shopify webhook doesn't use this route).

## Who and risk

Jack's side, found in the review of WP-1.5 piece 2. Risky: **migrations** (116) and **money and stock**.

## Follows

- Pattern: `readRequestKey`, Book in's `reused_key` (`delivery-booked-in`).
- Decisions: `docs/decisions/decided-while-building.md` (18 Oct, the till's refusals after the card step; 4 Nov, a job already paid).
- Drawings: none change; words logged in `decided-while-building.md`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `till`: a sale or an order's payment sent twice counts once.

## Impact

Migration 116; `server/routes/sales.js`; `src/screens/till/pay-dialog.tsx`, `till-page.tsx`; `public/app.js`.
