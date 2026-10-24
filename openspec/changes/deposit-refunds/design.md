# Design: refunding the deposit, the server

## Decisions

1. **Migration 071** adds to `online_payments`: `refund_due_reason` (set when
   a refund is owed), `refunded_at`, `refund_reason` and
   `refunded_by_login_id` (staff, for part 4's refund by hand).
2. **`server/payments/refund.js`**: `oweRefund(jobId, reason)` marks the
   job's payment as owed a refund, inside the cancel's or decline's own
   transaction; `refundOwed(jobId)` makes it after the commit: a taken
   deposit is refunded in full, one only held is let go; the payment is then
   `refunded` (or `released`) with when and why. `settleDeposits` also makes
   any refund still owed.
3. **The customer's cancel**: before `deposit_cancel_until` a refund is owed
   ("Cancelled in time"); after it the body must say `losesDeposit: true`,
   else 409 `code: 'deposit_kept'` and nothing changes.
4. **Staff decline, expire and cancel** owe a refund ("Declined", "The request
   expired", "Cancelled by the shop"). The shop cancelling isn't in the
   decisions: refunded, as the customer was told it comes back in full if the
   shop can't fit them in (logged).
5. **The link's `deposit`** adds `state`: `paid`, `refunded` (refunded, let
   go, or owed) or `kept` (cancelled with the deposit taken and not owed),
   and `refundable`: cancelling now would refund it (before the cut-off).
