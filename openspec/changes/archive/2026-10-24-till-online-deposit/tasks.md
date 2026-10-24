# Tasks

## 1. Server

- [x] 1.1 Tests first (`tests/till-online-deposit.test.js`): `/due` with a taken deposit, a refunded one, a held one and a kept one; convert records Deposit paid online for the server's amount and takes the rest; a till sending its own deposit payment is ignored; a deposit larger than the bill counts up to the bill; refund refused once paid. Watch each fail
- [x] 1.2 Build it
- [x] 1.3 `/review` (money). It found two real problems, fixed with tests, each watched failing: a refund racing a till payment could both count and refund the deposit (the refund now locks the order, as paying does), and a held deposit could be taken on top of a bill paid in full (it's now let go)

## 2. Screens

- [x] 2.1 Tests first: the till's Deposit paid line and Take payment for the rest; the deposit strip has no Refund once paid. Watch each fail
- [x] 2.2 Build it to `till-job-balance`
- [x] 2.3 `npm test`, `npm run test:browser`, lint; archive as the last commit. `npm test`: 3116 passed, with only the 4 that need `ADMIN_DATABASE_URL` failing; `npm run test:browser`: 116 passed. The run's server log showed the held-deposit release failing with no database in scope, fixed and tested as really released
