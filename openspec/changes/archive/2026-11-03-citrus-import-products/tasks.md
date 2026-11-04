# Tasks

## 1. Server, products and stock (one pull request, `jack/citrus-import-products`)

- [x] 1.1 Tests first: reading Excel and CSV, a file too large when unpacked (`tests/spreadsheet-read.test.js`); recognising a report, sending, refusals, a retried send, products and stock, rows that need a look, barcodes in either order, a restart (`tests/citrus-import.test.js`). Watch each fail
- [x] 1.2 Migration 111, the reader, the recognising, the batches, the routes, the timer
- [x] 1.3 Break each key rule on purpose, see its test go red, and restore
- [x] 1.4 Log choices in Jack's section of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`; self-review against the drawings and this spec
- [x] 1.5 `/opsx:archive` as the last commit
- [x] 1.6 The independent review, 3 Nov: reading in a worker with limits and a straight-through scan; the send replying before the read; the first store ever sent; plain numbers only; left-alone rows and refused stock counted apart; no savepoint per row. Tests first, with the review's made-up files, watched failing, each fix broken on purpose
- [x] 1.7 Migration 111 safe to run again over a database holding customer and bike files
- [x] 1.8 The re-review, 4 Nov: one send at a time per shop; storing without holding the move files; test servers leave waiting files alone unless asked; a worker's failure logged by its code. Tests first, watched failing, each fix broken on purpose
