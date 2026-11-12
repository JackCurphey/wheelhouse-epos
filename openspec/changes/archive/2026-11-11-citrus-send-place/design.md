# Design: A shop's next Citrus Lime file is taken as soon as the last is answered

## Context

`POST /api/move/files` (`server/routes/move.js`) declares `beforeBody`. `server/server.js` (around line 770) calls it inside `runWithShop` before the body is read. If it returns a function, the request has the shop's place, and `server.js` calls that function in a `finally` once `serveStaffRoute` has resolved. `serveStaffRoute` resolves only after `runWithShop` has released the request's database connection, which is a round trip after the handler wrote its answer.

## Decision

1. `sendingShops` becomes a `Map` of shop id to the request holding its place, instead of a `Set` of shop ids.
2. `giveUpPlace(shopId, req)` deletes the entry only if `req` still holds it.
3. In the handler, `answer(...)` (for 202, 409, 422 and 429) and `refuse(message)` (for the three 400s) call `giveUpPlace` and then write the answer. `beforeBody`'s returned let-go is `() => giveUpPlace(shopId, req)`, so it is harmless once the place has gone to the next send.

Giving the place up before the answer is safe because, by then, the send's own work is committed or rolled back. The 202 comes after `COMMIT`, and the 409 and 429 after `ROLLBACK`. All that is left is handing back the connection.

**Chosen over:** freeing the place in `server.js` before the connection goes back (that would touch the core for one route), and the test waiting between sends (that hides a delay a real owner can meet).

## Test

`tests/citrus-import.test.js`, "a shop's place is free again by the time its send is answered, whatever the answer":
- It runs `beforeBody` and the handler in-process, as `server.js` does.
- When the answer is written, it starts the shop's next `beforeBody` and holds back the first send's let-go until that has finished. This is the slowest the late let-go can be, so the race happens every time.
- It checks a 202, a 400 and a 422 in turn. After each, the next send gets the place, and a third send at that moment is still turned away.

Watched failing:
- main's `move.js`: "busy" after a 202;
- the 400's or the 422's early give-up removed: "busy" after that answer;
- the ownership check removed: the third send got the place.

## Risks

- A send that fails with an error (a body that isn't JSON, a database error after `ROLLBACK`) gives the place up before rethrowing, since `server.js` writes that answer. The body case is tested; the database-error case isn't, as there is no clean way to make the insert fail on purpose, so it rests on review.
- The test covers the 202, one 400, the empty-file 422 and the body that isn't JSON. The 409, the queue-full 429, the too-big 422 and the other two 400s use the same `answer`/`refuse` and aren't tested one by one. Reverting one of them would bring back an occasional false "busy", never a place held for good, because `server.js`'s `finally` still frees it.
- Two sends from one shop can now overlap only during the old send's connection hand-back, when it holds no file in memory. The one-file-in-memory rule still holds.
