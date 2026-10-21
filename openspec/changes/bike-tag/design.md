# Design
- `BikeTagPaper({ reference, customerName, bikeLabel })` is an `article` labelled "Bike tag", 54 mm wide (a 62 mm label less the 4 mm page margins), black on white. It shows the job number in large monospace, the barcode, then the customer and the bike. Each is left out when it's missing, apart from the number and barcode. The barcode uses JsBarcode `CODE128`, as the receipt does, with the label "Barcode for job [reference]".
- `printPaper(node)` in `receipt.tsx` draws any paper into `#wh-print` and calls `window.print()`. `printReceipt` now uses it, and `printBikeTag(job)` is the second user. The print styles in `theme.css` already show only `#wh-print`.
- The button is a 44px icon button, matching `JobMessagesButton`. It appears when `custodyState` is `in_shop`. A bike not yet in, or already collected, has no tag to print.
- It sits in the customer row's right-hand group, before Message. A job with no customer still shows the group, holding the print button alone.
- A job with no reference gets no button: its id counts every shop's jobs (migration 016's per-shop numbers exist so a customer can't read that).
- For Mark, later: the job's `bikeLabel` is make and model; the drawn tag adds the colour (`customer_bikes.colour`), which the job doesn't send.
