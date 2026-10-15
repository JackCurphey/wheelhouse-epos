# Tasks: employees join the team routes, and the dashboard gets its own file

## 1. The move

- [x] 1.1 Moved the employee routes and `serializeEmployee` to `team.js`, and the dashboard to `dashboard.js`. Checked that all 87 removed non-blank lines are in their new homes, apart from four import lines
- [x] 1.2 Added `tests/employees-dashboard-routes.test.js`. It fails 3 of 3 before the move and passes after, along with `route-files-defined`, `route-list`, the screen trace and the sales guard (22 tests)
- [ ] 1.3 `npm test` and `npm run test:browser` pass in CI on the final commit. This Mac has no Postgres
- [ ] 1.4 A fresh review confirms the move is pure

## Workflow follow-up

- Archive as the last commit, then merge once CI is green and #213 is in.
