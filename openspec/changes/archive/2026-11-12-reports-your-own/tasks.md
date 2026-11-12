Four pull requests, each about 250–600 changed lines, in this order. Before PR 1, take the piece in STATUS's "who is on what" block. PR 4 needs part 2's Workshop report merged. Run only the related test files while building (screen tests need `npm run pretest` first).

## 1. PR 1: Change what's shown and the changed Sales report (not risky)

- [x] 1.1 Tests first, in `tests/report-changed.test.js`: the fit table (each greyed row of design decision 2, with its reason; Margin hidden without `canSeeCosts`, greyed before sale lines keep a cost); Takings by Category adds up to Sales' Takings with a sale-level discount shared in proportion (old and new records); Items sold by Product; Payment type with a Split sale; a line with no product under Labour or its own row; Only with a parent category counting its children; Supplier chips from products sold in the period; a refused combination answers 400 with its reason; Owner only. Verify: each fails first, for the missing module or route.
- [x] 1.2 `server/lib/report-changed.js`: the choices and what fits with what (one table), the rows for Takings, Items sold and (greyed) Margin by Day, Week, Category, Product, Staff member and Payment type, the period before, the title and the line under it.
- [x] 1.3 `GET /api/reports/changed` and `/api/reports/changed.csv` in `server/routes/reports.js`, `ownerOnly` first, `// screens: rp-change, rp-changed`.
- [x] 1.4 Screen tests first (`tests/screens/reports-change.test.tsx`): the panel opens from Sales on Takings by Day and from Takings and cash-ups on Takings by Payment type; greyed chips are `aria-disabled` with their reason; "Show report" goes to the changed report with its title, line, graph, table and total row; "Back to Sales"; Download. Verify: each fails first.
- [x] 1.5 `change-panel.tsx` and `changed-report.tsx` (at `/reports/changed?…`), and the button on `sales-report.tsx` and `takings-report.tsx`, to the drawings `rp-change` and `rp-changed`. "Save as my report" is in PR 2; until then the bar shows only "Back to Sales".
- [x] 1.6 Measure a Last 12 months changed report on a shop-sized test set; write the time in the pull request. If it is slow, say so and stop before adding an index (that would be a migration).
- [x] 1.7 Log the undrawn wording (design decision 2's default reasons, "No product") in this month's `docs/decisions/decided-while-building/` file.
- [x] 1.8 `reviewer` agent self-review; lint and the related tests.

## 2. PR 2: Saving a report and Your reports (risky: migration)

- [x] 2.1 Tests first, in `tests/saved-reports.test.js`: the migration runs twice and from empty; one person's reports are invisible to another (404); the same name twice for one person is refused with "You already have a report with this name. Choose another name.", and allowed for two people, and allowed again after a delete; an empty name says "Type its name"; a name over 80 characters is refused; `shared: true` is refused; a saved report keeps the kind of period, not dates; Owner only; shop isolation. Verify: each fails first.
- [x] 2.2 The migration: `saved_reports`, its unique name index where not deleted, row-level security, as design decision 7. Additive, safe to run twice. Test it from empty on a scratch database.
- [x] 2.3 `server/lib/saved-reports.js` and `GET` and `POST /api/reports/saved`, `// screens: rp-save, rp-save-taken, rp-home`.
- [x] 2.4 Screen tests first: the save popup ("Name (needed)", "Just me" chosen, "Me and the other managers" greyed with its reason, the note, both name messages); Your reports on the Reports page with the badge "Just you", the note when there are none, and opening one on the latest period (one saved on This week opened a week later shows the new week). Verify: each fails first.
- [x] 2.5 `save-report-dialog.tsx`, `your-reports.tsx` (list only; the menu is PR 3), "Save as my report" on the changed report's bar, to the drawings `rp-save`, `rp-save-taken` and `rp-home`.
- [x] 2.6 `/review`, the `risky-area-reviewer` agent, `reviewer`; lint and the related tests; a hand-run CI on the branch (`gh workflow run test.yml --ref <branch>`), merged when green; a line in the weekly digest issue. (Done in #727: an Opus general-purpose review stood in for `risky-area-reviewer`, which is not an agent in this setup; no weekly digest issue was open, so the line is in the pull request.)

## 3. PR 3: Rename, sharing greyed, and delete with Undo (not risky)

- [x] 3.1 Tests first: `PATCH` renames with both name messages; `DELETE` sets `deleted_at` and the report leaves the list; `POST …/undo` puts it back, and refuses with the name message when the name was used again; another person's report answers 404 for each. Verify: each fails first.
- [x] 3.2 The three routes in `server/routes/reports.js` and `server/lib/saved-reports.js`.
- [x] 3.3 Screen tests first: the "More for [name]" menu (`aria-haspopup="menu"`) with Rename, Share with managers (greyed with its reason) and Delete; Rename's popup; Delete shows "'[Report name]' deleted." with Undo, and Undo brings it back; Undo after a reused name opens Rename. Verify: each fails first.
- [x] 3.4 The menu, Rename and the deleted bar, to the drawings `rp-report-menu` and `rp-report-deleted`. Log the Rename popup in `decided-while-building`.
- [x] 3.5 `reviewer` self-review; lint and the related tests.

## 4. PR 4: Workshop's Change what's shown, and Margin if it's ready (not risky)

- [x] 4.1 Tests first: from Workshop, Jobs (finished, as part 2 counts them) and Hours (as part 2's "How full each mechanic was") by Day, Week, Staff member (the mechanic) and Service; Only lists service categories and there is no Supplier; Items sold and Margin greyed with their reason; a saved Workshop report opens on the latest period. If part 2's PR 5 has merged: Margin by Category and Product from kept costs only, lines without a cost left out and counted, for the Owner only. Verify: each fails first.
- [x] 4.2 Add the Workshop measures and the Service split to `server/lib/report-changed.js`; the button on `workshop-report.tsx`.
- [x] 4.3 If part 2's PR 5 has merged, light up Margin; if not, leave it greyed and note in STATUS that Margin's measure waits for it.
- [x] 4.4 Log Service as a split in `decided-while-building`.
- [x] 4.5 `reviewer` self-review; lint and the related tests.

## 5. Finish

- [x] 5.1 Walk each drawing (`rp-change`, `rp-changed`, `rp-save`, `rp-save-taken`, `rp-report-menu`, `rp-report-deleted`, and Your reports on `rp-home`) against the built screens, and this change's requirements one by one; say in the last pull request which are met, dropped or changed.
- [x] 5.2 `npm run full-check` (lint, `npm test` and `npm run test:browser`) passes on the final commit after merging the latest main.
- [x] 5.3 `/opsx:archive` as the last commit in the last pull request, before it merges.
