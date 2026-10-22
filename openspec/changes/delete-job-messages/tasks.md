# Tasks: a deleted job's waiting messages, and the lock order

## 1. Server — Mark

- [x] 1.1 Tests first, watched failing: a deleted job's waiting messages are stopped and the timer sends none of them; a refused delete stops nothing; a quote answered while the job is deleted gives no server error (`tests/workshop-delete-messages.test.js`: the messages test failed with the Bike ready still `intended`; both race tests failed with "deadlock detected" and a 500 without the order lock)
- [x] 1.2 `undoJobMessages` in `server/messaging/engine.js`, called in the delete's transaction (one line in Jack's `server/routes/workshop.js`)
- [x] 1.3 `answerAndAddToOrder` locks the job's orders first (one statement in Jack's `server/workshop/jobs.js`)
- [x] 1.4 The call logged in Mark's section of `decided-while-building.md`
- [x] 1.5 A fresh review (no P1/P2; three P3s fixed: the timer slowed in the test, the design's testing note, `ORDER BY id` on the delete's order lock); `npm test` passes

## 2. Checks

- [ ] 2.1 Jack approves the two lines in his files
- [ ] 2.2 `npm test` and `npm run test:browser` pass; archived as the last commit of the pull request
