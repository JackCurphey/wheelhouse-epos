# The booking page's money and progress, to the drawings

## Why
#359 made the booking link carry how far the work is, the times, and the shop's details. What was done, what's left to pay and what was paid were still to come, waiting on Jack's answer on prices. Jack, 21 Oct (`docs/decisions/2026-10-21-booking-page-stages.md` answer 4): with "Show prices" off, only the figures are hidden.

## What changes
- **Server:** the booking link adds:
  - `work`: the job's order lines;
  - `declined`: the newest quote's declined lines;
  - `toPay`: what the till would charge, null once paid;
  - `paid { at, amount }`.

  Every figure is null with Show prices off.
- **Screens:** the later stages follow their drawings.
  - **In the workshop** (`dq-in-shop`, `dq-waiting-part`): the tracker at its step, then "We've got your bike — booked in [day] at [time]. Expected ready: [day]." Waiting for a part says so, and Work agreed shows with its total.
  - **Ready** (`cp-summary-inshop`, `cp-summary-paid`): the pay card with its amount, or the Paid card, then What we did with the declined lines.
  - **Collected** (`cp-summary-collected`): "Collected · [day]" and the date the page works until.
  - **Shop lines:** opening hours, address and a phone to call, at every stage.
  - **Expired pages:** a collected job (`cp-expired`) and a booking that never came in (`bk-expired`).
- The quote card shows only while the bike is in the workshop.

## Impact
- **Code:** `server/routes/portal.js` (`jobMoney`), `src/screens/book/pending.tsx`, `src/screens/book/pending-query.ts`.
- **Tests:** `tests/booking-link-data.test.js` and `tests/customer/pending-stages.test.js`.
