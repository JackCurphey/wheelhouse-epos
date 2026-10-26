# Tasks

## 1. The email side

- [x] 1.1 Migration 066. Tested from empty on a scratch database
- [x] 1.2 Tests first (`tests/receipt-email.test.js`): a sale's receipt sent to an address, with its shop, number, lines, discount, total and payment, no VAT line, sent through the pretend sender; the customer's saved address unchanged; a bad address refused with the drawn words; another shop's sale and an unknown sale not found; signed out refused. Watch each fail
- [x] 1.3 Build `sendEmailTo`, `receipt-email.js` and the route (route list). Verify 1.2
- [x] 1.4 Log what's decided; `/review`; lint and tests; archive as the last commit
