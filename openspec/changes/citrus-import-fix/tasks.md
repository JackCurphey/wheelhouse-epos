# Tasks

## 1. The server: Fix and Leave it out (`jack/citrus-import-fix`, on main)

- [x] 1.1 Tests first (`tests/citrus-import-fix.test.js`): the list, each report's fix, still doesn't fit, request keys, counts, a row changed by a batch, too long a wait, who and check-in, bikes and barcodes joining. Watch each fail, with time limits on every wait
- [x] 1.2 Migration 113, tested from empty on a scratch database and run twice
- [x] 1.3 `server/move/fix-row.js`, the appliers' `decided`, `settle`, `forgetForMove`, the routes
- [x] 1.4 Break each rule on purpose, see its test go red for the right reason, restore

## 2. The rules' tests and the help inbox (`jack/citrus-import-fix-rules`, on 1)

- [x] 2.1 Tests first (`tests/citrus-import-fix-rules.test.js`): the tick rules, account number always left out, row gone or changed by a deletion, a fix and a deletion at the same moment, left-out rows at a deletion. Tests first (`tests/citrus-import-help.test.js`): recorded once, nothing from the rows, a failed send kept
- [x] 2.2 `server/move/help-inbox.js` with its pretend version, and the route
- [x] 2.3 Break each rule on purpose, see its test go red, restore

## 3. The rows' screens (`jack/citrus-import-fix-screens`, on 2)

- [x] 3.1 Tests first (`tests/screens/move-fix.test.js`). Watch each fail
- [x] 3.2 Look at the [n], the list, the pop-up, Leave it out, Everything's sorted
- [x] 3.3 Break each rule on purpose, see its test go red, restore
- [x] 3.4 Log choices in Jack's section of `decided-while-building.md`; self-review against the drawings and this spec

## 4. Ask us to help's screens (`jack/citrus-import-help-screens`, on 3)

- [x] 4.1 Tests first (`tests/screens/move-help.test.js`, and `tests/browser/move-fix.spec.ts` for all of it, computer and phone widths). Watch each fail
- [x] 4.2 Ask us to help on each card, the form, the thanks
- [x] 4.3 Break each rule on purpose, see its test go red, restore
- [x] 4.4 Lint, `npm test`, `npm run test:browser`, consolidate check, check-migrations, after merging latest main
- [x] 4.5 `/opsx:archive` as the last commit of the top pull request
