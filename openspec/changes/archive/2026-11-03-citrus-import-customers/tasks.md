# Tasks

## 1. Customers and bikes (one pull request, `jack/citrus-import-customers`, on `jack/citrus-import-screens`)

- [x] 1.1 Tests first: customers and consent, the same person, sent twice, bikes matched each way and in either order, a deleted customer, rows forgotten on deletion (`tests/citrus-import-customers.test.js`); the page's Customers row (`tests/screens/move-page.test.js`). Watch each fail
- [x] 1.2 Migration 112, recognising, the rows, the forgetting, the page
- [x] 1.3 Break each key rule on purpose, see its test go red, and restore
- [x] 1.4 Log choices in Jack's section of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`; self-review against the drawings and this spec
- [x] 1.5 `/opsx:archive` as the last commit
- [x] 1.6 The independent review, 3 Nov, and Jack's answers: one-way codes of a deleted person; the consent date; no account number; a bike's owner; ids in waiting rows; phones; counts; the deletion's lock order; bikes resent. Tests first, watched failing, each fix broken on purpose
- [x] 1.7 The re-review, 4 Nov, and Jack's answer 3: only an account number is skipped; only contact details need a look; a deletion during a large store; the codes' comment. Tests first, watched failing, each fix broken on purpose
- [x] 1.8 A failed clean-up no longer leaves the test's server running; the timer's reach is in `citrus-import-products`, design 19
