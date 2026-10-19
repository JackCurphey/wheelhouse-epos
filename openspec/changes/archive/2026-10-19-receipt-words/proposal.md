# Proposal: words at the bottom of receipts

## Why

Jack, 19 Oct (`docs/decisions/2026-10-19-receipt-words.md`): a shop's
returns policy or thank-you, typed once in Settings › Till › Receipts and
printed on every receipt above the barcode, as `set-till-receipts` draws it.

## What Changes

- **Settings › Till › Receipts:** "Words at the bottom" (several lines), the drawn placeholder and note, saved when the box is left.
- **The receipt:** the words print just above the barcode, after the shop's details, keeping their line breaks; nothing when blank.
- **Server:** `shops.receipt_footer` (migration 043); `receiptFooter` on `GET`/`PUT /api/shop-details`, up to 500 characters.

## Lane, work package, drawings and decisions

- **Work package:** an early, partial WP-5.1 (Settings › Till › Receipts).
- **Lane:** screens are Jack's; **Mark's, flagged for him**: migration 043 on `shops`, `server/routes/shop-settings.js`.
- **Drawings:** `set-till-receipts` (`setup.mjs`) and its receipt preview; the receipts `till-receipt-paper*` (`till.mjs`).
- **Decisions:** `2026-10-19-receipt-words.md`; `2026-10-18-shop-details.md` answer 2.

## Out of scope

- The Paid box's Print, Email and Text choices in Settings, and email receipts.

## Impact

- `server/migrations/043_receipt_footer.sql` (new), `server/routes/shop-settings.js`
- `src/screens/settings/settings-page.tsx`, `src/screens/till/receipt.tsx`
- tests for each
