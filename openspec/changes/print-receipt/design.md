# Design: printing a receipt

## How it prints

`printReceipt(receipt)` draws the receipt into one hidden element at the end
of the page (`#wh-print`) and calls `window.print()`. The print styles hide
everything else, so the printer gets only the receipt: 72 mm wide, for an
80 mm till roll, and the top of the page on an A4 printer. The browser's own
print box chooses the printer. The element is cleared afterwards.

## Where the receipt's facts come from

| On the receipt | From |
|---|---|
| Shop name | the signed-in session (`/api/auth/me` `shopName`) |
| Sale [n], date and time | the sale (`id`, `createdAt`), London time |
| Barcode | the sale number, Code 128 (JsBarcode), so refunds can scan it later (decision 13) |
| Job and bike | the job (`reference`, `bikeLabel`), when it pays a job |
| Lines, discounts, total | the sale (`items`, `discount`, `groupDiscountName` and `groupDiscountAmount`, `total`) |
| How it was paid | the sale (`cashAmount`, `cardAmount`): "Paid by card" and "Paid by cash", each with its amount |

Paying returns the whole sale, so the Paid box prints with no extra request.
The diary menu reads the job's order (`GET /api/sale-documents/:id`) for its
`convertedSaleId`, then the sale (`GET /api/sales/:id`).

## Not shown

No VAT line, B1 receipt number, address, phone or VAT number (answer 2; no
Shop details yet); no staff name, change or footer words (no drawing shows them).
