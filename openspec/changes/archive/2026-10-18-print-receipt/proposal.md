# Proposal: printing a receipt (Print on the Paid box, Print receipt in the diary menu)

## Why

The till pays a job's order and a plain sale, but the Paid box offers only
"No receipt", and the diary menu's "Print receipt" waited for the till
(`docs/decisions/2026-10-18-old-diary-features.md`). Jack, 18 Oct, chose to
print through the browser now, drawn first (`docs/decisions/2026-10-18-print-receipt.md`).

## What Changes

- **The Paid box offers Print and No receipt** (`till-receipt-print`). Print prints the receipt on whatever printer the computer has, then the next sale starts, as No receipt does.
- **The printed receipt** (`till-receipt-paper`) shows the shop's name, "Sale [n]" with its barcode, the date and time, the job and bike when it pays a job, each line, any discounts, the total and how it was paid.
  - It has no VAT line until Mark's sales-in-pence work records VAT on each sale, and no B1 receipt number until receipt numbers exist (answer 2).
  - It has no address, phone or VAT number until Shop details holds them.
- **The diary menu's "Print receipt"** prints a paid job's receipt. It's greyed "Not paid yet" until then, as drawn (`diary-menu-job`), or "Order cancelled".

## Lane, work package, drawings and decisions

- **Work package:** part of WP-3.1 (the till: receipts), built early on Jack's 18 Oct answer. Email, Text, the print agent and reprinting from past sales stay in WP-1.11, WP-3.1 and WP-4.3.
- **Lane:** Jack's screens (`src/screens/till/`, `src/screens/diary/`). No server change: paying already returns the whole sale (`POST /api/sales`, `POST /api/sale-documents/:id/convert`), and a paid order names its sale (`convertedSaleId`, read with `GET /api/sales/:id`).
- **Drawings:** `till-receipt-print`, `till-receipt-paper` (`till.mjs`); `diary-menu-job`, `diary-menu-pending` (`diary.mjs`).
- **Decisions:** `2026-10-18-print-receipt.md` (answers 1 to 3); selling at the till decisions 7 and 13 (`2026-09-29-selling-at-the-till-review.md`); the receipt email's contents (`2026-10-02-leftover-screens-review.md`).
- **New dependency:** JsBarcode 3.12.3, for a barcode that scans (project rule 6).

## Out of scope

- Email and Text receipts, the shop's receipt settings and words at the bottom, the print agent, the cash drawer, and reprinting from Past sales.
- The VAT line and B1 receipt numbers (answer 2).

## Impact

- `src/screens/till/receipt.tsx` (new), `pay-dialog.tsx`, `till-page.tsx`; `src/screens/diary/job-extras.tsx`, `diary-page.tsx`; `src/styles/theme.css` (print styles); `package.json`
- `tests/screens/receipt.test.js` (new), `till-job.test.js`, the till sale tests, the diary menu tests; a browser test
