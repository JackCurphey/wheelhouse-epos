# Jack's answers, 11 Nov 2026: Reports, the second part (WP-5.3)

Questions from writing the spec for the second part of WP-5.3, Reports and accounts (`openspec/changes/reports-ready-made`): Workshop, Returning customers, VAT, and Margin and stock value. Answered by Jack on 11 Nov and passed on by the Front desk session. Each answer names what it settles. Part 1's answers are in `2026-11-10-reports-answers.md`.

## 1. Margin: keeping what each item cost when it's sold

The question: no sale line keeps what the item cost on the day it was sold (neither the old record, `sale_items`, nor the new one, `till_sale_lines`), and Mark's step C doesn't plan to add it. Part 1's answer 1 rules out working margin out from today's product costs.

**The recommendation.** Part 2 adds it: each sale line keeps the product's cost at the moment the sale is saved, and Margin counts from the day that lands; a period starting earlier says from which day margin counts. Past sales are not given a cost.

**Mark agrees first, before it is built.** It is pull request 5 of the change, and it is not started until Mark has said yes on the change's pull request. What he is asked to agree to:

1. One migration adding three empty-by-default columns: `till_sale_lines.unit_cost_pence`, `sale_items.unit_cost_pence`, and `sale_items.vat_rate_bp` (the new record already keeps its VAT rate).
2. The server fills them in at the moment it saves a sale, from the product as it is then: in `server/lib/sales.js` (`POST /api/sales`, and a job's order becoming a sale) and in `server/till/sync.js` (a sale received from a till). A labour line, or a product with no cost, keeps none.
3. The till sends nothing new, so offline tills and step C need no change. A sale made offline takes the cost from when it reaches the server.
4. No amount changes and no past sale is filled in; the totals check (`scripts/ci/check-money-totals.mjs`) is run before and after and must show no change.
5. Whether he wants it to land before or after step C, since both touch `server/till/sync.js`.

## 2. Discounts and refunds

The question: no refund of a sale is recorded with its money, and no discount keeps a reason or who gave it. These come with the complete till (WP-3.1), not with step C as part 1's answer 3 assumed.

**The recommendation.** Discounts and refunds is left out of part 2 and waits until WP-3.1 records discounts with reasons and refunds with their money.

## 3. VAT while sales are still in the old record

The question: every till sale is still saved in the old record, which keeps no VAT, until step C moves the till onto the new record.

**The recommendation.** VAT is built now. Sales in the old record are one row of their own, "VAT not recorded", giving their takings including VAT, with a line saying to take their VAT from the accounts software or the accountant. It becomes exact by itself as sales move to the new record after step C. Nothing works old sales' VAT out from today's product rates.

## 4. The Message button on "Not seen lately"

The question: Wheelhouse can't yet send a message to one customer.

**The recommendation.** The button is left out, and the "Happy to hear about offers" Yes or No column stays, until messaging one customer is built.

## 5. The small ones

**The defaults**, as `design.md` lists them: "Not seen for" starts at 6 months; "Not now" on the VAT quarter question uses calendar quarters for that visit and asks again next time; a discount on a workshop job's sale is shared between Labour and Parts in proportion, so they add up to what was taken; quotes count by when they were sent; the drawing's "stock held for customers" and "between shops" lines are left out until those exist.
