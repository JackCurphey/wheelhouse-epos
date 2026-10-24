# The morning's questions (24 Oct)

Jack answered these on 24 Oct, one at a time, after the overnight build
(`.agents/STATUS.md`; the questions came from building deposits, Customers
and Your settings). Each answer was option 1 of the choices put to him.

## Deposits (`dq-quote-deposit`, `bk-cancel-late`, `bk-settings-deposits`; book a repair review 3 and 4)

1. **A percentage deposit is that percentage of the price shown when booking,
   rounded to the nearest penny**: several services' shown prices are added
   first, and a "from" price is used as it stands. It is then fixed, as
   already decided ("worked out on the price then and fixed").
2. **Staff refund by hand on the job, in the diary**: the job page shows
   "Deposit paid £[deposit]" with "Refund the deposit" and a reason, at any
   stage.
3. **A no-show keeps the deposit, marked by staff with "Didn't come" on the
   job** (drawn first, for Jack's approval); staff can still refund it by
   hand. **A moved booking keeps its deposit**, whoever moves it.
   *Drawn and approved (Jack, 24 Oct: "I approve the diary job deposit
   drawings as they are"):* `bk-staff-deposit`, `bk-staff-deposit-refund`,
   `bk-staff-deposit-refunded`, `bk-staff-no-show` and
   `bk-staff-no-show-kept` in `book.mjs`. Answer 2's refund is drawn there
   too. The Undo after "Didn’t come" waits until staff leave the job, as answer
   9 has Bike ready’s Undo wait (decided while building).
4. **Online deposits now; the till's deposit (`till-job-deposit`) after Mark's
   sales in pence (#404)**, which rewrites the till's payment code.
5. **The refund wording is "within 5 to 10 working days"**, checked against
   Stripe's current documentation before it's built.

## Customers (WP-3.2)

6. **Merge can be undone for 30 days** (the `cs-merge` drawing's "can be
   undone … for [n] days"): the duplicate is hidden, not removed, with a
   record of what moved where; "Undo the merge" on the customer's page puts
   it back; after 30 days the duplicate is removed for good. This changes
   23 Oct answer 5 ("the empty duplicate is removed") to "hidden for 30 days,
   then removed".
7. **The header search comes first**, finding customers and jobs to start
   with (orders and products as they're built), then the Customers list.

## Your settings › Accessibility

8. **Larger text scales the text sizes themselves**: every screen's sizes move
   to one shared scale that Larger text raises a step (14 to 17, as drawn),
   so layouts, dragging and pop-ups are untouched. Not a zoom, which put the
   diary's drops off their marks (24 Oct).
9. **Don't close things by themselves makes both timers wait**: Bike ready
   waits with "Send now" and Undo, the server holding the message until one
   is pressed; the till's next sale waits for "Start next sale". The waiting
   strip is drawn first, for Jack's approval.
   *Drawn and approved (Jack, 24 Oct: "drawings look good, i approve"):*
   `job-finished-wait`, `job-finished-sent` and `till-receipt-wait`. On the
   till, Start next sale takes No receipt's place, and Print leaves the box
   open; after Send now the strip has no Undo, as the message has gone.
