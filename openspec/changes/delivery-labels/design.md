# Design: Print labels

## 1. The contract

`GET /api/deliveries/booked-in/:id`: each line also has `barcode` and `price`,
read now from the product. Open to anyone signed in, as the product list is. The
label size comes from the existing `GET /api/label-settings` (`widthMm`,
`heightMm`, 50 by 25 unless the shop saved another). No new route or migration.

## 2. The box

`rs-labels`, over Delivery booked in. Subtitle "[Supplier] · booked in just now",
or "Booked in just now" with no supplier; once it's over 5 minutes old, the day
instead, as a reload later isn't just now. Each line starts at what received
when the product has no barcode of its own, otherwise at 0 (decision 8). `Count`
gains a `min`, so a count can reach and be typed as 0; everywhere else it stays
1. "Print [n] labels" is off at 0 ("Print 1 label" at 1).

A line's count can go above what was received, for spares, up to about ten
times what came: at least 10, 500 at most, so a slip can't print thousands.

## 3. The paper

`printPaper`, as receipts and bike tags. One label a page, at the shop's size,
with its own `@page` size and no margin. Name, price, then a Code 128 barcode of
the product's barcode, or its code when it has none, with that code in words
under it (the old app's sticker). A product with neither has no barcode. A code
Code 128 can't draw prints in words only.

The barcode keeps a quiet zone of 10 narrow bars each side, as Code 128 needs.
Its narrowest bar is 0.33 mm where it fits; a long code is scaled to the label's
width, quiet zone included, instead of running off it. A very long code on a 50 mm
label has thin bars, which a scanner may not read. No real scan has been tried.

## 4. The screen

Print labels is the accent button: for Staff under the "booked in" line, for
the Owner first in the bottom row beside Receive another delivery, as drawn. It
isn't shown when nothing was booked in. If the size can't be loaded, the box
says so and Print stays off rather than printing the wrong size.
