# Tasks

## 1. Tests first, each watched failing

- [x] 1.1 `tests/migration-114.test.js`: from empty and onto a populated database, awkward values exact against an independent reading of the pounds, run twice, each shop kept to its own, old writers followed, pence can't be written directly.
- [x] 1.2 `tests/products-in-pence.test.js`: adding and saving in pence, refusals storing nothing, pence over pounds, the till's snapshot over an `INTEGER`, adjustment and stock take values, a held row answers busy within a time limit, `penceToPounds` across a sweep.
- [x] 1.3 `tests/product-costs-hidden.test.js`: its check for a cost also looks for the figure in pence, for everyone in its list; a cost in pence can't be changed by someone who can't see costs.
- [x] 1.4 `tests/stock-margin.test.js`, screen fixtures, `tests/check-money-totals.test.js`.

## 2. Build

- [x] 2.1 Migration 114.
- [x] 2.2 `server/lib/pence.js`; `serializeProduct`; `POST` and `PUT /api/products` with the lock limit.
- [x] 2.3 Snapshot, stock take differences, adjustment value, delivery lines read pence.
- [x] 2.4 Screens read pence; `check-money-totals` covers products.

## 3. Check

- [x] 3.1 Each rule broken on purpose, then restored.
- [x] 3.2 Migration from empty on a scratch database and on a populated one; `check-money-totals` on both.
- [x] 3.3 Large made-up table: the lock measured, plans for the list and a product checked.
- [x] 3.3a The independent review's fixes: a count's cost widened; a price's limit on every writer; the 2 seconds, a timed-out save's rollback and sorting by price each pinned and seen red; the margin claim corrected.
- [x] 3.4 `npm test`, `npm run test:browser`, consolidate tests, `npm run lint`, typecheck and check-migrations on the head after merging latest main; a fresh review; archive as the last commit.
