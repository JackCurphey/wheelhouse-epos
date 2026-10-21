# Remove the old app's job form

## Why
Since #342 (20 Oct) an order's "View / edit workshop job" and "Show in workshop diary" open the new diary, so nothing opens the old app's workshop job form any more. Project rule 5 (CLAUDE.md) lets an old-app screen go once its replacement has merged; the order-job-link change said removing the form's code would be its own pull request.

Work package: none of its own; the tail of the order-job-link change (`openspec/changes/archive/2026-10-20-order-job-link/`). Jack's lane (the old app's screens). Decisions it follows: `docs/decisions/2026-10-18-retire-old-diary.md` and Jack's 20 Oct answer recorded in the order-job-link proposal. No drawing: this removes a screen and draws nothing new.

## What changes
- `public/app.js`: the job form (`renderWorkshopJobFormModal`), its `'workshop-job-form'` line in the pop-up switch, and what only it used: `saveRefusalText`, the old status lists `JOB_STATUS_OPTIONS` and `JOB_STATUS_SELECT_OPTIONS`, the `mechanics` list and `loadMechanics` (already called by nothing).
- `public/styles.css`: the form's own styles (`.job-modal`, the `.wj-…` classes, `.attachment-list` and `.attachment-row`).
- The diary spec drops the old form's save-refusal requirement, and its order-job scenario now says the new diary opens.

## Out of scope
- Unticking "Show in workshop diary" on an order, which deletes the linked job: it stays in the old app until the order screen is rebuilt.
- The server: the old app's save path and its statuses (`workshop-jobs` spec, and the diary requirement on how an old-app save keeps a change request) are Mark's lane and stay as they are; the server still accepts that save.
- Old-app functions that were already unused before this change (`errorMessage`, `fmtTime`, `toDateStr`, `viewedSale`).

## Impact
`public/app.js`, `public/styles.css`, `openspec/specs/workshop-diary/spec.md`. No server change, no database change. The browser tests for the old form's last opener already went with #342.
