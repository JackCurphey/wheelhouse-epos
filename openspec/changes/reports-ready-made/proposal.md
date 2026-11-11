WP: WP-5.3

## Why

Part 1 of Reports and accounts (`openspec/changes/reports-sales-and-takings`, merged as #664, being built now) gives the Reports page, Sales, and Takings and cash-ups. Its proposal split WP-5.3 into four parts; this change is **part 2: the other ready-made reports**. On 9 Nov Jack chose to have each piece's spec written one piece ahead, its questions answered before building. **It is not built yet.** Jack answered its questions on 11 Nov (`docs/decisions/2026-11-11-reports-part-2-answers.md`), each as recommended; a builder session builds from it.

Looking at what each report needs, three of the drawn reports can be built from what Wheelhouse already records, and two can't be built in full yet:

- **Workshop**, **Returning customers** and the **stock** half of Margin and stock value read only what is already saved (jobs, the diary, quotes, customers, stock and its adjustments).
- **VAT** can be built, but it is exact only for sales in the till's new record (`till_sales`), which keeps VAT on every line. The old record never kept VAT (`server/migrations/083_all_sales_view.sql`), and **every till sale still goes into the old record today**: the till posts to `POST /api/sales` (`src/screens/till/pay-dialog.tsx:87`, `server/lib/sales.js:510`) until Mark's step C moves it onto the new record.
- **Margin** needs what each item cost on the day it was sold. No sale line keeps that (neither `sale_items` nor `till_sale_lines`), and **Mark's step C doesn't plan to add it**: step C only moves the new till onto sync (`openspec/changes/wp-1-6-sales-in-pence/design.md`, the step C section). Jack's answer 1 of 10 Nov rules out working margin out from today's product costs.
- **Discounts and refunds** has almost nothing to read: no sale refund is recorded with its money, and no discount keeps a reason or who gave it. These come with the complete till (WP-3.1: "discounts with reasons", "refunds"), **not with step C** as part 1's answer 3 assumed (step C's proposal: "There is no refund table today").

So this change specifies the three reports that can be built, VAT with its gap shown honestly, and keeping each sale line's cost so Margin can be true, which Mark agrees before it is built. Discounts and refunds waits for WP-3.1.

## What Changes

As Jack answered on 11 Nov; **(answer n)** points to each answer.

- **Workshop** (`rp-workshop`; Reports and accounts decision 6, audit L2): opens on This week with the same periods as Sales. Headline figures **Jobs booked in** (bikes booked in at the shop), **Finished** (signed off by a mechanic), **Collected**, and **Booked in to ready** (average days), each compared in words with the period before; a graph of jobs finished by day; **Workshop takings** (Labour, Parts and Total, against the period before) and **Quotes** (Approved, Declined, No answer); and **How full each mechanic was** (hours booked in the diary against the hours each mechanic is in, from their working days, with the Shared queue showing hours booked and "no set hours").
- **Returning customers** (`rp-returning`; leftover screens decision 5 and audit M5, M7, M9): opens on Last 12 months, with Last 24 months and Pick dates. Headline figures **Customers**, **New** and **Came back within 12 months**; a graph of new and returning customers by month (two parts of one bar); a table by month; and **Not seen lately**, the customers not seen for [n] months, each opening their customer page, with "Happy to hear about offers" from their yes or no. A customer counts when they buy something or a repair is collected; sales with no customer are not counted. There is no Message button until messaging one customer is built **(answer 4)**.
- **VAT** (`rp-vat`, `rp-vat-first`; decision 3, audit H6, issue #116 question 6): the first time the Owner opens it, "When does your VAT quarter start?" is asked once and saved on the shop, changeable later in Settings › Shop and sites › Shop details. The report opens on This VAT quarter, with Last VAT quarter and Pick dates; no graph and no "Change what's shown", as drawn. **Sales** by rate (Standard 20%, Reduced rate 5%, Zero rate 0%) with Sales before VAT, VAT charged and the quarter before, from the till's new record. Sales in the old record are **one row of their own, "VAT not recorded", with their takings including VAT** and a line saying to take their VAT from the accounts software **(answer 3)**. The Refunds row waits until refunds are recorded with their money (WP-3.1). **Stock purchases** says "Stock purchases only — not your full VAT reclaim" and to take supplier invoices from the accounts software, as decided on 3 Oct.
- **Margin and stock value** (`rp-margin`; decision 5, audit M11, walk-through 3 M7, M10 and L3, walk-through 11 M2, walk-through 5 M3):
  - **On the shelves today** (stock value at what it cost you, by Stockroom category, including stock held for customers) and **Stock written off** (stock takes counted under and over, and each adjustment reason, at cost when it happened, each row opening its counts or products). Both read what is saved today.
  - **Margin** (Sales before VAT, What it cost you, Margin and Margin %, by Stockroom category; products sold without a cost left out and counted; "Labour £[£] · not in margin"), and Margin on the Reports page's strip (part 1's answer 1). This needs each sale line to keep its cost when sold: one migration, adding the cost to both records' lines, filled in by the server at the moment a sale is saved, with **Mark's agreement before it is built**, because it touches how a sale is saved (what he is asked is in the answers file and `design.md` decision 7). Margin then counts from the day it lands; a period before that says so **(answer 1)**.
- **Discounts and refunds** (`rp-discounts`) is **left out of this part** and comes after WP-3.1 records discounts with reasons and refunds with their money **(answer 2)**.
- **Report cards.** The Reports page gains a card for each report this part builds, with its line as drawn (part 1's answer 2: only built reports get a card).
- **Download as spreadsheet** on every report, made exactly as in part 1 (the table as shown, through `server/lib/csv.js`). Every report here is **Owner only** until Mark's roles exist, as in part 1; Margin, stock value and VAT also go through `server/lib/can-see-costs.js`, which stands in for "Can see costs and margin" (decision 5) and is the Owner today.

### Not in this change, and why

- **Discounts and refunds** (`rp-discounts`): it waits for WP-3.1 (answer 2).
- **Anything waiting for Mark's roles (WP-1.1):** Staff with "Can see reports" (`rp-discounts-staff`, `rp-home-staff`, `rp-person`); managers.
- **Anything waiting for the shop switcher (WP-5.2):** `rp-vat-all`, `rp-workshop-all`, and a shop column.
- **The supplier invoice check** version of VAT (`rp-vat-check-off`): later (issue #116 question 6).
- **Cycle to Work's commission off margin** (walk-through 5 M3): Cycle to Work isn't built (WP-7.1); no bike carries a commission yet, so there is nothing to take off. The line about it comes with WP-7.1.
- **"Change what's shown"** on any report: part 3.
- **Filing VAT with HMRC:** never (decision 3).
- No new way of recording a sale, payment, refund or discount, apart from the cost kept on each sale line (answer 1). Mark's areas stay untouched otherwise: step C, the till deposit, roles, the settings store.

## Who and risk

WP-5.3 part 2, Jack's side, built by one builder session. **Two of its pull requests are in risky areas** and need `/review`, the `risky-area-reviewer` agent, a hand-run CI and a line in the weekly digest:

- the VAT pull request (a **migration**: the shop's VAT quarter month on `shops`);
- the Margin pull request (a **migration in the money area**: each sale line's cost, written when a sale is saved, in `server/lib/sales.js` and `server/till/sync.js`). It needs Mark's agreement before it is built (answer 1 of 11 Nov).

The other three pull requests read only, on staff routes, and are not in a risky area. No change to `server/server.js` or anything under `/api/portal/*`. Because the change holds migrations, it is the full version (proposal, specs, design and tasks) whatever its size.

## Follows

- Decisions: `docs/decisions/2026-11-11-reports-part-2-answers.md` (answers 1 to 5); `docs/decisions/2026-11-10-reports-answers.md` (answers 1, 2 and 3: margin with each sale line's cost agreed with Mark, only built reports get a card, no refunds figure until they are recorded); `docs/decisions/2026-10-01-reports-and-accounts-review.md` 3, 5, 6, 7 and 8 (audit H6, M7, M9, M11, M15/M16) and its later changes (issue #116 question 6, stock purchases from the accounts software; walk-through 11 H2, Takings has one meaning; walk-through 11 M2, labour beside margin; walk-through 5 M3, Cycle to Work commission); `docs/decisions/2026-10-02-leftover-screens-review.md` 5 and 6 (Returning customers, audit M5, M7, M9); `docs/decisions/2026-10-16-mechanic-sign-off.md` (finishing a job is its sign-off); `docs/decisions/2026-10-19-owner-only-settings.md`; `docs/decisions/2026-10-18-build-for-every-shop.md`.
- Drawings (`docs/design/user-journeys/generator/reports.mjs`, screen ids in `journeys.mjs`, journey j17): `rp-workshop`, `rp-returning`, `rp-vat`, `rp-vat-first`, `rp-margin`, and the cards on `rp-home`.
- Built on: part 1 (`openspec/changes/reports-sales-and-takings`: the route file, the periods helper, the graph, the downloads), `openspec/specs/workshop-diary`, `workshop-jobs`, `stock`, `stock-take`, `customers`, `shop-details`.

## Capabilities

### New Capabilities
- None. The `reports` capability is created by part 1; this change adds to it.

### Modified Capabilities
- `reports`: adds Workshop, Returning customers, VAT, and Margin and stock value, their cards, and Margin on the strip.
- `shop-details`: adds the shop's VAT quarter to Settings › Shop and sites › Shop details.

## Impact

- New: `server/lib/report-workshop.js`, `server/lib/report-customers.js`, `server/lib/report-vat.js`, `server/lib/report-stock.js` (one query module each, so `server/routes/reports.js` stays short); `src/screens/reports/workshop-report.tsx`, `returning-report.tsx`, `vat-report.tsx` (with the VAT quarter box), `margin-report.tsx`; migrations for the VAT quarter and the cost kept on each sale line.
- Changed: `server/routes/reports.js` (new routes and their `.csv`), `server/routes/shop-settings.js` and the Shop details screen (the VAT quarter), the Reports page's card list and strip; `server/lib/sales.js` and `server/till/sync.js` (write each line's cost).
- No dependency added. `public/app.js` is not changed.
