# Design

1. **The cancel route** owes the refund when the booking is `pending` or
   `offered`, as well as before the cut-off; such a cancel never needs
   `losesDeposit`.
2. **The link's `refundable`** is true for `pending` and `offered`, so the
   page's pop-up and rows follow without a change of their own.
