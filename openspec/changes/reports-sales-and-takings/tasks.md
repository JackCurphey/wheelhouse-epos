# Tasks

Follows Jack's answers of 10 Nov (`docs/decisions/2026-11-10-reports-answers.md`); the small ones 7 to 12 are as `design.md` lists them.

Each pull request: tests first, each watched failing for the right reason (break the code it covers, see it go red, restore, and check the break really landed); `npm run lint`, `npm test` and `npm run test:browser` pass locally after merging main; a self-review against these specs and the drawings (`reports.mjs`). None is in a risky area on the defaults (no migration; reads sales and closes, writes no money or stock; staff routes only). Every gap decided while building goes in Jack's section of `docs/decisions/decided-while-building.md`. Server tests pin the clock to 1 Sep 2026 (`WHEELHOUSE_TEST_CLOCK`), so example weeks are on or after it; compare DOM query results with `assert.ok(x === null)`. Aim: 250-600 changed lines each. Pull requests 1→2 and 1→3 are stacked; 4 needs 2 and 3.

## 1. Periods and Sales on the server (PR 1, about 450 lines)

- [ ] 1.1 Tests first (`tests/report-periods.test.js`): `periodFor` for This week on a Thursday (Mon to Thu "So far", Fri to Sun not reached, the same days last week before it), on a Monday, and on a Sunday; Today (against the same weekday last week); This month so far and Last month (against the same days last month, and the month before); Last 12 months (12 months, against the 12 before); picked dates (against the same number of days just before); To before From and a day after today refused; a week that crosses a month and a year; British Summer Time ending inside the week. Verify: each fails for the right reason before 1.2.
- [ ] 1.2 `server/lib/report-periods.js`. Verify: 1.1 passes.
- [ ] 1.3 Tests first (`tests/reports-sales.test.js`): `GET /api/reports/sales` counts an old-record sale and a till sale once each, on the shop's day; an offline till sale on its own clock's day; a sale at 23:30 shop time on the right day; Takings, Number of sales and Average sale (rounded to the penny) and each compared with the period before; the table's rows and total equal the headline figures; a period with no sales and a shop with nothing before it say so (`empty`, `nothingBefore` with the first sale's date); another shop's sales never count; Staff are refused with "Only the shop's owner can see reports" (403) and signed out with 401. `GET /api/reports/home` gives this week's Takings and the strip's heading. Verify: each fails first.
- [ ] 1.4 `server/routes/reports.js` (home and sales, `// screens: rp-home, rp-sales, rp-sales-year, rp-sales-empty, rp-pick-dates`), listed in `server/routes/index.js` and the route list. Verify: 1.3 passes.

## 2. The Reports page and Sales screens (PR 2, about 550 lines)

- [ ] 2.1 Tests first (`tests/screens/reports-home.test.js`, `tests/screens/reports-sales.test.js`, `tests/browser/reports.spec.ts`): Reports in the Owner's sidebar opens the page with "Thursday 17 September · North Street Cycles, Bolton" (on the test week), the strip "So far: Mon 14 – Thu 17 September" with Takings and the shop's link to Sales, and the two cards; Sales opens on This week with its heading, the three figures compared in words, the graph's spoken description and the table with "So far"; each period choice; Pick dates with Cancel, Show report and a wrong-way-round range refused beside the field; "Nothing sold yet today" and "Nothing to compare with yet"; "All reports" goes back; Staff don't see Reports in the sidebar; on a phone the period chips wrap and the table's headings wrap. Verify: each fails first.
- [ ] 2.2 `src/screens/reports/reports-page.tsx`, `sales-report.tsx`, `report-graph.tsx` (plain SVG bars and line, scale, key, "Not yet", spoken description), `pick-dates.tsx`; `app-shell.tsx`'s `SCREENS` gets `reports`. The graph for Today, This month and Pick dates and the comparisons follow Jack's answers 7 and 8. Verify: 2.1 passes.

## 3. Takings and cash-ups (PR 3, about 500 lines)

- [ ] 3.1 Tests first (`tests/reports-takings.test.js`): `GET /api/reports/takings` lists this week's closes newest first with takings, cash banked, difference and who closed each, and today "Not closed yet"; each day's online money as its own row; the headline figures add up the closes (Closed days' takings, Card, Cash, Other, Online, Cash differences) and compare with the same days last week; a sale saved after a close changes nothing in that close's figures; `GET /api/reports/days/:id` gives the close as saved, and 404 for another shop's close; Staff refused. Verify: each fails first.
- [ ] 3.2 The takings and day routes in `server/routes/reports.js` (`// screens: rp-takings, rp-day`). Verify: 3.1 passes.
- [ ] 3.3 Tests first (`tests/screens/reports-takings.test.js`, the close-the-day screen tests unchanged, `tests/browser/reports.spec.ts`): Takings and cash-ups shows the figures, the graph by closed day, the table with a short day's difference marked in words and colour, the Online rows and the two notes as drawn; a closed day's row opens "Wed 16 September" (the day), "Closed by Jo Taylor at [time]", the saved figures and the online line, with Print; Close the day's own end-of-day report looks as before. Verify: each fails first.
- [ ] 3.4 `src/screens/reports/takings-report.tsx`; the end-of-day report's body moved out of `src/screens/till/close-the-day.tsx` into a shared component used by both. One row per closed day, without a till (Jack's answer 4). Verify: 3.3 passes.

## 4. Downloads and Show graphs (PR 4, about 350 lines)

- [ ] 4.1 Tests first (`tests/reports-downloads.test.js`): `sales.csv`, `takings.csv` and `days/:id.csv` give the same header, rows and total as the JSON the screen shows, amounts as pounds and pence, a £ sign intact (the UTF-8 mark), a name starting with "=" as text, and the file name `<report>-<shop-slug>-<from>-to-<to>.csv`; Staff refused. Your settings: `showGraphs` is known, on to start, saved per login, and refused when not true or false. Verify: each fails first.
- [ ] 4.2 The `.csv` routes in `server/routes/reports.js` through `server/lib/csv.js`; `showGraphs` in `server/routes/your-settings.js` (`SWITCHES` and `DEFAULT_ON`). Verify: 4.1 passes.
- [ ] 4.3 Tests first (screen and browser tests): "Download as spreadsheet" beside each report's title ("Download" on a phone) and on a closed day's report downloads the file; Your settings › Accessibility shows "Show graphs in reports" to the Owner and not to Staff; off hides every report's graph and leaves the table. Verify: each fails first.
- [ ] 4.4 The buttons; the switch in `src/screens/your-settings/your-settings-page.tsx`. The old app's Sales History tab is left as it is (Jack's answer 6). Verify: 4.3 passes.

## 5. Finish

- [ ] 5.1 Walk the built screens against `rp-home`, `rp-sales`, `rp-sales-year`, `rp-sales-empty`, `rp-pick-dates`, `rp-takings`, `rp-day` and `rp-your-settings` on desktop, tablet and phone, and against each requirement in `specs/`; list what was met, dropped or changed.
- [ ] 5.2 `npm run lint`, `npm test` and `npm run test:browser` pass locally on the final commit after merging main; a fresh self-review of the whole diff.
- [ ] 5.3 `/opsx:archive` as the last commit of PR 4, so `openspec/specs/reports` and `openspec/specs/your-settings` describe what was built.
