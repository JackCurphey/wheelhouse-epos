# Tasks

- [x] 1.1 Record Jack's 27 Oct answers in `docs/decisions/2026-10-27-answers.md`
- [x] 1.2 Tests first (`tests/close-part-delivered.test.js`; the old "a partly arrived order can’t be closed" test in `tests/purchase-orders-status.test.js` removed): a partly delivered order closes to `closed`, keeping what arrived on its lines and in stock, with nothing still to come and the rest not coming; a cancelled order's lines are not coming too; closing it again says it is already closed; a received order's close says everything has arrived. Watch each fail for the right reason
- [x] 1.3 Tests first: booking in on a closed order is refused by both receive routes, stock unchanged
- [x] 1.4 Race tests first: a close that waits on a booking that makes the order partly delivered closes it with the booking kept; a booking that waits on a close is refused with stock unchanged (an admin connection holds the other side's lock)
- [x] 1.5 Screen tests first (`tests/screens/deliveries.test.js`, `tests/screens/receive-delivery.test.js`): Close the order on a partly delivered order, the box, then "Closed" and "[n] not coming"; `?order=` naming a closed order says "This order is all in."
- [x] 1.6 The close route, `serializePurchaseOrder`'s `outstanding` and `notComing`, and the order page (`design.md` 3, 5, 6)
- [x] 1.7 Break each rule on purpose, confirm the break landed, see its test go red, restore
- [x] 1.8 Log the gaps in Jack's section of `decided-while-building.md`
- [x] 1.9 The touched tests, the purchase-orders, deliveries and receive tests, `tests/route-list.test.js`, `tests/owner-only-routes.test.js`, `tests/browser-coverage.test.js`, the deliveries browser specs, `npm run lint`, `npx tsc --noEmit`
- [x] 1.10 Self-review and `/review` (money and stock); `npm test`, `npm run test:browser`; archive as the last commit
