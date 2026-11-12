## Context

Part 1 built `server/routes/reports.js` (Owner only, read-only; `asked(query)` reads `period`, `from` and `to`), `server/lib/report-periods.js` (periods and the period before, in the shop's time zone), `server/lib/report-sales.js` (sales grouped by day, month or hour from the `all_sales` view), the plain-SVG `ReportGraph`, the CSV downloads through `server/lib/csv.js`, and Your settings' "Show graphs". Part 2 (`openspec/changes/reports-ready-made`) adds Workshop (jobs booked in, finished and collected; workshop takings as labour and parts; how full each mechanic was) and, in its PR 5, each sale line's cost. What a changed report can read today (checked in the code on 11 Nov):

- **Sale lines.** The old record's `sale_items` (pounds, `product_id`, `line_type` `labour` or `product`, migration 014) under `sales` (`cashier_id`, `payment_method` 'Cash', 'Card' or 'Split', a sale-level `discount`); the till's new record's `till_sale_lines` (pence, `product_id`, null when the product is gone) under `till_sales` (`employee_id`), paid by `till_sale_payments.method`. `all_sales` (migration 083) gives both records' sales, with `employee_id`, but not their lines. Every till sale still goes into the old record until Mark's step C.
- **Products.** `products.category` is the Stockroom category's whole path ("Drivetrain › Derailleurs"), the link to `product_categories` (migration 119), which keeps the tree. `products.supplier` is free text (migration 001); the `suppliers` table is used by the supplier catalogue, purchase orders and deliveries, but **no product is linked to a supplier row**.
- **The till's quick-button groups** (the drawing's "Workshop, Parts, Accessories") **are not built**: the till has fixed Workshop quick buttons, and "quick button groups the shop sets up" is listed as not there yet (`src/screens/till/till-page.tsx`).
- **Workshop.** `workshop_jobs` (`signed_off_at`, `mechanic_id`), `workshop_job_services` (a job's services, migration 030), `workshop_services.category_id` → `workshop_service_categories` (migration 022), and the diary for hours, as part 2 reads them.
- **The person.** Your settings is kept per login (`login_preferences`, migration 065, keyed by `login_id`, read as `ctx.login.id`). There are no managers yet: Reports is Owner only (`ownerOnly`, part 1's answer 1) until Mark's roles (WP-1.1).
- **Undo.** The app's patterns: a removed item with Undo before saving (`categories-settings.tsx`), and soft delete with `deleted_at` (`customers`, migration 109).
- **One site per shop** until WP-5.2.

## Goals / Non-Goals

**Goals:** "Change what's shown" on Sales, Takings and cash-ups, and Workshop, as drawn, with every choice that doesn't fit greyed and saying why; a changed report whose figures add up to the report it came from; saving it under a name, per person, opening on the latest period; Rename, Delete with Undo; nothing to redo when roles add managers.

**Non-Goals:** sharing with managers and reports shared by others (WP-1.1); Shop as a split (WP-5.2); Margin working before part 2's PR 5; Change what's shown on Returning customers and on Margin and stock value (answer 1); VAT (never); any change to how sales are recorded.

## Decisions

1. **One panel, set by where it started.** "Change what's shown" is one popup (`change-panel.tsx`) for every report that has it. The report it opens from sets what's chosen when it opens: Sales opens on Takings by Day; Takings and cash-ups on Takings by Payment type; Workshop on Jobs by Day. The chips are the one chip look (audit M3), as radios for Measure, Split by and Supplier and checkboxes for Only, each greyed chip with `aria-disabled`, its reason in `aria-description`, and the reasons listed under the group ("Jobs: workshop only — choose it from the Workshop report · Hours: workshop only"), as drawn.

2. **What fits with what.** One table in `server/lib/report-changed.js`, used by the panel (through the route) and by the server to refuse a combination that doesn't fit, so the two can't disagree:

   | Choice | Fits | Greyed, with |
   |---|---|---|
   | Takings, Items sold | started from Sales or Takings | from Workshop: "sales only — choose it from the Sales report" *(default wording)* |
   | Margin | someone who can see costs (`canSeeCosts`), once part 2's PR 5 has merged | hidden from anyone who can't see costs (audit M2); greyed before PR 5: "costs aren't kept on sales yet" *(default wording)* |
   | Jobs, Hours | started from Workshop | from Sales: "workshop only — choose it from the Workshop report" (Jobs) and "workshop only" (Hours), as drawn |
   | Day, Week | any measure; Day not for Last 12 months or dates over 62 days | "too many days — choose Week" *(default wording)* |
   | Category, Product | Takings, Items sold, Margin | with Jobs or Hours: "jobs aren't split by product" *(default wording)* |
   | Service | Jobs, Hours (the drawn "Workshop: jobs by service" row) | from Sales: "workshop only" |
   | Staff member | any: who served the sale (`employee_id` / `cashier_id`), or the job's mechanic | — |
   | Payment type | Takings with no Only | with Items sold or Margin, or with an Only: "payments aren't split by item", as drawn |
   | Shop | never yet | "one shop until a second one is added" *(default wording)*, until WP-5.2 |
   | Only, Supplier | Takings, Items sold, Margin | with Jobs or Hours, Only lists the service categories instead and Supplier is hidden |

   Service is not in the drawn Split by list, which is drawn from Sales; the Your reports box draws "Workshop: jobs by service", so it is added for Workshop and logged in `decided-while-building`.

3. **Takings by item adds up to Takings.** A changed Sales report by Category or Product, or with an Only, reads sale lines from both records. The old record's sale-level discount is shared between its lines in proportion, as part 2 does for job takings, so Takings across every category adds up to the Sales report's Takings for the same period. Items sold is the lines' quantity. A line with no product (labour, a typed-in item, a product since removed) goes in a row of its own: labour lines in "Labour", the rest in "No product" *(default wording)*. Payment type reads `sales.payment_method` and `till_sale_payments.method`; a Split sale's cash and card halves count under Cash and Card.

4. **Categories and suppliers are as the product is now.** A line's category and supplier are read from its product today, so a product moved to another category takes its past sales with it (answer 3). The "Only" categories are the shop's top-level Stockroom categories (walk-through 3 M10), not the drawing's quick-button groups, which aren't built (answer 2). Choosing "Drivetrain" counts everything under it. Supplier chips are the distinct supplier names typed on products that sold in the period, "Any supplier" first.

5. **Routes.** All in `server/routes/reports.js`, each calling `ownerOnly(req, res, "Only the shop's owner can see reports")` first, each with `// screens: rp-…`:
   - `GET /api/reports/changed?base=sales|takings|workshop&measure=…&split=…&only=…&supplier=…&period=…&from=…&to=…`: the title, the line under it, the panel's choices with what's greyed and why, the period, the graph's rows, the table's rows and total. A combination that doesn't fit is refused (400) with its reason. `GET /api/reports/changed.csv` with the same query: the table as shown.
   - `GET /api/reports/saved` (the person's own, not deleted), `POST /api/reports/saved`, `PATCH /api/reports/saved/:id` (name), `DELETE /api/reports/saved/:id`, `POST /api/reports/saved/:id/undo`. A report belonging to someone else answers 404, as if it weren't there.
   - `base` is used rather than `from`, which already means the first day of Pick dates.

6. **Titles and the line under them.** The title is the report and what's chosen: "[Report]: [measure] by [split]" ("Sales: items sold by product", "Workshop: jobs by service"). The line under it is "Changed from [Report]", then the Only and Supplier chosen ("Accessories only", "[Supplier] only"), then the period in part 1's words. Its total row is "Total, [what it's limited to]" ("Total, Accessories only"), or "Total". The graph follows the choices (decision 7) and Your settings' "Show graphs"; its summary names the largest row and the comparison in words ("most sold [Product]; [up or down] [n] on the same days last week"). The table has the split, the measure, and Takings when the measure is Items sold (or Margin), as drawn.

7. **The saved reports table** (the migration, risky area 1), `saved_reports`:
   - `id`, `shop_id` (with the shop's row-level security, as every table), `login_id` (`REFERENCES logins(id) ON DELETE CASCADE`: the person, as Your settings is), `base`, `measure`, `split` (text, checked by `report-changed.js`, so a later measure needs no migration), `only_categories` (text array of category paths; or service category ids from Workshop), `supplier` (text or null), `period` (the kind of period, like `this-week`; never dates), `name` (1 to 80 characters, trimmed), `shared` (boolean, false), `deleted_at`, `created_at`, `updated_at`.
   - A unique index on `(shop_id, login_id, lower(name))` where `deleted_at IS NULL`: "You already have a report with this name" is the database's answer as well as the screen's.
   - Additive and safe to run twice, as every migration here. Its number follows part 2's migrations.

8. **It opens on the latest period.** A saved report keeps the kind of period it was saved on (This week, Last month, Last 12 months), and opens on the latest one of that kind. One saved on Pick dates opens on the report's own first period (This week for Sales and Workshop). It keeps working if a category is removed: the report shows what's left, and the line under the title lists only the choices that still exist.

9. **Sharing is kept but greyed until managers exist.** "Who can see it" is saved from the start (`shared`). Until roles (WP-1.1), "Me and the other managers" and the menu's "Share with managers" are greyed with "there are no managers until staff roles are set up" *(default wording; answer 4)*, and the server refuses `shared: true`. The badge shows "Just you".

10. **Delete with Undo.** Delete sets `deleted_at` and the report goes from the list at once, with the bar "'[Report name]' deleted." and Undo (the drawing's done tone). Undo clears `deleted_at`. The bar stays until the person leaves the Reports page or deletes another. If the name has been used again since, Undo says "You already have a report with this name. Choose another name." and opens Rename. Deleted rows are kept, never shown, and not tidied away (they are a few short rows per person).

11. **Rename** opens the save popup with only the name, titled "Rename", Save and Cancel, with the same two name messages. Not drawn; it follows the save popup and is logged in `decided-while-building`.

12. **Screens.** `change-panel.tsx`, `changed-report.tsx` (reached as `/reports/changed?…`, so a changed report has its own address and Back works), `save-report-dialog.tsx` (also Rename), `your-reports.tsx` (the box on the Reports page and the menu, with `aria-haspopup="menu"` and "More for [name]" as drawn). The Reports page shows Your reports under the ready-made ones, with the drawn note "Start from any report, choose 'Change what's shown', then 'Save as my report'." when there are none.

## Risks / Trade-offs

- **Categories as they are now.** Moving a product changes past reports. The other way (keeping each line's category when sold) needs a change to how sales are saved, in Mark's money area, for little gain (answer 3).
- **Supplier is free text.** "Shimano" and "Shimano UK" are two chips. Tidying it means linking products to supplier rows, a stock change outside this piece (answer 3).
- **Speed.** A changed report reads every sale line in the period from two records. For Last 12 months that is the largest read the reports make. The build measures it on a shop-sized test set and adds an index on the lines' `product_id` only if it's needed (another migration, risky).
- **Wording not drawn.** The greyed reasons marked *default wording*, "No product" and the Rename popup are not drawn. Each follows the drawn ones and is logged for Jack to overrule.
- **Margin waits** on part 2's PR 5, which waits on Mark's yes. Until then, it's greyed with its reason.

## Migration Plan

One migration in PR 2, additive (a new table and its index and policy), safe to run twice, tested from empty on a scratch database and on a copy of the test database. Nothing reads it until PR 2's screens; taking it back out is dropping the table, with no other table touched.

## Jack's answers

Answered on 11 Nov (`docs/decisions/2026-11-11-reports-part-3-answers.md`), each as recommended and already written into the decisions above:

1. **Which reports:** Sales, Takings and cash-ups, and Workshop now; Returning customers and Margin and stock value later, once their own choices are designed; VAT never.
2. **What "Only" picks from:** the shop's top-level Stockroom categories, plus Labour (decision 4).
3. **Categories and suppliers as the product is now:** past sales move with the product; suppliers grouped as typed (decision 4).
4. **Sharing until managers exist:** shown greyed with its reason, not hidden (decision 9).
5. **The small ones:** Day greyed past 62 days (decision 2); Undo, then hidden for good, rows kept (decision 10); a Pick dates report opens on the report's first period (decision 8); Rename reuses the Save popup (decision 11).
