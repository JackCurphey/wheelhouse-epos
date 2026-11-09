# Design

**Not built.** Jack answered the six main questions on 9 Nov (`docs/decisions/2026-11-09-answers.md`); they are folded in here, in the specs and in the tasks. The small ones (§ Open questions) are built on their defaults unless he overrules one.

## Context

What exists today (checked 9 Nov against main at `88ed9981`):

- **No store credit, account, transfer or warranty anywhere** in migrations, routes or screens. At a glance (`src/screens/customers/customer-page.tsx:438-443`) shows only "Happy to hear about offers". `customer_groups` has only a name and a discount. Settings › Front desk › Payments shows only Customer groups ("ways to pay come with their pieces", `decided-while-building.md` 26 Oct).
- **How a sale is paid now:** the old record `sales` (`payment_method`, `cash_amount`, `card_amount` in pounds) plus `sale_payments(tender_type, amount)` for anything else, written in `server/lib/sales.js:480-521`; the till's own record `till_sale_payments(method, amount_pence)`, where `server/till/sync.js:29` knows only cash and card (step C, Mark). The till's pay dialog offers Card, Cash and split only.
- **Close the day** (`server/routes/close-the-day.js:96-115`) counts every `sale_payments` tender except `ONLINE_TENDERS` and every till payment that isn't cash or card as "other" takings. Anything put in those tables lands in takings unless excluded.
- **Bikes:** `customer_bikes` has make, model, colour, `serial_number` (shown as "Frame number"), notes. Nothing records a purchase. `bike-page.tsx:17` holds the Warranty block back for this. Nothing records a stock bike's frame number yet (`product-page.tsx:25`, `receive-page.tsx:24`); WP-2.1 is building it now in another session (`jack/bulk-price-change` first), with no spec for frame numbers written yet.
- **Privacy requests:** `privacy_requests` (migration 108, `kind` copy/delete, `source` account/shop, `asked_at`, `done_at`, `cancelled_at` from 109). `server/privacy-requests.js:34-40` holds a deletion back only for a bike in the workshop. Routes: list, open count, delete (Owner). No route to log one or send a copy. The account's own copy is built by `server/customer-data-copy.js`.
- **Email:** `sendEmailTo({ to, subject, body, saleId, customerId, loginId })` (`server/messaging/engine.js:113`) queues a `customer_messages` row; the sender is pretend.
- **Who:** `server/lib/owner-only.js` until roles; the staff app knows Owner and Staff only.
- **Brand:** nothing records a product's brand today. `products` has name, category, supplier (free text matched to the suppliers list by name, Jack's 4 Nov answer 10) and category details the shop defines (migration 121); no brand, make or manufacturer column, and no drawing shows one. A customer's bike has a free-text Make. Nothing marks a product or bike as an e-bike.
- Latest migration on disk: 124 (`124_price_change_batches.sql`, bulk price change, merged 9 Nov).

## Goals / Non-Goals

**Goals:** every amount in whole pence; every change to money kept as its own entry, never edited; nothing in this piece touches a till's takings; each part usable on its own as it lands.

**Non-Goals:** **the till's half** (Jack, 9 Nov, answer 1): putting a sale on account, spending and earning store credit, refunds onto store credit, taking an account payment at the till (and so the Account pop-up's "Take a payment at the till"), and recording a frame number on a sale, which is what joins a sold bike to its customer. It is a later, separate piece, after a word with Mark about step C, and none of it is in this change's tasks. Also out: the activity log (Mark, WP-1.2), reports, Managers.

## Decisions

### 1. Two entry tables, balances worked out from them

Migration 125 (`125_customer_money.sql`, or the next free number at build time):

- `store_credit_entries`: `id`, `shop_id` (row-level security as every table), `customer_id` (references `customers`), `change_pence INTEGER NOT NULL` (signed, never 0), `kind TEXT CHECK (kind IN ('added','taken','undo','lost_on_deletion','earned','spent','refund'))` (the last three for the till's half, so its later piece needs no migration), `reason TEXT`, `sale_id`/`till_sale_id` (nullable, for the till's half), `undoes_entry_id` (nullable), `login_id`, `who_name`, `created_at`.
- `account_entries`: `id`, `shop_id`, `customer_id`, `change_pence INTEGER NOT NULL` (signed: + owed, − paid), `kind TEXT CHECK (kind IN ('opening','sale_on_account','bank_transfer','till_payment','undo'))`, `reference TEXT`, `received_on DATE` (a transfer's "Date it arrived"), `sale_id`/`till_sale_id` (nullable), `undoes_entry_id`, `reason`, `login_id`, `who_name`, `created_at`.
- `customers.account_opened_at TIMESTAMPTZ NULL` (only customers the Owner gives an account can owe, Jack's answer 2) and `customers.account_limit_pence INTEGER NULL` (null = the shop's limit).
- Payment settings: a `payment_settings` row per shop (`store_credit_on`, `earn_back_percent` for the till's half, `accounts_on`, `account_limit_pence`), read and written by `GET`/`PUT /api/payment-settings`, created lazily as `label_settings` and `end-of-day-settings` are (`server/routes/shop-settings.js`). If Mark's settings store lands first, these four keys go there instead; the screen doesn't change.

A balance is `SUM(change_pence)` for the customer (and every record merged into them, as the privacy check already reads merged records). *Why not a balance column:* the drawings promise a history and reports of every change, and a sum can't drift from its entries. *Considered:* a single table for both: rejected, the two have different kinds, rules (credit never below zero; owed may go over the limit) and switches.

### 2. Never below zero, never two at once

Every write locks the customer's row (`SELECT … FOR UPDATE`, as the other customer saves do, `server/routes/customers.js:86`, #542) before reading the balance, so two tills taking credit at once can't overdraw it, and a deletion or merge at the same moment waits ("A deletion happens at once or not at all").

### 3. Bank transfers live only in `account_entries`

A transfer is never written to `sales`, `sale_payments` or `till_sale_payments`, so close the day, the float and the cash count can't see it. A test closes a day with a transfer recorded and compares the figures with and without it. `close-the-day.js` is not changed.

### 4. Routes (`server/routes/customer-money.js`, `// screens:` comments)

- `GET /api/customers/:id` gains `money: { storeCreditOn, accountsOn, credit, owed, hasAccount, limit, shopLimit, overBy }` (pence), from the switches; fields for a switched-off way to pay are absent.
- `GET /api/customers/:id/store-credit` (entries, newest first); `POST …/store-credit { change: 'add'|'take', pence, reason }` (any staff); `POST /api/store-credit-entries/:id/undo { reason }` (Owner).
- `GET /api/customers/:id/account` (owes, limit, statement); `POST …/account/open` (Owner, answer 2); `PUT …/account/limit { pence | null }` (Owner); `POST …/account/opening { pence }` (Owner, once, answer 5); `POST …/account/transfers { pence, receivedOn, reference }` (any staff); `POST /api/account-entries/:id/undo { reason }` (Owner); `POST …/account/email-statement` (any staff; at most 5 an hour per customer, as receipts are).
- The history (`GET /api/customers/:id/history`) gains store credit rows ("Store credit added · [reason] · by [name]", +/−) and transfers, filtered with Everything only, as refunds will be.
- `GET`/`PUT /api/payment-settings` (`PUT` Owner).
- Each refusal is a 400 or 409 with the words the pop-up shows; another business's customer is a 404.

### 5. Statement email (`server/messaging/statement-email.js`)

Template key `statement`, no sale; to `invoice_email` for a company customer when set (built with company customers, #528), else `email`. Words follow the receipt email's frame (not-drawn row 44's pattern): the shop's name, "Your account with [shop]", the statement lines, "You owe [£]", and how to pay (the shop's phone from its details). Logged in `decided-while-building.md` as not drawn.

### 6. Warranty, by brand (Jack, 9 Nov, answers 3 and 4)

Jack's answer: warranties differ by brand and a bike carries more than one (Trek: lifetime frame, 2 years components; Cube: 10 years frame, 2 years components; a Trek e-bike: lifetime frame, 2 years electronics). Migration 126 (`126_bike_warranty.sql`, or the next free number), additive:

- **Brand had to be added.** `products.brand TEXT` (free text, trimmed), matched to the brand list by name ignoring capitals and spaces at either end, as a product's supplier is matched to the suppliers list (Jack's 4 Nov answer 10). *Considered:* a category detail named "Brand" (each shop names its own details, so code can't rely on one) and a link to a brands table (a Citrus Lime import or a supplier feed brings brand as text, so text matched by name fits what comes in). `products.is_ebike BOOLEAN NOT NULL DEFAULT false`.
- `bike_brand_warranties`: `id`, `shop_id`, `brand TEXT` (unique per business, lower-cased and trimmed). `warranty_lines`: `id`, `shop_id`, `brand_warranty_id` or `product_id` (exactly one), `part TEXT CHECK (part IN ('frame','components','electronics'))`, `years INTEGER NULL CHECK (years BETWEEN 1 AND 50)` (NULL = Lifetime), unique per owner and part. A product with any lines of its own uses only its own (question 17); otherwise its brand's.
- `customer_bikes.bought_here_on DATE NULL`, `is_ebike BOOLEAN NOT NULL DEFAULT false`, `warranty_brand TEXT NULL`, `warranty_product_id INTEGER NULL`, `sold_on_sale_id`/`sold_on_till_sale_id` (nullable, for the till's half).
- `bike_warranty_lines`: `customer_bike_id`, `part`, `ends_on DATE NULL` (NULL = lifetime). **Worked out and written when the bike becomes bought here** (sold, or "Bought here on" saved in Edit), from the product's or brand's lines, Electronics only for an e-bike; never recalculated when a brand's or model's lines change, so a sold bike keeps the warranty it was sold with. Changing "Bought here on", the brand, the model or e-bike in Edit writes them again; clearing "Bought here on" removes them.
- **Showing it:** "Under warranty" while any line runs, then each line in the order Frame, Components, Electronics: "Frame: lifetime", "Components: until [date], [n] months left" (whole calendar months, rounded down; under one month "less than a month left"), "Components: ended [date]"; all ended, "Warranty ended [date]" (question 19).
- **Where the brand list lives:** Settings › Stockroom, a "Bike warranties" fold after Categories. *Pattern:* Settings › Stockroom › Categories (piece 8), a list the Owner edits with each row's details in its own box; warranty lengths are stock facts the Owner sets once. Logged in `decided-while-building.md`, 9 Nov.
- **A bike not linked to a product** (typed in Edit, answer 4): Edit bike gains "Bought here on", Brand (a pick from the brand list, starting at the one matching the bike's Make), Model (optional, a product of that brand) and E-bike (starting from the model's). With no brand picked it shows "Bought here [date]" and no warranty.
- **A sold bike:** one function, `bikeSoldTo(customerId, { frameNumber, productId, soldOn, saleId })`, adds or reuses the customer's bike with that frame number and writes its lines. **It is not called from any sale in this change:** recording a frame number on a sale is the till's half (answer 1). It is tested directly. Assumption about WP-2.1: a stock bike's frame number is recorded per unit, and the till's `till-serial` step will carry it and the customer on the sale line; only the caller depends on that.

### 7. Privacy requests

- `POST /api/privacy-requests { customerId, kind, askedOn, how }` (Owner): `source = 'shop'`, `asked_at` from `askedOn` (not after today), a new `how TEXT` column (question 7) in migration 125. A second open request of the same kind for the same customer is refused.
- `POST /api/privacy-requests/:id/copy { send: 'download'|'email' }` (Owner): builds the account's copy (`customer-data-copy.js`) plus the shop's notes on the customer and each bike (Jack's 30 Oct answer 1: the instant copy leaves notes out; this fuller one doesn't), returns the zip or queues an email with it, and marks the request done.
- `server/privacy-requests.js`' "in the way" gains money owed on account (summed across merged records); store credit is listed on the row as "will be lost", never in the way. Deletion writes a `lost_on_deletion` entry for any credit, inside the same step.

### 8. Screens

- `customer-page.tsx`: At a glance lines and the Owes chip from `money`; `credit-dialog.tsx` (`cs-credit`), `account-dialog.tsx` (`cs-account`), `transfer-dialog.tsx` (`cs-transfer`), each a Form box (block 9) as `cs-edit` is; amounts typed as pounds and pence and sent as pence ("Pounds and pence, like 5.00", the counter's words).
- `bike-page.tsx`: the Warranty block with its lines; Edit bike gains Bought here on, Brand, Model and E-bike.
- `src/screens/settings/`: a Bike warranties fold on Settings › Stockroom, Owner-only controls, each brand's lines in its own box (as a category's details are).
- `product-page.tsx` and its Edit box: Brand and E-bike with the product's details, the warranty it gets ("Warranty: Frame lifetime · Components 2 years", or "this model's own"), and setting the model's own lines (question 17).
- `privacy-requests.tsx`: "+ Log a request" (`log-request-dialog.tsx`, Form box) and "Send the copy" (Download it / Email it).
- `customer-groups-settings.tsx`'s Payments page: the Ways to pay section with the two rows (`set-pay-ways`), Owner-only controls.
- `src/screens/book/account.tsx`: the Store credit card, the warranty lines, and the two lines in the delete pop-up.

## Risks / Trade-offs

- [Without the till's half, accounts are charged only with what was owed before Wheelhouse, and credit can't be spent] → Jack's answer 1 makes the till's half its own piece next; the switches start off (question 11), so no shop sees a half feature unless the Owner turns it on.
- [Two sessions picking the same migration number] → numbers are taken at build time (bulk price change took 124 on 9 Nov).
- [Brand typed differently on products and bikes ("Trek", "Trek Bikes")] → matching ignores capitals and spaces only; a product's brand is picked from the list where it can be, and an unmatched brand simply shows no warranty.
- [WP-2.1's frame numbers land differently from the assumption in § 6] → only `bikeSoldTo`'s caller depends on it, and it isn't wired until the till records a frame number.
- [Mark's settings store or roles land mid-build] → payment settings are four keys behind one route; Owner checks go through `owner-only.js`, which roles replace in one place.
- [A wrong transfer can't simply be deleted] → the Owner's undo (question 14) keeps both lines, so the paper trail stays honest.

## Migration Plan

Both migrations are additive (new tables, nullable columns) and safe to run twice; tested from empty on a scratch database and on a copy with customers, bikes and privacy requests. Rolling back the code leaves unused tables and columns; nothing existing is rewritten.

## Open Questions

Jack answered the six main questions on 9 Nov (`docs/decisions/2026-11-09-answers.md`): 1, the customer-page side now and the till's half as a later piece; 2, only customers the Owner gives an account; 3, warranties per brand with Frame, Components and Electronics lines (his own design, § 6); 4, bikes sold through Wheelhouse plus "Bought here on" in a bike's Edit; 5, the Owner types "Owed from before Wheelhouse" once; 6, the full copy with the shop's notes, to download and emailed.

Small ones, built on these defaults unless Jack overrules one (7 to 16 kept as proposed, 9 Nov):

7. How a hand-logged request came: pills In person, Phone, Email, Letter; the row reads "Asked in person · [date]".
8. The store credit pop-up's button when taking credit away reads "Take it away" (the drawing shows only "Add the credit").
9. Store credit reasons: "Other…" with a typed reason only, until Till › Reasons (not built) gains a Store credit list; then the shop's reasons show as pills.
10. The statement email isn't drawn: it follows the receipt email's frame, with the lines and "You owe [£]".
11. Both switches start off for a new shop and for every existing shop; Customer accounts can't be switched off while anyone owes; Store credit can be switched off with credit held (it's kept and comes back on).
12. The statement shows every entry since the account began, newest first, with what's owed now.
13. Merging moves store credit and money owed to the record kept; undoing the merge moves them back.
14. A transfer for more than is owed is refused; a mistaken transfer or credit change is undone by the Owner with a reason, both lines staying visible.
15. Under a month left on a warranty line reads "less than a month left".
16. A customer who owes on account can still ask to delete their account from the website; the pop-up says it waits until what they owe is paid, as it already says for a bike in the workshop.
17. A model (product) can replace its brand's warranty lines with its own (Jack's answer 3 asked for this as a small default).
18. A product's brand is a new field (nothing recorded brand before), picked from Bike warranties' brands or typed; "E-bike" is a yes/no on the product and on a customer's bike.
19. Each line reads "until [date], [n] months left", "lifetime" or "ended [date]", after "Under warranty"; all ended reads "Warranty ended [date]".
20. The Account pop-up leaves out "Take a payment at the till" until the till's half is built, rather than showing a button that can't work.
