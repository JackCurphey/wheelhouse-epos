## Context

The Reports item is already in the staff sidebar for the Owner (`src/staff/nav.ts:51`, key `reports`, route `/workshop/reports`) and renders the "not built yet" placeholder, because `src/staff/app-shell.tsx`'s `SCREENS` has no entry for it. What exists to build on:

- **Sales from both records.** The `all_sales` view (migration 083, step B, #492) gives one row per sale in pence from the old record (`sales`, time `created_at`) and the till's record (`till_sales`, time `till_clock_at`). The Today page and `/api/dashboard` already count today's takings from it with `shopDayWindow` (`server/lib/sales.js`), which places a time on the shop's day in its own time zone. Old-record sales have no VAT and no receipt number; neither record keeps a line's cost.
- **Closed days.** `day_closes` (migration 096, WP-3.4, #551, #552) holds one close per shop per day (`UNIQUE (shop_id, day)`): who and when, takings, card, cash, other, online, float, expected, counted, difference reason, float left and banked. Each sale is marked with the close that counted it (`day_close_id`), so a closed day's figures never change (close-the-day spec). The end-of-day report is drawn by `src/screens/till/close-the-day.tsx` (`eod-z`).
- **Spreadsheets.** `server/lib/csv.js` (`csvOf`: header row, UTF-8 mark so Excel shows £ and ’, formula-looking cells written as text), used by stock take and the customer's copy, and by Your data › Download everything (`openspec/changes/your-data-download/`, merging now).
- **Owner only.** `server/lib/owner-only.js` (`ownerOnly(req, res, message)`), replaced in one place when roles (WP-1.1) arrive.
- **Your settings.** Each person's switches are a JSON object on their login (`login_preferences.accessibility`); `server/routes/your-settings.js` lists the known switches and those on to start (`DEFAULT_ON`, Show the diary legend). A new switch needs no migration.
- **Refunds.** No sale refund is recorded with its money today: Shopify refunds only put stock back (`stock_movements.shopify_refund_id`), and refunded online deposits are deposits, not sales. Till refunds come with Mark's step C.

## Goals / Non-Goals

**Goals:** the Reports page, Sales and Takings and cash-ups as drawn for one shop and the Owner, each downloadable as a spreadsheet; graphs that can be switched off per person; no new way of saving a sale, payment or close.

**Non-Goals:** WP-5.3 parts 2 to 4 (the proposal's split): Workshop, Discounts and refunds, Returning customers, VAT, Margin and stock value; Change what's shown and saved reports; accounts software, the "Sent to Xero" column, and reopening a closed day. All shops (WP-5.2), Staff with "Can see reports" (WP-1.1), the Activity log card (WP-5.4), Cycle to Work figures (WP-7.1). Mark's areas: roles, the settings store and activity log, step C, the till deposit.

## Decisions

1. **One route file, read-only, Owner only.** `server/routes/reports.js`, listed in `server/routes/index.js`: `GET /api/reports/home`, `GET /api/reports/sales?period=…&from=…&to=…`, `GET /api/reports/takings?period=…`, `GET /api/reports/days/:id` (one close's saved report), and each with `.csv` for its download (`/api/reports/sales.csv?…`). Every handler calls `ownerOnly(req, res, "Only the shop's owner can see reports")` first. All read through the request's shop under row-level security, as every staff route does; the tests also check another shop's rows never count. Each handler carries `// screens: rp-…` as the route list requires.
2. **Periods in one helper.** `server/lib/report-periods.js` turns a period choice (and today's date in the shop's time zone, `currentShopToday`) into `{ from, to, label, before: { from, to, label }, buckets }`: the days or months the graph and table show, the "So far" flag, and the period before. Weeks start on Monday (the drawing's Mon 14 – Sun 20). It is pure (no database), so its cases are tested directly, the test clock pinned to 1 Sep 2026.
3. **Sales are grouped from `all_sales` by the shop's day.** One query per period: `SELECT bucket, count(*), sum(total_pence)` over `all_sales`, bucketed by `made_at AT TIME ZONE <shop zone>`, for the period and the period before. Average is computed in whole pence, rounded half up. A till sale made offline lands on the day of its own clock, as the view already does. A deposit paid online counts when the sale it pays towards is made, because that is when the sale reaches `all_sales` (Jack's answer 5). Sales are placed by when they were made, while Takings and cash-ups places them by the close that counted them (close-the-day); the two can differ for a sale made just before a close and saved after it, and each report says which it is.
4. **Takings and cash-ups reads `day_closes`, never recounts.** The list and each day's report read the saved close (`takings_pence`, `card_pence`, `cash_pence`, `other_pence`, `online_pence`, the float and difference, `banked_pence`, who and when), so they always match what was closed. Today's row is "Not closed yet" until it is. The table shows one row per close, since closes are per shop per day, not per till (Jack's answer 4).
5. **The day's report is shared, not redrawn.** The end-of-day report's body in `close-the-day.tsx` moves into a component both Close the day and Reports show, unchanged in look; Reports adds Download as spreadsheet. Print uses the browser's print, as receipts and bike tags do (`docs/decisions/2026-10-26-day-answers.md` 5).
6. **The graph is plain SVG, no dependency.** One `ReportGraph` component draws bars (with the period before as a dashed outline) or a line (with the period before dashed), a scale of zero and two gridlines, a key, "Not yet" for days to come, and `role="img"` with the spoken description built from the table's figures, as `reports.mjs` draws them. It is hidden when the person's `showGraphs` is off.
7. **Downloads are the table as shown.** The `.csv` route builds the same rows the screen's table shows (header, rows, total), through `csvOf`, with amounts as pounds and pence (`12.50`), so the screen and the file can't disagree; the tests compare them. File name: `<report>-<shop-slug>-<from>-to-<to>.csv`.
8. **Only built reports have cards** (Jack's answer 2): the card list is a constant in the screen, each part adding its card when it builds the report.

## Risks / Trade-offs

- [Sales placed by time and closed days placed by close can show different totals for the same day] → each report's note says which it is; Takings and cash-ups' heading is "Closed days' takings", as drawn (walk-through 11 H2).
- [Old-record sales have no VAT] → nothing in part 1 shows VAT; part 2's VAT report deals with it.
- [A 12-month Sales report on a big history is one grouped query over every sale] → no shop uses Wheelhouse yet; the query is grouped in the database, and the tests time a year of sales. If it is slow on a shop with years of imported history, add an index then (a migration, with `/review`).
- [Margin is in the drawing's strip but no sale keeps its cost] → the strip shows Takings only until part 2 keeps each sale line's cost (Jack's answer 1); nothing works margin out from today's costs, which would quietly change past figures.

## Migration Plan

None on the defaults: no table or column changes. Deploying is merging; rolling back is reverting the pull requests. The old app's Sales History tab stays (Jack's answer 6).

## Jack's answers

Answered on 10 Nov (`docs/decisions/2026-11-10-reports-answers.md`); they are folded into the decisions above, the specs and `tasks.md`.

1. **Margin on the strip:** Takings only now. Margin comes in part 2, with each sale line keeping its cost when sold, agreed with Mark's step C first.
2. **Cards:** only built reports get a card (decision 8).
3. **Refunds:** the Refunds figure stays off Sales until step C records refunds.
4. **Closed days:** one row per closed day, without a till; the card's line reads "Each closed day, and any cash difference" (decision 4).
5. **Online deposits:** Sales counts a deposit when its sale is made; Takings and cash-ups shows it on the day's Online row (decision 3).
6. **The old app's Sales History stays** (not the recommendation): a walk-in sale with no customer must stay findable. Part 1 doesn't touch `public/app.js`. **Later work:** a list of single sales has to be drawn and built before the old tab goes.

The small ones, as recommended:

7. **Graphs the drawing doesn't show:** Today by hour across the shop's opening hours; This month and Last month by day; Pick dates by day up to 62 days, by month beyond.
8. **Comparisons the drawing doesn't show:** Today against the same weekday last week ("on last Thursday"); This month so far against the same days last month; Last month against the month before.
9. **Takings and cash-ups' periods:** the same choices as Sales; beyond 62 days the table shows a row per month (its closed days added up), and a month's row opens nothing.
10. **Downloads are CSV files** (they open in Excel and Google Sheets), as Your data's are, named like `sales-north-street-cycles-2026-09-14-to-2026-09-17.csv`.
11. **"Show graphs in reports" is on to start,** as Show the diary legend is (decision 7: "anyone can hide graphs").
12. **A closed day's report in Reports shows what Close the day's report shows today** (Takings, Card, Cash, Other, the float, the difference, Banked and the online line). The drawing's extra rows (Refunds, Voids, Discounts given, VAT in the day's sales) wait for step C, which records them.

## Open Questions

None left for part 1.
