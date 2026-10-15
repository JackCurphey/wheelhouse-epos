# Tasks: customers, their groups and bikes move to server/routes/customers.js

## 1. The move

- [x] 1.1 Moved the 15 routes and their helpers. Checked that all 271 removed non-blank lines are in `customers.js`, apart from two import lines
- [x] 1.2 Added `tests/customers-routes-file.test.js`. It fails 3 of 3 before the move and passes after, along with `route-files-defined`, `route-list` and the screen trace (19 tests)
- [ ] 1.3 `npm test` and `npm run test:browser` pass in CI on the final commit. This Mac has no Postgres
- [ ] 1.4 A fresh review confirms the move is pure

## Workflow follow-up

- Archive as the last commit, then merge once CI is green and #211 is in.
