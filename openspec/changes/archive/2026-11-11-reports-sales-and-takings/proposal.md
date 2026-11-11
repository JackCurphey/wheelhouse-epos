## Why

WP-5.3, Reports and accounts (journey 17), is "Old app's sales history only" on the build board: the staff app has a Reports item in its sidebar that opens a "not built yet" page (`src/staff/routes.ts:33`, `src/staff/app-shell.tsx`), and the only way to look back at sales is the old app's Sales History tab (`public/app.js:2490`). Jack chose Reports and accounts as the next area on 10 Nov, because it doesn't wait on Mark and it unlocks spreadsheet downloads (his 26 Oct answer 4 put "Download as spreadsheet" with Reports) and, later, the figures for accounts software. On 9 Nov he chose to have each piece's spec written one piece ahead, with its questions answered before building. WP-5.3 is too large for one change (11 screens and 103 boards), so this change splits it into four parts and specifies **the first part only**, the one that answers an owner's first question soonest: "how much have we taken, and did each day's cash add up?" Jack answered its questions on 10 Nov (`docs/decisions/2026-11-10-reports-answers.md`) and they are folded in here. **It is not built yet;** a builder session builds from it.

## What Changes

### The split of WP-5.3 into four parts

Each part can be used on its own once merged, and each is its own OpenSpec change, written just before it is built (the OpenSpec-only decision).

1. **Part 1, this change: the Reports page, Sales, and Takings and cash-ups.** The Reports page with its figures strip and ready-made report cards (`rp-home`); the Sales report with its periods, comparison in words, graph and table (`rp-sales`, `rp-sales-year`, `rp-sales-empty`, `rp-pick-dates`); Takings and cash-ups, a list of closed days that each open their end-of-day report (`rp-takings`, `rp-day`); "Download as spreadsheet" on each; and "Show graphs in reports" in Your settings › Accessibility (`rp-your-settings`). Read-only: it writes no sale, no money and no stock, and needs no migration on the defaults.
2. **Part 2: the other ready-made reports.** Workshop (`rp-workshop`), Discounts and refunds (`rp-discounts`), Returning customers (`rp-returning`), VAT with the shop's VAT quarter asked once (`rp-vat`, `rp-vat-first`), and Margin and stock value (`rp-margin`). Margin needs each sale line's cost kept at the moment of sale, which no sale record holds today; it is agreed with Mark's step C first (Jack's answer 1); VAT is exact only for till-record sales, since the old record never kept VAT (`server/migrations/083_all_sales_view.sql`).
3. **Part 3: your own reports.** "Change what's shown" with greyed choices and reasons (`rp-change`), the changed report and "Save as my report" (`rp-changed`, `rp-save`, `rp-save-taken`), and Your reports with Rename, Share and Delete with Undo (`rp-report-menu`, `rp-report-deleted`). One migration (saved reports). "Share with managers" waits for Mark's roles (WP-1.1).
4. **Part 4: accounts software, and reopening a closed day.** Settings › Your data › Accounts software behind an adapter with a pretend version (`rp-accounts-connect`, `rp-accounts-map`, `rp-accounts-missing`, `rp-accounts-log`, `rp-accounts-lost`, `rp-accounts-disconnect`), Today's "didn't go to Xero" line (`rp-today-accounts`), the "Sent to Xero" column, the daily figures as a download for shops without accounts software (decision 4, and Your data's design question 5), and Reopen this day with a reason (`rp-reopen`, `rp-takings-reopened`), since reopening corrects what was sent. Money area and a migration. Connecting a real Xero or QuickBooks account is Jack's call and stays out until he says yes.

Left to other packages, whatever part: the "All shops" versions (`rp-home-all`, `rp-sales-all`, `rp-takings-all`, `rp-vat-all`, `rp-workshop-all`) come with the shop switcher (Multiple sites, WP-5.2); Staff with "Can see reports" (`rp-home-staff`, `rp-discounts-staff`, `rp-person`) come with Mark's roles (WP-1.1); the Activity log card with WP-5.4; Cycle to Work's report and figures (`rp-c2w`, `rp-accounts-c2w`) with WP-7.1; the supplier invoice check version of VAT (`rp-vat-check-off`) is later (issue #116 question 6).

### What part 1 does

- **The Reports page** (`rp-home`; decision 1, later changes of 3 Oct: the strip, the shop menu, third walk answers 2 and 3): "Thursday 17 September · North Street Cycles, Bolton", a strip headed "So far: Mon 14 – Thu 17 September" with this week's **Takings** and a link to the shop that opens its Sales report, then "Ready-made reports" with a card for each report that is built: **Sales** ("Takings, number of sales and the average sale") and **Takings and cash-ups** ("Each closed day, and any cash difference"; answer 4). The strip's Margin tile and the other cards wait for the parts that build them (Jack's answers 1 and 2). "Your reports" waits for part 3.
- **Sales** (`rp-sales`, `rp-sales-year`, `rp-sales-empty`, `rp-pick-dates`; decisions 1 and 7, audit M7–M9, M15/M16; walk-through 11 H2): opens on This week; the period choices Today, This week, This month, Last month, Last 12 months and Pick dates; the headline figures Takings, Number of sales and Average sale (the drawing's Refunds waits until step C records refunds with their money, answer 3), each compared in words with the period before ("[Up or down] £[£] on the same days last week"); a graph (bars by day, or a line by month for 12 months, with the period before behind it, a scale and a spoken description) and the table below it with a total row; "So far" for an unfinished period; "Nothing sold yet today" and "Nothing to compare with yet" when there is nothing; the note "Takings include VAT, take refunds off, and count online and Cycle to Work money; today counts so far." Sales are counted from both sales records (the `all_sales` view, step B, #492), placed on the shop's day by when they were made; a deposit paid online counts when the sale it pays towards is made (answer 5). "Change what's shown" is not shown until part 3.
- **Takings and cash-ups** (`rp-takings`, `rp-day`; Cash-up 6, audit H1, M12, M17, L3; walk-through 2 M5; close the day, WP-3.4, #551, #552): opens on This week; headline figures Closed days' takings, Card, Cash, Other, Online and Cash differences; a graph of takings by closed day; the table of closed days, newest first, with today's "Not closed yet" row and each day's online money as its own "Online · Not a till" row; each closed day opens its end-of-day report, exactly as it was saved at the close, with Print and Download as spreadsheet. Closes are one per shop per day today (`day_closes`, `UNIQUE (shop_id, day)`), not one per till as drawn, so there is one row per closed day, without a till (answer 4). "Reopen this day" and "Sent to Xero" wait for part 4.
- **Download as spreadsheet** on each report and on a closed day's report (Jack's 26 Oct answer 4; decision 1): the report's table as it is shown, for the period chosen, as a CSV that opens in Excel or Google Sheets, made with the same spreadsheet helper as Your data's downloads (`server/lib/csv.js`).
- **Show graphs in reports** (`rp-your-settings`; decision 7, audit L4): a switch in Your settings › Accessibility, for the people who can see reports; off hides every report's graph, leaving the table.
- **Owner only.** Reports open for the shop's Owner only until Mark's roles (WP-1.1) exist (as Settings do, `docs/decisions/2026-10-19-owner-only-settings.md`); anyone else gets "Only the shop's owner can see reports". Managers are not built.
- **The old app's Sales History stays** (`public/app.js:2490`; answer 6): a walk-in sale with no customer must stay findable, and Reports shows totals, not single sales.

### Not in this change, and why

- Parts 2, 3 and 4 above, and the screens left to other packages.
- **A list of single sales** (later work, not drawn yet): needed before the old app's Sales History tab can be removed (answer 6). It needs drawing first.
- No new way of recording a sale: nothing here changes how a sale, payment, refund or close is saved. Mark's areas stay untouched: roles (WP-1.1), the settings store and activity log (WP-1.2), sales step C, the till deposit.
- No real accounts software, and no real account of any kind.

## Who and risk

WP-5.3 part 1, Jack's side, built by one builder session. **Not in a risky area on the defaults:** no migration (the graphs switch is one more Your settings switch, kept with the others on the person's login and on to start, as Show the diary legend is: `server/routes/your-settings.js` `DEFAULT_ON`); it reads sales and closes but writes no money or stock; staff routes only, nothing under `/api/portal/*`; no change to `server/server.js` (the route file is listed in `server/routes/index.js`, as every route file is). Four pull requests, listed in `tasks.md`.

## Follows

- Decisions: `docs/decisions/2026-11-10-reports-answers.md` (Jack's answers to this change's questions); `docs/decisions/2026-10-01-reports-and-accounts-review.md` 1, 4, 5, 7 and 8 (audit H1, M1, M7, M8, M9, M12, M15/M16, M17, L3, L4), and its later changes of 3 Oct (the strip; the strip and the shop menu; walk-through 11 H2, "Takings" has one meaning; third walk answers 2 and 3); `docs/decisions/2026-10-03-ux-walkthrough-third-walk.md` 2 and 3; `docs/decisions/2026-10-26-day-answers.md` 4 (downloads with Reports); `docs/decisions/2026-09-29-cash-up-review.md` 6 (the end-of-day report saved to Reports); the close-the-day answers of 27 Oct as built (`openspec/specs/close-the-day/spec.md`: Takings is till money only, online on its own line, a closed day's report never changes); `docs/decisions/2026-10-19-owner-only-settings.md` (Owner only until roles); `docs/decisions/2026-10-18-build-for-every-shop.md`.
- Drawings (`docs/design/user-journeys/generator/reports.mjs`, screen ids in `journeys.mjs` journey j17): `rp-home`, `rp-sales`, `rp-sales-year`, `rp-sales-empty`, `rp-pick-dates`, `rp-takings`, `rp-day`, `rp-your-settings`.
- Built: `openspec/specs/close-the-day` (the closes and their report), `openspec/specs/your-settings` (the Accessibility switches), `openspec/specs/today` (today's takings), the `all_sales` view (`openspec/changes/wp-1-6-sales-in-pence`, step B).

## Capabilities

### New Capabilities
- `reports`: the Reports page, the Sales report, Takings and cash-ups, and their spreadsheet downloads.

### Modified Capabilities
- `your-settings`: adds "Show graphs in reports" to Accessibility.

## Impact

- New: `server/routes/reports.js` (staff routes, Owner only), `server/lib/report-periods.js` (periods and the period before, in the shop's time zone), `src/screens/reports/` (the page, Sales, Takings and cash-ups, the graph).
- Changed: `src/staff/app-shell.tsx` (Reports gets its screen), `src/screens/your-settings/` (the switch), the Your settings route's list of switches, `src/screens/till/close-the-day.tsx` (its end-of-day report shared with Reports, unchanged in look). `public/app.js` is not changed.
- No dependency added: the graph is drawn with plain SVG, as the drawings are.
