# Tasks: the workshop settings routes move to their own file

## 1. The move

- [x] 1.1 Moved the 15 routes and their helpers to `server/routes/workshop-settings.js`. Checked that all 622 removed non-blank lines are in their new homes, apart from the import lists, `UPLOADS_DIR`'s path, and `export` on `MAX_SERIAL` and `resolveWorkingDays`
- [x] 1.2 Added `server/lib/uploads.js`, moved `resolveWorkingDays` to `server/capacity.js`, and fixed the imports. `tests/route-files-defined.test.js` (defined and unused names) passes
- [x] 1.3 Added `tests/workshop-settings-routes-file.test.js`. It was written after the move, so it was run against a checkout without the move, where it fails 3 of 3 ("`server/routes/workshop-settings.js` does not exist"). It passes with the move, along with `route-list`, the screen trace (46 routes) and the other module guards (33 tests)
- [ ] 1.4 `npm test` and `npm run test:browser` pass in CI on the final commit. This Mac has no Postgres
- [x] 1.5 A fresh review confirmed the move is pure: the code is identical, `UPLOADS_DIR` resolves to the same folder, the order is safe, and there is no shared state or circular import. Its test point is fixed with a check that the shared names left `server.js` and that `UPLOADS_DIR` is still `<repo>/uploads` (watched failing with the old path depth). Its comment point is in Jack's `tests/helpers/workshopFixtures.js`, so it's left for him

## Workflow follow-up

- Archive as the last commit, then merge once CI is green on it.
- Tell Jack on #180 that `server/lib/uploads.js` exists.
