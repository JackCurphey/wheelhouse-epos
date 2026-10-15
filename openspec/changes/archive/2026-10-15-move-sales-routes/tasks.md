# Tasks: sales and sale documents move to server/routes/sales.js

## 1. The move

- [x] 1.1 Moved the 9 routes and their helpers, and `shopDayWindow` to `server/lib/sales.js`. Checked that all 452 removed non-blank lines are in their new homes, apart from three import lines and `export` on `shopDayWindow`. `server.js` gains one import line and one heading
- [x] 1.2 Added `tests/sales-routes-file.test.js`. It fails 3 of 3 before the move and passes after, along with `route-files-defined` (which caught one unused import, removed), `route-list`, `sales-lib-module` and the screen trace (23 tests). All the modules load, with no import cycle
- [ ] 1.3 `npm test` and `npm run test:browser` pass in CI on the final commit. This Mac has no Postgres
- [x] 1.4 A fresh review confirmed the move is pure: the webhook code is untouched, the handler arguments and push wiring are intact, there's no import cycle, and the dashboard still gets `shopDayWindow`. Its points are fixed (an empty Sales heading moved above the sales routes; the proposal now says the webhooks weren't moved)

## Workflow follow-up

- Archive as the last commit, then merge once CI is green and #212 is in.
