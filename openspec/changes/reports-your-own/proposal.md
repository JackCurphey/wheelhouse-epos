WP: WP-5.3

## Why

Part 1 of Reports and accounts (`openspec/changes/archive/2026-11-11-reports-sales-and-takings`) gives the Reports page, Sales, and Takings and cash-ups; part 2 (`openspec/changes/reports-ready-made`) adds Workshop, Returning customers, VAT, and Margin and stock value. Part 1's proposal split WP-5.3 into four parts; this change is **part 3: your own reports**. It is written one piece ahead of building, as Jack chose on 9 Nov, so its questions can be answered first. **It is not built yet.** Jack answered its questions on 11 Nov (`docs/decisions/2026-11-11-reports-part-3-answers.md`), each as recommended; a builder session builds from it.

Jack decided on 1 Oct that the shop gets ready-made reports **and** its own (Reports and accounts decision 1): "Start from any report, choose 'Change what's shown', then 'Save as my report'" (decision 2), with every report except VAT having "Change what's shown", and the graph following what's chosen (decision 7). Today no report has the button, and nothing can be saved.

## What Changes

- **Change what's shown** (`rp-change`; decision 2, audit M1, M3): a button on Sales, Takings and cash-ups, and Workshop opens one popup, "Change what's shown", with three groups of chips in the one chip look: **Measure** (Takings, Items sold, Margin, Jobs, Hours), **Split by** (Day, Week, Category, Product, Staff member, Shop, Payment type), and **Only** (categories, pick one or more, and a Supplier, "Any supplier" or one). A choice that doesn't fit what else is chosen is **greyed with its reason** written under its group, as drawn ("workshop only — choose it from the Workshop report"; "payments aren't split by item"). Margin shows only to someone who can see costs (audit M2), and is greyed until part 2 keeps each sale line's cost. Shop is greyed while the shop has one site ("one shop until a second one is added"), until the shop switcher (WP-5.2).
- **The changed report** (`rp-changed`; decision 8 "the changed report's own title and Save banner"): "Show report" opens the report with its own title (like "Sales: items sold by product"), a line saying what it was changed from and what it is limited to, the period chips, a graph of what's chosen (decision 7), and a table with a total row, as drawn, with "Download as spreadsheet" made as part 1's. A bar says "You've changed this report. Save it to come back to it." with **Save as my report** and **Back to Sales**.
- **Save as my report** (`rp-save`, `rp-save-taken`; decision 2, audit M5): a popup with **Name (needed)** and **Who can see it** ("Just me" to start, as M5 says), and the note "It opens on the latest period each time, under 'Your reports'." A name already used by the same person says "You already have a report with this name. Choose another name."; a missing name says "Type its name", the app's own words for a missing name.
- **Your reports** on the Reports page (`rp-home`; decision 2): each saved report with its name, what it is ("Sales: items sold by product · Accessories only"), who can see it ("Just you"), and a "More for [name]" menu. Opening one shows the changed report on the latest period of its kind.
- **The saved report's menu** (`rp-report-menu`, `rp-report-deleted`; audit M6): **Rename**, **Share with managers** and **Delete**. Delete takes the report away at once with "'[Report name]' deleted." and **Undo**, which puts it back as it was.
- **Sharing waits for managers.** Mark's roles (WP-1.1) bring managers; until then Reports is Owner only (part 1's answer 1), so there is no one to share with. "Me and the other managers" and "Share with managers" are shown greyed with their reason until roles exist **(answer 4)**. The saved report keeps who can see it from the start, so nothing needs changing when roles land.
- **One migration** (risky area 1): a table of saved reports, one row per report, belonging to the person (their login) and the shop, keeping the report it started from, the choices, the name, who can see it, and when it was deleted.

### Not in this change, and why

- **Sharing with managers, and seeing reports shared by someone else** (`mine(…, 'Shared by Jack Lewis', false)` on the staff view, `rp-home-staff`): wait for Mark's roles (WP-1.1).
- **Shop as a split, and "All shops"**: wait for the shop switcher (WP-5.2).
- **Margin as a measure, working**: needs part 2's PR 5 (each sale line keeps its cost, Mark's yes first). Until it lands Margin is greyed with its reason; it lights up in this change's last pull request if PR 5 has merged by then, or in a small follow-up if not.
- **Change what's shown on Returning customers, and on Margin and stock value**: the drawn panel's measures and splits don't fit either report; they come once their own choices are designed **(answer 1)**. VAT never has it (drawing: `change: false`).
- **Discounts and refunds**: not built until WP-3.1 (part 2's answer 2).
- **The accounts software link**: part 4.
- No change to how a sale, payment, refund or stock is recorded.

## Who and risk

WP-5.3 part 3, Jack's side, built by one builder session after part 2's Workshop report is merged (Workshop's own Change what's shown needs it). **One pull request is in a risky area**: PR 2 adds a **migration** (the saved reports table), so it needs `/review`, the `risky-area-reviewer` agent, a hand-run CI (`gh workflow run test.yml --ref <branch>`) and a line in the weekly digest. The other pull requests read sales and jobs on staff routes, as part 1's and part 2's reports do, or change only the saved reports table; they are not in a risky area. No change to `server/server.js` (the routes go in `server/routes/reports.js`, which is already mounted) or anything under `/api/portal/*`. Because it holds a migration, this change is the full version (proposal, specs, design and tasks), not a small piece.

## Follows

- Decisions: `docs/decisions/2026-11-11-reports-part-3-answers.md` (answers 1 to 5); `docs/decisions/2026-10-01-reports-and-accounts-review.md` decisions 1, 2, 5, 7 and 8 (audit M1, M2, M3, M5, M6, and "the changed report's own title and Save banner"), and walk-through 3 M10 (Stockroom categories for margin); `docs/decisions/2026-11-10-reports-answers.md` answers 1 and 2 (Owner only until roles; only built reports get a card); `docs/decisions/2026-11-11-reports-part-2-answers.md` answer 1 (margin from each sale line's kept cost); `docs/decisions/2026-10-18-build-for-every-shop.md`.
- Drawings (`docs/design/user-journeys/generator/reports.mjs`, screen ids in `journeys.mjs`, journey j17): `rp-change`, `rp-changed`, `rp-save`, `rp-save-taken`, `rp-report-menu`, `rp-report-deleted`, and the Your reports box on `rp-home`.
- Built on: part 1 (`openspec/specs/reports`: the route file, the periods helper, the graph, the downloads, Your settings' "Show graphs") and part 2 (`openspec/changes/reports-ready-made`: Workshop, and each sale line's cost for Margin); `openspec/specs/stock` (the Stockroom categories).

## Capabilities

### New Capabilities
- None. The `reports` capability exists; this change adds to it.

### Modified Capabilities
- `reports`: adds Change what's shown, the changed report, Save as my report, Your reports, and the saved report's menu.

## Impact

- New: `server/lib/report-changed.js` (the choices, what fits with what, and the rows for a changed report, shared by the screen and the CSV); `server/lib/saved-reports.js`; a migration for the saved reports table; `src/screens/reports/change-panel.tsx`, `changed-report.tsx`, `save-report-dialog.tsx`, `your-reports.tsx`.
- Changed: `server/routes/reports.js` (the changed report and its `.csv`, and the saved reports routes); `src/screens/reports/sales-report.tsx`, `takings-report.tsx` and part 2's `workshop-report.tsx` (the button); `src/screens/reports/reports-page.tsx` (Your reports).
- No dependency added. `public/app.js` is not changed.
