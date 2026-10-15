# Tasks: the booking pages' account and read routes move to server/routes/portal.js

## 1. The move

- [x] 1.1 Moved the 10 routes, the cookie helpers and the sign-in limiters. Checked that all 260 removed non-blank lines are in `portal.js`, apart from the import lists, two section headers and the one comment pointer
- [x] 1.2 Added `tests/portal-routes-file.test.js`. It was written after the move, so it was run against main, where it fails 3 of 3. It passes with the move, along with `route-files-defined`, `route-list` and the screen trace (19 tests)
- [ ] 1.3 `npm test` and `npm run test:browser` pass in CI on the final commit. This Mac has no Postgres
- [x] 1.4 A fresh review confirmed the move is pure: the dispatcher's portal branch is unchanged, there is one instance of each limiter, and there are no circular imports. Its comment point is fixed (two `server.js` mentions of `portalSignupLimiter` now say where it lives); `customer-auth.js`'s comments wait for the bookings move

## Workflow follow-up

- Archive as the last commit, then merge once CI is green on it.
