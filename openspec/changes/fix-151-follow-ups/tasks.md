# Tasks: two follow-ups from Jack's review of #151 and #156

## 1. Scripts run through a symlink

- [x] 1.1 Wrote `tests/scripts-run-through-symlink.test.js` first. Watched both cases fail with "expected the usage error, got exit 0"
- [x] 1.2 Compared real paths in both scripts, and dropped the import `new-db.mjs` no longer uses. Verified the new test and `migration-checks` pass (14 tests)

## 2. The purchase-order edit route's bad lines

- [ ] 2.1 Added the edit-route case to `tests/purchase-orders-validation.test.js`. Watch it fail in CI against a deliberate break (the edit route's `ValidationError` check removed), then revert the break
- [ ] 2.2 Verify `npm test` and `npm run test:browser` pass in CI on the final commit (this Mac has no Postgres), then get a fresh review

## Workflow follow-up

- Archive as the last commit, then merge once CI is green on it.
