# Tasks

- [x] 1.1 Tests first (`tests/server-stays-up.test.js`): a staff cookie, a website's shop name, an online shop's name and an address that the database or the server can't read each get an error, and the server answers the next request. Watch each fail
- [x] 1.2 Tests first (`tests/messaging-connection-per-request.test.js`): 12 collections at once each set up both messages quickly; a service reminder, a review request and an own message after a sale are written with every other connection held. Watch each fail
- [x] 1.3 Test first (`tests/portal-connection-per-request.test.js`): 12 sign-ins by code at once, each to its own account. Watch it fail
- [x] 1.4 `server/server.js`: the dispatcher's own failures answer the one request
- [x] 1.5 The messaging lookups, and `createCustomerSession` from sign-in by code, on the shop's own connection
- [x] 1.6 Break each part on purpose, confirm the break is in the file, see the tests go red, restore and check the restore
- [x] 1.7 Self-review and `/review` (server.js, messaging core, `/api/portal/*`); the touched tests, `route-list`, `owner-only-routes`, both connection-per-request tests; lint (/review 26 Oct: nothing serious; follow-ups 1-3 done)
- [x] 1.8 The review's follow-ups, each test watched failing and each fix broken on purpose: a cookie that isn't a valid escape keeps its raw value; unsigned-in error answers carry fixed words, details logged; a garbled address gets 400 with nothing logged; `createCustomerSession` decides its connection from the scope (optional 4, done)
