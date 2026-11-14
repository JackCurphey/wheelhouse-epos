# Tasks

Fifteen pull requests. The first ten need no other piece and can be built
now, in order (1 → 2; 1 → 3 → 4 → 5 → 6 → 7 → 8; 9 and 10 after 7). Pull
requests 11, 12 and 13 wait for WP-6.2's website app; 14 waits for the
till's Collect screen and warning (WP-3.1); 15 waits for roles (WP-1.1).
Sizes are estimates of changed lines, tests included; about 7,500 in all.

**Written with the recommended answers** to questions 8–12 (overnight 12–13
Nov). Defaults taken, Jack can overrule: store credit online, no gift cards
(8); only what's on the shelf (10); remind after 3 days, keep for 7 (12).
**Waiting for Jack** (money and the till): the sale and the stock drop at
payment (9) and Hand over on the staff order page (11). Pull requests 1–4
don't depend on either and can be built now; 5–10 wait for his answers to 9
and 11 (`docs/decisions/2026-11-13-website-buy-online-defaults-taken.md`). The order number's prefix stays `[prefix]` and the basket cookie's
length "[n] days" until Jack says (design, decided while planning 2 and 3).

Every test is written first and watched failing for the right reason before
the code. Example data comes from the drawings; unknowns stay bracketed.
While building, run only the related test files
(`node --test --test-force-exit tests/<a>.test.js …`; screen tests need
`npm run pretest`). Before each pull request: merge the latest main,
`npm run full-check` passes, self-review with the `reviewer` agent, and for
the pull requests marked **risky**, `/review` plus `risky-area-reviewer`
and a hand-run CI (`gh workflow run test.yml --ref <branch>`).

## 1. Tables and Online orders settings — server (pull request 1, about 500 lines, risky: migration)

- [x] 1.1 Test (scratch database, migrating from empty): `online_orders`, `online_order_lines`, `online_order_events` exist with row-level security on `shop_id`; another shop's rows can't be read or named in a link
- [x] 1.2 Test: `online_payments.purpose` takes `'order'` with an `online_order_id` and refuses an order payment without one; old `'deposit'` rows are untouched; `checking` and `unknown` statuses are allowed on `online_payments` and `pretend_payments`
- [x] 1.3 Test: `online_order_settings` gains `sells` (`shelf` only), `wallets_on`, `store_credit_on`, `remind_days` (3), `keep_days` (7), `shelf_name`, `next_order_number`; `categories.show_online` starts true
- [x] 1.4 Test: `GET /api/online-orders-settings` returns the new settings beside WP-6.1's; `PUT` saves them; reminder 1–60, keeping 2–90 and longer than the reminder; refused for non-Owners (`ownerOnly`)
- [x] 1.5 Test: the order number comes from the shop's counter, one up, never reused; two at once get different numbers (shown as `[prefix]-` and the number until Jack names the prefix)
- [x] 1.6 Write the migration (the next free number at build time; latest on main is 149) and extend `server/routes/online-payments.js` to pass 1.1–1.5
- [x] 1.7 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 2. Online orders settings — screen (pull request 2, about 550 lines)

- [x] 2.1 Screen test: `on-settings` — What the website sells with only "Only what’s on the shelf" and its hint, and the held line; no other choice (question 10)
- [x] 2.2 Screen test: `on-settings-pay` — WP-6.1's connected line, the Apple Pay and Google Pay and Store credit switches, no Gift cards switch, summary "[Payment provider] · store credit"; Not collected with its two boxes and the drawn explanation
- [x] 2.3 Screen test: `on-settings-keep` — Keep orders for, and "Shelf or spot" with its hint
- [x] 2.4 Test (server): a category's switch sets every product in it; a new product follows its category; the count of products set differently; "Started with every product online on [date]" from the website's set-up date; Change reuses set-up step 3's code
- [x] 2.5 Screen test: `on-settings-show` — a switch per category, "[n] products are set differently from their category." with See them (opens Stock filtered, as WP-6.1's See them does), "New products follow their category."
- [x] 2.6 Build the folds in `src/screens/settings/online-orders-settings.tsx` and the category switch route to pass 2.1–2.5
- [x] 2.7 Self-review with `reviewer`; full check

## 3. The six order messages (pull request 3, about 400 lines, risky: messaging core)

- [x] 3.1 Test: six keys in `server/messaging/templates.js` — Order confirmation, Order ready to collect (the drawn `on-email-ready` wording), Order still waiting, Item we couldn’t supply, Order cancelled, Order not ready after all — five marked as draft wording; each carries the order number and "See your order"
- [x] 3.2 Test: `server/online-orders/messages.js` queues each through `queueMessage` (pretend), skips a switched-off message, and gives Order ready to collect a wait of a few seconds with Undo (decision 9, H4; `[n]` seconds, chosen at build time); Order confirmation goes with no wait
- [x] 3.3 Test: a message that couldn't reach the customer is visible on the order, for "Email didn’t arrive · [phone]"
- [x] 3.4 Screen test: `on-messages` — "Online order messages" with the six rows, Edit and On; the "on" count counts the real list; block 46 (the Email and text frame) shows the ready email as drawn
- [x] 3.5 Build to pass 3.1–3.4
- [x] 3.6 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI
- [x] 3.7 Left by the reviews of pull request 3 (nothing sends these messages yet; fix before pull request 4 first calls `queueOrderMessage`):
  - [x] 3.7a Order ready to collect says "ready at [Shop name]" with the business's name and address only; with more than one shop it needs the order's own shop (`online_orders.site_id` → the site's name and address), as the spec scenario and `on-email-ready` say ("North Street Cycles, Bolton")
  - [x] 3.7b Order confirmation's draft wording lacks what the spec asks for: what was bought, how it was paid, where to collect it
  - [x] 3.7c Order cancelled for an order with no number (unpaid, "payment unsure") leaves a gap for the number and still says "We’ve refunded [Amount refunded]"; give unpaid cancellations their own wording or skip the refund sentence
  - [x] 3.7d Nothing stops the same order message being queued twice (a retried payment step sends two confirmations); guard in `queueOrderMessage` or in each caller
  - [x] 3.7e Order cancelled's wording runs `[Reason]` into "We’ve refunded" with no full stop of its own
  - [x] 3.7f The ready email's shop lines leave a bare "Open" or a leading "·" when the shop has no opening hours or address in Shop details
  - [x] 3.7g The preview route adds From and To to every message's preview, not only the online order ones; `undoOrderReady` leaves `ready_message_id` on the undone message; `orderEmailProblem` ignores a message stuck at "unknown"; the screen test for the "on" count passes without this change, and nothing tests that a second Mark ready stops the first ready email

## 4. Basket and checkout — server (pull request 4, about 550 lines, risky: public routes, money and stock)

- [x] 4.1 Test: `POST /api/site/basket` prices each line from the product, never from the cookie; a tampered price is ignored; the stock line at the chosen shop; "Only 1 left at Bolton — we’ve changed it to 1" and "No longer in stock at Bolton or [Second site]" answers
- [x] 4.2 Test: the basket answers "not taking online orders" when buying online is off or payments aren't connected, and for a Shopify-kind website
- [x] 4.3 Test: `POST /api/site/checkout` checks the details and answers each box's message ("Enter your name", the email message) and the count; nothing is made
- [x] 4.4 Test: a signed-in customer's details and store credit come from their account, when the shop allows credit online; "covers it all" when it does; a guest gets a new customer of their own, never matched on typed details (the guest's customer is made with the order, so it moves to 4.5)
- [ ] 4.5 Test (waits for 5.0b–e and Jack's answer 9; until then checkout answers 501 `paying_not_built` where it would make the order): checkout makes one order at `awaiting_payment` and one held payment per `requestKey`; sent twice gives the same order; rate limited
- [ ] 4.6 Write `server/online-orders/basket.js`, `checkout.js` and the routes to pass 4.1–4.5 (written to pass 4.1–4.4)
- [ ] 4.7 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 5. Paying — server and pretend outcomes (pull request 5, about 600 lines, risky: money and stock, public routes — waits for Jack's answer to question 9)

- [ ] 5.0 Test and migration (the next free number at build time): `online_order_refunds`, `online_order_refund_lines` with row-level security on `shop_id`, `store_credit_entries.online_order_id`, and the `stock_movements` refund cause — moved here from pull request 1, as their shape follows question 9
- [ ] 5.0a `server/payments/settle.js` lets go of any payment with no booking after an hour; order payments have no booking, so it needs a deposits-only filter before order payments exist
- [ ] 5.0b Before any code writes an order payment: `server/payments/refund.js`'s provider-wide sweep (`refundOwed()` with no `jobId`) would refund order payments too, and it can only refund in full
- [ ] 5.0c Before any code writes an order payment: `server/shop-data-copy.js` (the Refund rows, about lines 125–133) labels every refunded online payment as a deposit for a job ("Online deposit for job …")
- [ ] 5.0d Before any code writes an order payment: take the order number (`nextOrderNumber()`) last, just before COMMIT, with no provider calls after it, because the counter's row lock holds the shop's settings and other orders' payments until the commit
- [ ] 5.0e Before any code writes an order payment: the public deposit card route (`server/routes/deposit-payments.js`, the `UPDATE online_payments SET status = ?` matched on `provider_ref` alone, about line 82) needs `AND purpose = 'deposit'`, or an order's pretend `ref` posted to it would set that order payment's status (found by the risky-area review of pull request 1)

- [ ] 5.1 Test: a card that works — in one transaction stock is checked and comes off the collecting shop, store credit is spent, one sale is recorded with "Paid online" and "Store credit" lines, the order gets its number and moves to To get ready, the payment is taken, and Order confirmation is queued
- [ ] 5.2 Test: sold out just before paying — the hold is released, nothing is taken from card or credit, no sale, the answer names the product
- [ ] 5.3 Test: declined — nothing taken, credit unchanged, another card can be tried and pays once
- [ ] 5.4 Test: the pretend bank's check (`checking`): approved pays; "Cancel and go back" takes nothing
- [ ] 5.5 Test: no answer (`unknown`): the order waits; `settleOrders()` asks again; went through finishes the order and sends Order confirmation; didn't go through takes nothing and sends the one-off "didn't go through" email (draft wording)
- [ ] 5.6 Test: Apple Pay and Google Pay (pretend wallet) pay as the card does, and are refused when the shop's switch is off; Place order with credit covering it all takes no card
- [ ] 5.7 Test: a commit that fails after the take marks a refund owed, made once; the money joins `ONLINE_TENDERS`, so close the day leaves it out of the till's takings
- [ ] 5.8 Extend `server/payments/pretend.js` (bank's check, no answer, wallets; Stripe's published test cards where one exists) and write `server/online-orders/pay.js` to pass 5.1–5.7
- [ ] 5.9 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 6. Online orders for staff — server (pull request 6, about 500 lines, risky: money and stock — waits for Jack's answers to questions 9 and 11)

- [ ] 6.1 Test: the list in three groups with each row's words; Collected is the last 7 days; the sidebar count is To get ready
- [ ] 6.2 Test: Mark ready moves the order and queues the ready email with a few seconds' wait; Undo in those seconds moves it back and stops the email; `keep_until` is set from the keep days
- [ ] 6.3 Test: Not ready after all moves it back and queues "Order not ready after all" only when ticked
- [ ] 6.4 Test: Hand over moves a ready order to Collected with who and when, takes no money and changes no stock; sent twice collects once; refused from any other stage
- [ ] 6.5 Test: the collecting shop's figure falling below open orders' lines marks the newest order's line "Not on the shelf any more" and turns its Mark ready off
- [ ] 6.6 Test: the till's stock lookup says how many are "for an online order", with the order number
- [ ] 6.7 Write `server/online-orders/orders.js` and `server/routes/online-orders.js` to pass 6.1–6.6
- [ ] 6.8 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 7. Refunds — server (pull request 7, about 600 lines, risky: money and stock, public routes — waits for Jack's answer to question 9)

- [ ] 7.0 Each history step (`online_order_events`) also saves the person's name in `detail.by`, as `server/c2w/orders.js` does, so "who" survives a deleted employee or a sign-in with no employee
- [ ] 7.1 Test: Cancel and refund needs a reason; store credit goes back as a refund entry naming the order, the card part through the adapter's refund, the items back in stock caused by the refund, Order cancelled queued with the reason
- [ ] 7.2 Test: Can't supply refunds one line the way it was paid, marks it "Couldn’t supply · refunded", puts its unit back, queues Item we couldn’t supply with the reason; the rest carries on
- [ ] 7.3 Test: the customer's cancel (`POST /api/portal/:shopSlug/order-links/:code/cancel`) refunds in full while To get ready; just after Mark ready it changes nothing and answers "just marked ready"
- [ ] 7.4 Test: an owed card refund is retried by `settleOrders()` and made once; never more than was taken
- [ ] 7.5 Test: the takings and VAT reports take a refund off on the day made; the sale stays on the day paid
- [ ] 7.6 Write `server/online-orders/refunds.js` to pass 7.1–7.5
- [ ] 7.7 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 8. Online orders for staff — screens (pull request 8, about 600 lines — waits for Jack's answer to question 11)

- [ ] 8.1 Screen test: `on-orders` — the three groups with their hints and rows ("Waiting at [Shelf name]", "Email didn’t arrive · [phone]", "Not collected · [n] days", "by Jo Taylor"); the sidebar count
- [ ] 8.2 Screen test: `on-orders-ready` — "Ready. The email goes to [Customer] in [n] seconds" with Undo; `on-orders-sold-at-till`
- [ ] 8.3 Screen test: `on-order-staff` and `on-order-staff-ready` — items, How, how it was paid, the customer, and each stage's buttons; Hand over on the ready order (question 11)
- [ ] 8.4 Screen test: `on-not-ready`, `on-cant-supply`, `on-cancel-refund` — every drawn line, the needed reasons, Keep buttons; the refunded staff-side states follow not-drawn rows 84 and 85 (`on-order-staff` with the item refunded)
- [ ] 8.5 Build `src/screens/online-orders/` and the `orders` route in `src/staff/routes.ts` to pass 8.1–8.4
- [ ] 8.6 Self-review with `reviewer`; full check

## 9. Not collected and Today (pull request 9, about 450 lines, risky: messaging core — waits for Jack's answer to questions 9 and 11, through pull request 7)

- [ ] 9.1 Test: the reminder round sends "Order still waiting" once, after the shop's reminder days, only when on and not undone; it follows `bike_still_waiting`'s round in the messaging engine
- [ ] 9.2 Test: at the keep date the order goes to Today's Needs attention; Contacted records who and when and takes it off; Hand over takes it off too
- [ ] 9.3 Test: Today's "[n] new online orders" with the oldest time; Owner only
- [ ] 9.4 Test: an order cancelled after its keep date tells the customer it wasn't collected by [date], after the reminder on [date]
- [ ] 9.5 Screen test: `on-today` and `on-today-uncollected`
- [ ] 9.6 Build to pass 9.1–9.5
- [ ] 9.7 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 10. The customer's order link and account — server (pull request 10, about 450 lines, risky: public routes, customer accounts — waits for Jack's answer to questions 9 and 11, through pull request 7)

- [ ] 10.1 Test: `GET /api/portal/:shopSlug/order-links/:code` gives the allowed fields only (no staff names, costs or other customers); a wrong code gets the stop page's answer; rate limited
- [ ] 10.2 Test: the account's `GET /api/portal/:shopSlug/orders` and `/orders/:id` list the customer's own orders and orders typed with the email their code sign-in proved; anyone else's is the same 404
- [ ] 10.3 Test: "Save my details" sends the sign-in code to the order's email; the right code signs in and the order is in the account; a wrong code doesn't
- [ ] 10.4 Test: "Change email" on the confirmation changes the order's email and sends the confirmation again
- [ ] 10.5 Write the routes in `server/routes/portal.js` to pass 10.1–10.4
- [ ] 10.6 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 11. Product page and basket screens (pull request 11, about 550 lines, risky: public routes — waits for WP-6.2's website app, product page, chosen shop and cookies, its pull requests 3, 5, 7 and 8)

- [x] 11.1 Screen test: `on-product` and `on-product-added` on WP-6.2's product page — the stock line, the quantity buttons ("One fewer …", "One more …"), Add to basket, "Added 2 × Shimano brake pads" with View basket, the basket count in its label ("Basket, 3 items")
- [x] 11.2 Screen test: `on-product-out` with "Sold out at Bolton" (decided while planning 1) and `on-product-out-other` with "Collect from [Second site] instead"; `on-product-off`
- [x] 11.3 Screen test: `on-product-no-shop` and `on-choose-shop` — one tap chooses, remembers and adds; Cancel adds nothing
- [x] 11.4 Screen test: `on-basket`, `on-basket-changed`, `on-basket-empty` with Undo; WP-6.2's "can't take orders online yet" basket message goes
- [x] 11.5 Test: `wh_basket` is set and read, listed on WP-6.2's Cookies page from the one list, lasting "[n] days" until Jack says
- [x] 11.6 Build in `src/website/` to pass 11.1–11.5; browser test on a phone and a computer
- [x] 11.7 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 12. Checkout, paying and confirmation screens (pull request 12, about 600 lines — waits for WP-6.2's website app, its pull request 3)

- [ ] 12.1 Screen test: `on-checkout` — How you'll get it with one choice, Your details, Pay with the wallets and the card form, Your order, the terms line; no gift card box (question 8); no "ready in about [n] days" (decided while planning 11)
- [ ] 12.2 Screen test: `on-checkout-errors`, `on-checkout-credit`, `on-checkout-covered`
- [ ] 12.3 Screen test: `on-checkout-paying`, `on-checkout-bank`, `on-checkout-declined`, `on-checkout-unsure`, `on-checkout-sold-out`; "[payment provider]" never named
- [ ] 12.4 Screen test: `on-confirmed` and `on-save-details`; "Not right? Change email"
- [ ] 12.5 Screen test: "our terms" opens the shop's Collection and returns words over checkout, as the booking site's terms open
- [ ] 12.6 Build to pass 12.1–12.5; on a phone the order sits at the top and Pay in a bar along the bottom (decision 10); browser test of paying with the pretend card on a phone and a computer
- [ ] 12.7 Self-review with `reviewer`; full check

## 13. The customer's order page (pull request 13, about 500 lines — waits for WP-6.2's website app, its pull request 3)

- [ ] 13.1 Screen test: `on-order`, `on-order-ready`, `on-order-collected` with Receipt
- [ ] 13.2 Screen test: `on-order-cancel`, `on-order-cancelled`, `on-order-clash`
- [ ] 13.3 Screen test: `on-order-shop-cancelled`, `on-order-cant-supply`
- [ ] 13.4 Screen test: the order in the customer's account opens the same page
- [ ] 13.5 Build to pass 13.1–13.4; browser test of cancelling on a phone
- [ ] 13.6 Self-review with `reviewer`; full check

## 14. The till's hand-over and warning (pull request 14, about 400 lines, risky: money and stock — waits for WP-3.1's `till-collect`, `till-held` and the till's search)

- [ ] 14.1 Screen test: `on-hand-over` on `till-collect` — "Online order · [order number]", each item "from [Shelf name]", the tick line, Not now and Hand over, calling pull request 6's Hand over step
- [ ] 14.2 Screen test: `on-hand-over-refunded` — the refunded item's line
- [ ] 14.3 Test: the till warns but doesn't block when selling an item for an online order (`till-held`, walk-through 2 M6); the order then says "Not on the shelf any more"
- [ ] 14.4 Test: the till's search has an Orders group (walk-through 2 M4) and a count on its Online orders (M3)
- [ ] 14.5 Build to pass 14.1–14.4; the "Till only (no email)" written line is pull request 15's
- [ ] 14.6 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 15. Roles (pull request 15, about 250 lines, risky: sign-in — waits for WP-1.1)

- [ ] 15.1 Test: "Till only" opens Front desk › Online orders and nothing else, so a till-only worker can mark orders ready (walk-through 8, later change 3 Oct; the written line on `on-orders`)
- [ ] 15.2 Test: Online orders settings follow "Can change settings"; "Keep orders for" is open to managers (`on-settings-keep`); Today's lines follow the manager switch
- [ ] 15.3 Swap `ownerOnly` for the switches to pass 15.1–15.2
- [ ] 15.4 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 16. Before the last pull request merges

- [ ] 16.1 `npm test` and `npm run test:browser` pass locally on the final commit (through `npm run full-check`)
- [ ] 16.2 Walk the build against `specs/` and the drawings line by line; note what was met, dropped or changed
- [ ] 16.3 Log design's "Decided while planning" items, as built, in your own month file in `docs/decisions/decided-while-building/`

## Later (not in this change)

Each keeps its drawn words for when it is built.

- **Gift cards** (question 8): selling, codes, balances, paying with them
  at the till and online; then `on-checkout-gift-code` ("We don’t recognise
  that code. Check it against your card, or ask the shop."),
  `on-checkout-gift` ("£[£] left on your gift card for next time"), the
  "Have a gift card? Add it" box and the Gift cards switch in Paying online.
- **"Anything in stock at any of our shops"** (question 10; needs stock
  transfers, WP-5.2): the setting ("We move it across with a stock
  transfer. The website says “Ready at Bolton in [n] days”. Only shown when
  you have more than one shop."), "Moving between shops takes",
  `on-product-two-shops` ("Ready at Bolton in [n] days — it’s at our [Second
  site] shop, and we’ll bring it over"), `on-order-moving`,
  `on-orders-arrived`, `on-orders-second` ("Send to Bolton"), "Waiting for 1
  item", "Ready to collect when the last item is — about [n] days.", and
  WP-6.2's "Show ones ready in [n] days".
- **"Also things we can order in"** (question 10; needs supplier lead
  times): the setting ("From the supplier. The website says “Ready in about
  [n] days”. The order arrives as “To order from [supplier]”, and the item
  goes on the restock list under “For customers” for whoever orders
  stock."), `on-settings-order-in` ("Ordering in takes about", "Or each
  supplier’s own time, from their details in Stockroom."),
  `on-product-order-in` ("Ready at Bolton in about [n] days — we order it in
  for you"), "Ordered from [supplier] · due [date]" and "Due [date]" on
  Online orders, and online orders on the restock list's "For customers"
  (`decided-while-building.md:2330`).
- **Delivery** (decision 1): postage, packing and tracking, a second "How
  you'll get it" choice, and a "Sent" step. Every "Collect from" place is
  listed for then (decision 9, M8).
- **Shopify orders in Online orders** (`ws-shopify-order`, "From Shopify";
  WP-6.1 decision 10): waits for Shopify orders to become online orders,
  which today are one sale with the tender 'Shopify'. Then Mark ready and
  Hand over work on them like website orders.
- **Search finding online orders** (decision 10: "search finds orders all
  the same"): not drawn; the till's Orders group is pull request 14.
- **Buy now, pay later** (decision 5): when the provider is chosen.
- **A real payment provider**: stops and asks Jack (Mark sets the account
  up, with Jack's yes).

## Workflow follow-up

- `/opsx:archive` as the last commit of the last pull request, before it merges.
- Change STATUS's "Start here" in the pull request that takes the piece, and in the one that finishes it.
