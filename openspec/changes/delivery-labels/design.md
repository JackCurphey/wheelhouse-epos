# Design: Print labels

## 1. The contract

`GET /api/deliveries/booked-in/:id`: each line also has `barcode` and `price`,
read now from the product. Open to anyone signed in, as the product list is. The
label size comes from the existing `GET /api/label-settings` (`widthMm`,
`heightMm`, 50 by 25 unless the shop saved another). No new route or migration.

## 2. The box

`rs-labels`, over Delivery booked in. Subtitle "[Supplier] · booked in just now",
or "Booked in just now" with no supplier. Each line starts at what received
when the product has no barcode of its own, otherwise at 0 (decision 8). `Count`
gains a `min`, so a count can reach and be typed as 0; everywhere else it stays
1. "Print [n] labels" is off at 0 ("Print 1 label" at 1).

A line's count can go above what was received, up to `Count`'s usual limit: a
person may want spares.

## 3. The paper

`printPaper`, as receipts and bike tags. One label a page, at the shop's size,
with its own `@page` size and no margin. Name, price, then a Code 128 barcode of
the product's barcode, or its code when it has none, with that code in words
under it (the old app's sticker). A product with neither has no barcode. A code
Code 128 can't draw prints in words only.

## 4. The screen

Print labels is the accent button: for Staff under the "booked in" line, for
the Owner first in the bottom row beside Receive another delivery, as drawn. It
isn't shown when nothing was booked in. If the size can't be loaded, the box
says so and Print stays off rather than printing the wrong size.
