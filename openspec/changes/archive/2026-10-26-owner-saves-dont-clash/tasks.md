# Tasks

- [x] 1.1 Read the six saves listed in `more-saves-dont-clash`'s "Not covered" against the stored code; each has the fault (`design.md`)
- [x] 1.2 Tests first (`tests/owner-saves-dont-clash.test.js`): two saves of different fields at once, 30 rounds, both stored every round, for a workshop service, a service group, a mechanic's time off, a person on the team, a supplier and a draft order, each checking another shop's record is untouched. Watched each fail: a change lost in 29 or 30 of 30 rounds, every save answered 200
- [x] 1.3 Test first: an order marked as ordered while an edit holds back is refused, with its lines unchanged. Watched it fail: answered 200
- [x] 1.4 The three workshop settings saves: in a transaction, reading the record `FOR UPDATE`; the body read first; the checks unchanged; 200 after `COMMIT`
- [x] 1.5 The team and supplier saves: the same; a supplier name already taken is still a 400 and rolls back
- [x] 1.6 The order save: the same, with the draft check made again on the locked row; locks checked against booking in, marking as ordered and cancelling (`design.md`)
- [x] 1.7 Break each fix on purpose (drop `FOR UPDATE`; for the order, drop the draft check under the lock), confirm the edit landed, see the test go red, restore
- [x] 1.8 A refused save writes nothing, leaves no transaction open and the next save goes through; break a refusal's `ROLLBACK` on purpose and see it go red
- [x] 1.9 The existing tests for each changed route, `tests/route-list.test.js`, `tests/owner-only-routes.test.js`, and lint
- [x] 1.10 Self-review and `/review` (stock ordering: the order save)
- [x] 1.11 `npm test`, `npm run test:browser`; archive as the last commit
