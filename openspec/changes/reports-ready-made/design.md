## Context

Part 1 (`openspec/changes/reports-sales-and-takings`) builds the Reports page, `server/routes/reports.js` (Owner only, read-only), `server/lib/report-periods.js` (periods and the period before, in the shop's time zone), the plain-SVG `ReportGraph`, and the CSV downloads through `server/lib/csv.js`. This part adds four reports on top of those and reuses every one of them. What each report can read today (checked in the code on 11 Nov):

- **Sales.** Two records, read together through the `all_sales` view (migration 083): the old record (`sales`, `sale_items`, amounts in pounds, no VAT, no cost) and the till's new record (`till_sales`, `till_sale_lines`, pence, VAT rate and amount on every line, no cost). **Every till sale is still saved in the old record** (`POST /api/sales`, `server/lib/sales.js:510`) until Mark's step C moves the till onto sync (`server/till/sync.js:143`), so today the new record is nearly empty. Neither record keeps a line's cost, a discount's reason or who gave it; the old record has a sale-level `discount` and `group_discount_name` only. No sale refund is recorded with its money anywhere. The new till's sales carry no customer yet (step C's `design.md`); the old app's sales and job sales can.
- **Workshop.** `workshop_jobs`: `booked_in_at` (the bike booked in at the shop, migration 051), `signed_off_at` (the mechanic's sign-off, which is how a job is finished, migration 040; cleared if reopened), `collected_at`, `mechanic_id`, `job_date`, `start_time`, `end_time`, `planned_minutes`, the booking state; `workshop_job_parts` (a job's extra diary blocks, per mechanic and date). Quotes: `workshop_quotes.state` and `sent_at`, each line's `decision` and `decided_at`. Mechanics: `employees.is_mechanic` and `working_days`; the workshop's hours per weekday (`workshop_settings.weekday_hours`); time away (`workshop_unavailability`). A job's money: its order (`sale_documents.workshop_job_id`) becomes an old-record sale (`converted_sale_id`) whose lines are marked `labour` or `product` (`sale_items.line_type`).
- **Customers.** `customer_id` on both sales records (exposed by `all_sales`); `workshop_jobs.collected_at` with the job's `customer_id`; `customers.marketing_permission` (the yes or no to offers); deleted customers are marked deleted (customers spec, "Deleting someone's details").
- **Stock.** `products.cost_pence` (today's cost), `products.stock_qty`, `products.category` (the Stockroom category path, `product_categories.path`, migration 119); adjustments in `stock_movements` with `reason` (`damaged`, `lost_stolen`, `used_workshop`, `faulty_return`, `found`, `other`) and `value_pence` (at cost when made); stock takes in `stock_takes` and `stock_take_results` with `difference` and `cost_pence` as it was.
- **Shop settings.** Columns on `shops` (`server/routes/shop-settings.js`), shown in Settings › Shop and sites › Shop details. No VAT quarter is kept.
- **Who sees costs.** `server/lib/can-see-costs.js` stands in for "Can see costs and margin": the Owner until roles (WP-1.1).

## Goals / Non-Goals

**Goals:** Workshop, Returning customers, VAT and Margin and stock value as drawn, for one shop and the Owner, each downloadable; honest about what isn't recorded (old-record VAT, products without a cost) rather than guessing; the smallest change to how a sale is saved that makes margin true from the day it lands.

**Non-Goals:** Discounts and refunds (answer 2); recording refunds or discounts with reasons (WP-3.1); "All shops" (WP-5.2); Staff with "Can see reports" and managers (WP-1.1); "Change what's shown" and saved reports (part 3); accounts software (part 4); the supplier invoice check (later); Cycle to Work's commission (WP-7.1); filing VAT.

## Decisions

1. **Routes and modules.** `server/routes/reports.js` gains `GET /api/reports/workshop`, `/returning`, `/vat`, `/margin` (each with `?period=…&from=…&to=…`) and each with `.csv`. Each report's queries live in their own module (`server/lib/report-workshop.js`, `report-customers.js`, `report-vat.js`, `report-stock.js`), which returns the same rows the screen and the CSV both use, so the route file stays a list of handlers. Every handler calls `ownerOnly(req, res, "Only the shop's owner can see reports")` first; VAT and Margin also check `canSeeCosts`. Each carries `// screens: rp-…`.

2. **Workshop counts from what the diary and jobs already save** (decision 6: "Uses only what the diary and job pages already record").
   - *Jobs booked in:* jobs whose `booked_in_at` falls in the period (the bike booked in at the shop).
   - *Finished:* jobs whose current `signed_off_at` falls in the period (a reopened job counts when it is signed off again).
   - *Collected:* jobs whose `collected_at` falls in the period.
   - *Booked in to ready:* the average, in days to one decimal place, from `booked_in_at` to `signed_off_at`, over jobs finished in the period that have both. Jobs booked in before migration 051 have no `booked_in_at` and are left out of this average.
   - *Graph:* jobs finished by day (by month for 12 months), the period before dashed behind, as part 1's graph.
   - *Workshop takings:* job sales (old-record sales made from a job's order) made in the period, placed on the shop's day as Sales places them. Labour is the labour lines; Parts the product lines. A sale-level discount is shared between Labour and Parts in proportion to their lines, rounded so the two add up to the sale's total, so Total always equals what was taken for jobs. Until step D lets the new till pay a job, every job sale is in the old record.
   - *Quotes:* quotes sent in the period, counted by how they stand now: Approved (approved or partly approved), Declined, and No answer (still waiting, or expired). Drafts, withdrawn and replaced quotes don't count.
   - *How full each mechanic was:* for each mechanic (`is_mechanic`), hours booked = the diary time of their jobs and job blocks on days in the period (cancelled, declined and expired bookings left out); hours available = on each of their working days, the workshop's hours that weekday, less their time away. "[n] of [n] hours booked · [n]% full", rounded to whole hours and percent. Jobs with no mechanic are the **Shared queue**, with hours booked and "no set hours", as drawn. A mechanic with no working days in the period shows hours booked and "no set hours".

3. **Returning customers count visits from both records and collections** (leftover screens decision 5).
   - *A visit* is a sale with that customer on it (either record, at `made_at`), or a repair collected (`collected_at`, the job's customer). Sales with no customer are not counted, and the report says so, as drawn. Deleted customers are left out.
   - *New* in a month: the customer's first visit ever falls in that month. *Returning:* they visited that month and had visited before it. *Customers:* everyone with a visit in the period, once each.
   - *Came back within 12 months:* of the period's customers who had visited before, the share whose visit in the period came no more than 12 months after their previous one, as a whole percent.
   - *Not seen lately:* customers with at least one visit, whose latest visit is more than [n] months before today, most recently seen first; Last bought or collected (the date), Spent in the period (both records' sales with them on, the column named for the period, audit M7), and Happy to hear about offers (Yes or No, from `marketing_permission`). [n] starts at 6 (answer 5) and is set in the box beside the title; it is kept in the address, not saved. Each name opens the customer's page.
   - *Periods:* Last 12 months, Last 24 months and Pick dates (drawn), the months before as the comparison.

4. **The VAT quarter is one column on the shop** (audit H6, "the shop says once which month its VAT quarter starts"). A migration adds `shops.vat_quarter_start_month SMALLINT NULL CHECK (vat_quarter_start_month IN (1, 2, 3))`: 1 for January, April, July, October; 2 for February, May, August, November; 3 for March, June, September, December. Null means not asked yet. The VAT report asks when it is null ("When does your VAT quarter start?", the three choices, "It's on your VAT registration, or ask your accountant.", Not now and Save), as `rp-vat-first` draws. It is saved through the Shop details route (`PATCH` on `server/routes/shop-settings.js`, Owner only) and shown as a choice in Settings › Shop and sites › Shop details, which the box's line points to ("Change it later in Settings › Shop and sites"). "Not now" shows calendar quarters (January, April, July, October) for this visit, with a line saying so, and asks again next time (answer 5). It is a shop setting, not a site one: a business has one VAT registration (shop-details spec).

5. **VAT by rate from the new record; the old record on its own row.**
   - *Periods:* This VAT quarter, Last VAT quarter, Pick dates, each against the quarter (or the same number of days) before. Sales are placed on the shop's day by when they were made, as Sales places them.
   - *Sales:* `till_sale_lines` in the period, grouped by `vat_rate_bp`: Sales before VAT (line total less its VAT) and VAT charged, with the quarter before. Rates 20%, 5% and 0% are named as drawn ("Standard 20%", "Reduced rate 5%", "Zero rate 0%"); any other rate gets its own row with its percentage.
   - *The old record* (answer 3): one more row, "VAT not recorded", giving those sales' takings including VAT, no split, and the line "These sales were made before Wheelhouse kept VAT on each sale. Take their VAT from your accounts software or ask your accountant." Once PR 5 lands (answer 1), old-record product lines kept from that day onward carry their VAT rate and join the rows above; their labour lines stay in "VAT not recorded" until Jack answers the labour VAT question step D waits on.
   - *Refunds:* the row is not shown until refunds are recorded with their money (WP-3.1); the Total row then takes them off.
   - *Stock purchases:* the box as decided on 3 Oct: "Stock purchases only — not your full VAT reclaim. Rent, bills and other costs don't go through Wheelhouse." and "Supplier invoices are checked in your accounts software — take this figure from there."
   - No graph and no "Change what's shown" (audit H6). The note under it as drawn.

6. **Stock value and stock written off read what is saved.**
   - *On the shelves today:* every product with stock (`stock_qty > 0`) × its cost today (`cost_pence`), by the top level of its Stockroom category (walk-through 3 M10), with Items and What it cost you, and an All row. This is today's stock at today's cost, which is what "stock value" means, so it doesn't break answer 1. Products with stock but no cost are counted in a line ("[n] products on the shelves have no cost, so they aren't in this"). The drawing's "Includes stock held for customers" and "Stock on its way between shops" lines are left out: nothing holds stock for a customer yet, and there is one shop until WP-5.2.
   - *Stock written off:* in the period, stock takes counted under and over (`stock_take_results.difference` × its `cost_pence` as it was, for takes applied in the period), and adjustments by reason (`stock_movements.value_pence`, signed by the change), with the drawing's eight rows and labels; "See the counts" opens the stock takes, "See the products" opens the Stockroom's stock history filtered to that reason.

7. **Each sale line keeps its cost, written when the sale is saved** (answer 1 of 11 Nov; part 1's answer 1 of 10 Nov).
   - One migration adds `unit_cost_pence INTEGER NULL` to `till_sale_lines` and to `sale_items`, and `vat_rate_bp INTEGER NULL` to `sale_items` (the new record has it already). Nothing is filled in for past sales: their cost then is not known, and answer 1 rules out today's cost.
   - The server writes them at the moment it saves the sale, from the product as it is then: `server/lib/sales.js` for the old record (including a job's order becoming a sale), `server/till/sync.js` for the new one. A line with no product (labour, or a product the server no longer has) or a product with no cost gets null. The till sends nothing new, so offline tills and Mark's step C need no change; a sale made offline takes the cost from when it reaches the server, the closest moment the server can know (its own line in the risks).
   - The totals check (`scripts/ci/check-money-totals.mjs`) is unchanged: no amount changes.
   - **Mark agrees first, before PR 5 is built** (answer 1). He is asked, on this change's plan pull request, to agree to: the three nullable columns above; the server filling them in when it saves a sale, in `server/lib/sales.js` and `server/till/sync.js`; the till sending nothing new, so step C needs no change; no amount changing and no past sale filled in, with the totals check unchanged; and whether it lands before or after step C, as both touch `server/till/sync.js`. PRs 1 to 4 don't wait for him.
   - *Margin* (`rp-margin`'s first half): product lines with a cost, in the period: Sales before VAT (the line's total less its VAT; on old-record lines, worked out from the line's kept VAT rate, after the sale's discount is shared over its lines in proportion), What it cost you (quantity × kept cost), Margin and Margin % by Stockroom category. "[n] products sold without a cost" counts lines left out, with "See them and add a cost" opening the Stockroom filtered to products without a cost. "Labour £[£] · not in margin" from labour lines (walk-through 11 M2). A period that starts before the migration's first sale with a kept cost says "Margin counts from [date], when Wheelhouse started keeping what each item cost when sold."
   - *The strip:* the Reports page's strip gains its Margin tile ("£[£] · [n]%", this week so far), for people who can see costs.

8. **Cards.** The Reports page's card list (part 1's constant) gains, in the drawing's order and with its lines: Workshop ("Jobs, labour and parts, how full each mechanic was"), Returning customers ("Who comes back, and who hasn't been in for a while"), Margin and stock value ("What you made on what you sold, what's on the shelves, and stock written off"), VAT ("VAT by rate for your VAT quarter, for your accountant"). Each card is added by the pull request that builds its report.

9. **Downloads.** Each report's `.csv` is its tables as shown, one after another with a blank row between and each table's title as a row above it (a report here has more than one table, unlike part 1's), named `<report>-<shop-slug>-<from>-to-<to>.csv`.

## Risks / Trade-offs

- [Every till sale is in the old record until step C, so the VAT report shows almost everything as "VAT not recorded"] → said plainly on the report; it becomes exact by itself as sales move to the new record, with no more work here. Jack chose to build it now (answer 3).
- [An offline till sale's cost is taken when it reaches the server, not when it was made] → a cost changed in between gives that line the newer cost. Offline sales are usually sent within minutes; the till never holds costs (Staff see no costs), so the server's moment is the closest true one.
- [Adding columns to both sales tables touches Mark's area and the money area] → nullable columns, no change to any amount or to the till's request, Mark's yes before merging, full risky-area review, and the totals check run before and after.
- [Workshop's "How full" is only as good as the diary] → it uses only diary times and working days, as decision 6 chose over a timer on every job; the note under it says where the figures come from.
- [Returning customers undercounts while the new till's sales carry no customer] → the drawn note says sales with no customer aren't counted; it grows as WP-3.1 puts customers on till sales.
- [Big histories] → each report is grouped in the database; the tests time a year of rows. An index, if needed, is a migration with `/review`.

## Migration Plan

Two migrations, each additive and nullable, each in its own risky-area pull request: the VAT quarter on `shops` (PR 3), and the kept cost and VAT rate on sale lines (PR 5). Test each from empty on a scratch database. Rolling back is reverting the pull request; the columns are only read by this change's reports. The totals check runs before and after PR 5.

## Jack's answers

Answered on 11 Nov (`docs/decisions/2026-11-11-reports-part-2-answers.md`), each as recommended and already written into the decisions above:

1. **Margin:** each sale line keeps its cost when sold (decision 7), with Mark's yes before PR 5 is built; margin counts from that day.
2. **Discounts and refunds:** left out until WP-3.1 records discounts with reasons and refunds with their money.
3. **VAT:** built now, the old record on its own "VAT not recorded" row (decision 5).
4. **The Message button:** left out; the Yes or No column stays (decision 3).
5. **The small ones:** the defaults ("Not seen for" from 6 months; "Not now" uses calendar quarters and asks again; job discounts shared in proportion; quotes by when sent; "held for customers" and "between shops" left out).
