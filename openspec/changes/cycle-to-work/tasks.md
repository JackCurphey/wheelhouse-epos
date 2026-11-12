# Tasks

Thirteen pull requests. The first ten need none of the missing pieces and
can be built now, in order (1 → 2, and 1 → 3 → 4 → 5 → 6 → 7 → 8; 9 and 10
after 8). Pull request 11 waits for Mark's till deposit for orders, 12 for
WP-1.1 roles and WP-1.2's activity log, 13 for the accounts link, the
Margin report, the till working offline and till refunds. Sizes are
estimates of changed lines, tests included.

**Waiting for Jack** (12 Nov, `docs/decisions/2026-11-12-cycle-to-work-defaults-taken.md`): pull requests 7 and 8 —
money taken at the till is his to approve — and within them the paid box
wording (7.5, `till-c2w-paid-cert`); and the two messages beyond his
decision's four (9.1; the "no longer put aside" half of `cw-texts-hold`,
and `cw-texts-cancelled`). Build order meanwhile: 1, 2, 3, 4, 5, 6, 10, then
9 with the four messages only. Pull request 10's late-payment lines show
nothing until pull request 7 sets expected payments.

Every test is written first and watched failing for the right reason before
the code. Example data comes from the drawings; unknowns stay bracketed.
While building, run only the related test files
(`node --test --test-force-exit tests/<a>.test.js …`; screen tests need
`npm run pretest`). Before each pull request: merge the latest main,
`npm run full-check` passes, self-review with the `reviewer` agent, and for
the pull requests marked **risky**, `/review` plus `risky-area-reviewer`
and a hand-run CI (`gh workflow run test.yml --ref <branch>`).

## 1. Tables and settings — server (pull request 1, about 450 lines, risky: migration)

- [x] 1.1 Test: migrating from empty makes `c2w_settings`, `c2w_providers`, `c2w_orders`, `c2w_order_events`, `c2w_payments`, `c2w_payment_orders`, and the `c2w_order_id` columns on `stock_frames` and `purchase_order_items`, all with row-level security on `shop_id`; another shop's rows can't be read (scratch database)
- [x] 1.2 Test: `GET /api/c2w/settings` makes the shop's row on first read; `PUT` saves hold days, reminder days, quote days, the ordering rule, how to apply; refused for non-Owners
- [x] 1.3 Test: "Straight away, with a deposit" is refused while till deposits don't exist
- [x] 1.4 Test: providers — add, edit, retire; a retired provider drops off the list to pick from; the commission left out of replies for someone who can't see costs (days to pay and hand-over checks are still sent: `docs/decisions/decided-while-building/2026-11-jack.md`, 12 Nov, item 4)
- [x] 1.5 Write the migration (next free number) and `server/routes/c2w-settings.js` to pass 1.1–1.4
- [ ] 1.6 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 2. The settings screen (pull request 2, about 400 lines)

- [ ] 2.1 Screen test: `cw-settings` — the intro line, the six folds, the hold, reminder and quote fields, the ordering rule with its drawn hints, How to apply with its hint
- [ ] 2.2 Screen test: `cw-settings-provider` — Name, Commission (% or £), Pays in about, accessories choice, Checks at hand-over with its hint; "+ Add a provider", Edit, Retire
- [ ] 2.3 Build Settings › Front desk › Cycle to Work to pass 2.1–2.2
- [ ] 2.4 Self-review with `reviewer`; full check

## 3. Orders and quotes — server (pull request 3, about 550 lines)

- [ ] 3.1 Test: making a quote creates the order at "Quote given" with the next quote number; two quotes at once get different numbers
- [ ] 3.2 Test: valid-until and hold-until come from Settings; the total includes accessories; "Don't hold this one" sets no hold
- [ ] 3.3 Test: each step adds a "What's happened" line with who and when; nothing edits or removes one
- [ ] 3.4 Test: a step not allowed from the order's stage is refused and changes nothing
- [ ] 3.5 Test: the list groups orders by stage, gives the top-line counts and the sidebar count; the owed total only for someone who can see costs
- [ ] 3.6 Test: the quote document's fields and closing paragraph follow the order; email queues the quote
- [ ] 3.7 Test: a retired provider can't be picked for a new order; merging two customers moves their Cycle to Work orders to the kept one, and Undo moves them back (add `c2w_orders` to `MOVED` in `server/routes/customer-merge.js`)
- [ ] 3.8 Write `server/c2w/orders.js` and `server/routes/c2w.js` to pass 3.1–3.6
- [ ] 3.9 Self-review with `reviewer`; full check

## 4. List, New order, quote and order page — screens (pull request 4, about 600 lines)

- [ ] 4.1 Screen test: `cw-list` and `cw-list-owner` — groups, row buttons, top line; `cw-first-use` with its two buttons
- [ ] 4.2 Screen test: `cw-new` and `cw-new-not-in-stock` — fields, the Bike lines, the two ticks, Cancel and Make the quote; + New customer (edge 6c)
- [ ] 4.3 Screen test: `cw-quote` and `cw-quote-revised` — every drawn line, "LOGO" placeholder, Print and Email
- [ ] 4.4 Screen test: `cw-order-held` and `cw-more` — heading, Who pays what, next-step buttons, "What's happened"
- [ ] 4.5 Build `src/screens/c2w/` to pass 4.1–4.4, with the sidebar count
- [ ] 4.6 Log decided-while-building 1, 3 and 4 (design) in your own month file
- [ ] 4.7 Self-review with `reviewer`; full check

## 5. Holding bikes and stock (pull request 5, about 450 lines, risky: stock)

- [ ] 5.1 Test: making a quote with the hold holds one free frame at the site, linked to the order; two quotes for the last frame — only one holds it
- [ ] 5.2 Test: a hold never ends by itself; the reminder day and the end date drive "hold ending soon" and "hold ended — choose"
- [ ] 5.3 Test: Hold longer moves the date; Release the bike frees the frame and keeps the order open
- [ ] 5.4 Test: a held frame is left out of available stock in the till search, the Stock page and the storefront (sold out when it's the last); the till refuses it in any other sale
- [ ] 5.5 Screen test: `cw-hold-ending`, `cw-list-hold-ended`; the Stock page's "Held for [Customer] until [date] · Cycle to Work — not for sale"
- [ ] 5.6 Build to pass 5.1–5.5
- [ ] 5.7 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 6. Certificate, applied and ordering in (pull request 6, about 550 lines, risky: stock)

- [ ] 6.1 Test: Mark as applied; adding the certificate moves the stage and makes the hold firm; the "bike is ready" tick moves on to Ready to collect
- [ ] 6.2 Test: less and more than the order give the drawn choices and change Who pays what; late certificate warns; released order takes a free frame again
- [ ] 6.3 Test: the ordering rule decides when "Order from [supplier]" shows; ordering adds a supplier order line linked to the order, with Undo; "Order now anyway…" refused without a reason, logged with it
- [ ] 6.4 Test: booking the bike in holds its frame for the order and moves it to Ready to collect when the certificate is in
- [ ] 6.5 Screen test: `cw-applied`, `cw-certificate` with `-diff`, `-more`, `-late`, `-released`, `cw-certificate-match`, `cw-order-anyway`, `cw-ordered`, `cw-order-on-order`, `cw-order-get-ready`, `cw-marked-ready`, `cw-order-ready`; `rs-receive-c2w`, `rs-frame-c2w`, `rs-booked-c2w`
- [ ] 6.6 Build to pass 6.1–6.5
- [ ] 6.7 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 7. Hand-over at the till (pull request 7, about 550 lines, risky: money — waiting for Jack)

- [ ] 7.1 Test: the hand-over checks come from the provider's note, one tick a line
- [ ] 7.2 Test: `POST /api/sales` with the order adds the "Cycle to Work · [Provider]" payment itself; a different claimed share is refused; the order must be Ready to collect; sent twice counts once
- [ ] 7.3 Test: the sale marks the frame sold, moves the order to Collected, sets the expected amount and date from the provider's terms; the provider's share isn't counted in the drawer
- [ ] 7.4 Test: accessories added at the counter are paid by the customer; a card declined for the customer's part keeps the provider's line (edge 6b)
- [ ] 7.5 Screen test: `cw-hand-over`, `till-c2w-pick` (and empty), `till-c2w`, `till-c2w-pay`, `till-c2w-extra`, `till-c2w-paid-cert` (**waiting for Jack:** paid box wording), `till-c2w-paid`, and the receipt line
- [ ] 7.6 Build to pass 7.1–7.5
- [ ] 7.7 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 8. The provider's money and cancelling (pull request 8, about 550 lines, risky: money — waiting for Jack)

- [ ] 8.1 Test: Mark paid equal to expected moves to Paid by the provider; a difference offers Close with a reason and Save as part paid; Mark the rest paid
- [ ] 8.2 Test: Record a payment over several ticked bikes; the Expected, Received and Difference rows
- [ ] 8.3 Test: the Owed lists, late payments, Download as spreadsheet
- [ ] 8.4 Test: the money steps are refused for non-Owners and logged with who and why
- [ ] 8.5 Test: cancelling frees the frame and keeps the order; Staff can cancel with no deposit
- [ ] 8.6 Screen test: `cw-order-owed`, `-part-paid`, `-paid`, `cw-mark-paid`, `-diff`, `cw-record-payment`, `-more`, `cw-owed`, `cw-owed-reports`, `cw-owed-provider`, `cw-cancel`, `cw-cancel-ordered`
- [ ] 8.7 Build to pass 8.1–8.6
- [ ] 8.8 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 9. Messages and the customer's view (pull request 9, about 500 lines, risky: messaging and public route)

- [ ] 9.1 Test: the four message keys the decision names, with the drawn wording; each sent at its step only when on (**waiting for Jack:** "Your bike is no longer put aside" and "Your order is cancelled")
- [ ] 9.2 Test: `GET /api/portal/c2w-links/:code` gives the allowed fields only; a wrong code gives nothing; rate limited
- [ ] 9.3 Test: the signed-in account lists only the customer's own orders, with "What you pay at collection"
- [ ] 9.4 Screen test: `cw-messages`, `cw-email`, `cw-email-certificate-revised`, `cw-texts-certificate`, `cw-texts-hold`, `cw-texts-cancelled`, `cw-customer-view` with `-released` and `-cancelled`, `ac-account-c2w`, `-collected`
- [ ] 9.5 Build to pass 9.1–9.4
- [ ] 9.6 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 10. Today, search, customer page and the report (pull request 10, about 450 lines)

- [ ] 10.1 Test: the Today source gives the hold and late-payment lines, Owner only, and only when "On Today" is on
- [ ] 10.2 Test: header search finds orders by name and quote number; the customer page lists their orders
- [ ] 10.3 Test: the `rp-c2w` report — tiles and the by-provider table, counted on the day marked paid
- [ ] 10.4 Screen test: `cw-today`, `cw-today-held`, `op-today-c2w`, `cs-search-c2w`, `cs-page-c2w`, `-collected`, `rp-c2w`; the Takings report counts Cycle to Work money in
- [ ] 10.5 Build to pass 10.1–10.4
- [ ] 10.6 Self-review with `reviewer`; full check

## 11. Deposits (pull request 11, about 450 lines, risky: money — waits for Mark's till deposit for orders)

- [ ] 11.1 Test: "Straight away, with a deposit" can be chosen; the order asks for the deposit (£ or %); "Order from [supplier]" waits for it
- [ ] 11.2 Test: the till takes the deposit against the order, using Mark's deposit table widened to Cycle to Work orders
- [ ] 11.3 Test: at the certificate, refund or count it as Settings says; on pulling out, refund or keep it; cancelling with a deposit is Owner only; "Deposit to refund" on Today
- [ ] 11.4 Screen test: `cw-settings-deposit`, `cw-quote-deposit`, `cw-order-applied-deposit`, `-deposit-paid`, `-deposit-counted`, `-deposit-refund`, `cw-list-deposit-refund`, `cw-cancel-ordered-deposit`, `till-c2w-deposit`
- [ ] 11.5 Build to pass 11.1–11.4
- [ ] 11.6 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 12. Roles and the activity log (pull request 12, about 250 lines, risky: sign-in — waits for WP-1.1 and WP-1.2)

- [ ] 12.1 Test: the money steps are allowed for managers and Staff with "Can close the day"; Today's lines for "Give everything a Manager can do"; costs for "Can see costs and margin"
- [ ] 12.2 Test: each money step also reaches the activity log as its own kind
- [ ] 12.3 Swap `ownerOnly` for the switches and add the activity log calls to pass 12.1–12.2
- [ ] 12.4 Self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 13. Late items (pull request 13, about 300 lines — waits for the accounts link, Margin, till offline and till refunds)

- [ ] 13.1 `rp-accounts-c2w`: the three Cycle to Work rows in the accounts mapping
- [ ] 13.2 Margin takes off the provider's commission on each Cycle to Work bike, corrected when marked paid
- [ ] 13.3 Edge 6a: a hand-over while offline uses the till's own copy, marked To send
- [ ] 13.4 Edge 6d: a bike back after the provider paid — refund to the provider or store credit for the customer, chosen by a manager; the order reopens
- [ ] 13.5 Tests first for each; self-review with `reviewer`, `/review` and `risky-area-reviewer`; full check; hand-run CI

## 14. Before the last pull request merges

- [ ] 14.1 `npm test` and `npm run test:browser` pass locally on the final commit (through `npm run full-check`)
- [ ] 14.2 Walk the build against `specs/` and the drawings line by line; note what was met, dropped or changed

## Workflow follow-up

- `/opsx:archive` as the last commit of the last pull request, before it merges.
- Change STATUS's "Start here" in the pull request that takes the piece, and in the one that finishes it.
