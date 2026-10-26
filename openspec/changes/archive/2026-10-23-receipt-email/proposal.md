# Proposal: emailing a receipt, the email side

## Why

The till's Paid box offers Email (`cp-receipt-email`, `cp-receipt-address`,
`collect.mjs` :203–249; one receipt email for every sale, leftover screens
review, `2026-10-02-leftover-screens-review.md` :25–43). Jack, 23 Oct
(`2026-10-23-overnight-questions.md` answer 3): build the email side now (the
message and the address checks) and the till's button after Mark's sales in
pence (#404), which rewrites the till's receipt files.

## What Changes

- **`POST /api/sales/:id/email-receipt`** with `{ email }`: checks the address
  ("That doesn’t look like an email address — check it", as drawn), builds the
  receipt and sends it at once through the messages engine (pretend for now).
  The address is for this receipt only: nothing is saved to a customer (review
  answer 3). The till's button and pop-up come after #404.
- **The receipt email** (`receiptEmail`, `collect.mjs` :203–220): "Your
  receipt", the shop's name and details, "Sale [n]", when, the lines, any
  discounts, the total and how it was paid, and the no-account footer. As the
  printed receipt (print receipt answer 2, `2026-10-18-print-receipt.md`): no
  VAT line and "Sale [n]" until the sale records VAT and receipt numbers.
- **Migration 066**: a message can go to an address with no customer
  (`customer_messages.customer_id` nullable) and say which sale it's for
  (`sale_id`).

## Capabilities

### New Capabilities
- `receipt-email`: emailing a sale's receipt to an address.

### Modified Capabilities
- None.

## Lane, work package, drawings and decisions

- **Work package:** WP-2.x collect and pay (receipts), taken by Jack (overnight
  queue, 23 Oct).
- **Risky areas:** a migration, money (it reads sales) and the messaging core,
  so `/review` runs before merging.
- **Drawings:** `cp-receipt-email`, `cp-receipt-address` (`collect.mjs`).
- **Decisions:** leftover screens review 1–3; print receipt answer 2; 23 Oct
  answer 3.

## Out of scope

- The till's Email button, its pop-up and offline sending (after #404).
- Save to a customer record and Add a customer (a separate pop-up, decision 3).
- The account footer ("See it in your account") until accounts' receipt page;
  the VAT invoice (waits on the accountant, review :75–79).
- A Receipt row in Settings › Messages (not drawn).

## Impact

`server/migrations/066_receipt_email.sql`, `server/messaging/engine.js`
(`sendEmailTo`), new `server/messaging/receipt-email.js` and
`server/routes/receipt-email.js` (registered; route list). None of #404's files.
