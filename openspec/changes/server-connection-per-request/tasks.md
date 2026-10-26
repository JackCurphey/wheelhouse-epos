# Tasks

- [x] 1.1 Tests first: 12 Owner-only requests at once all answer within 4 seconds, and two shops at once stay apart with a staff member still refused (`tests/connection-per-request.test.js`). Watch each fail
- [x] 1.2 `rememberSession` in `server/lib/session.js`; `currentSession` returns it; the dispatcher in `server/server.js` remembers the session it looked up
- [x] 1.3 Break the fix on purpose, see the tests go red, restore
- [ ] 1.4 Self-review and `/review` (server.js, sign-in); the touched tests, `route-list`, `owner-only-routes`; lint (tests and lint pass; `/review` not yet run)
