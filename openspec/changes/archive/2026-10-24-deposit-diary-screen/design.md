# Design: the diary job's deposit, the job pop-up

## Decisions

1. **The strip** (`DepositStrip`, `job-deposit.tsx`) sits between the customer
   strip and the details, as drawn; the "Not come in" line leads it while
   Didn't come is offered. Dates read as the pop-up's others ("Thu 17 Sep").
2. **Didn't come is offered** while the booking stands, the bike is expected,
   the job isn't marked and its day is before today (the shop's computer's
   day, as the diary's). It is a secondary button before Book in.
3. **Marked**: the badge reads "Didn't come" (the ended bookings' grey); the
   footer is the drawn dark bar with Undo while the pop-up stays open; opened
   again later, Book in is offered instead (the bike came after all, which
   clears the mark, 4a).
4. **The refund pop-up** sends `{ reason }` to `deposit-refund` and then reads
   the job again; a refusal shows its words in the pop-up.
5. **The decline pop-up**'s note adds the deposit sentence when the job took
   one.
