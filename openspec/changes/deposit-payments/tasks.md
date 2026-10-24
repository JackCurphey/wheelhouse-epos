# Tasks

- [x] 1.1 Tests first (`tests/payments-pretend.test.js`): hold, the test cards, take, release, refund, the same key answering the same hold, nothing without a provider. Watch each fail
- [x] 1.2 Migration 070 from empty on a scratch database; the adapter and the pretend provider. Verify 1.1
- [x] 2.1 Tests first (`tests/portal-deposit.test.js`): a hold's amount from the stored prices; no deposit, none held; paid and booked, taken once; not held, wrong amount, someone else's, declined: refused and nothing booked; the slot gone: released; sent twice: once; the cut-off kept; another shop's payment never. Watch each fail
- [x] 2.2 The two routes and the booking request. Verify 2.1
- [ ] 2.3 Log what's decided; `/review` (migration, money, public routes); lint and tests; archive as the last commit
