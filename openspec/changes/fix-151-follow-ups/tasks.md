# Tasks: two follow-ups from Jack's review of #151 and #156

## 1. Scripts run through a symlink

- [x] 1.1 Wrote `tests/scripts-run-through-symlink.test.js` first. Watched both cases fail with "expected the usage error, got exit 0"
- [x] 1.2 Compared real paths in both scripts, and dropped the import `new-db.mjs` no longer uses. Verified the new test and `migration-checks` pass (14 tests)

## 2. The purchase-order edit route's bad lines

- [x] 2.1 Added the edit-route case to `tests/purchase-orders-validation.test.js`. It failed in CI against a deliberate break, the edit route's `ValidationError` check removed (run 38735535589: "500 !== 400", the only failing test). The break is reverted
- [x] 2.2 A fresh review found no P1 or P2 issues. It confirmed the deliberate break is reverted (no net change to `purchase-orders.js`), and that the symlink test passes on this branch and fails on main's scripts. CI on the final commit (`npm test` and `npm run test:browser`; this Mac has no Postgres) is the merge gate

## Workflow follow-up

- Archive as the last commit, then merge once CI is green on it.
