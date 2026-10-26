# Design: the stock list and a product's page

## Decisions

1. **The list reads `GET /api/products`** (active products), as the old
   inventory screen does. Its search now also matches `supplier`. Search
   runs on the server once typing pauses; All, Running low and Below zero
   filter what came back, on the page.
2. **Running low** is the Overview's rule (`server/routes/dashboard.js`): a
   low-stock level above 0 and stock at or under it, and not under 0. Stock
   under 0 is Below zero instead.
3. **Margin** is worked out as the old app does, on the price before VAT,
   but with the product's own VAT rate: `(price ÷ (1 + VAT) − cost) ÷ that`,
   rounded to a whole percent. No price, no margin ("—").
4. **`GET /api/products/:id`** returns `serializeProduct` (which now carries
   `vatRateBp`) and `history`: every `stock_movements` row for it, newest
   first, as `{ id, type, change, note, at }`. For anyone but the Owner,
   `cost` is `null`. Another shop's product, or one that doesn't exist, is
   "Product not found". A product taken off sale still opens.
5. **History lines** name the movement by its type: `sale` and `till_sale`
   "Sold", `return` "Returned", `po_receipt` "Received", `intake` "Booked
   in", `adjustment` "Adjusted", anything else "Stock changed". The line
   under it is the movement's note and its date and time. Who did it isn't
   recorded, and no line links anywhere yet (no sale, delivery or count page
   exists). The filters: Sold (sale, till_sale, return), Received
   (po_receipt, intake), Counted and adjusted (adjustment). Price changes
   aren't recorded, so that filter is left out.
6. **Who sees what:** everyone signed in sees the list and the page.
   Margin, Cost and Show on website show to the Owner only (`isOwner` from
   the session), until WP-1.1's roles.
7. **The list shows 50 products, then "Show all ([n])"**, as the bike page
   pages its jobs.
8. **Layout** copies the customer and bike pages: a back link, an `h2` with
   the product's name, a left column (380px) and the history on the right;
   one column on a phone, where the list drops the Price and Margin columns
   and puts the price on the line under the name, as drawn.

## Contract

`GET /api/products/:id` →
`{ ...serializeProduct, cost: number | null, history: [{ id, type, change, note, at }] }`
