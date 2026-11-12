# Tasks

Follows Jack's answers of 11 Nov (`docs/decisions/2026-11-11-reports-part-2-answers.md`). PR 5 is not started until Mark has said yes (task 5.1). Builds on part 1 (`openspec/changes/reports-sales-and-takings`): start only once part 1's route file, periods helper, graph and downloads are merged.

Each pull request: tests first, each watched failing for the right reason (break the code it covers, see it go red, restore, and check the break really landed); `npm run lint`, `npm test` and `npm run test:browser` pass locally after merging main; a self-review with the `reviewer` agent against these specs and the drawings (`reports.mjs`). **PRs 3 and 5 are in risky areas** (migrations; PR 5 also money): `/review`, the `risky-area-reviewer` agent, a hand-run CI (`gh workflow run test.yml --ref <branch>`) green before merging, and a line in the weekly digest. Gaps decided while building go in the builder's own month's file in `docs/decisions/decided-while-building/`. Server tests pin the clock to 1 Sep 2026, so example weeks are on or after it; compare DOM query results with `assert.ok(x === null)`. Aim: 250-600 changed lines each. PRs 1 to 4 are independent of each other; PR 5 needs PR 4.

## 1. Workshop (PR 1, about 550 lines)

- [x] 1.1 Tests first (`tests/reports-workshop.test.js`): Jobs booked in by `booked_in_at`; Finished by the current `signed_off_at` (a reopened and re-signed job once, on its last sign-off); Collected; Booked in to ready averaged over finished jobs with both times, a job without `booked_in_at` left out; jobs finished by day and the period before; Workshop takings from job sales, labour and product lines, a sale-level discount shared in proportion so Labour + Parts = Total; quotes sent in the period counted Approved (approved and partly approved), Declined, No answer (sent, or expired), drafts and withdrawn left out; how full: a mechanic's diary hours (job and job blocks) against working days × the workshop's hours less time away, cancelled bookings left out, the Shared queue and a mechanic with no working days showing "no set hours"; another shop's jobs never count; Staff refused (403), signed out 401. Verify: each fails first.
- [x] 1.2 `server/lib/report-workshop.js` and `GET /api/reports/workshop` with `.csv` (`// screens: rp-workshop`). Verify: 1.1 passes.
- [x] 1.3 Tests first (`tests/screens/reports-workshop.test.js`, `tests/browser/reports.spec.ts`): the Workshop card on Reports opens the report; the four figures compared in words, the graph's spoken description, the takings and quotes tables, each mechanic's row with its bar and the Shared queue, the note; Download as spreadsheet; on a phone the figures sit two by two. Verify: each fails first.
- [x] 1.4 `src/screens/reports/workshop-report.tsx`, the Workshop card. Verify: 1.3 passes.

## 2. Returning customers (PR 2, about 500 lines)

- [x] 2.1 Tests first (`tests/reports-returning.test.js`): a visit from an old-record sale, a till sale and a repair collected, each with its customer; a sale with no customer not counted; a deleted customer left out; New on the first visit's month, Returning after; Customers once each; Came back within 12 months as a whole percent; compared with the 12 (or 24) months before; Not seen lately with the months (6 to start, set by `?months=`), most recently seen first, Spent in the period, Yes or No from `marketing_permission`; another shop's customers never count; Staff refused. Verify: each fails first.
- [x] 2.2 `server/lib/report-customers.js` and `GET /api/reports/returning` with `.csv` (`// screens: rp-returning`). Verify: 2.1 passes.
- [x] 2.3 Tests first (screen and browser tests): the card; Last 12 months, Last 24 months, Pick dates; the three figures; the two-part bars with stripes (not colour alone) and the spoken description; the table by month; Not seen lately with the months box, each name opening the customer's page, and no Message button (answer 4); the drawn note; Download. Verify: each fails first.
- [x] 2.4 `src/screens/reports/returning-report.tsx`, the card. Verify: 2.3 passes.

## 3. VAT and the VAT quarter (PR 3, about 550 lines; risky: migration)

- [ ] 3.1 Tests first (`tests/migration-<n>-vat-quarter.test.js`, `tests/shop-settings.test.js`): from empty, `shops.vat_quarter_start_month` exists, null to start, refuses anything but 1, 2 or 3; the Shop details route reads and saves it, Owner only. Verify: each fails first.
- [ ] 3.2 The migration; `server/routes/shop-settings.js`. Verify: 3.1 passes; the migration runs from empty on a scratch database.
- [ ] 3.3 Tests first (`tests/reports-vat.test.js`, `tests/report-periods.test.js` for quarters): This VAT quarter and Last VAT quarter for each of the three start months, and calendar quarters when not said; till lines grouped by rate with Sales before VAT and VAT charged, 20%, 5% and 0% named, another rate on its own row; old-record sales in "VAT not recorded" with their takings; the quarter before; the Total row; no Refunds row; `needsQuarter` true while not said; another shop's sales never count; Staff refused. Verify: each fails first.
- [ ] 3.4 Quarters in `server/lib/report-periods.js`; `server/lib/report-vat.js`; `GET /api/reports/vat` with `.csv` (`// screens: rp-vat, rp-vat-first`). Verify: 3.3 passes.
- [ ] 3.5 Tests first (screen and browser tests): the VAT card; "When does your VAT quarter start?" on first opening, Save keeping it and not asking again, Not now showing calendar quarters with a line saying so and asking next time; the Sales table, the "VAT not recorded" line, the Stock purchases box with no figure, the drawn note, no graph and no "Change what's shown"; the VAT quarter choice in Settings › Shop and sites › Shop details. Verify: each fails first.
- [ ] 3.6 `src/screens/reports/vat-report.tsx` with the box, the card, the Shop details choice. Verify: 3.5 passes. `/review` and `risky-area-reviewer`; hand-run CI green.

## 4. Stock value and stock written off (PR 4, about 450 lines)

- [ ] 4.1 Tests first (`tests/reports-stock.test.js`): stock value as `stock_qty × cost_pence` by the top level of the Stockroom category, products without stock left out, products with stock and no cost counted apart; stock takes applied in the period, counted under and over at their kept cost; adjustments by each reason at their `value_pence`, signed by the change; the All rows; another shop's stock never counts; Staff refused. Verify: each fails first.
- [ ] 4.2 `server/lib/report-stock.js` and `GET /api/reports/margin` with `.csv` giving the stock tables (`// screens: rp-margin`). Verify: 4.1 passes.
- [ ] 4.3 Tests first (screen and browser tests): the Margin and stock value card; On the shelves today with its value, the line about products with no cost, the table; Stock written off with the eight rows and their links to the counts and the products; Download. Verify: each fails first.
- [ ] 4.4 `src/screens/reports/margin-report.tsx` (stock half), the card. Verify: 4.3 passes.

## 5. Each sale line keeps its cost, and Margin (PR 5, about 550 lines; risky: migration and money)

- [ ] 5.1 Before anything: check Mark has said yes to the sale-line cost (asked on this change's plan pull request; what he is asked is `design.md` decision 7 and answer 1 of 11 Nov), and whether it lands before or after step C. Don't start without it. Run the totals check (`scripts/ci/check-money-totals.mjs`) and keep its output.
- [ ] 5.2 Tests first (`tests/migration-<n>-sale-line-cost.test.js`, `tests/sale-line-cost.test.js`): from empty, `till_sale_lines.unit_cost_pence`, `sale_items.unit_cost_pence` and `sale_items.vat_rate_bp` exist and are null on past rows; `POST /api/sales`, a job's order becoming a sale, and a sale received through sync each keep the product's cost (and, on the old record, its VAT rate) at that moment; a labour line and a product with no cost keep none; a cost changed afterwards leaves the line as it was; no amount changes. Verify: each fails first.
- [ ] 5.3 The migration; `server/lib/sales.js` and `server/till/sync.js`. Verify: 5.2 passes; the existing sales, till-sync and job-payment tests pass unchanged; the totals check shows no change.
- [ ] 5.4 Tests first (`tests/reports-margin.test.js`): margin by Stockroom category from kept costs, Sales before VAT from the line's VAT (worked out from the kept rate on old-record lines, after sharing the sale's discount), What it cost you, Margin and Margin %, compared with the period before; lines without a cost counted apart; labour beside margin; "Margin counts from [date]" when the period starts before costs were kept; the strip's Margin for this week; Staff refused. Verify: each fails first.
- [ ] 5.5 Margin in `server/lib/report-stock.js` (or its own module) and the margin route; the strip's Margin in `GET /api/reports/home`. Verify: 5.4 passes.
- [ ] 5.6 Tests first (screen and browser tests): the three margin figures, the "[n] products sold without a cost" line opening the Stockroom's products without a cost, the graph by category and the table, "Labour £[£] · not in margin" and "Margin is on goods only.", the "counts from" line; the strip's Margin tile on Reports. Verify: each fails first.
- [ ] 5.7 The margin half of `margin-report.tsx`; the strip's tile. Verify: 5.6 passes. `/review` and `risky-area-reviewer`; totals check again; hand-run CI green.

## 6. Finish

- [ ] 6.1 Walk the built screens against `rp-workshop`, `rp-returning`, `rp-vat`, `rp-vat-first`, `rp-margin` and the cards on `rp-home`, on desktop, tablet and phone, and against each requirement in `specs/`; list what was met, dropped or changed.
- [ ] 6.2 `npm run lint`, `npm test` and `npm run test:browser` pass locally on the final commit after merging main; a fresh self-review of the whole diff.
- [ ] 6.3 `/opsx:archive` as the last commit of the last pull request, so `openspec/specs/reports` and `openspec/specs/shop-details` describe what was built.
