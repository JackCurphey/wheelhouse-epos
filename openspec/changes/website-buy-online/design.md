# Design

## Context

See `proposal.md` for why, and its table for what is built and what this
piece waits for. In short: nothing of buying online is built. The pieces it
stands on are built (the payments adapter, store credit, messages, private
code links, customer accounts, Today, `lib/stock.js`, `createSale`), except
WP-6.2's website app (open, pull request #742 and its build pull requests),
the till's Collect screen and refunds (WP-3.1), and roles (WP-1.1).

Example data in tests and fixtures comes from the drawings only (header of
`online.mjs`): North Street Cycles, Bolton, "[Second site]", Maya Patel
(07700 900 142, maya@example.test), Shimano brake pads B05S-RX (£28.00), Jo
Taylor, Jack Lewis, and the example categories (Bearings, Drivetrain ›
Derailleurs). Other products, order numbers, totals and times stay bracketed,
or are visibly made-up test values in the test file only.

## Goals / Non-Goals

**Goals:** pay online and collect from the shop, from Add to basket to Hand
over; refunds the way it was paid; reminders; the six messages; Settings,
Today and the sidebar count. Build the server and staff side first, so the
customer screens drop in when WP-6.2 lands.

**Non-Goals:** gift cards; the other two stock choices; delivery; Shopify
orders in Online orders; search finding orders; a real payment provider.

## The five questions (8–12): three defaults taken, two waiting for Jack

Each is written into the specs and tasks as the recommendation. Under
Jack's overnight rule (take the recommended answer, except money taken at
the till, real accounts, recorded decisions or design changes), 8, 10 and
12 are defaults taken; 9 and 11 wait for Jack.

1. **Store credit online now; gift cards later as their own piece**
   (question 8; default taken overnight 13 Nov, Jack can overrule; `docs/decisions/2026-11-13-website-buy-online-defaults-taken.md`). No gift card box
   at checkout, no Gift cards switch in Paying online. `on-checkout-gift-code`
   and `on-checkout-gift` wait for the gift cards piece.
2. **The sale and the stock drop happen at payment** (question 9;
   Jack's answer (14 Nov), relayed by the Front desk: option 1, as recommended; `docs/decisions/2026-11-13-website-buy-online-defaults-taken.md`). An online order becomes a `sales` row and
   `stock_qty` drops when it is paid; VAT counts on the day the money came
   in. Until it is handed over, its items show as "for an online order", so
   the till warns. Cancelling refunds it the way it was paid: card through
   the adapter's refund, store credit back to store credit. The money stays
   out of till takings by joining `ONLINE_TENDERS` in close-the-day.
3. **Only "what's on the shelf at the collecting shop"** (question 10;
   default taken overnight 13 Nov, Jack can overrule; `docs/decisions/2026-11-13-website-buy-online-defaults-taken.md`). "Anything in stock at any of
   our shops" (needs transfers, WP-5.2) and "Also things we can order in"
   (needs supplier lead times) are later items, with their drawn words kept
   in the Later section of `tasks.md`. The "in [n] days" and "We order it in"
   product-page lines that WP-6.2 hands to WP-6.3 come with them.
4. **A Hand over step on the staff order page now** (question 11;
   waiting for Jack: money and the till; written as the recommendation, and nothing that depends on it is built until he answers). The till's `till-collect` board (WP-3.1)
   reuses the same server step when it is built.
5. **Remind after 3 days, keep for 7** (question 12;
   default taken overnight 13 Nov, Jack can overrule; `docs/decisions/2026-11-13-website-buy-online-defaults-taken.md`). The days follow bikes
   (`docs/decisions/decided-while-building.md:3157`).
6. **The "Order ready to collect" email waits a few seconds with Undo**, as
   Jack decided (Buy online decision 9, H4,
   `docs/decisions/2026-10-01-buy-online-review.md:114`: "a few seconds with
   Undo"; the drawing: "The email goes to [Customer] in [n] seconds"). This is
   a recorded decision, so it is not a question; the number of seconds stays
   `[n]` and is chosen when it is built, within "a few".

## Decisions

### 1. Tables

One migration: the next free number at build time; the latest on main is
149 (142–144 are missing on main, so check open pull requests too).

- `online_orders`: `site_id` (the collecting shop), `customer_id`, `number`
  (the shop's counter), `stage` (`awaiting_payment`, `payment_unsure`,
  `to_get_ready`, `ready`, `collected`, `cancelled`, `not_paid`), `how`
  (`collect` only for now, decision 1 of journey 2), name, email and phone as
  typed, `total_pence`, `credit_pence`, `card_pence`, `sale_id`, `paid_at`,
  `ready_at`, `ready_message_id`, `reminded_at`, `keep_until`,
  `contacted_at`/`contacted_by`, `collected_at`/`collected_by`,
  `cancelled_at`/`cancelled_by`/`cancel_reason`/`cancelled_by_customer`,
  `order_code` (the private link), `request_key_hash` (one order per Pay).
- `online_order_lines`: `order_id`, `product_id`, `qty`, `unit_pence` (the
  price at payment), `refunded_at`, `refund_reason`.
- `online_order_events`: what happened, who, when, reason. Only added to.
- `online_order_refunds`: `order_id`, `sale_id`, `kind` (`customer_cancel`,
  `shop_cancel`, `cant_supply`), `card_pence`, `credit_pence`, `reason`,
  who, when, and the card refund's state (owed, made). With
  `online_order_refund_lines` for which lines and how many.
- `online_order_settings` (WP-6.1's table, migration 147, which says "WP-6.3
  adds the rest of the Online orders settings here"): `sells`
  (`shelf` only for now), `wallets_on`, `store_credit_on`,
  `remind_days` (default 3), `keep_days` (default 7), `shelf_name`,
  `next_order_number`.
- `online_payments`: `purpose` allows `'order'` as well as `'deposit'`, a
  nullable `online_order_id`, and a check that an order payment names its
  order. Statuses gain `checking` (the bank's check) and `unknown` (no
  answer), on `pretend_payments` too.
- `categories`: `show_online` (default true), for Showing products.
- `store_credit_entries`: nullable `online_order_id`, so a spend and its
  refund name the order.
- `stock_movements`: an `online_order_refund_id` cause, beside `saleId`.

Every new table has `shop_id` and row-level security with a
`<table>_shop_isolation` policy, as `141_website.sql` does. Links to the
customer, product, site and sale carry the shop (`(id, shop_id)`), as
Cycle to Work's do.

### 2. The basket is a cookie; the server prices it

`wh_basket` holds product ids and quantities only, beside WP-6.2's `wh_shop`
and `wh_cookies` and added to its one cookies list (WP-6.2 design 4). Every
read goes through `POST /api/site/basket`, which prices each line from the
product, works out the stock line at the chosen shop and says what changed
(`on-basket-changed`). Nothing in the cookie is trusted beyond "which and
how many".

### 3. Checkout and paying

Public routes under `/api/site/`, each finding the shop with
`resolveStorefrontShop` and running in `runWithShop`, rate-limited like
`deposit-holds`:

- `POST /api/site/checkout` with a client `requestKey`: checks buying online
  is on and payments connected, checks the details (`on-checkout-errors`),
  prices and checks stock again, works out store credit for a signed-in
  customer when the shop allows it, uses the signed-in customer, or makes a
  new customer for a guest (as a guest booking does, `resolveGuestCustomer`
  in `server/customer-auth.js`; never matched on typed details), and makes the order at
  `awaiting_payment` with its `online_payments` row, held through
  `provider.hold` for the card part. Pay pressed twice gives the same order
  (`ON CONFLICT (shop_id, request_key_hash)`, as deposits do).
- `POST /api/site/orders/:ref/pay`: the pretend card, wallet or the bank's
  answer. On `held`, in one transaction: lock the order, lock the stock
  (`lockStock`), check the collecting shop has enough (`on-checkout-sold-out`
  if not: release the hold, nothing taken), spend the store credit (lock the
  customer, check the balance, a `spent` entry), record the sale with
  `createSale` (stock comes off through `moveStock`, the card part as
  `Paid online` and the credit part as `Store credit`), give the order its
  number, move it to `to_get_ready`, `take` the card payment, and queue
  "Order confirmation". A commit that fails after the take marks a refund
  owed, which `refundOwed`'s pattern makes after the commit.
- "Place order" (credit covers it all) runs the same transaction with no
  card part.

The adapter is hold-then-take and has no one-step "take at once"
(`server/payments/pretend.js`). Taking at once is a hold, the card's yes,
and an immediate `take`, so the adapter needs no new call for it.

### 4. Pretend outcomes for the bank's check, "couldn't confirm" and wallets

`pretend.js` gains, as Stripe's test mode does:
- a pretend test card that asks for the bank's check (status `checking`),
  answered by `check(ref, approved)` from the pretend bank page
  (`on-checkout-bank`; "Cancel and go back" sends it back to `waiting`);
- a pretend test card whose result never arrives (status `unknown`);
  `settleOrders()` asks `status(ref)` again every few minutes and finishes
  the order or tells the customer (`on-checkout-unsure`);
- `wallet(ref, kind)` for "Pay with Apple Pay" and "Pay with Google Pay",
  answering as the card that works.
The test card numbers are chosen at build time from Stripe's published test
cards where one exists; the screens keep "[payment provider]"
(`displayName: null`).

### 5. Stock

Stock drops at payment (default 2), so WP-6.2's stock line counts it out
with no change of its own. "For an online order" is worked out, not stored:
open orders' lines at that shop, until handed over. When the shop's figure
falls below what open orders there are waiting for, the newest orders'
lines say "Not on the shelf any more" (`on-orders-sold-at-till`). Cancelling
and Can't supply put the lines back through `moveStock`, caused by the
refund. Can't supply puts its unit back too, because the order's unit came
off at payment; when it was sold at the till, that brings a figure below
zero back to the truth.

### 6. Refunds

One function refunds a whole order or some lines: inside the transaction it
writes `online_order_refunds`, gives back store credit first up to what was
paid in credit (a `refund` entry), puts stock back, marks the card part
owed, and moves the order on; after the commit the card part is refunded
through `provider.refund(ref, pence)`, which takes part refunds. An owed
card refund is retried by `settleOrders()` and never made twice. The
customer's cancel locks the order and checks it is still `to_get_ready`;
otherwise it answers "just marked ready" (`on-order-clash`).

There is no sale refund model on main (till refunds are WP-3.1), so online
orders keep their own refund records. The takings and VAT reports take them
off on the day made. WP-3.1 can read them, or fold them into its own model.

### 7. Staff routes and screens

`server/routes/online-orders.js`: the list in three groups, one order,
Mark ready (queues "Order ready to collect" with `delayMs: UNDO_MS`; Undo
cancels the message and moves the order back), Not ready after all, Hand
over, Can't supply, Cancel and refund, Contacted, the sidebar count.
`src/screens/online-orders/` gives the existing `orders` sidebar entry
(`src/staff/nav.ts`) its page. Hand over is a server step the till's
Collect screen calls later (default 4).

### 8. The customer's order page

`GET /api/portal/:shopSlug/order-links/:code`, following the Cycle to Work
link (`/api/portal/:shopSlug/c2w-links/:code`, `server/routes/portal.js:2035`):
a 32-byte random code, `stopCodeTooMany` and `stopCodeGone`, and a reply
built from a list of allowed fields. `POST .../order-links/:code/cancel`
cancels. The signed-in account gets `GET /api/portal/:shopSlug/orders` and
`/orders/:id`, as `c2w-orders` does, reading the same fields. It lists the
customer's own orders and any order typed with the email the code sign-in
has just proved, so a guest order placed by someone who already has an
account still shows in it.

### 9. Messages

Six keys in `server/messaging/templates.js`, queued with `queueMessage`
(pretend sending, as today) from `server/online-orders/messages.js`, which
follows `server/c2w/messages.js`. "Order ready to collect" uses the drawn
wording (`on-email-ready`); the other five are draft wording, marked as
draft, until Jack approves it (Q9 of `docs/decisions/2026-10-03-build-plan-questions.md`).
The reminder round follows `bike_still_waiting`'s, inside the messaging engine.
Block 46, the Email and text frame, is built here to show the ready email
as drawn, and is reused by Settings › Messages' preview.

### 10. Who may do what, until WP-1.1

| Step | Now | After WP-1.1 |
|---|---|---|
| See Online orders, Mark ready, Not ready after all, Hand over | Anyone signed in | Also "Till only" (walk-through 8, later change 3 Oct) |
| Can't supply, Cancel and refund | Anyone signed in (Staff may refund: coverage-6 L2; Selling at the till 9) | Same |
| Today's online order lines, Contacted | Owner (as other Needs attention lines) | Owner, managers |
| Online orders settings | Owner (`ownerOnly`, as WP-6.1) | "Can change settings"; "Keep orders for" for managers (`on-settings-keep`) |

## Decided while planning, for Jack to overrule

Each goes into the builder's own month file in
`docs/decisions/decided-while-building/` when built.

1. **Sold-out words: "Sold out at Bolton".** Followed Jack's newer answer:
   "The website shows only what's on the chosen shop's shelf ("Ready today
   at Bolton" or "Sold out at Bolton")" (`docs/decisions/2026-11-12-website-browse-answers.md`,
   answer 2, on pull request #742), over journey 2's `on-product-out` "Not in
   stock at Bolton". So `on-product-out-other` reads "Sold out at Bolton — in
   stock at our [Second site] shop". The rest of `on-product-out` ("Ask the
   shop about it", phone and email, no Add to basket) is kept.
2. **Order numbers: `[prefix]-` and the shop's own count.** Followed the
   WH- and CW- pattern: "A quote's reference is `CW-` and its number,
   counted from 1 by each shop" (`docs/decisions/decided-while-building/2026-11-jack.md:719`),
   and `server/workshop/references.js` ("Per shop, not global ... Numbers are
   consumed, never returned"). No source settles the prefix, so it stays
   `[prefix]` until Jack names one; the count starts from 1, as CW- does.
3. **Basket: a cookie, `wh_basket`, on WP-6.2's one cookies list.**
   Followed "The basket cookie is WP-6.3's" and "The Cookies page lists the
   cookies from one list in the code" (WP-6.2 `design.md`, decision 4). No
   source says how long it lasts, so it is "[n] days" until Jack says. It is
   needed for the site to work, so it needs no consent, as `wh_shop`. Signing
   in doesn't change it: it stays with the browser.
4. **A guest's order link: a token in the confirmation email.** Followed
   the Cycle to Work link: "A Cycle to Work order's private link ... the
   allowed fields only, no sign-in made. A code that doesn't work gets the
   stop page's answer, so codes can't be probed" (`server/routes/portal.js:2031-2034`),
   with its code made by `randomBytes(32)` (`server/routes/c2w.js:161`). It
   keeps working as long as the order does, as that link does.
5. **Order payments: `online_payments` extended.** Its `purpose` "CHECK
   (purpose IN ('deposit'))" (`server/migrations/070_online_payments.sql:32`)
   gains `'order'`, with an `online_order_id`, in the migration (the next
   free number at build time; latest on main is 149).
6. **Who may mark ready, hand over and refund before roles.** WP-6.1's
   pattern is `ownerOnly` for its settings ("Settings for the Owner only,
   until roles are built", `server/lib/owner-only.js`), so Online orders
   settings follow it. WP-6.1 has no everyday staff step, so the order steps
   follow the closest built money step, the deposit refund, which any
   signed-in person may make (`server/routes/workshop.js:1294`), and
   coverage-6 L2: "staff can refund".
7. **Shopify orders in Online orders (`ws-shopify-order`) wait.** They
   depend on Shopify orders becoming orders: today a Shopify order is one
   `createSale` "with `payments: [{ tenderType: 'Shopify', amount }]`"
   (`server/server.js:163`). Placed under Later.
8. **Six order messages, wording marked as draft.** Followed Q9 of
   `docs/decisions/2026-10-03-build-plan-questions.md` (Claude drafts every
   automatic message, marked as draft) and walk-through 2 M9 ("a sixth online
   message"). Sent pretend, as "Messages are pretend until Jack says
   otherwise".
9. **The card part's payment line is "Paid online".** Followed the drawn
   "Maya Patel · paid online [date]" (`on-hand-over`) and `DEPOSIT_TENDER =
   'Deposit paid online'` (`server/workshop/counted-deposit.js:8`). It joins
   `ONLINE_TENDERS`. The store credit part is "Store credit", as "How you
   paid · Store credit" is drawn, and is kept out of till takings too.
10. **A guest order makes its own new customer; signing in joins it.**
    Followed the built guest booking: "Every guest booking now gets its own
    customers row; merging duplicates is a staff decision made in the Office
    UI" (`server/customer-auth.js`, `resolveGuestCustomer`), because typed
    details prove nothing. The order's email is kept as the customer's own
    (`email_from_customer`), so the built "first code sign-in joins the one
    customer the shop already has" (`customer-accounts` spec;
    `server/routes/portal.js:146-155`) joins the order to the account, as
    decision 4 asks ("join the account's history if the customer signs up
    with that email"). Staff find guest orders by email and phone in search
    and on Online orders.
11. **With only the shelf choice, the "about [n] days" parts are left out.**
    "Only what’s on the shelf — At the shop they collect from. Ready the same
    day." (`on-settings`). So checkout's "Free · ready in about [n] days ·
    open [opening hours] · [Shop address]" drops "ready in about [n] days",
    the basket's "Ready to collect when the last item is — about [n] days."
    isn't shown, on-confirmed's first step reads "We get it ready." and the
    order page's "We’ll tell you when it’s ready." drops "— about [n] days".
    The full words come back with the other two choices.
12. **Gift card words trimmed.** With no gift cards (default 1), the drawn
    "Your store credit and gift card are only used once the order is paid."
    reads "Your store credit is only used once the order is paid.", and the
    Paying online summary "[Payment provider] · gift cards and store credit"
    reads "[Payment provider] · store credit".
13. **"Couldn't confirm" emails either way.** `on-checkout-unsure` promises
    "we’ll email maya@example.test within [n] minutes to say whether it went
    through". "Went through" sends Order confirmation. "Didn't go through"
    is a one-off email (not one of the six, not switchable), as the receipt
    email is one-off, with draft wording. `[n]` stays a placeholder until the
    re-check time is set at build time.
14. **The terms link opens Collection and returns.** Followed not-drawn row
    82 (`docs/decisions/2026-10-08-not-drawn-pages.md`, answer C: "TermsDialog,
    src/screens/book/details.tsx:306") with the shop's published "Collection
    and returns" words (WP-6.1's part, `collection_returns`).
15. **Showing products: a `show_online` switch on each category.** Followed
    decision 3: "a switch on each category (which sets every product in it)
    and on each product (which can differ from its category). New products
    follow their category." "Started with every product online on [date]"
    reads `website.set_up_at`; Change asks set-up step 3's question again,
    using WP-6.1's own `setUp` code (`server/website.js:506`).
16. **Today's online order lines are the Owner's until roles.** Followed
    "Needs attention lists what's waiting on the Owner" (`openspec/specs/today/spec.md`)
    and Cycle to Work's "Today's Cycle to Work lines | Owner".
17. **Contacted works as for bikes.** Followed `workshop-collection` spec:
    "Contacted SHALL record who and when and take the line off" and decision
    9 M12 ("'Uncollected' on Today works as for bikes, with 'Contacted'").
18. **Order messages go by email; Text is the drawn second choice.** The
    online messages are "online-order emails" (decision 9, M5); the message
    list draws "Text | Email" on each. They go by email to the order's
    address; Text sends to the order's phone when the shop turns it on, if
    the message list's own channel choice supports it at build time, and is
    left off (and logged) if not.
19. **"Collect from [Second site] instead" is built now.** It changes the
    chosen shop, needing no transfer, and WP-6.2 answer 1 builds the
    two-shop parts now. It is offered only when the other shop has it on
    the shelf.
20. **No "Waiting at" words until the shelf is named.** "Where ready orders
    wait" starts empty, shown as the drawn "[Shelf name]" in Settings; rows
    and the hand-over leave the words out until it is set, so nothing
    invented reaches staff.

## Where a source pulls against a default

Noted rather than picked silently. The defaults stand; Jack can change them.

1. **Question 9, "refunded like any sale":** there is no sale refund on main
   (till refunds are WP-3.1), so there is no built way to refund "like a
   sale". Online orders keep their own refund records (decision 6).
2. **The ready email's wait:** the built messages spec waits a minute for
   Bike ready, but Buy online decision 9 (H4) says "a few seconds with Undo"
   for this email. The plan follows the decision (point 6 above); decisions
   aren't reopened (CLAUDE.md).
3. **Question 11, Hand over on the order page:** the drawn group hint says
   "Hand over opens the till’s hand-over for that order". Until WP-3.1 it
   does the same step from the order page; the hint is kept as drawn.
4. **Question 9, "the till warns":** the warning screen (`till-held`) is
   WP-3.1's. Until then only the server's answer carries "for an online
   order"; no screen warns.
5. **Who may refund:** WP-6.1's own pattern is Owner only, but every step it
   built is a setting; coverage-6 L2 says Staff can refund. The order steps
   follow the decision (item 6 above).
6. **Decision 4, guests "found by email and phone, like walk-in
   customers":** the built guest booking never matches a customer on typed
   details, for safety (21 Oct review, `server/customer-auth.js`). A guest
   order makes its own customer, and the code sign-in joins it (item 10
   above), so the order still reaches the account, but two guest orders by
   the same person are two customers until staff merge them.
7. **Line number:** the uncollected-bike default the brief cites as
   `decided-while-building.md:3155` is at line 3157 on main (its section
   starts at 3155).

## Risks / Trade-offs

- **Money taken for stock that isn't there** → stock is locked and checked
  inside the payment's transaction, and nothing is taken when it is short.
- **A payment taken twice** → one order per `requestKey`; the adapter's hold
  is idempotent on its key; tests send Pay twice.
- **A refund made twice, or never** → owed refunds marked in the
  transaction, made after the commit, retried by `settleOrders()`, and the
  adapter refuses more than was taken.
- **Store credit spent twice** → the customer is locked and the balance
  checked in the same transaction.
- **Tampered prices** → the cookie holds no price; tests alter it.
- **The public link** → the Cycle to Work pattern, allowed fields only, and
  tests that a wrong code shows nothing.
- **Stock off the shelf while still there** → the count drops at payment
  though the item is on the shelf until collected. "For an online order"
  and the till warning cover it; a stock-take counts what's on the shelf,
  which includes uncollected orders' items. **The stock-take should add
  back open orders' items**; logged for the builder to check against
  `stock-take` at build time.
- **WP-6.2 changes** → pull requests 11–13 build on its plan; if its design
  moves, only those change.
- **Size** → about 7,500 lines over fifteen pull requests; each leaves the
  app working.

## Migration Plan

One additive migration (pull request 1). Old rows are untouched: existing
`online_payments` rows stay `'deposit'`; `categories.show_online` starts
true so nothing disappears from the website; `online_order_settings` rows
get the defaults. Rolling back the code leaves the new tables unused.
Buying online stays off until the Owner switches it on, which needs payments
connected (WP-6.1).

## Order of pull requests

1. Tables and settings — server
2. Settings screen
3. The six order messages
4. Basket and checkout — server
5. Paying — server and pretend outcomes
6. Online orders for staff — server
7. Refunds — server
8. Online orders for staff — screens
9. Not collected and Today
10. The customer's order link and account — server
11. Product page and basket screens — waits for WP-6.2
12. Checkout, paying and confirmation screens — waits for WP-6.2
13. The customer's order page — waits for WP-6.2
14. The till's hand-over and warning — waits for WP-3.1
15. Roles — waits for WP-1.1

## Open Questions

None that change the specs or the task breakdown. The answers to questions
8–12, the order number's prefix and the basket cookie's length change words
and numbers in place.
