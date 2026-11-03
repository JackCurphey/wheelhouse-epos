# Tasks

## 1. Server, products and stock (one pull request, `jack/citrus-import-products`)

- [ ] 1.1 Tests first: reading Excel and CSV, a file too large when unpacked (`tests/spreadsheet-read.test.js`); recognising a report, sending, refusals, a retried send, products and stock, rows that need a look, barcodes in either order, a restart (`tests/citrus-import.test.js`). Watch each fail
- [ ] 1.2 Migration 111, the reader, the recognising, the batches, the routes, the timer
- [ ] 1.3 Break each key rule on purpose, see its test go red, and restore
- [ ] 1.4 Log choices in Jack's section of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`; self-review against the drawings and this spec
- [ ] 1.5 `/opsx:archive` as the last commit
