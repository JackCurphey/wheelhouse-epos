# The new till paying a job's order: "check these" and deposits (16 Oct 2026)

Two questions Mark left for Jack before WP-3.1, in the sales-in-pence change
(`openspec/changes/wp-1-6-sales-in-pence/design.md`, decision 8 and Open
Questions; #203). Jack, 16 Oct, one question each.

1. **Two new kinds of "check these"** (Jack: "1"): a payment for a job whose
   order changed while it was being paid for (`order_changed`), and a
   payment of more than the order's balance (`order_overpaid`). Both are
   recorded and flagged, never refused, as the till's other kinds. Chosen
   over turning an overpayment into credit or change, and over deciding at
   WP-3.1.
2. **Deposits at any stage; the payment that clears the balance still needs
   the work finished** (Jack: "1"). A deposit may be taken while the work is
   not started, in progress, on hold or waiting for parts (Selling at the
   till decision 11, Cycle to Work decision 4). The payment that brings the
   balance to zero is refused unless the work is finished, so the 8 Oct rule
   (`2026-10-08-paying-for-finished-work.md`) now covers that final payment
   rather than every payment. Chosen over deposits only once the work is
   finished, and over deposits only while booked or waiting for parts.
