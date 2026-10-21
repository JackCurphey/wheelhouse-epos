# The booking page's later stages

## Why
Once the bike is in the shop, ready, collected, or a request has expired, the customer's booking page still falls back to the first release's page: a status word for a heading, a summary box, Copy link, and "Need to change or cancel? Contact …". That contact line is wrong once nothing can be changed. Jack's answers on 21 Oct (`docs/decisions/2026-10-21-booking-page-stages.md`) and the drawings settle each stage:
- `dq-in-shop`, with answer 1: a plain line for now.
- `cp-summary-inshop` and `cp-summary-checked`.
- `cp-summary-collected` and `bk-request-expired`, both approved 21 Oct.

## What changes
Jack's screens half, now, using what the link already sends:
- **In the workshop:** "Your repair · [reference]" above the bike and the work as the heading (as `dq-in-shop` draws it), then the plain line "Your bike is in the workshop" where the tracker will go (answer 1), any quote, the booking's rows and the shop.
- **Ready:** "Your [bike] is ready". The tracker shows Booked, In the shop, Being worked on, all ticked, with Ready as the current step. The card "To pay when you collect" says "Pay at the counter by card or cash. When you come in, just give your name." Then the quote's answer, Checked by, the rows and the shop.
- **Collected:** "Your [bike] has been collected", the same tracker, and a "Collected" card: "Thanks for coming in — this page keeps working for 30 days after collection." Then the quote's answer, the rows and the shop.
- **Request expired:** "Sorry, we couldn't get back to you in time" under "Not booked". It says the shop couldn't answer the request for [day, time] in time and that nothing is booked. Then "Choose another date" and the shop.
- None of these four has Copy link or the contact line, because none of their drawings does.

Mark's server half, which comes later, is set out as a contract in `design.md`. Once it lands, the screens add:
- the work progress (tracker steps and waiting for parts);
- what was done, with prices, and the amount to pay;
- the checklist;
- the collected and paid dates;
- the shop's address, phone and hours;
- the 410 page's details.

It also fixes the link's 30 days to count from collection.

## Impact
- Code: `src/screens/book/pending.tsx`, plus `pending-rules.ts` for the headings.
- Tests: `tests/customer/pending-stages.test.js` (new), and `tests/customer/pending-screen.test.js` where it used the in-workshop stage as the old page.
- No server change in this pull request.
