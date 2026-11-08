# Design

## 1. Migration 123 (`123_restock.sql`)

- `purchase_order_items.workshop_job_id INTEGER NULL REFERENCES workshop_jobs(id) ON DELETE SET NULL`: the job an order line is for ("for job WH-1042", `rs-restock-customers`' note). Indexed `(shop_id, workshop_job_id)` where it is set.
- `restock_seen`: `login_id` (primary key, references `logins`), `shop_id` (the business's own rows, row-level security as every table), `seen_keys TEXT[]` (the list's lines when that person last opened it or downloaded from it), `seen_at`. Additive, safe to run twice.

## 2. Working out the list (`server/lib/restock.js`, `restockList()`)

All in the business's own rows; stock is the product's total (`stock_qty`), as Stock's Running low uses. Products that are off sale (`active = 0`) are left out.

- **Sold, last 28 days** and **usual**: from `stock_movements` of type `sale` and `till_sale` (the till's and online sales; one place, as every stock change goes through `moveStock`), summed as positive counts, for the 28 days to now and the 168 days before. Usual = the earlier sum ÷ 6.
- **Running low:** `low_stock_threshold > 0 AND stock_qty <= low_stock_threshold`. Stock's own Running low leaves out a product below zero (it has Below zero and Count them); here one below zero is running low too, as it needs reordering most.
- **Selling fast:** `sold28 >= 3 AND sold28 >= 2 × usual`.
- **On order:** each product's still-to-come on draft, ordered and partly delivered orders (`qty_ordered − qty_received − set aside`, never below 0), split into lines for a job (by job) and the rest.
- **For customers:** open job orders are `sale_documents` of kind `order`, status `open`, with a `workshop_job_id` whose job's `status` is not `complete` or `pending`. Their product lines are summed per job and product, and sorted by the job's `job_date`, then job id. Each job's need, less what's still to come on order lines for that job, takes from the product's stock (never below 0) in turn, then from what's still to come on lines not for a job; what neither covers is that job's shortfall. An off-sale product is read only for jobs. A shortfall above 0 is a line: job id, `WH-` reference, customer's name, the job's day as "promised", and how many.
- **Suggested for stock:** the stock the jobs take is `covered = min(max(stock_qty, 0), jobs' needs)`; the shop's own is `stock_qty − covered`. Suggested = `low_stock_threshold + sold28 − shop's own − on order not for a job`, at least 1. A product running low or fast whose rule gives 0 or less (already covered by orders) is left off as low or fast. A job's shortfall is listed separately, so nothing is counted twice.
- **Supplier:** each product's `supplier` text is trimmed and matched, ignoring capitals (`toLocaleLowerCase('en-GB')`), to `suppliers.name`. Groups are sorted by name, "No supplier" last.

The answer, `GET /api/restock` (the Owner's):

```
{ days: 28,
  groups: [ { supplier: '[Supplier]', supplierId: 3 | null,
              lines: [ { productId, name, sku, barcode, stock, sold, low, fast,
                         suggested,            // for stock (0 when only for jobs)
                         jobs: [ { jobId, ref: 'WH-1042', customer: 'Maya Patel', promised: '2026-09-19', qty } ] } ] } ],
  counts: { low, fast, customers },   // products, for the hub
  newCount, newForJobs }               // since this person last opened it, for Today
```

Line keys for "new": `low:[product]`, `fast:[product]`, `job:[job]:[product]`. New = keys not in the person's `seen_keys`; `newCount` counts the distinct products among them, `newForJobs` those from job keys.

## 3. The routes (`server/routes/restock.js`)

All `ownerOnly(req, res, "Only the shop's owner can order stock")`, with `// screens:` comments.

- `GET /api/restock` (`rs-restock`, `rs-hub`): §2.
- `POST /api/restock/seen` `{}` (`rs-restock`): writes the current keys to `restock_seen` for this login. The screen calls it when the list opens; a GET never writes.
- `POST /api/restock/download` `{ supplier, lines: [{ productId, qty }] }` → `text/csv` (`csvOf`, which guards against spreadsheet formulas), `content-disposition: attachment; filename="restock-[supplier slug]-[yyyy-mm-dd].csv"`, columns Supplier code, Quantity, Product, Barcode; marks the list seen too. Each line checked: a product of the business, a whole count from 1 to 100,000; otherwise 400 with the words.
- `POST /api/restock/add-to-order` `{ supplierId, lines: [{ productId, qty, forJobId? }] }` → `{ orderId }`. In one transaction: the supplier's newest draft order `FOR UPDATE`, or a new draft; each line added, or a line for the same product and job raised by `qty`. A line's cost is the product's cost, as New order's. `forJobId` must be a job of the business. Lines are checked as the order routes check theirs (`MAX_QTY`, an active product).

## 4. Orders keep a line's job (`purchase-orders.js`)

`serializePurchaseOrder` adds `forJob: { id, ref }` to a line with a job. `PUT /api/purchase-orders/:id`, which replaces a draft's lines, keeps each line's job: an item may send `forJobId`; one that doesn't takes the job of the draft's earlier line for the same product, so the old app's edits don't drop it. The order page shows "for job WH-1042" under the line's name.

## 5. The screen (`src/screens/deliveries/restock-page.tsx`, `rs-restock`)

Route `/workshop/deliveries/restock` (`?show=low|fast|customers` picks the pill). Built from the deliveries pieces (`Page`, `Back`, `Card`) and the built pill group, as drawn: one card "Tick what to reorder" with the note, the pills, the column headings (hidden on a phone), then a section per supplier: the group's tick box and name as a heading, its lines (tick box in a 44px cell, name, code line, In stock "[n] · low", Sold "[n] · fast", the Reorder stepper as New order's), then "[n] ticked", Add to an order and Download for [Supplier]’s basket. For customers shows one line per job with the job's words in bold, and the drawn note "“Add to an order” keeps who each line is for on the order line — “for job WH-1042”." The bottom note says what the file holds.

- **All:** one line per product; its count is the stock suggestion plus its jobs' shortfalls. Add to an order sends the jobs' lines first (each up to its shortfall, with `forJobId`) and the rest as one line.
- **Running low / Selling fast:** the products with that flag, count as on All.
- **For customers:** one line per job's need.
- Opening calls `POST /api/restock/seen`. Download fetches the CSV and saves it with an `<a download>`; Add to an order opens `/workshop/deliveries/orders/[id]`.
- Nothing on the list: "Nothing to reorder." (not drawn; follows Orders' empty note).

## 6. The hub and Today

- `deliveries-page.tsx`: after To return, a Restock list card with the three drawn lines, counts from `GET /api/restock`, each "See the list" a link with `?show=`.
- `today.js` `restockNew()`: `[{ kind: 'restock_new', count, forJobs }]` when `newCount > 0`, in the Owner's `GET /api/needs-attention`. `today-page.tsx` draws the drawn line with Open, linking to the list.

## 7. Defaults for Jack to overrule (his 27 Oct answer 2's open details)

1. Selling fast: at least 3 in 28 days and twice the usual over the 24 weeks before. 2. The suggested count: low-stock level plus 28 days' sales, less stock and on order, at least 1; a job's shortfall for a job. 3. The file: CSV, Supplier code, Quantity, Product, Barcode. 4. Supplier by name (his 4 Nov answer 10). 5. For customers: jobs' order lines the stock doesn't cover; online orders wait until Wheelhouse has orders that order in. Each is logged in Jack's section of `decided-while-building.md`; the numbers are constants in `server/lib/restock.js`, one line each to change.
