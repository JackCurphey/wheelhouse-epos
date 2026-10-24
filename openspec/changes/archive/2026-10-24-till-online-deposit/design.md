# Design: a deposit paid online comes off at the till

1. **Which deposit counts** (`server/workshop/counted-deposit.js`,
   `countedDeposit(jobId)`): the job's latest online payment, when it is
   `taken`, with no refund owed or made, the job not marked Didn't come and
   the booking not cancelled. That's the job serializer's "paid" state. It
   returns `{ pence, paidAt }` or null. `held` doesn't count: the card
   isn't charged until it's taken.
2. **`/due`** adds `depositPence`, `depositPaidAt`, `depositUsedPence =
   min(deposit, total)` and `leftToPayPence` (and `leftToPay` in pounds),
   from the same total it already works out.
3. **Convert** works out the same total and deposit before the sale. It
   adds the payment `{ tenderType: 'Deposit paid online', amount }` itself,
   and drops any payment of that name the till sent. The till pays the rest
   by card or cash, so `createSale`'s "Payment amounts must add up to the
   total" still holds. The total is worked out in pence, so an amount over
   the pennies can't slip through.
4. **Refund refused once paid.** `POST /api/workshop-jobs/:id/deposit-refund`
   checks the job's order: when it's `converted`, 409 `paid_at_till`, "This
   deposit paid part of the bill at the till, so it can't be refunded from
   the job." The job pop-up's deposit strip hides "Refund the deposit" when
   `orderStatus` is converted.
5. **The till** (`JobTill`): with `depositUsedPence`, a fixed line "Deposit
   paid", "[date] · online", "−£x" under the job's lines. Total shows the
   bill, and Take payment and the payment pop-up use `leftToPay`. A deposit
   larger than the bill adds "The deposit is more than the bill: [£n] isn't
   paid back here yet."
6. **The receipt** prints the deposit as its own payment line by its tender
   name, as extra payments already print.
