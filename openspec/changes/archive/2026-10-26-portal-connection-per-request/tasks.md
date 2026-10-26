# Tasks

- [x] 1.1 Tests first (`tests/portal-connection-per-request.test.js`): after a warm-up burst, 12 at once with a made-up cookie and with Maya's real one, on `/me` and `job-<id>`; a customer of one shop gets nothing from another, alone and in a mixed burst; 12 private links, photo codes and quote sends at once. Watch each fail
- [x] 1.2 `rememberCustomerSession` in `server/lib/session.js`; `currentCustomerSession` returns it; the portal branch of the dispatcher in `server/server.js` calls it before `runWithShop`, only when the cookie is there
- [x] 1.3 The shop's slug in `issueJobLink`, the private link and photo codes (`server/routes/workshop.js`), and its name in `jobMessageVars` (`server/workshop/job-messages.js`), through the request's own connection
- [x] 1.4 Break each part on purpose, see the tests go red, restore and check the restore
- [x] 1.5 Self-review and `/review` (server.js, `/api/portal/*`); the touched tests, `route-list`, `owner-only-routes`; lint (`/review` ran 26 Oct with only low findings)
- [x] 1.6 The review's three follow-ups: a failed early lookup stores nothing (a public page still answers); an expired sign-in through the early lookup is refused and deleted (tests 8 and 9, each seen red); sign-in/check's `createCustomerSession` listed under Not covered
