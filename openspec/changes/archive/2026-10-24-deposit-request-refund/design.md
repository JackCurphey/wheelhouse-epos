# Design

1. **The cancel route** owes the refund when the booking is `pending` or
   `offered`, as well as before the cut-off; such a cancel never needs
   `losesDeposit`.
2. **The link's `refundable`** is true for `pending` and `offered`, so the
   page's pop-up and rows follow without a change of their own.
3. **Confirmed after the cut-off** (Jack, 24 Oct, option 1 of 1 hour, 2
   hours, until it starts): the staff accept of a request, or the customer accepting a time the shop
   offered (review), moves `deposit_cancel_until` to 1 hour after now (the server's clock),
   never past the booked start (`server/workshop/deposit-cut-off.js`). A
   booking confirmed at once (automatic confirming) isn't a request and keeps
   its own cut-off; the customer saw it when booking.
