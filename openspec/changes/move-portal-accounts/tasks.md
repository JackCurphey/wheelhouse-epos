# Tasks: the booking pages' account and read routes move to server/routes/portal.js

## 1. The move

- [x] 1.1 Moved the 10 routes, the cookie helpers and the sign-in limiters. Checked that all 260 removed non-blank lines are in `portal.js`, apart from the import lists, two section headers and the one comment pointer
- [x] 1.2 Added `tests/portal-routes-file.test.js`. It was written after the move, so it was run against main, where it fails 3 of 3. It passes with the move, along with `route-files-defined`, `route-list` and the screen trace (19 tests)
- [ ] 1.3 `npm test` and `npm run test:browser` pass in CI on the final commit. This Mac has no Postgres
- [ ] 1.4 A fresh review confirms the move is pure

## Workflow follow-up

- Archive as the last commit, then merge once CI is green on it.
