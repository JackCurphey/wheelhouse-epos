# Design

`agreeWithinLimit({ quoteId, loginId })` in `server/workshop/jobs.js`, in one
transaction with the quote locked:
1. the quote must be able to take `within_limit` (a draft);
2. the whole bill, summed by the database: the job's order total, plus each
   booked service's price not already on the order (matched by service), plus
   the quote's lines; it must be at or under `workshop_jobs.spend_limit`;
3. every line is decided `approved`, `decided_via = 'limit'`, with who and
   when; the quote becomes `approved` and `sent_at` is set (so the customer's
   page can show it); its lines join the order (`addApprovedLinesToOrder`).

The route then queues `work_within_limit` as Send quote queues its message:
after the commit, a fault reported to staff as "no message went", never a
500. Its tap-ins add Work added (the lines' words), Amount added (their sum,
from the database), Spending limit and Shop phone.

Refusals (409 `illegal`): no limit ("This customer asked to be asked before
any extra work. Send a quote instead."), over it ("That takes the whole bill
to £111.00, over the £100 limit. Send a quote instead."), not a draft, no
lines.

## From the fresh review
- The order is locked with the quote, and an order that can't take the work
  (paid, or a part no longer sold) is a 409 with its reason, not a 500.
- A refused Save and tell reads the quote again; saving Work and parts does
  too, so the panel's within-or-over follows the bill.
- Proposed total shows the whole bill; the drawn hint shows on every draft
  quote that isn't within a limit.
- The message's limit reads "£1,000"; with no shop phone it says "Call the
  shop".
- Left as is: a draft saved at the very moment Save and tell runs (Send quote
  has the same window).
