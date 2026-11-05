# Tasks

- [x] 1.1 Tests first (`tests/dropped-request.test.js`): real sockets reset against a live server, each test with a time limit (a till, staff, a Citrus Lime upload, a body cut off part-way on each kind of route, a cancel); and the read itself, with the request already gone before it starts. Watch each fail for the right reason (three runs on the unfixed code: 15 of 17 red, the pool out of connections or the read never ending)
- [x] 1.2 `server/lib/http.js`: one `readBody` that always ends; `ClientGoneError`; `sendJson` writes nothing to a client that has gone
- [x] 1.3 `server/server.js`: the dispatcher's catches say nothing about a client that has gone
- [x] 1.4 `server/routes/portal.js`: a cancel that never arrived whole cancels nothing
- [x] 1.5 Every catch around a body read checked, and every other reader of a request's stream looked for (`design.md`)
- [x] 1.6 Break each changed branch on purpose, confirm the break is in the file, see the tests go red, restore and check the restore
- [x] 1.7 Self-review against this change; `npm test`, `npm run test:browser`, the drawing coverage check and lint on the head after merging main
