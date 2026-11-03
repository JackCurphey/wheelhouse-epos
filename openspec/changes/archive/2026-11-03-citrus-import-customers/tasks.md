# Tasks

## 1. Customers and bikes (one pull request, `jack/citrus-import-customers`, on `jack/citrus-import-screens`)

- [x] 1.1 Tests first: customers and consent, the same person, sent twice, bikes matched each way and in either order, a deleted customer, rows forgotten on deletion (`tests/citrus-import-customers.test.js`); the page's Customers row (`tests/screens/move-page.test.js`). Watch each fail
- [x] 1.2 Migration 112, recognising, the rows, the forgetting, the page
- [x] 1.3 Break each key rule on purpose, see its test go red, and restore
- [x] 1.4 Log choices in Jack's section of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`; self-review against the drawings and this spec
- [x] 1.5 `/opsx:archive` as the last commit
