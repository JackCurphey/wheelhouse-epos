# Design: a deposit at the till on a repair job, on the current sales record

## Context

The state on `mark/till-job-deposit` at `45c68fa8` (25 Oct, after step B, #492).
Line numbers move; names are the anchor. Revised after challenge r1 (two
reviews; `reviews/r1-disposition.md`).

- **A job's order** is a `sale_documents` row (`kind = 'order'`,
  `workshop_job_id` set), made with zero totals when the job is made
  (`server/workshop/jobs.js:463`) and filled as quotes are agreed
  (`answerAndAddToOrder`, `jobs.js:641`). Pence columns from step A
  (migration 073): `subtotal_pence`, `discount_pence`, `total_pence`,
  `paid_pence`. Today only convert writes `paid_pence`, setting it to the
  sale's total (`server/routes/sales.js`, `convertOrder`).
- **A booked job's order is £0 at drop-off.** `createWorkshopJob` inserts
  the order with zero totals (`jobs.js:463-465`); the booked services sit in
  `workshop_job_services` (`jobs.js:445`, `booked_price_pence`) and reach the
  order only when staff add them in Work and parts (`work-parts.tsx:76`) or a
  quote is agreed (`addApprovedLinesToOrder`). `wholeBill` (`jobs.js:656-690`)
  already sums "the order, plus each booked service's price not already on
  it (matched by service)" for the spending limit.
- **What's due**, `GET /api/sale-documents/:id/due` (`sales.js`): the bill from
  `computeOrderTotals` (`server/lib/sales.js`: the order's discount and the
  customer's group discount off), each part's stock, and the online deposit
  from `countedDeposit` and `depositShare` (`server/workshop/counted-deposit.js`):
  `depositPence`, `depositUsedPence`, `leftToPayPence`, `leftToPay`.
- **Three more places say what's left to pay**, each from
  `computeOrderTotals` alone: the customer's page (`server/routes/portal.js`,
  `jobMoney`, `toPay`) and the Bike ready / Bike still waiting messages
  (`server/workshop/job-messages.js`, `whatsLeftToPay` and `jobMessageVars`,
  whose comment says "as the till would charge it"). None takes the online
  deposit off today.
- **Convert**, `POST /api/sale-documents/:id/convert`: locks the order
  (`SELECT … FOR UPDATE`), refuses unless the work is finished or can be
  finished, refuses with `use_till` without `signedOffBy`, drops any
  "Deposit paid online" payment the till sends, adds its own for the counted
  online deposit, calls `createSale` (old record, pounds, 1p payment
  tolerance), sets `status = 'converted'`, `converted_sale_id`,
  `paid_pence = ROUND(sales.total * 100)`, lets go of a held online deposit,
  and finishes the job. A job's order with no lines, or lines coming to £0,
  is finished by taking £0 ("work given free is finished by taking £0 for
  it"). `createSale`'s insert sets no `created_at`, so the sale carries the
  database's real `now()`, not the pinned test clock.
- **"The job's order".** A job can have more than one linked document
  (`POST /api/sale-documents` and `PUT /api/sale-documents/:id` both take
  `workshopJobId`, for any kind; delete locks them all, `workshop.js:1616`).
  The customer's page, the messages and `wholeBill` read the job's order as
  the newest `kind = 'order'` that isn't cancelled (`ORDER BY d.id DESC LIMIT 1`).
  `PUT /api/sale-documents/:id` can change or clear `workshop_job_id` on any
  open document (`sales.js:333-343`).
- **The online deposit** lives in `online_payments` (migration 070), outside
  the sales record, until convert makes it a payment on the one final sale
  (#473, `openspec/changes/archive/2026-10-24-till-online-deposit`). Its
  refund is `POST /api/workshop-jobs/:id/deposit-refund` (`server/routes/workshop.js`),
  which locks the job's order and refuses once it's `converted` (`paid_at_till`).
- **Reports** read the `all_sales` view (migration 083): one row per sale from
  `sales` and `till_sales`. The dashboard's today figures sum its
  `total_pence` (`server/routes/dashboard.js:24`). No cash-up or takings
  report exists yet (WP-3.4).
- **The totals check** (`scripts/ci/check-money-totals.mjs`, `checkOrders`)
  holds `paid_pence` to "the converted sale's total plus any till lines paying
  it" (the latter only once `till_sale_lines.order_id` exists, step D).
- **Deleting a job** (`DELETE /api/workshop-jobs/:id`, `workshop.js`) already
  refuses with `settle_first` when an order linked to the job is `converted`
  **or has `paid_pence > 0`**, or an online deposit is held or taken (audit
  item 12, commit `3c4f63a3`). It reads only orders still linked to the job.
  The job page decides its own first step from `orderStatus === 'converted'`
  (`src/screens/diary/job-dialog.tsx`, `askDelete`).
- **The till** (`src/screens/till/till-page.tsx`, `JobTill`): a job's lines
  locked, "Bike collected when paid", Take payment enabled only while the work
  is `in_progress` or `complete` (`PAYABLE`) and the order has lines, the
  sign-off question first on work in progress. `PayDialog` (`pay-dialog.tsx`)
  offers Card, Cash and Split (including `Card · £0.00` for free work) and,
  for a job, calls convert, then `afterPaid` records collection.
- **Removing a staff member** clears their id from `sales`, `sale_documents`
  and `till_sales` (`server/routes/team.js:157-161`).
- **Exact-match fixtures.** `tests/route-list.test.js` holds the route table
  to `tests/fixtures/route-list.txt` (regenerated by
  `node scripts/print-route-list.mjs`); `tests/reply-shapes.test.js` holds a
  job's reply to `WORKSHOP_JOB` in `src/lib/api/shapes.ts`, whose
  `shapeProblems` flags a field "not in the shape".

## Goals / Non-Goals

**Goals:** take a deposit at the till on a job at any stage, including a
booked job at drop-off; pay the rest once the work is finished with every
deposit taken off; count the job's money once; keep `paid_pence`, the totals
check, delete and refunds right; tell the customer the same "left to pay" the
till will charge; say what step C redoes.

**Non-Goals:** deposits on plain sales; the sync path; a connected card
machine; the cash-up and VAT reports (they get a contract here, Decision 6);
building paying a repair online (it gets a contract here, Decision 12).

## Decisions

### 1. A till deposit is a payment held against the order, not a sale

A new table, `order_deposits`, one row per deposit taken at the till. No
`sales` row is made, so `all_sales`, the dashboard, the sales list and a
customer's history don't change when a deposit is taken. The order's
`paid_pence` goes up by the deposit in the same transaction.

*Why:* it is the pattern already built and reviewed for the online deposit
(#473): money held against the job, then a payment on the one sale that pays
the job off. That sale carries the job's full lines, discounts and total, so
the job's revenue is counted once, and every reader of the old record (the
receipt, the old app, the totals check's sale rules, the "top 5") is
unchanged.

*Alternative (Open question 1's other way):* the deposit as its own sale,
with a minus "Deposit paid" line on the final sale. Each day's sales would
match the money taken, and the receipt, barcode and email would come free.
But `createSale` works the group discount out on the sum of the lines
(`computeOrderTotals`), so a minus line would shrink the discount unless
skipped; `sale_items.line_type` would need a third kind (migration 014's
check); the dashboard's top 5 would show deposits; and a refund before
collection would need a negative sale, which `createSale` can't make
(`total` is never below 0) and nothing reads. Larger, in the riskiest file,
for a path step C replaces.

### 2. The table (migration `084_order_deposits.sql`)

```sql
CREATE TABLE order_deposits (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  order_id INTEGER NOT NULL REFERENCES sale_documents(id),
  amount_pence INTEGER NOT NULL CONSTRAINT order_deposits_amount_check CHECK (amount_pence > 0),
  cash_pence INTEGER NOT NULL DEFAULT 0 CONSTRAINT order_deposits_cash_check CHECK (cash_pence >= 0),
  card_pence INTEGER NOT NULL DEFAULT 0 CONSTRAINT order_deposits_card_check CHECK (card_pence >= 0),
  cash_tendered_pence INTEGER,
  employee_id INTEGER REFERENCES employees(id),
  request_key TEXT NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_sale_id INTEGER REFERENCES sales(id),
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,
  refunded_by_login_id INTEGER REFERENCES logins(id),
  CONSTRAINT order_deposits_split_check CHECK (cash_pence + card_pence = amount_pence),
  CONSTRAINT order_deposits_tendered_check CHECK (cash_tendered_pence IS NULL OR cash_tendered_pence >= cash_pence),
  CONSTRAINT order_deposits_used_or_refunded CHECK (used_sale_id IS NULL OR refunded_at IS NULL),
  CONSTRAINT order_deposits_key_unique UNIQUE (shop_id, request_key)
);
CREATE INDEX idx_order_deposits_order ON order_deposits(order_id);
-- RLS enabled and forced, policy order_deposits_shop_isolation, as 070.
```

- A deposit is **held** while `used_sale_id` and `refunded_at` are both null,
  **used** once the sale paying the job off counts it, **refunded** once
  given back. Never deleted.
- `order_id` has no cascade: an order is never deleted, and deleting a job
  keeps its order (unlinked).
- Additive only. Pence only: no pounds twin, since nothing old reads it.

### 3. Taking a deposit: `POST /api/sale-documents/:id/deposits`

In `server/routes/sales.js`. Staff route (the dispatcher's `/api/` branch).

Body: `{ amountPence, cashPence, cardPence, cashTenderedPence?, cashierId, requestKey }`,
whole pence. In one transaction, the order locked first (`FOR UPDATE`, the
same lock convert, the online refund and delete take, so they run one after
another). Checks, in this order:

| Check | Reply |
|---|---|
| order not found | 404 `Not found` |
| `requestKey` not a string of 1–100 characters | 400 `Send a request key` |
| a deposit with this `requestKey` already exists in the shop, on this order | **200**, the same shape as the 201 below: that deposit and the balance as it is now (a second tap or a retry records nothing new) |
| a deposit with this `requestKey` already exists in the shop, on another order | 409, code `request_key_used`: `That request was already used for another order. Close the pop-up and try again.` (never a server error from the unique rule) |
| order not open | 400 `This order is already [status]` (convert's words) |
| no `workshop_job_id`, or `kind` isn't `'order'` | 400, code `not_a_job`: `A deposit is taken on a workshop job’s order.` |
| the job's `booking_state` is `declined`, `expired` or `cancelled` | 409, code `booking_ended`: `This booking has ended, so a deposit can’t be taken.` |
| no cashier (`resolveCashierId`) | 400 `Select a staff member before completing the sale` (createSale's words) |
| `amountPence` not a whole number of at least 1 | 400 `Enter a deposit of at least 1p` |
| `cashPence + cardPence ≠ amountPence`, either below 0 | 400 `The cash and card must add up to the deposit` |
| `cashTenderedPence` below `cashPence` | 400 `The cash handed over is less than the cash part` |
| `expectedLeftPence` is 0 (Decision 4) | 409, code `nothing_on_bill`: `There’s nothing on this job’s bill yet. Add the work in Work and parts, then take a deposit.` |
| `amountPence ≥ expectedLeftPence` (Decision 4) | 409, code `deposit_too_much`: `A deposit must be less than the £[left] left to pay. The rest is paid when the work is finished.` ([left] is `expectedLeftPence`) |

Then: insert the row (`employee_id` = the cashier), and
`UPDATE sale_documents SET paid_pence = paid_pence + ? WHERE id = ? AND status = 'open'`.
The work state is **not** checked and **not** changed (Jack, 24 Oct: any
stage). No stock moves. The bike isn't collected.

Reply 201: `{ deposit: { id, amountPence, cashPence, cardPence, cashTenderedPence, takenAt, takenBy }, paidPence, leftToPayPence, expectedLeftPence, billPence, expectedBillPence }`,
sent from `afterRelease` after the commit, as convert does, so nobody is told
"taken" about a deposit that can still roll back.

- The booking states `pending`, `offered`, `scheduled` and
  `reschedule_requested` take a deposit; so does a job marked Didn't come
  (`no_show_at` set), whose booking is still live and whose customer may yet
  bring the bike.
- The booking check reads the job without its booking lock, so a cancel
  landing at the same moment can leave a deposit on a just-cancelled
  booking. Under Open question 5's default that is the same state as a
  deposit taken just before the cancel (held, shown, refundable), so it is
  accepted, not locked against.
- More than one deposit may be taken on a job; each is its own row and its
  own "Deposit paid" line. The drawing (`till-job-balance`) shows one; this
  follows the pattern of the job's own lines and is logged (task 5.4).

### 4. A deposit is always less than what's left of the expected bill

Two bills, because a booked job's order is £0 at drop-off (Context):

- **The bill** (`billPence`): what convert charges, `computeOrderTotals(…).total`
  of the order's lines, in pence. Unchanged.
- **The expected bill** (`expectedBillPence`): the bill plus
  `bookedNotOnOrderPence`, each booked service's `booked_price_pence` not
  already on the order (matched by `service_id`, a null price counted as 0),
  the same sum `wholeBill`'s `base` makes. Booked services count only toward
  the job's newest open order (Decision 9), so a second order never counts
  them twice.

`leftToPayPence = max(0, billPence − onlineUsedPence − tillHeldPence)` is what
the till charges. `expectedLeftPence = max(0, expectedBillPence − expectedOnlinePence − tillHeldPence)`
is what a deposit is measured against. `onlineUsedPence` is
`depositShare(billPence, countedDeposit(jobId)).usedPence`,
`expectedOnlinePence` the same share of `expectedBillPence`, and
`tillHeldPence` the sum of the order's held till deposits. A deposit must be
at least 1p and **strictly less** than `expectedLeftPence` (Open question 3,
restated, at its recommended choice 1).

*Why:* the payment that brings the balance to zero is the one that needs the
work finished (Jack, 16 and 24 Oct). Keeping every deposit below what's left
means that payment is always convert, which already enforces the rule. Using
the expected bill lets a booked job take a deposit at drop-off, the case
Jack's 24 Oct answer names ("or hasn't started, as at drop-off"), without
changing how jobs are made or what convert charges.

*What it leaves:* a job with nothing booked and nothing on its order (a
walk-in not yet looked at) takes no deposit until work is added
(`nothing_on_bill`). If staff never add a booked service to the order, the
bill at payment is lower than expected and may be below the deposits;
convert then refuses with `deposits_over_bill` (Decision 7), which shows the
gap rather than hiding it.

### 5. One helper for the balance: `server/lib/order-deposits.js`

- `export const TILL_DEPOSIT_TENDER = 'Deposit paid at the till';`
- `export async function heldDeposits(orderId)` → `[{ id, amountPence, cashPence, cardPence, takenAt }]`,
  held only, oldest first. Callers that write already hold the order's lock.
- `export async function orderBalance(doc)` → `{ billPence, bookedNotOnOrderPence, expectedBillPence, onlineDeposit, onlineUsedPence, expectedOnlinePence, tillHeldPence, tillDeposits, leftToPayPence, expectedLeftPence, overPence }`,
  as Decision 4, and `overPence = max(0, onlineUsedPence + tillHeldPence − billPence)`.
  `doc` is the `sale_documents` row; the bill is worked out from its items,
  `discount` and `customer_id` with `computeOrderTotals`, as `/due` and
  convert do now. `bookedNotOnOrderPence` is 0 unless `doc` is the job's
  newest open order.
- `export async function jobOrderBalance(jobId)` → `{ order, balance }` for
  the job's newest `kind = 'order'` document that isn't cancelled
  (`ORDER BY id DESC LIMIT 1`, as `portal.js` and `job-messages.js` pick it),
  or `null`. No lock; for readers that only show a figure.

`/due`, the deposit route, convert, the customer's page and the two messages
all use it (Decision 12), so none can disagree (the pattern of
`computeOrderTotals`' own comment).

### 6. Days, takings and VAT (Open questions 1 and 2, at their defaults)

- **Sales figures** (`all_sales`, the dashboard, a customer's history): a
  till deposit appears only inside the final sale, on the day the job is paid
  in full, the same as an online deposit today. Nothing reads
  `order_deposits` for these figures.
- **The day's takings (cash-up, WP-3.4):** money into the drawer and onto the
  card machine on a day is: each old sale's `cash_amount` and `card_amount`
  (not its "Deposit paid at the till" or "Deposit paid online" payments,
  which took no money that day), plus each till sale's cash and card, plus
  each `order_deposits` row's `cash_pence` and `card_pence` on its `taken_at`
  day, less each one refunded on its `refunded_at` day. Written here as the
  contract for WP-3.4; nothing builds it now.
- **VAT:** no VAT is recorded on a deposit (the old record records none).
  `taken_at` and `amount_pence` are kept so the VAT reports (stage 6) can use
  either date once Jack's accountant answers.

### 7. Paying the rest: what's due and convert

**`/due`** adds, from `orderBalance`:
`tillDepositPence` (held total), `tillDeposits` (`[{ id, amountPence, cashPence, cardPence, takenAt }]`),
`depositsOverPence` (`overPence`), `expectedBillPence` and
`expectedLeftPence` (Decision 4); and `leftToPayPence`/`leftToPay` now take
the till deposits off too. Existing fields are unchanged.

**Convert** (inside its existing transaction, after the work checks):
1. Drops any payment the till sends named `TILL_DEPOSIT_TENDER`, as it drops
   `DEPOSIT_TENDER` (the server's to add, never the till's to claim).
2. `orderBalance(doc)`; if `overPence > 0` → 409, code `deposits_over_bill`:
   `The deposits taken (£[held]) are more than the bill (£[bill]). Refund a deposit on the job, then take payment.`
   Refused before any sale is made (Open question 4's default).
3. Pushes `{ tenderType: TILL_DEPOSIT_TENDER, amount: tillHeldPence / 100 }`
   when above 0, after the online deposit's payment.
4. `createSale` as now: the full lines and total; cash plus card plus both
   deposit payments must equal the total, so the till sends only
   `leftToPay` as cash and card. When `leftToPay` is £0 (free work, or a
   bill equal to the deposits), cash and card are 0 and the deposit payments
   make up the total; convert already accepts that.
5. In the same transaction: `UPDATE order_deposits SET used_sale_id = [sale] WHERE order_id = ? AND used_sale_id IS NULL AND refunded_at IS NULL`.
6. `paid_pence` is set to the sale's total, as now: it already includes the
   deposits, because they are payments on that sale. **No double count:** the
   deposits move from "held" into the one sale; nothing else adds them.

Finishing the job, the sign-off, the online deposit's let-go and the job
warnings are unchanged. `wp-1-6-sales-in-pence` Decision 8's "Convert
refuses an order with `paid_pence > 0`" was for till sales on sync paying
part of an order; it is superseded here for till deposits on the current
path (task 2.6 notes it there).

### 8. `paid_pence` means "money taken at the till against this order"

- Open order: the sum of its held till deposits.
- Converted order: the sale's total (unchanged), which includes any deposits
  it used and any online deposit counted.
- The online deposit isn't in `paid_pence` until convert (unchanged), so
  delete keeps checking `online_payments` itself.

**The totals check** (`checkOrders`), once `order_deposits` exists:
- `paid_expected` for an order that isn't converted becomes the sum of its
  held deposits (today: 0). For a converted order it stays the sale's total
  (plus till lines, step D).
- A new kind, `order_deposits_used` (not a known kind, so it stops a step):
  for each old sale that used deposits, the sum of its `sale_payments` named
  "Deposit paid at the till" must equal the sum of the `order_deposits` with
  that `used_sale_id`.
- The script's header comment and `formatReport` stay in step with these.

### 9. Refunds, cancelling, moving, deleting, removing staff

- **Refund a till deposit**: `POST /api/workshop-jobs/:id/till-deposits/:depositId/refund`,
  body `{ reason }`, in `server/routes/workshop.js` beside `deposit-refund`.
  The deposit is found by id among the orders linked to the job; that order
  is locked first, then the deposit row. Replies:
  reason missing → 400 `Say why the deposit is being refunded`; over 200
  characters → 400 `The reason can be up to 200 characters`; job not found →
  404 `Job not found`; deposit not on any order linked to this job → 404
  `That deposit isn’t on this job`; used (the order is paid) → 409
  `paid_at_till`, `This deposit paid part of the bill at the till, so it can’t be refunded from the job.`
  (Jack, 24 Oct, deposit-after-paid); already refunded → 409 `not_refundable`,
  `There’s no deposit to refund on this job.` Otherwise it sets `refunded_at`,
  `refund_reason`, `refunded_by_login_id`, takes the amount off
  `paid_pence`, and replies with the job. The money goes back the way it was
  paid (Selling at the till decision 9): staff give the cash part from the
  drawer and key the card part into the card machine; the server records it
  and moves no money.
- **Cancelling the order, or moving it off its job** (`PUT /api/sale-documents/:id`
  with `status: 'cancelled'`, or a `workshopJobId` different from the
  order's, including `null`) with `paid_pence > 0` → 409, code
  `deposit_held`: `A deposit was taken at the till on this order. Refund it on the job first.`
  Nothing is changed. Read under the order's lock (`FOR UPDATE`), so it
  can't race a deposit. This keeps the delete guard (which reads only orders
  still linked) and the job page's view of the deposit true.
- **Several orders on one job.** A deposit belongs to the order it was taken
  on (the route is per order). The job page's `tillDeposits` lists the
  deposits on every order linked to the job, each with its `orderId`. The
  booked services count only toward the newest open order (Decision 4).
  Convert of any order counts only that order's deposits. No other
  multi-order behaviour changes.
- **Cancelling, declining or expiring the booking, or Didn't come**: nothing
  happens to a till deposit (Open question 5's default). The job keeps
  showing it with Refund the deposit. A deposit kept that way never reaches
  the sales figures, the same gap as a kept online deposit today; it is in
  `order_deposits` for step C and the reports to pick up.
- **Deleting the job**: already refused while `paid_pence > 0`; once every
  till deposit is refunded, `paid_pence` is 0 and the delete goes ahead,
  keeping the order and its `order_deposits` rows.
- **Removing a staff member** (`team.js`): `UPDATE order_deposits SET employee_id = NULL WHERE employee_id = ?`
  beside the other three.
- **The online deposit's refund** is unchanged.

### 10. The screens

Built to `till-pay`, `till-job-deposit` and `till-job-balance`; Open question 7
at its default.

- **The job's basket** (`JobTill`): Take payment can be pressed whenever the
  order is open and what's due has loaded without error, at any work stage,
  and either the order has lines (as today, including lines coming to £0) or
  a deposit can be taken (`expectedLeftPence` at least 2p). A balance of £0
  is paid as today's free work is (`Card · £0.00`, or Cash for £0.00),
  convert taking the deposits as the payments; this covers free work and a
  bill that dropped to exactly the deposits held. The basket's lines stay
  the order's; the expected bill shows only in the Deposit pop-up. The line
  "The work isn’t finished, so this job can’t be paid yet." stays when the
  work isn't in progress or finished. Each held till deposit is a fixed line
  "Deposit paid", sub "[d Mon] · card", "· cash" or "· cash and card",
  amount "−£27.75", after any online deposit's line. With
  `depositsOverPence > 0`: `The deposits taken are more than the bill: refund one on the job before taking payment.`
  and Take payment greyed.
- **Take payment** (`PayDialog`, for a job): Card, Cash and Split as now,
  greyed when the work isn't `in_progress` or `complete` or the order has no
  lines; a fourth button, **Deposit**, greyed when `expectedLeftPence` is
  under 2p (no deposit of at least 1p fits under it). On work in progress,
  choosing Card, Cash or Split first asks "Who’s signing this off?" (the
  existing `SignOffDialog`); Deposit never asks.
- **The deposit pop-up** (`till-job-deposit`, new `src/screens/till/deposit-step.tsx`,
  `DepositStep`): title `Take a deposit · job WH-1042 · £111.00` (the
  expected bill, `expectedBillPence`), sub `Maya Patel · Trek Domane AL 3`;
  a group labelled "How much now" with 10%, 25%, 50% and Other
  (`aria-pressed`; none chosen at first); Other shows an amount box, label
  "Deposit amount", id `deposit-other`. A percentage is of the expected
  bill, rounded half up to the penny
  (`Math.floor((expectedBillPence * pct + 50) / 100)`, as `depositPence` does
  for bookings). Rows "Deposit now" and "Paid at collection"
  (`expectedLeftPence` less the deposit). The note: **Bike stays in.** "Bike
  collected when paid" is switched off for now — it comes back on when the
  rest is paid. Buttons Back and `Take £27.75 now`, greyed until an amount
  under `expectedLeftPence` is chosen; a pill that would reach it is greyed.
- `Take £[n] now` goes to Card, Cash or Split for that amount, as for a sale;
  Card approved or Cash taken calls the deposit route with a `requestKey`
  made once when the pop-up opens (`crypto.randomUUID()`), so a retry can't
  take it twice. Refusals read as convert's do, ending
  "No deposit was recorded: if the card machine took the payment, reverse it on the machine."
- **Paid** after a deposit: the amount, Print and No receipt (or Start next
  sale), no Email, and the note `Deposit taken. £83.25 is left to pay at collection.`
  (the reply's `expectedLeftPence`). Collection is never recorded. *Not
  drawn; the closest pattern is Paid's own note (the job warning); logged.*
- **The deposit's receipt** (`receipt.tsx`, `ReceiptPaper` with a `deposit`
  prop): "Deposit [id]" in place of "Sale [n]", the job and bike line, a line
  "Deposit on the job" with the amount, "Paid by cash"/"Paid by card", and
  "Left to pay £83.25" (`expectedLeftPence`); the shop's details and words;
  **no barcode**, since a deposit is refunded from the job, not found by
  scanning. *Not drawn; logged.*
- **The final sale's receipt** needs nothing new: "Paid by Deposit paid at
  the till £27.75" prints from `extraPayments`, as the online deposit's does.
- **The job page** (`job-deposit.tsx`): `DepositStrip` also lists each till
  deposit: badge "Deposit paid" (green) or "Deposit refunded" (grey), the
  amount, "· [d Mon] · at the till" or "· [d Mon] · [reason]", and **Refund the
  deposit** while it's held and its order isn't converted. Its pop-up,
  `RefundTillDepositDialog`, follows `bk-staff-deposit-refund`: "The whole
  deposit, paid [d Mon] at the till", "Reason (needed)", and instead of the
  card words: `Give £27.75 back in cash from the drawer.`, or
  `Key a refund of £27.75 into the card machine, to the card they paid with.`,
  or both lines for a split; button `Refund £27.75`.
- **Deleting from the job page** (`job-dialog.tsx`, `askDelete`): a job with
  any till deposit in state `paid` counts as paid, as a converted order does
  now, so the pop-up goes straight to its existing blocked words ("refund
  what was paid") instead of first asking to delete. The server's refusal
  is unchanged.
- **The job's data**: the serializer (`serializeWorkshopJob`, `jobs.js`) adds
  `tillDeposits: [{ id, orderId, pence, cashPence, cardPence, takenAt, takenBy, state: 'paid'|'used'|'refunded', refundedAt, refundReason, refundedBy }]`,
  read by one `json_agg` subquery in `WORKSHOP_JOB_SELECT` over the
  `order_deposits` of every order linked to the job (Decision 9), `[]` when
  none. `tillDeposits` is added to `JOB_FIELDS` in `src/lib/api/shapes.ts`
  (`['array']`) and to `WorkshopJob` in `src/lib/api/types.ts`.

### 11. What step C (and steps D and E) must redo

When the new till records through sync (step C) and pays orders through it
(step D, `wp-1-6-sales-in-pence` Decision 8):
1. **Taking a deposit** moves onto that path: online only (orders aren't in
   the offline copy), as a till sale, a till payment record, or this table
   written through sync. Step C decides; this change only fixes what the
   money must add up to (Decision 8 here).
2. **The final payment's deposit payment** becomes a `till_sale_payments` row;
   `till_sale_payments.method`'s check (036) needs a value for it, and
   `order_deposits.used_sale_id` (old `sales`) needs a till-sale twin.
3. **The totals check's `paid_pence` rule** merges Decision 8 here with
   step D's "plus till lines paying it".
4. **The deposit's receipt** gets a receipt number and barcode like any till
   sale, if step C makes it one.
5. **The cash-up** (WP-3.4) reads `order_deposits` as Decision 6 says, or
   whatever replaces it.
6. **Kept deposits** (cancelled, didn't come back) need a home in the sales
   figures, together with kept online deposits.
7. The `/due` and convert code here is retired with convert itself at step E.
8. **`order_deposits.used_sale_id REFERENCES sales(id)`** blocks dropping
   `sales` at step E: step E moves each used deposit's link to its till-sale
   twin (item 2), or drops the constraint, before `sales` goes.
9. **The customer's page, the two messages and paying a repair online** read
   `orderBalance` (Decision 12); when the balance moves to the sync path,
   they move with it.

### 12. What the customer is told, and paying a repair online

- **The customer's page** (`portal.js`, `jobMoney`): `toPay` and
  `nothingToPay` come from `jobOrderBalance(jobId).balance.leftToPayPence`
  (over 100, through `figure` as now, so hidden prices stay hidden), not
  from `computeOrderTotals` alone. Paid orders are unchanged.
- **Bike ready and Bike still waiting** (`job-messages.js`): `whatsLeftToPay`
  and `jobMessageVars`' `due` come from the same figure, so "[What’s left to
  pay]" and "Amount to pay" are what the till will charge, as their comment
  already says.
- Both now take the **online** deposit off too, because `leftToPayPence`
  does. Today they state the whole bill after an online deposit while the
  till charges less; this makes them agree with the till and with their own
  comment. Logged in `decided-while-building.md` (task 3.4).
- `portal.js` is a public route (risky area 3), so that pull request runs
  `/review` for it too.
- **Paying a repair online** (Jack's piece, replan slice A, on the current
  record, not yet built) must charge `orderBalance(doc).leftToPayPence`, take
  the order's lock first, add the held till deposits as a
  `TILL_DEPOSIT_TENDER` payment and mark them used in the same transaction,
  as convert does (Decision 7 steps 1–5), and refuse on `overPence > 0`.
  This change builds none of it; it is the contract that piece must meet,
  and its issue is told so (task 3.4).

## Risks / Trade-offs

- [A deposit day's sales figure is lower than the money taken] → the
  dashboard says sales, not takings; the cash-up contract (Decision 6) counts
  the money on the day; Open question 1 puts the choice to Jack.
- [Two writers of `paid_pence`] → both lock the order first; the totals check
  holds `paid_pence` to the held deposits or the sale.
- [A card taken but the deposit refused] → the till checks what's left before
  the card step, and a refusal after it tells staff to reverse it on the
  machine, as convert's does.
- [A double tap takes two deposits] → `request_key` is unique per shop and
  looked up per shop; a repeat returns the first.
- [The bill drops below the deposits] → convert refuses before any sale; the
  job page offers the refund.
- [A booked service never added to the order] → the deposit was measured
  against the expected bill; convert refuses with `deposits_over_bill` if
  the order's bill is below the deposits, which shows staff the missing line.
- [An order holding money moved off its job] → refused with `deposit_held`.
- [The customer told a different figure from the till's] → one helper,
  `orderBalance`, for all of them (Decision 12).
- [Step C rework] → named in Decision 11; this table is small and additive.

## Migration Plan

1. Migration 084 is additive; deploy runs it. The totals check runs in CI
   against fixtures with a held, a used and a refunded deposit, and by hand on
   the hosted copy before and after, its output in the pull request.
2. Rollback: deploy the previous version. The table stays, unread. A held
   deposit then isn't taken off at convert, so before rolling back, any held
   till deposits are listed (`SELECT … FROM order_deposits WHERE used_sale_id IS NULL AND refunded_at IS NULL`)
   and settled by hand.

## Decision log

| When | Decision | Because |
|---|---|---|
| 25 Oct | Build on the current path, not after step C | Mark's instruction for this spec, as for paying a repair online (replan §4 answer 3) |
| 25 Oct | A deposit is a held payment, not a sale (Decision 1) | The online deposit's reviewed pattern; one sale per job keeps revenue counted once and `createSale` untouched |
| 25 Oct | A deposit is less than what's left to pay (Decision 4) | Jack, 16 and 24 Oct: the payment that clears the balance needs the work finished; convert already enforces it |
| 25 Oct | Delete needs no server change | Audit item 12 (`3c4f63a3`) already refuses `paid_pence > 0` |
| 25 Oct | Open questions 1–7 at their recommended defaults | Mark's request: state each money question with a default for him to approve |
| 25 Oct (r1) | A deposit is measured against the expected bill: the order plus booked services not on it (Decision 4); Open question 3 restated with three choices; `nothing_on_bill` for a job with neither | Challenge r1 finding 1 (both reviews): a booked job's order is £0 at drop-off, so the old default blocked Jack's drop-off deposit |
| 25 Oct (r1) | The customer's page and the two messages read `orderBalance`, which also takes the online deposit off; paying a repair online gets a contract (Decision 12) | Finding 2 (both): they stated the whole bill after a deposit |
| 25 Oct (r1) | Moving an order holding money off its job is refused; a deposit belongs to its order; the job lists every order's (Decision 9) | Finding 3 (both) |
| 25 Oct (r1) | Take payment stays pressable at £0 left; Card or Cash for £0.00 pays it (Decision 10) | Finding 4 (both): the old gate stranded free work and a bill equal to the deposits |
| 25 Oct (r1) | Day-count tests assert on `all_sales` rows by sale id, not "today" | Finding 5 (both): convert's sale has the real `now()`, the test clock is 1 Sep |
| 25 Oct (r1) | The deposit route refuses non-orders; request keys looked up per shop (`request_key_used`); the replay returns the 201's shape | Second review findings 7, 8, 9; first review finding 8 |
| 25 Oct (r1) | The route list and reply-shape fixtures named in the tasks | Second review finding 6 |
| 25 Oct (r1) | The job page's delete goes straight to "refund what was paid" with a held till deposit | Both reviews, housekeeping item on the delete wording |
| 25 Oct (r1) | Booking states that take a deposit, Didn't come, the unlocked booking check, and more than one deposit per job stated (Decision 3) | First review finding 10 |
| 25 Oct (r1) | Pull request 1 split in two; the customer-facing figures get their own pull request | First review finding 7 |
| 25 Oct (r1) | `[careful]` tags kept, each task now naming its kind | Both reviews flagged tags without a kind; the spec-writer's rules require them for migrations (kind 4) and money (kind 6) |

## Open Questions

See `proposal.md`, "Open questions": seven for Jack, each with the default
this design is written to. Question 3 was restated after challenge r1.
