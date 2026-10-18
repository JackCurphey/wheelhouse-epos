# Tasks: the mechanic sign-off, piece 2

## 1. Server (Mark's sales.js; flagged for him)

- [x] 1.1 Tests first, watched failing: convert with signedOffBy records the sign-off; an inactive mechanic finishes unsigned with a warning and the sale stands; no signedOffBy finishes unsigned; finished work keeps its sign-off
- [x] 1.2 convert records the sign-off

## 2. Till

- [x] 2.1 Tests first, watched failing: work in progress asks first, the job's mechanic picked; signing off opens the payment and convert carries signedOffBy; Cancel takes nothing; finished work isn't asked
- [x] 2.2 `JobTill` and `PayDialog`
- [x] 2.3 Browser: pay for work in progress at the till, sign off, and the job records it

## 3. Checks

- [x] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
