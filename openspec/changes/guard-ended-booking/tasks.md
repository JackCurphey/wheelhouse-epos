# Tasks: a booking that has ended can't be booked in or started

## 1. Server — Mark

- [x] 1.1 Tests first, watched failing: book in, start and hold refused on a booking cancelled by the customer, cancelled by staff, declined and expired; work reopen refused; collect and custody reopen still allowed; hold of work already under way still allowed; a pending booking can still be booked in; an out-of-date version is still "illegal" (`tests/workshop-ended-booking-actions.test.js`: 13 of 15 failed without the guard; after the review, the exact words and hold of started work failed 4 of 18 on the earlier guard)
- [x] 1.2 The guard in `applyEvent` (`server/workshop/transitions.js`); `server/routes/workshop.js` untouched; the two calls logged in Mark's section of `decided-while-building.md`
- [ ] 1.3 A fresh review; `npm test` passes; merged

## 2. Checks

- [ ] 2.1 `npm test` and `npm run test:browser` pass; archived as the last commit of the pull request
