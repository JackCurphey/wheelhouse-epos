# Design: Your data › Download everything

**Not built.** Written 10 Nov against main at `177912c5`. Jack answered questions 1 to 7 on 10 Nov (`docs/decisions/2026-11-10-your-data-answers.md`), the recommendation each time; small ones 8 to 14 stand as proposed.

## Context

What exists today (checked 10 Nov):

- **The parts.** `server/lib/csv.js` (`csvOf`: header row, UTF-8 mark so Excel shows £ and ’, formula-looking cells written as text) and `server/lib/zip.js` (`zipFiles`: a zip of text files, stored uncompressed, no dependency). Both were made for the customer's own copy (`server/customer-data-copy.js`, archived `your-data-copy`, `your-data-once-a-day`), which runs in the request's shop under row-level security and writes times in the shop's zone by the database (`to_char(... AT TIME ZONE ?)`).
- **Owner only.** `server/lib/owner-only.js` (`ownerOnly(req, res, message)`); WP-1.1 replaces it in one place.
- **Sales.** Two records: the older `sales` / `sale_items` / `sale_payments` (pounds, no VAT, no receipt number; every collected repair's payment lands here, `server/routes/sales.js:742`) and the till's `till_sales` / `till_sale_lines` / `till_sale_payments` (pence, VAT, `receipt_number`, shown as `B1-0000` by `receiptLabel` in `server/till/money.js`). The `all_sales` view (migration 083) lists both, one row per sale, `source` saying which. Mark's step C will change how the till saves sales; the view is the agreed place both records are read from (step B).
- **Refunds.** No till refund exists yet (step C). Wheelhouse records refunds of online deposits (migration 071) and Shopify refunds (migration 012, #566). Store credit (migration 126) is customer money, not a refund.
- **Stock.** `products` (prices in pence, migration 114; sizes and colours, migration 120; categories, 119), `product_stock` per site (migration 117), barcodes, suppliers.
- **Workshop jobs.** `workshop_jobs` with services, parts, quotes, deposits; a job's amounts come from the job page's own figures (`jobMoney`).
- **Customers.** `deleted_at` (deleted at their request; details blanked), `merged_into_id` (merged away), groups (`customer_group_members`), the yes-to-messages columns already read by the customer copy.
- **Citrus Lime import.** `move_rows` with `state = 'left_out'`, its `data` (Citrus Lime's columns, JSON) and `why` (migration 113: "kept for Settings › Your data"). A deleted customer's rows are emptied (`moving-from-citrus-lime` spec, "A deletion isn't undone by a row left open"). `move-page.tsx:288-299` hides See them and says the rows "will be listed under" Your data (Jack, 4 Nov, answer 1).
- **Settings.** `src/screens/settings/settings-page.tsx:1024`: the Office room has only Shop and sites. The drawing's rooms (`settings-frame.mjs:65`) put `['shop', 'staff', 'data']` there.
- Latest migration on disk: 128. This change needs none.

## Goals / Non-Goals

**Goals:** one button gives the Owner every customer, sale, product and job as spreadsheets that open cleanly in Excel and Google Sheets; nothing is written to sales, stock or customers; only the shop's own rows ever leave; the import's left-out rows have somewhere to be seen.

**Non-Goals:** per-report downloads (Reports, slice D); Settings changes (WP-1.2); accounts software; the Lightspeed version; any way to change data from Your data; a scheduled or emailed copy.

## Decisions

1. **One route, made on request, sent at once.** `GET /api/settings/your-data/download` builds the spreadsheets and the zip in the request and sends it as `application/zip` with the file name. *Why:* no shop uses Wheelhouse yet; the customer copy works the same way; no job queue or file storage exists to keep a finished file in. *Alternative:* make it in the background and offer "Ready to download" later (audit M18), which needs storage and a notice; kept for when a real shop's data is large (Risks).
2. **A new `server/shop-data-copy.js`, beside the customer copy**, one function per spreadsheet, each returning rows for `csvOf`. It runs in the request's shop like every staff route, so row-level security keeps it to that shop; the tests also check another shop's rows never appear.
3. **Sales read from both records through `all_sales` for the sale, joined to each record's own lines and payments.** One row per item sold (answer 3), the sale's details repeated on each row so the file filters and totals in Excel without lookups. Older-record cells Wheelhouse never stored (VAT, receipt number) stay empty, not 0. Money is pounds with two decimals (`(pence / 100).toFixed(2)`, as the customer copy).
4. **Refunds as negative rows in the same file** (answer 4): online deposit refunds and Shopify refunds, each with "Refund" in a Kind column and what it refunded. Till refunds join when step C records them, by adding to the same function.
5. **Stock: one row per product per site** (small one 9), so a two-site shop's file sums by site; a one-site shop sees one row each.
6. **Customers leave out deleted and merged-away records** (their details are gone or live in the kept record). Sales and jobs of a deleted customer keep their rows with the customer cell empty.
7. **The left-out Citrus Lime rows are a fifth spreadsheet, only when there are any** (answer 1). Its columns: the file, why it needed a look, then the union of Citrus Lime's own column names found in those rows, in the order first seen. Emptied rows (deleted customers) are left out. See them on `mv-sorted` opens Settings at `?room=office&fold=download-everything`, the built way a link opens a named fold (`settings-frame.tsx:21, 67`).
8. **The screen.** A Your data area in the Office room (`your-data-settings.tsx`), drawn fold and rows, the button as a link-styled download fetched with the session cookie. While waiting: "Preparing your download…" (disabled, `aria-live`); on failure the drawn warning bar "The download didn’t start." with Try again, as the customer copy (`account.tsx:237`). Both states are undrawn and logged in `decided-while-building.md` (small one 8).
9. **No limit on how often**, unlike the customer copy (once a day, a public route). This is a signed-in Owner on a staff route; one download at a time per browser by disabling the button.

## Risks / Trade-offs

- [A big shop's history won't fit comfortably in one request's memory: the CSV text and the uncompressed zip are both held whole] → no shop uses Wheelhouse yet; the tests time a shop of [n] sales. Before the first real shop with years of history, switch to a streamed, compressed zip (a task left open in tasks.md § 5, not built now).
- [Step C changes how the till saves sales] → reading through `all_sales` and each record's own lines keeps this to one function to update; step C's own tests would show a missing row.
- [The download holds every customer's details: a privacy-heavy action with no record of who took it] → Owner only now; not recorded until Mark's activity log exists (answer 7).
- [The drawing shows a Manager; it is built Owner only] → as every setting until WP-1.1 (`2026-10-19-owner-only-settings.md`).
- [CSV, not Excel workbooks] → the drawing says "Spreadsheets that open in Excel or Google Sheets"; CSV opens in both with no dependency and is what the customer copy already gives.

## Migration Plan

None. Rollback is reverting the pull requests; nothing is stored.

## Answered questions

Asked 10 Nov and answered by Jack the same day (`docs/decisions/2026-11-10-your-data-answers.md`). He chose option (1), the recommendation, on each of 1 to 7. Small ones 8 to 14 stand as written.

1. **Where the left-out Citrus Lime rows show (See them):** a fifth spreadsheet, "Left out from Citrus Lime", in the same download, and a line in the fold with how many. No new screen; it finishes WP-2.4's See them.
2. **Choosing which lists:** none; all four every time, as drawn. The ticks only show what is included.
3. **Sales:** one row per item sold, the sale's date, receipt and total repeated on each row.
4. **Refunds before the till can refund:** the refunds Wheelhouse records today (online deposits and Shopify orders) as negative rows now; till refunds added when Mark's step C records them.
5. **The daily figures for accounts** (`reports.mjs:345, 360`): left out until Reports and accounts software are built.
6. **Staff notes on jobs:** included in the shop's own copy (a customer's copy still leaves them out, 30 Oct answer 1).
7. **Recording who downloaded:** not recorded until Mark's activity log exists; Owner only meanwhile. No migration.

Small ones, as proposed (Jack kept them):

8. Waiting and failure: "Preparing your download…", then "The download didn’t start." with Try again (the customer copy's words). Not drawn; logged.
9. Stock: one row per product per site.
10. Deleted and merged customers: no row in Customers; their sales and jobs keep their rows with the name empty.
11. No limit on how often the Owner downloads.
12. Products switched off (`products.active = 0`): left out of Stock; their past sales still show what was sold.
13. Cost prices are included (only the Owner can download).
14. File name "[shop name] data [YYYY-MM-DD].zip"; each spreadsheet named as its row on screen.
