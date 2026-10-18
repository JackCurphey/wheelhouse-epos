# Tasks: Change details on the job page

## 1. Tests first, each watched failing

- [x] 1.1 Screen tests: the pop-up filled in, and every field saved with the version; Shared queue sends no mechanic; another customer brings their own bike; a refusal stays open; none for finished work; several days leave date and time to the diary (five failed with no button; the finished-work test was watched failing with the guard removed, and the bike test with the reset removed)
- [x] 1.2 Browser: beside Close on a computer, with a save that changes the job; in the details box on a phone, with the pop-up filling the screen (both failed with the size classes removed)

## 2. Build

- [x] 2.1 `change-details-dialog.tsx`; the two buttons on the job page

## 2b. After the fresh review

- [x] 2b.1 Tests first, watched failing: a real save of a job with no time, then a start with no end (the server refused "null"); empty times sent; a stale refusal says so and reloads; Escape closes the search's list, not the pop-up, and the search takes the focus; a job over several days sends no date or times, and its mechanic is day 1's
- [x] 2b.2 Times as text; the version the pop-up opened with; the customer and bike only when they change; New job's Escape and blur on the search; a slow bike reply for another customer ignored; 44px buttons; the phone's buttons pinned to the bottom

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
