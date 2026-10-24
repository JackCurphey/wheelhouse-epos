# Design: one sales record in pence, and where open orders live

## Context

See `proposal.md` for why. The state on `main` at 94ef8db, 15 Oct. Line
numbers move, so names are the anchor. `createSale` and its helpers move to
`server/lib/sales.js` in #202; before that they are in `server.js`.

- **Old sales record, in pounds** (`NUMERIC(10,2)`, read into JavaScript
  floats by `server/db.js:37`):
  - `sales`, `sale_items` and `sale_payments`, all written by one function,
    `createSale`;
  - `sale_documents` and `sale_document_items` (quotes and orders, with one
    `converted_sale_id` each, and `status` `open`, `converted` or
    `cancelled`).
- **New sales record, in pence** (migration 036): `till_sales`,
  `till_sale_lines` and `till_sale_payments`.
  - Each finished sale is written once by `server/till/sync.js`, with no
    status and no update path, so they can't hold an open order.
  - `sync.js:157-166` flags any line with no product as `unknown_product`.
  - Nothing reads them for reports yet.
- **The new till screen** records through `POST /api/sales`
  (`src/screens/till/pay-dialog.tsx:56`), turning pence back into pounds.
  It sends no customer and no discount.
- **The build plan puts these in WP-3.1** (build plan, WP-3.1): paying for a
  workshop job at the new till, and a customer's group discount there. Until
  then, a job is paid through `POST /api/sale-documents/:id/convert`, which
  refuses before any money is taken if the job can't be finished (the
  paying-for-finished-work decision).

## Goals / Non-Goals

**Goals:**
- Answer #134 in full: the list, how each piece keeps working during the
  move, and the totals check.
- Give Jack a fixed money contract for the workshop half.
- Fix the rules WP-3.1 must follow when the new till pays an order.

**Non-Goals:**
- Building order payments at the new till (WP-3.1).
- Moving the new till onto sync. That's the send-queue part of WP-1.6, with
  the till's registration and offline copy.
- How VAT is split on a deposit.

## Decisions

### 1. Open orders stay in `sale_documents`, in pence (Mark, 15 Oct)

`sale_documents` stays the home of every open order, a job's included.
- It gains `subtotal_pence`, `discount_pence`, `total_pence` and
  `paid_pence`.
- `sale_document_items` gains `unit_price_pence`, `line_total_pence` and
  `vat_rate_bp`.
- All are `INTEGER NOT NULL DEFAULT 0`, except `vat_rate_bp`, which is
  nullable. Job creation inserts zero totals (`server/workshop/jobs.js:394`)
  and keeps working.
- **The backfill:**
  - pence = `ROUND(pounds * 100)`;
  - `paid_pence` = the converted sale's total for converted orders, 0
    otherwise;
  - `vat_rate_bp` comes from the product (`products.vat_rate_bp`) for
    product lines, and stays empty for labour lines. What VAT rate labour
    carries is Jack's call (asked on #134). Nothing is assumed.
- `status` keeps its three values, so the old app keeps understanding it.
  An order fully paid by the new till (WP-3.1) reads `converted`, with no
  `converted_sale_id`.

*Alternatives:*
- New `orders` tables, with `sale_documents` copied over once and retired.
  That gives a cleaner model and better names, but every workshop order read
  and write would change, plus a one-off data move, in the middle of stage 1.
- Open orders inside `till_sales`, with a status. That breaks "each sale
  recorded exactly once" and the offline send rules.

### 2. Pounds stay readable by the old app, worked out from pence

The pounds columns stay during the move, written by the same statement as
pence (pounds = pence ÷ 100). Pence is the authority. The API keeps its pound
fields for `public/app.js` and adds `…Pence` fields beside them. The pounds
columns and the old tables are dropped in a later change, once nothing reads
or writes them. That deletes data, so Jack signs it off first.

### 3. Reports read one view across both records

A view, `all_sales`, gives one row per sale in pence from both records. Each
row is keyed by its record and number (`source` = `old` or `till`, plus
`id`), so `GET /api/sales/:id` and the sales list never mix up old sale 12
and till sale 12.

| | Old tables | `till_sales` |
|---|---|---|
| Total | `ROUND(total * 100)` | `total_pence` |
| When the sale was made | `created_at` | `till_clock_at` (the till's clock, so an offline sale lands on the day it was made) |
| VAT | empty (never recorded) | `vat_pence` |

Each row also carries the customer and staff member. The dashboard's today
figures, the sales list and a customer's history
(`GET /api/customers/:id/sales`) read the view, so a sale counts exactly
once wherever it was recorded. Old ids keep working: an id with no `source`
means `old`. The view goes when the old tables do.

### 4. Shopify orders keep using the old tables until online orders are built

`processShopifyOrderWebhook` keeps calling `createSale`. `till_sales` needs a
till and a receipt number, and an online order has neither. The view counts
these orders. They move when the online orders package (Buy online) gives
them a home, which must happen before the old tables are dropped.

*Alternative:* a pretend "Online" till per site. It would mean a till nobody
uses, receipt numbers nobody printed, and a site chosen for orders that
don't belong to one.

### 5. When each piece moves

| Step | What changes | Who | Keeps working because |
|---|---|---|---|
| A | Pence columns on orders, backfilled. The sale-documents routes, `loadDocumentLine` and convert write both. The totals check | Mark | Pounds still written; every reader unchanged |
| A′ | Workshop amounts in pence (services, quote lines, booked prices), quote approval writing pence, the three JavaScript sums made SQL sums | Jack, after A merges | The money contract (Decision 6) |
| B | The `all_sales` view. The dashboard, sales list and customer history read it | Mark | It counts both records. The totals check runs before and after |
| C | The new till records through sync instead of `POST /api/sales` | Mark (send-queue part of WP-1.6) | The view already counts till sales |
| D | The new till pays orders (Decision 8) | Mark (server) and Jack (till screens), WP-3.1 | Convert refuses an order part-paid at the till |
| E | Old writers retire as their screens go, then the pounds columns and old tables are dropped | Mark, with Jack's yes to drop | Nothing reads them; the totals check is clean |

### 6. The money contract (for Jack's half)

- Every new column holding money is `INTEGER` pence, named `…_pence`, and
  every API field is `…Pence`. VAT rates are basis points (`…_bp`), as
  migration 036 has them.
- Totals are added up in SQL or in integer pence on the server. No screen
  adds money up (`types.ts:54`).
- Converting a pounds column: `ROUND(col * 100)::int`, checked by the totals
  check.
- During the move, an endpoint that already returns pounds keeps doing so,
  and adds the pence field beside it.

### 7. The totals check

`scripts/ci/check-money-totals.mjs`, run on any database, reports each
mismatch with the record, the table and both amounts. It checks:
1. **Conversion:** for every row with both, `pounds * 100 = pence`.
2. **Orders:** lines add up to the subtotal, and the total is the subtotal
   less the discount, never below 0. `paid_pence` equals the converted sale's total plus the
   till sale lines paying it (from step D).
3. **Sales:** lines and payments each add up to the total, in both records.
   Old sales' group-discount rounding and `createSale`'s 1p payment
   tolerance are listed separately, as **known kinds**. They're reported,
   but they don't stop a step.
4. **Days:** before step B, each shop's per-day totals and counts from the
   old tables are saved as a baseline. Afterwards, the view's old-record
   rows for those days must match it. Till sales are left out of this
   comparison, because a late offline sale can rightly add to a past day.

It runs in CI against fixtures that hit every case, and by hand on the
hosted copy before and after step B.

### 8. The contract for WP-3.1: when the new till pays an order

This is written now so that the order's home works for it. WP-3.1 builds it
in its own change.
- **Online only.** Orders aren't in the till's offline copy
  (`server/till/snapshot.js`), so paying an order needs the till to be
  online.
- **The job is checked first.** Before taking money, the till asks the
  server whether the job can take the payment, keeping the
  paying-for-finished-work refusal. A sale that still arrives for an order
  that can no longer take it (the job changed in between) is recorded,
  because sales are never refused, and goes on "check these" as a new kind,
  `order_changed`.
- **A deposit on unfinished work is Jack's call.** The paying-for-finished-work
  decision refuses payment for work that isn't finished, but Selling at the
  till decision 11 and Cycle to Work decision 4 take deposits before the work
  is done. Whether a deposit on such a job is allowed narrows a recorded
  decision, so it waits for Jack (Open Questions). Until he answers, the till
  pays a job's order only in full, as convert does today.
- **When the balance reaches zero**, the job is finished exactly as convert
  finishes it today, and the bike is marked collected unless "Bike collected
  when paid" is switched off (Selling at the till decisions 10 and 11).
- **Lines say what they pay.** `till_sale_lines` gains `order_id`,
  `line_type`, `service_id` and `minutes`. A paid order's lines are copied
  over with their VAT; a labour line can't be copied until Jack sets labour's
  VAT rate, because `till_sale_lines.vat_rate_bp` is `NOT NULL` (036:79).
  `sync.js` doesn't flag labour lines as
  `unknown_product`, and labour stays countable on the dashboard.
- **Paid counts only the order's lines.** After the duplicate check,
  `paid_pence = paid_pence + (the sale's lines for that order)`, in the same
  transaction, `RETURNING` the new balance. A basket with a job plus other
  items doesn't overstate what was paid.
- **More than the balance** is recorded and goes on "check these" as
  `order_overpaid`.
- **Convert and the till never both pay one order.** Convert refuses an
  order with `paid_pence > 0` ("pay the rest at the till"), as a conditional
  update (`WHERE status = 'open' AND paid_pence = 0`) so it can't race a till
  sale; from step A, convert also sets `paid_pence` to the sale's total. A till sale
  against an order that isn't open is recorded and goes on "check these"
  (`order_changed`).
- **The old app** shows an order paid at the new till as converted. Its
  receipt link only works for orders paid the old way; the new till's past
  sales show the rest. Its order page prints "Converted to Sale #[n]"
  (`public/app.js:6733`), which needs a wording for an order with no
  converted sale before WP-3.1 ships.
- **Group discount:** sync gains a sale-level discount field when WP-3.1
  adds customers to sales (`resolveGroupDiscount`, `server/lib/sales.js`).

The new "check these" kinds (`order_changed`, `order_overpaid`) need Jack's
yes, and a migration widening `till_attention.kind` (036:96-99). They follow
036's own rule: "recorded and flagged, never refused".

## The list (#134): every place, Mark's part

Workshop places are Jack's list on #134. They're repeated here only where
they cross into Mark's files.

**Writers of the old tables**

| Where | Flow | Step |
|---|---|---|
| `createSale`: `sales`, `sale_items`, `sale_payments`, `stock_movements` ('sale') | every old-path sale | E |
| `POST /api/sales` (`server.js`) | the new and old tills | C (new), E (old) |
| `POST /api/sale-documents/:id/convert` (`server.js`) | order → sale, a job's included | A (pence); D (refuses once part-paid); E |
| `processShopifyOrderWebhook` (`server.js`) | Shopify order | stays (Decision 4) |
| `processShopifyRefundWebhook` (`server.js`): `stock_movements` ('return') only | Shopify refund | no change |
| `POST`, `PUT`, `PUT items` `/api/sale-documents` (`server.js`) | quotes and orders | A |
| quote approval (`answerAndAddToOrder`), job create (`jobs.js:394`), job delete (`server.js`) | Jack's | A′ |
| `server/routes/team.js:134-135` | staff removed: `cashier_id` cleared | no change (`till_sales.employee_id` already cleared at `:138`) |
| `stock_movements` from products (`routes/products.js:97, 178`), purchase orders (`routes/purchase-orders.js:268`), the new till (`till/sync.js:182`) | not sales money | no change |
| `server/scripts/migrate-to-postgres.js` | one-off history copy | no change |

**Readers of the old tables**

| Where | What | Step |
|---|---|---|
| `SALE_SELECT`, `GET /api/sales`, `GET /api/sales/:id` | sales list and a sale | B |
| `GET /api/customers/:id/sales` | customer history | B |
| dashboard (`server.js`): today's count and total; top 5 from `sale_items` | dashboard | B (today), D (top 5 reads till lines once they carry line type) |
| `GET /api/sale-documents`, `/:id` | orders | A |
| `WORKSHOP_JOB_SELECT` (`jobs.js:83-88`) | a job's order total | A′ |
| `public/app.js`: sales list, dashboard, documents, convert, job receipt (`converted_sale_id`), customer sales, order page | old app | E (pounds and statuses kept until then) |

**Money in pounds, Mark's side**

| Column | Migration | Step |
|---|---|---|
| `products.price`, `.cost` | 001:80-81 | WP-1.5 |
| `sale_documents` subtotal, discount, total; `sale_document_items` unit_price, line_total | 001:255-280 | A |
| `sales.*` amounts, `sale_payments.amount`, `sale_items` unit_price, line_total | 001:195-238 | not converted: read through the view, dropped at E |
| `supplier_catalogue_items.price`, `purchase_order_items.unit_cost` | 002:35, 007:41 | with purchase orders (stage 2); listed for completeness |

**Pounds ↔ pence conversions and pounds sums today**
- `till/snapshot.js:16`: `ROUND(price * 100)`, which goes with WP-1.5.
- `pay-dialog.tsx:58-60`: `pence(x)/100`, which goes at C.
- `createSale`: line and sale totals, the group discount rounding, and the
  1p payment tolerance.
- The Shopify order total (`parseFloat(total_discounts)`).
- The document totals in POST and PUT items.

**Tests that cover these** (each gets pence cases at its step):
- `saleDocuments`, `saleDocumentsConvertApi`, `till-sale-server`,
  `shop-day-window` and `db-transaction-scope`;
- the four `sale-shopify-push-*` tests, `shopify-webhook-matching` and
  `shopify-inventory-sync`;
- `till-employee-delete` and `team`;
- `migration-036` and `till-sync-*`;
- the till's screen and browser tests.

## Risks / Trade-offs

- [Two records at once make reports harder] → One view, keyed by record,
  removed with the old tables, and checked by the totals check.
- [Pounds and pence written side by side can drift] → The same statement
  writes both, and the totals check's conversion rule catches any
  difference.
- [Old sales carry no VAT] → The view shows VAT as empty for them. VAT
  reports (stage 6) start from the switch date and say so.
- [Shopify orders stay on the old path longer] → The view counts them. The
  online orders package has to move them before step E.

## Migration Plan

Steps A to E above, each its own pull request. A and B run the totals check
in CI. B also runs it by hand on the hosted copy before and after, with the
output put in the pull request.

Rolling back B means deploying the previous version. No data is lost,
because the view is an addition. But until B is redeployed, till sales
already recorded drop off the dashboard and customer history, exactly as
before B. Rolling back C also needs the till's queue format reversed, so C's
own change says how.

E can't be rolled back, which is why it needs Jack's yes and a clean totals
check.

## Step A′ notes (Jack's side, 24 Oct)

- **A quote line's quantity isn't money**, so it isn't converted: it stays a
  `NUMERIC` count (hours of labour can be 1.5). A line's total in pence is
  `ROUND(quantity * unit_amount_pence)`, worked out in one place on the
  server, never by a screen.
- **The pounds stay**, written in the same statement as their pence (as step
  A), until nothing reads them: migration 075 adds `price_pence`,
  `unit_amount_pence` and `booked_price_pence` (null where the price is), and
  every writer writes both. Readers move to pence in the next pull request.

## Open Questions

- For Jack (asked on #134): what VAT rate labour lines carry. Until he
  answers, labour lines' `vat_rate_bp` stays empty. This doesn't change the
  approach.
- For Jack, before WP-3.1: the two new "check these" kinds (Decision 8).
- ~~For Jack, before WP-3.1: may the till take a deposit on a job whose work
  isn't finished, which the paying-for-finished-work decision refuses today?
  (Decision 8.)~~ **Answered 24 Oct, "Yes, deposits only"**
  (`docs/decisions/2026-10-24-till-deposit-unfinished-work.md`): a deposit
  at any stage; the payment that pays the rest still needs the work finished.
