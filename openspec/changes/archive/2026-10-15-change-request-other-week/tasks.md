# Tasks: a change request into another week shows the time asked for

## 1. Tests first, each watched failing

- [x] 1.1 Choosing a change request into another week moves the diary to that week and shows the marked outline, named for the customer
- [x] 1.2 A change request inside its own week still goes to the booking's week
- [x] 1.3 On a phone, choosing it goes to the day asked for and shows the outline

## 2. Build

- [x] 2.1 Outlines from the waiting list; the card goes to the week asked for; the chosen outline is marked

## 2b. After the fresh review

- [x] 2b.1 Tests first, watched failing: with the time asked for on screen, the job takes the light mark and the time the strong one, as drawn; in the Day view a request for any mechanic shows in the booking mechanic's column; the phone marks the chosen time. The diary test's pretend server now filters by date, as the real one does, so the Day view test could fail
- [x] 2b.2 The fixes; the one-mechanic filter uses the booking's mechanic for both kinds of outline

## 3. Checks

- [x] 3.1 Decided-here choices logged in Jack's section of `decided-while-building.md`
- [x] 3.2 A fresh review; `npm test` and `npm run test:browser` pass
