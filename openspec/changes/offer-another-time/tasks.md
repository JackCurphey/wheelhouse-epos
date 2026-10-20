# Tasks: offering another time

## 1. Server — the workshop server (Jack's, Mark approves) and the booking server (Mark's), on Jack's word; flagged for Mark

- [x] 1.1 Tests first, watched failing: the state's transitions; the migration from empty; offer (moves the job and its hold, keeps where it was asked, refusals); the link's stage, offer and flags; accept-offer; cancel an offer; change refused; Waiting for you leaves it out; the legacy PUT leaves it
- [x] 1.2 Migration 046, the machine and generated docs, the offer route, the link view, accept-offer, guards; route snapshot
- [x] 1.3 A fresh review; `npm test` passes; merged

## 2. Staff screens — Jack

- [x] 2.1 Tests first, watched failing: Offer another time opens pick mode; Cancel returns; a free time opens the offer pop-up; Offer this time posts; the diary draws Time offered without Accept/Decline
- [x] 2.2 The request pop-up's button, pick mode, the offer pop-up, the offered diary state
- [x] 2.3 A fresh review; tests pass; merged

## 3. Customer page — Jack

- [x] 3.1 Tests first, watched failing: the offered page's words; Accept this time; Cancel my request
- [x] 3.2 The offered state on the booking page
- [x] 3.3 Browser: staff offer a time, the customer accepts, against the real server
- [ ] 3.4 A fresh review; `npm test` and `npm run test:browser` pass; archived
