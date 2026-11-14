# Buy online and click and collect (WP-6.3): defaults taken overnight, and what waits for Jack — 13 Nov 2026

Jack's overnight rule: overnight sessions take the recommended answer on spec
questions, marked "default taken, Jack can overrule". The exceptions still
wait for him: money taken at the till, real accounts, anything contradicting
a recorded decision, and design changes. The Front desk applied this rule
overnight on 12–13 Nov.

The plan is `openspec/changes/website-buy-online/`. The full questions, with
their options and trade-offs, are questions 8–12 in the overnight file
`settings-plan.md`.

## Defaults taken — Jack can overrule

8. **Gift cards at checkout:** option 1, store credit online now, gift cards
   later. Wheelhouse has no gift cards yet: no selling, codes or balances.
   They become a piece of their own, covering the till and online together.
   Until then the gift card box at checkout and the Gift cards switch aren't
   shown (`on-checkout-gift-code` and `on-checkout-gift` wait for it).
10. **What the website sells:** option 1, only what's on the shelf at the
    collecting shop. "Anything in stock at any of our shops" needs stock
    moves between shops (Multiple sites, WP-5.2). "Also things we can order
    in" needs each supplier's delivery time. Both appear in Settings, with
    their drawn words, once those exist. So do the "in [n] days" and "We
    order it in" product-page lines that WP-6.2 handed on.
12. **Reminder days for orders not collected:** option 1, remind after 3
    days and keep for 7, the same as for bikes
    (`docs/decisions/decided-while-building.md:3157`).

## Waiting for Jack

9. **When an online order becomes a sale, and when stock goes down.**
   **Jack's answer (14 Nov), relayed by the Front desk: option 1.** The order becomes a sale and the stock count drops
   when the customer pays. The item shows as "for an online order" until
   it's handed over, and the till warns on it. VAT is counted on the payment
   day, and a cancelled order is refunded like any sale. What follows is the
   question as it was put to him: this
   is money, so it waits. The plan is written as the recommendation: a sale
   and the stock drop at payment, VAT on the day the money came in, and the
   item showing as "for an online order" until it's handed over. Pull
   requests 5–7 (paying, staff steps, refunds) and the refund tables moved
   from pull request 1 aren't built until he answers. Now answered, so they
   can be built.
11. **Handing over before the till's Collect screen (WP-3.1) exists.**
    **Jack's answer (14 Nov), relayed by the Front desk: option 1.** A "Hand over" button on the staff order page now;
    the till's Collect screen (WP-3.1) uses the same step when it's built.
    What follows is the question as it was put to him: this
    is the till, so it waits. The plan is written as a Hand over step on the
    staff order page, which the till's screen reuses later. Pull requests 6
    and 8 aren't built until he answers; 9 and 10 follow them. Now answered,
    so they can be built.

## Not a question

- **The "Order ready to collect" email waits a few seconds with Undo,** as
  decided (Buy online decision 9, H4,
  `docs/decisions/2026-10-01-buy-online-review.md:114`). The first draft
  used the minute the bike "Ready" email waits. That contradicted the
  decision, so the plan follows the decision.

## Can be built now

Pull requests 1–4 depend on neither 9 nor 11, and they don't wait for
WP-6.2, WP-3.1 or WP-1.1:
- 1: tables and settings, server;
- 2: the settings screen;
- 3: the six order messages;
- 4: basket and checkout, server. It prices and checks stock, and records
  nothing.

Status: 8, 10 and 12 are defaults taken. 9 and 11, and pull requests 5–10,
are waiting for Jack.
