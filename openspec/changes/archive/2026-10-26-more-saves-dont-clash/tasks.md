# Tasks

- [x] 1.1 Survey the PUT and PATCH routes in `server/routes/*.js` for the read, merge, write-back pattern (there are no PATCH routes); list what was found in `design.md`
- [x] 1.2 Tests first (`tests/more-saves-dont-clash.test.js`): two saves of different fields at once, 30 rounds, both stored every round, for a customer, a bike, a product and a workshop job without a version, each checking another shop's record is untouched. Watched each fail: a change lost in 29 or 30 of 30 rounds, every save answered 200
- [x] 1.3 Customers and bikes: the save in a transaction, reading the record `FOR UPDATE`; the body read first; the checks unchanged; 200 after `COMMIT`
- [x] 1.4 Products: the same; the Shopify sync after `COMMIT`
- [x] 1.5 Workshop jobs: the merge and the checks on the job read under `withJobBookingLock`
- [x] 1.6 Break each fix on purpose (drop `FOR UPDATE`; drop the `BEGIN`; for jobs, merge into the copy read before the lock), confirm the edit landed, see the test go red, restore
- [x] 1.7 A refused save writes nothing and the next save goes through; break each check on purpose and see it go red (the date check stayed green until the test checked the refusal's words)
- [x] 1.8 Self-review and `/review` (customer accounts: `email_from_customer`; products set prices)
- [x] 1.9 `npm test`, `npm run test:browser` and lint; archive as the last commit
