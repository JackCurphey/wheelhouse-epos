# Tasks

Follows Jack's answers of 10 Nov (`docs/decisions/2026-11-10-your-data-answers.md`), the recommendation on each of 1 to 7; small ones 8 to 14 stand as proposed in `design.md`.

Each pull request: tests first, each watched failing for the right reason (break the code it covers, see it go red, restore, and check the break really landed); `npm run lint`, `npm test` and `npm run test:browser` pass locally after merging main; a self-review against these specs and the drawings (`set-data-export`, `mv-sorted`). No pull request here is in a risky area (no migration, no writes to money or stock, no public route, no `server.js` or messaging). Gaps decided while building go in Jack's section of `docs/decisions/decided-while-building.md`. Server tests pin the clock to 1 Sep 2026. Example names come from the drawings (North Street Cycles, Bolton, Shimano brake pads B05S-RX); unknowns stay `[n]`. Aim: 250-600 changed lines each. PRs 1→2→3 are stacked; 4 needs 1 and 3.

## 1. The route, Customers and Stock (PR 1, about 450 lines)

- [x] 1.1 Tests first (`tests/shop-data-copy.test.js`): `GET /api/settings/your-data/download` as the Owner gives `application/zip` named "North Street Cycles data 2026-09-01.zip" holding "Customers.csv", "Sales and refunds.csv", "Stock.csv" and "Workshop jobs.csv" (the last two header-only for now); a staff sign-in gets 403 "Only the shop's owner can download the shop's data"; nobody signed in gets 401; another shop's customer and product never appear. Customers: one row per customer, with groups, company fields and yes-to-messages with when and where; a deleted and a merged-away customer have no row; a name starting "=" is written as text. Stock: one row per product per site with price, cost, VAT rate, quantity and reorder level; a product not active has no row; money is pounds with two decimals. Verify: each fails for the right reason before 1.2.
- [x] 1.2 `server/shop-data-copy.js` (customers, stock, and the zip's assembly with `csvOf` and `zipFiles`); the route in `server/routes/shop-settings.js` behind `ownerOnly` with its message, and the route-list line. Verify: 1.1 passes.

## 2. Sales and refunds, and Workshop jobs (PR 2, about 550 lines)

- [x] 2.1 Tests first (same file): a till sale of two items gives two rows sharing its date, "B1-0000"-style receipt number, till, who served and total, with VAT per line; an older-record sale has empty VAT and receipt cells, not 0; a collected repair's sale appears once; sales come oldest first, in the shop's time zone; an online deposit refund and a Shopify refund appear as negative rows with "Refund" (answer 4); a deleted customer's sale keeps its row with the name empty. Workshop jobs: one row per job with job number, customer, bike, services, booked-in and due dates, stage words, mechanic, quoted and final amounts, deposit, collected date and staff notes (answer 6). Verify: each fails first.
- [x] 2.2 The two spreadsheets in `server/shop-data-copy.js`, sales through `all_sales` joined to each record's own lines and payments, job amounts from the job page's own figures. Verify: 2.1 passes. Time a shop with [n] sales and note the result in the pull request (design Risks).

## 3. Your data in Settings › Office (PR 3, about 350 lines)

- [x] 3.1 Tests first (`tests/screens/your-data-settings.test.js`, `tests/browser/your-data-settings.spec.ts`): Settings › Office shows Shop and sites, then Your data, Jump to offers both; Your data's intro "Take a copy of everything, and see who changed what in Settings."; the fold Download everything summarised "Customers, sales, stock, jobs", unfolding to the four ticked rows, the note and the button; no Settings changes fold; pressing the button shows "Preparing your download…", disabled and announced, then a file downloads (browser test checks its name); a failed request shows "The download didn’t start." with Try again, which works; `?room=office&fold=download-everything` opens with it unfolded; on a phone the Office room lists Your data. Verify: each fails first.
- [x] 3.2 `src/screens/settings/your-data-settings.tsx`; the Office room's Your data area in `settings-page.tsx` with the drawing's ids in a `// screens: set-data-export` comment. Log the waiting and failure states (small one 8) in `decided-while-building.md`. Verify: 3.1 passes.

## 4. Left out from Citrus Lime, and See them (PR 4, about 300 lines, then the archive)

- [x] 4.1 Tests first (server and screen tests, the move's browser test): with two rows left out, the zip holds "Left out from Citrus Lime.csv" with the file, why, and Citrus Lime's own columns; a row emptied by a customer's deletion is not in it; with none left out there is no fifth file; the fold shows "Left out from Citrus Lime · 2 rows" only while there are any; Everything's sorted shows See them on its Left out line, reads "…are listed under Settings › Office › Your data, to add by hand when you like.", and See them opens Your data with Download everything unfolded; with none left out there is no See them. Verify: each fails first.
- [x] 4.2 The fifth spreadsheet in `server/shop-data-copy.js` and its count in a small `GET /api/settings/your-data` (Owner only); the fold's fifth row; `move-page.tsx`'s Left out line and sentence, its comment updated (See them built; Next: run alongside still waits for WP-8.1). Verify: 4.1 passes.
- [ ] 4.3 `/opsx:archive` as the last commit: `openspec/specs/your-data` made, `settings` and `moving-from-citrus-lime` updated.

## 5. Left for later (not in these pull requests)

- [ ] 5.1 Before the first real shop with years of history: stream and compress the zip instead of holding it whole (design Risks). Not built now.
- [ ] 5.2 When step C records till refunds: add them to "Sales and refunds".
- [ ] 5.3 When WP-1.1 builds roles: replace the Owner-only check with the roles that may see Your data (the drawing shows a Manager).
