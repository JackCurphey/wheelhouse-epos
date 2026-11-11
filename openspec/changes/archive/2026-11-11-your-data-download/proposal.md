# Proposal: Your data › Download everything

**Not built. Written 10 Nov, one piece ahead (Jack, 9 Nov).** Jack answered its seven questions on 10 Nov (`docs/decisions/2026-11-10-your-data-answers.md`), choosing the recommendation each time; they are folded in here, in the specs and in the tasks. The small ones (8 to 14) stand as proposed.

## Why

A shop's data is its own: the drawings promise "Spreadsheets that open in Excel or Google Sheets — yours to keep, whatever happens" (`set-data-export`, `setup.mjs:465`, programme rule 5). Nothing in Wheelhouse gives a shop that copy yet. Jack decided on 25 Oct that "Download everything" waits until all four lists can be made, then comes as one zip of spreadsheets (`docs/decisions/2026-10-25-morning-questions.md`, answer 10), and kept that on 26 Oct (`docs/decisions/2026-10-26-day-answers.md`, answer 4). Customers, sales (both records, `all_sales`, migration 083), stock (per shop, migration 117) and workshop jobs now all exist, so it can be made.

The Citrus Lime import also needs it: "Everything's sorted" says the rows a shop left out "are kept, and will be listed under Settings › Office › Your data", and its See them link stays hidden until that page is built (`docs/decisions/2026-11-04-answers.md`, answer 1; `src/screens/moving/move-page.tsx:288`).

## Work package, who, risky areas

- **WP-5.1** (Owner setup, the rooms): the `set-data-export` screen (build plan line 726).
- **WP-2.4** (Citrus Lime import, first half): See them on `mv-sorted`.
- **WP-1.11** (Small shared parts): its "spreadsheet download" line, in part.
- **Taken by:** Jack's lane (to be entered in STATUS's "Jack is on" block by whoever builds it).
- **Risky areas:** none of the four. It reads sales and stock but writes neither (not "money and stock" writes); it adds a staff route, not a public one; no migration; no change to `server/server.js` or messaging. Downloads are not recorded until the activity log exists (answer 7), so there is no migration.

## What Changes

- **Settings › Office gets its Your data area** (`settings-frame.mjs:54`, `SETTINGS_ROOMS` `['shop', 'staff', 'data']`), after Shop and sites, with the drawn intro "Take a copy of everything, and see who changed what in Settings." and one fold, **Download everything**, summary "Customers, sales, stock, jobs".
- **The fold shows the four drawn rows** (Customers, Sales and refunds, Stock, Workshop jobs, each with a tick), the drawn note, and the **Download everything** button (`setup.mjs:463-465`). All four always come; the ticks only show what is included (answer 2).
- **Pressing it downloads one zip of spreadsheets** (CSV, UTF-8, Excel-safe, the existing `csvOf` and `zipFiles`), named after the shop and the day.
- **Owner only** until roles exist (`docs/decisions/2026-10-19-owner-only-settings.md`; the `ownerOnly` check). The drawing shows a Manager; WP-1.1 opens it to the roles that may see it.
- **What each spreadsheet holds** (columns in `design.md`): Customers (every customer not deleted, their details and their yes to messages); Sales and refunds (every sale from both records, one row per item sold (answer 3), and the refunds that exist today, online deposits and Shopify orders (answer 4)); Stock (every product with its price, cost and quantity at each shop); Workshop jobs (every job with its customer, bike, dates, stage and amounts).
- **See them on Everything's sorted comes back** and opens Settings › Office › Your data. The left-out rows come as a fifth spreadsheet, "Left out from Citrus Lime", in the same zip, with a line in the fold saying how many there are (answer 1).
- Gaps decided while building go in Jack's section of `docs/decisions/decided-while-building.md`.

## Drawings and decisions followed

- Drawings: `set-data-export` (`docs/design/user-journeys/generator/setup.mjs:462-470`, `settings-frame.mjs:54, 247-250`; `journeys.mjs:645`; outside link `mockup/links/j08.mjs:142`); `mv-sorted` and its See them (`moving.mjs:126-128`, `mockup/links/j09.mjs:45-46`); links to Your data from `j17.mjs:48`, `j19.mjs:14`.
- Decisions: `2026-10-25-morning-questions.md` answer 10 (one zip, all four); `2026-10-26-day-answers.md` answer 4 (per-report downloads come with Reports, not here); `2026-11-04-answers.md` answer 1 (See them waits for this page); `2026-10-19-owner-only-settings.md`; `2026-10-30-answers.md` answer 1 (staff notes left out of a *customer's* copy; the shop's own copy includes them, answer 6); `docs/decisions/2026-11-10-your-data-answers.md`.
- Audit, not a decision: `docs/design/user-journeys/setup-ui-audit.md` M18 (ticks that look like choices; no states for a big download; fold and button share a name). Jack kept the drawing (answer 2); the waiting and failure states are small one 8.

## Out of scope

- **Settings changes** (`set-data-history`): an activity list that waits on Mark's settings store and activity log (WP-1.2). Its fold is not shown until then.
- **Download as spreadsheet on each report** (Sales, Takings, VAT, Workshop): with Reports in slice D (day answers 4).
- **Accounts software** (Connect Xero / QuickBooks, `rp-accounts-connect`, `reports.mjs:345`) and the daily figures its note says are "in Download everything" (left out until Reports and accounts software, answer 5).
- **Lightspeed shops' Your data** (Customers, jobs and Activity, `settings-frame.mjs:249`): with the Lightspeed version, after the all-in-one (18 Oct).
- **Staff and roles** in the Office room (WP-1.1, Mark), the till's sales step C, the till deposit.
- Bringing a left-out Citrus Lime row back in from Your data (the drawing says "to add by hand").

## Capabilities

### New Capabilities
- `your-data`: the shop's own copy of its data from Settings › Office › Your data — what the download holds, who may take it, and how it arrives.

### Modified Capabilities
- `moving-from-citrus-lime`: "Everything's sorted" shows See them again, opening Your data, and says where the left-out rows are.
- `settings`: the Office room gains its Your data area.

## Impact

- Server: a new `server/shop-data-copy.js` (the spreadsheets) beside `server/customer-data-copy.js`; one route, `GET /api/settings/your-data/download` (Owner only), in `server/routes/shop-settings.js`. Reuses `server/lib/csv.js`, `server/lib/zip.js`, `server/lib/owner-only.js`, the `all_sales` view.
- Screens: `src/screens/settings/settings-page.tsx` (Office room), a new `your-data-settings.tsx`; `src/screens/moving/move-page.tsx` (See them and its sentence).
- No dependency, no migration.
