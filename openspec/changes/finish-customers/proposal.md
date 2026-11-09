## Why

WP-3.2, Customers, is built except for its money and its paper trail. A check against the build plan on 8 Nov found five parts still missing: store credit (`cs-credit`), a customer's account with its statement and what they owe (`cs-account`), recording a bank transfer (`cs-transfer`), a bike's warranty (`cs-page`, `cs-bike`), and "+ Log a request" and "Send the copy" on Privacy requests (`cs-privacy`). Jack chose on 8 Nov to finish partly done board items before new ones, and on 9 Nov to have each piece's spec written one piece ahead with its open questions brought to him before building. This is that spec, with Jack's answers of 9 Nov folded in (`docs/decisions/2026-11-09-answers.md`). **It is not built yet;** a builder session builds from it.

## What Changes

- **Ways to pay** (`set-pay-ways`): Settings › Front desk › Payments gains the drawn "Ways to pay" section's two rows this piece needs: **Store credit** ("Earned back on sales, and given on refunds without a receipt") and **Customer accounts** ("Pay later, settled from the customer's page", with "Most a customer can owe"). Customer service decision 6: with a switch off, its line, history rows and buttons don't show on the customer page.
- **Store credit** (`cs-credit`): "Store credit [£]" in At a glance opens "Maya Patel's store credit · Has [£] now", Add credit or Take some away, an amount and a reason; each change shows in her history as "Store credit added · [reason] · by [name]". Her website account shows "Store credit £[credit] · Use it in the shop or online" (`ac-account`, account and reminders decision 1), and asking to delete warns it will be lost (`ac-delete`, audit M12).
- **A customer's account** (`cs-account`, `cs-page-over`): "Owes on account [£ owed]" in At a glance and an "Owes [£]" chip beside the name (warning colour and "Over her limit by [£]" when over); the Account pop-up with Owes now, Most Maya can owe (the Owner can change it for her), the Statement, Email the statement and Record a bank transfer. Only customers the Owner gives an account ("Give [name] an account") can owe (answer 2); the Owner types what a customer owed before Wheelhouse once (answer 5). "Take a payment at the till" waits for the till's half.
- **Recording a bank transfer** (`cs-transfer`): Amount (filled with everything she owes), Date it arrived, Reference; it comes off what she owes and is never counted in the till's takings or cash-up.
- **Money owed holds a deletion back** (customer service decision 12(2)): a privacy request for someone who owes on account says "Still in the way: owes on account [£]", as a bike in the workshop already does. Store credit doesn't (audit M12, coverage walks answer 5): it is lost, and the loss is recorded.
- **Bike warranty, by brand** (`cs-page`, `cs-bike`, `ac-account`; customer service decision 4; Jack's answers 3 and 4): Settings › Stockroom gains "Bike warranties", a list of brands, each with Frame, Components and Electronics lines of whole years or Lifetime (Electronics for e-bikes only); a product gains a **brand** (nothing recorded one before) and an e-bike yes/no, and can have its own lines. A bike bought here shows each line with its own end ("Frame: lifetime · Components: until [date], [n] months left"); a bike from elsewhere shows none. Staff record "Bought here on" with its brand (and model) in a bike's Edit for bikes sold before Wheelhouse; a bike sold through Wheelhouse joins its customer's Bikes once the till records frame numbers (the till's half).
- **Privacy requests** (`cs-privacy`): "+ Log a request" for a request made in person, by phone, email or letter; "Send the copy" for a copy-of-their-data request.
- **Server (risky: migrations; money; customer accounts and their website routes):** two migrations (store credit and account entries, a customer's account and limit; brands' and models' warranty lines, a product's brand and e-bike, a bike's purchase and its warranty lines); new routes for credit, the account, transfers, the statement, logging a request and sending a copy; the privacy check gains money owed.

## Out of scope, and what waits on Mark

- **The till's half of store credit and accounts** (`till-account` "Put on account", `till-loyalty` "Use it", earning back [n]% on each sale, `till-refund-noreceipt` refunds onto store credit, taking an account payment at the till, and a sale recording a bike's frame number). These are WP-3.1 till payments and change how a sale is paid; the till's money path is Mark's step C. **Jack's answer 1: a later, separate piece, after a word with Mark.** Until it exists, an account's balance comes only from what was owed before Wheelhouse, less bank transfers, and store credit only from staff adding it.
- Recording who changed what in the activity log (Mark's WP-1.2): each change is kept in this piece's own entries, with who and why, which the log can read later.
- Reports showing store credit changes and account balances (WP-5.x, Reports): the entries are kept so Reports can read them; nothing here draws a report.
- A Manager changing a customer's limit or seeing privacy requests: there are no Managers until roles (Mark's WP-1.1), so it is the Owner, as every Owner-only setting is.
- Gift cards, deposits, finance, Cycle to Work and the card machine rows of Ways to pay come with their own pieces.
- Spending store credit online (`ac-account` says "in the shop or online"; the website's checkout, WP-6.x).
- At a Lightspeed shop there is no account or store credit (Lightspeed shops decision 1, `ls-customer-page`); nothing changes there.

## Who and risk

WP-3.2, Jack's side, built by one builder session after Jack answers. **Risky on three counts:** migrations; money (store credit, money owed, transfers); customer accounts and `/api/portal/*` (the website account's store credit card and delete warning). `/review` before each merge and a hand-run CI (`gh workflow run test.yml --ref <branch>`). Seven pull requests, stacked, listed in `tasks.md`.

## Follows

- Decisions: `docs/decisions/2026-11-09-answers.md` (Jack's answers to this change's questions); `docs/decisions/2026-09-30-customer-service-review.md` 2, 4, 6, 7, 9, 10, 12 and the later change of 4 Oct; `docs/decisions/2026-09-30-owner-setup-review.md` 7 and the later change on Store credit; `docs/decisions/2026-09-29-selling-at-the-till-review.md` 8, 9; `docs/decisions/2026-10-01-account-and-reminders-review.md` 1 and audit M12; `docs/decisions/2026-10-04-coverage-walks.md` 5; `docs/decisions/2026-10-30-answers.md` 1 and 3; `docs/decisions/2026-10-08-not-drawn-pages.md` rows 6, 14, 15, 44, 45, 46, 61; `docs/decisions/2026-10-02-lightspeed-shops-review.md` 1; `docs/decisions/decided-while-building.md` (30 Oct privacy items 3 and 4; 24 Oct customer page item 7; 25 Oct bike page item 2; 26 Oct account screens item 1).
- Drawings (`docs/design/user-journeys/generator/customer.mjs`, `setup.mjs`, `account.mjs`, `stock.mjs`): `cs-credit`, `cs-account`, `cs-transfer`, `cs-page`, `cs-page-over`, `cs-page-off`, `cs-bike`, `cs-privacy`, `set-pay-ways`, `ac-account`, `ac-delete`, and `st-product`'s "Sold to [Customer] · [date] · warranty to [date]".
- Built: `openspec/specs/customers`, `openspec/specs/customer-accounts`, `openspec/specs/settings`, `openspec/specs/close-the-day` (unchanged: transfers stay out of it).

## Capabilities

### New Capabilities
- `customer-money`: store credit and pay-later accounts on the customer page: balances, changes with reasons, the account's limit and statement, bank transfers, and the Ways to pay switches that turn them on.

### Modified Capabilities
- `customers`: a bike's warranty; logging a privacy request by hand and sending the copy; money owed holding a deletion back; store credit lost on deletion.
- `customer-accounts`: the website account's store credit card, its bikes' warranty, and the delete pop-up's store credit and money-owed lines.
- `stock`: Bike warranties per brand in Settings › Stockroom; a product's brand, e-bike and own warranty lines.

## Impact

New: `server/migrations/126_customer_money.sql` and `127_bike_warranty.sql` (the next free numbers at build time), `server/lib/customer-money.js`, `server/routes/customer-money.js`, `server/messaging/statement-email.js`, `src/screens/customers/credit-dialog.tsx`, `account-dialog.tsx`, `transfer-dialog.tsx`, `log-request-dialog.tsx`. Changed: `server/routes/customers.js` (the page's money, the bike's warranty), `server/routes/products.js` (a product's brand, e-bike and own warranty lines), `server/routes/stockroom-warranties.js` (new), `server/privacy-requests.js`, `server/routes/privacy-requests.js`, `server/customer-data-copy.js`, `server/routes/portal.js`, `server/routes/shop-settings.js`, `src/screens/customers/customer-page.tsx`, `bike-page.tsx`, `privacy-requests.tsx`, `src/screens/settings/customer-groups-settings.tsx` (its Payments page), `src/screens/book/account.tsx`, `src/screens/stock/product-page.tsx`, a Bike warranties fold in `src/screens/settings/`. Tests: new `tests/customer-money.test.js`, `tests/migration-126.test.js`, `tests/migration-127.test.js`, `tests/screens/customer-money.test.js`, `tests/browser/customer-money.spec.ts`; changed customer, bike, privacy, portal and route-list tests. `server/routes/close-the-day.js` is deliberately untouched, with a test proving a transfer never reaches takings.
