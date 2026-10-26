# Design: open a sale from a customer's history

## Decisions

### 1. The history reads `all_sales`
`GET /api/customers/:id/history` (`server/routes/customers.js`) reads sales
from `all_sales`, as the customer's sales list already does:
- what was bought comes from `sale_items` (old) or `till_sale_lines` (till),
  each as "name × qty" when there's more than one;
- each item is `{ kind: 'sale', source, id, receiptNumber, total, what, at }`;
- `total` stays in pounds, as the screen reads it today.

### 2. The pop-up (`src/screens/customers/sale-dialog.tsx`)
- **What it reads:** `GET /api/sales/:id?source=…`, which already serves
  both records.
- **Title:** "Sale [receipt number]", or "Sale [id]" for an old sale.
- **The line under it:** the date and time · "served by [cashier]" when known
  · the customer's name.
- **Lines:** name, then "× qty" as the sub-line, then the amount.
- **Total**, then "Paid by" with the sale's payment label.
- **Footer:**
  - "Print the receipt" (old record only), which uses `printReceipt` as the
    diary's Print receipt does;
  - "Close".

The history row becomes a button with the same look.

### 3. Not drawn, decided here (logged)
- "Close" stands in for the drawn "Refund at the till".
- A till sale has no Print until its receipt exists.
