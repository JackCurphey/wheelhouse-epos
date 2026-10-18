# Tasks: Accept or decline from a booking request's menu

## 1. Tests first, each watched failing

- [x] 1.1 Screen tests: a request's menu is Accept or decline and View overview, and Accept or decline opens its pop-up (failed: the menu had Open job); a booked job's menu still starts with Open job

## 2. Build

- [x] 2.1 `onAnswer` on JobMenu; the diary opens the request's Waiting card, or one made from the job

## 2b. After the fresh review

- [x] 2b.1 Tests first: a real request's Waiting card opens, with its services (watched failing with only the made card used); on a phone the menu is headed "[job] · booking request", as drawn (watched failing with the old heading)
- [x] 2b.2 The phone heading for a booking request

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
