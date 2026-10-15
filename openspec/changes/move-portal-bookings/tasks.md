# Tasks: the booking pages' bookings, booking links and quotes move to server/routes/portal.js

## 1. The move

- [x] 1.1 Moved the 10 routes, their helpers and the two limiters. Checked that all 704 removed non-blank lines are in `portal.js`, apart from the import lists, one section header and `export` on `resolveBookingLink`. `server.js` gains only import lines
- [x] 1.2 Extended `tests/portal-routes-file.test.js` to the new routes and helpers, plus a check that the quote answer stays in `server.js`. It fails 2 of 4 on #210's branch and passes here, along with `route-files-defined`, `route-list` and the screen trace
- [ ] 1.3 `npm test` and `npm run test:browser` pass in CI on the final commit. This Mac has no Postgres
- [ ] 1.4 A fresh review confirms the move is pure

## Workflow follow-up

- Archive as the last commit, then merge once CI is green and #210 is in.
- When Jack's quote move takes `answerAndAddToOrder`, the quote answer route moves to `portal.js` and the `resolveBookingLink` export goes back to private.
