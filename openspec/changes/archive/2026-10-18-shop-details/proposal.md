# Proposal: Shop details (one set for the whole business, for now)

## Why

Printed receipts (#269) leave out the shop's address, phone and VAT number
because nothing holds them. Jack, 18 Oct (`docs/decisions/2026-10-18-shop-details.md`):
keep one set of details for the whole business for now, moving onto the
first site when Mark's WP-1.4 lands; the receipt puts the shop's name at the
top and the address, phone, VAT number and barcode at the bottom.

## What Changes

- **Settings › Shop and sites › Shop details** (drawn as `set-shop-details`): shop name, address, phone, email and VAT number, with "These show on receipts, emails and the website." Each box saves when you leave it.
- **The receipt** (`till-receipt-paper`, `-checked`, `-details`): the shop's name, sale number and date and time at the top; the address, phone and "VAT number [n]" at the bottom, each left out when blank; the barcode last.
- **Server:** `shops` gains `address`, `phone`, `email`, `vat_number` (migration 042); `GET` and `PUT /api/shop-details`.

## Lane, work package, drawings and decisions

- **Work package:** an early, partial WP-5.1 (Settings › Shop and sites), on details WP-1.4 will move to the first site.
- **Lane:** screens are Jack's (`src/screens/settings/`, `src/screens/till/`, `src/screens/diary/`). **Mark's, flagged for him** (Jack, 18 Oct): migration 042 on `shops`, `server/routes/shop-settings.js`.
- **Drawings:** `set-shop-details` (`setup.mjs`); `till-receipt-paper`, `till-receipt-paper-checked`, `till-receipt-paper-details` (`till.mjs`).
- **Decisions:** `2026-10-18-shop-details.md` answers 1 to 3; `2026-10-18-print-receipt.md`; `2026-10-05-shops-and-sites.md` (one VAT number per business; address and phone per site later).

## Out of scope

- Per-site details, opening hours and Sites (WP-1.4, WP-5.1, WP-5.2).
- Words at the bottom (Till › Receipts), the VAT line (WP-1.6), and the email and website using these details.

## Impact

- `server/migrations/042_shop_details.sql` (new), `server/routes/shop-settings.js`, `tests/fixtures/route-list.txt`
- `src/screens/settings/settings-page.tsx`, `src/screens/till/receipt.tsx`, `pay-dialog.tsx`, `src/screens/diary/diary-page.tsx`
- tests for each
