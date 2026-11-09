# Tasks

Jack answered the main questions on 9 Nov (`docs/decisions/2026-11-09-answers.md`); the small ones in `design.md` § Open questions are built on their defaults unless he overrules one. Take the pull requests in order, each stacked on the last. **The till's half (a sale on account, spending and earning store credit, refunds onto credit, account payments at the till, a frame number on a sale) is not in these tasks:** it is a later piece, after a word with Mark (answer 1).

Each pull request: tests first, each watched failing for the right reason (break the code it covers, see it go red, restore); `npm run lint`, `npm test` and `npm run test:browser` pass locally after merging main; a self-review against these specs and the drawings, and `/review` with a hand-run CI (`gh workflow run test.yml --ref <branch>`): every pull request here is in a risky area (migrations, money, or customer accounts and `/api/portal/*`). Every gap decided while building goes in Jack's section of `docs/decisions/decided-while-building.md`. Migration numbers are the next free ones when built (126 and 127 as of 9 Nov, after frame numbers took 125). Aim: 250-600 changed lines each.

## 1. Store credit and the Ways to pay switches, server (pull request 1; migration, money)

- [ ] 1.1 Tests (`tests/migration-126.test.js`, `tests/customer-money.test.js`): migration 126 from empty and run twice; payment settings created lazily, both off, Owner-only `PUT`; add and take with a reason in pence, the balance as the sum, refused with no reason, a bad amount, or more than held; two takes at once never below zero; Owner-only undo kept as its own entry; the customer's `money` with only the switched-on fields; store credit rows in the history; another business's customer a 404. Verify: the file runs red before 1.2, green after.
- [ ] 1.2 Migration 126 (store credit entries, account entries, the customer's account columns, payment settings, privacy requests' `how`); `server/lib/customer-money.js` (store credit half); routes in `server/routes/customer-money.js` and `/api/payment-settings`, with their place in `server/routes/index.js` and `tests/fixtures/route-list.txt`. Verify: 1.1 passes.
- [ ] 1.3 Merging moves store credit to the record kept and undoing moves it back (question 13). Verify: a merge test in `tests/customer-money.test.js`.

## 2. Store credit and Ways to pay, screens (pull request 2; customer accounts)

- [ ] 2.1 Screen tests (`tests/screens/customer-money.test.js`): Ways to pay's two rows, read-only for Staff; At a glance's Store credit line only when on; the `cs-credit` pop-up's words, Add credit and Take some away, the refusals shown in the pop-up, the new balance and history row after; the website account's Store credit card when on and not when off; the delete pop-up's "will be lost" line. Verify: red before 2.2.
- [ ] 2.2 The Ways to pay section on the Payments page; `credit-dialog.tsx`; At a glance and history rows in `customer-page.tsx`; the account's card and delete line in `src/screens/book/account.tsx` and the portal's answer (`server/routes/portal.js`). Verify: 2.1 passes.
- [ ] 2.3 Browser test (`tests/browser/customer-money.spec.ts`): the Owner turns Store credit on, Jo adds credit to Maya Patel with a reason, at computer and phone widths. Verify: `npm run test:browser`.

## 3. Accounts, server (pull request 3; money)

- [ ] 3.1 Tests: giving an account (Owner only); the limit, the customer's own, back to the shop's, Owner-only; "Owed from before Wheelhouse" once, Owner-only; a transfer with amount, date arrived (not in the future) and reference, refused over what's owed (question 14); the statement newest first; Owner's undo; the email queued to the company's invoice address or their email, none without one, at most 5 an hour; over-limit `overBy`; Customer accounts refused off while anyone owes (question 11); **a day closed with a transfer recorded has the same takings, card, cash and other as without it**; merging moves money owed. Verify: red before 3.2.
- [ ] 3.2 The account half of `customer-money.js` and its routes; `server/messaging/statement-email.js` (template `statement`). Verify: 3.1 passes and `close-the-day.js` is unchanged in the diff.

## 4. Accounts, screens, and money owed holding a deletion back (pull request 4; money, customer accounts)

- [ ] 4.1 Tests: the Owes chip and "Over her limit by [£]"; At a glance's line only when on; the `cs-account` pop-up's words without "Take a payment at the till" (question 20), the limit read-only for Staff, "Give [name] an account" and "Owed from before Wheelhouse" for the Owner only; `cs-transfer` filled with what's owed, part payment, the refusals; Email the statement and its no-email words; the privacy row "Still in the way: owes on account [£ owed]" with Delete held back and the server's refusal; the website delete pop-up's line when she owes (question 16). Verify: red before 4.2.
- [ ] 4.2 `account-dialog.tsx`, `transfer-dialog.tsx`, the chip in `customer-page.tsx`; money owed in `server/privacy-requests.js`' in-the-way check across merged records; the portal's delete pop-up line. Verify: 4.1 passes; the existing "bike still in" tests still pass.
- [ ] 4.3 Browser test: the Owner gives Maya an account, enters what she owed before Wheelhouse, Jo records a transfer of part of it, the statement shows both. Verify: `npm run test:browser`.

## 5. Bike warranties, server (pull request 5; migration)

- [ ] 5.1 Tests (`tests/migration-127.test.js`, `tests/bike-warranty.test.js`): migration 127 from empty and run twice; Bike warranties: a brand with Frame, Components and Electronics lines of 1-50 years or Lifetime, a brand listed once ignoring capitals, Owner-only; a product's brand matched by name ignoring capitals and spaces, its e-bike yes/no, its own lines replacing its brand's (question 17); `bikeSoldTo` taking a frame booked in by receiving, adding or reusing the customer's bike with that frame number, marking the frame sold to them, and writing the bike's lines (Trek: frame lifetime, components two years on; Electronics only for an e-bike; Cube: frame ten years on); a sold bike's lines unchanged when Trek's lines change; Edit's Bought here on with a brand, a model and e-bike writing the lines, changing them rewriting them, clearing it removing them, a future date refused; months left rounding down and "less than a month left"; "Warranty ended [date]" when every line has ended; nothing for a bike from elsewhere; another business's brands and products never used. Verify: red before 5.2.
- [ ] 5.2 Migration 127; `server/routes/stockroom-warranties.js` and its route-list lines; the product's brand, e-bike and own lines in `server/routes/products.js`; `bikeSoldTo` and the lines' working-out in a bikes module, **not called from any sale** (the till's half); the bike's and customer's answers (`server/routes/customers.js`) and the account's (`server/routes/portal.js`) carrying each bike's lines. Verify: 5.1 passes.

## 6. Bike warranties, screens (pull request 6)

- [ ] 6.1 Screen tests: Settings › Stockroom's Bike warranties fold, adding Trek and Cube with their lines, read-only for Staff; the product page's Brand, E-bike and "Warranty: Frame lifetime · Components 2 years" or "this model's own", and setting a model's own lines; the bike's Warranty block and the customer page's Bikes row in the drawn wording with each line (question 19); Edit bike's Bought here on, Brand starting at the one matching its Make, Model and E-bike; the account's line. Verify: red before 6.2.
- [ ] 6.2 The Bike warranties fold; `product-page.tsx` and its Edit box; `bike-page.tsx` (remove the "waits" comment at line 17) and its Edit; `customer-page.tsx`'s Bikes; `src/screens/book/account.tsx`. Log where Bike warranties lives (Settings › Stockroom, after Categories) in Jack's section of `decided-while-building.md`. Verify: 6.1 passes.
- [ ] 6.3 Browser test: the Owner adds Trek's lines, Jo records that Maya's Trek was bought here on a date, and her page shows each line, at computer and phone widths. Verify: `npm run test:browser`.

## 7. Privacy requests: log one, send the copy (pull request 7; customer accounts)

- [ ] 7.1 Tests: `POST /api/privacy-requests` Owner-only, a day asked not after today, how they asked (question 7), due one month on, Overdue at once for an old one, a second open one of the same kind refused; the copy with the shop's notes added, downloaded or emailed, marking it done; no email offers download only; store credit shown on a deletion row and written off as `lost_on_deletion`, with no name, in the same step as the deletion. Verify: red before 7.2.
- [ ] 7.2 The routes; the fuller copy in `server/customer-data-copy.js`; `log-request-dialog.tsx` and Send the copy in `privacy-requests.tsx`; remove the comment at `privacy-requests.tsx:17`. Verify: 7.1 passes.
- [ ] 7.3 Browser test: the Owner logs Maya's request made in person and sends her the copy. Verify: `npm run test:browser`.

## 8. Before the last merge

- [ ] 8.1 Walk the built piece against every requirement in this change's specs and the drawings (`cs-credit`, `cs-account`, `cs-transfer`, `cs-page`, `cs-page-over`, `cs-page-off`, `cs-bike`, `cs-privacy`, `set-pay-ways`, `ac-account`, `ac-delete`) and Jack's 9 Nov answers; say in the last pull request which are met, dropped or changed. Verify: the list is in the pull request description.

## Workflow follow-up

- `/opsx:archive` as the last commit of pull request 7, so `openspec/specs/` says what was built.
- The board and STATUS catch up in the day's status pull request.
- The till's half is the next spec after this piece, after a word with Mark about step C: `till-account`, `till-loyalty`, earning back, refunds onto credit, account payments at the till ("Take a payment at the till" on the Account pop-up), and a frame number on a sale calling `bikeSoldTo`.
