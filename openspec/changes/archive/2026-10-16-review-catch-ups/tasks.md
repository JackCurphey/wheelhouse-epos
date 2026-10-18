# Tasks: four places the diary catches up with its drawings

## 1. Tests first, each watched failing

- [x] 1.1 A chosen card's hint, by mouse and by tap; Open is finger-sized on touch
- [x] 1.2 In a real browser set up as a tablet, Week and Day are 44px (were 38)
- [x] 1.3 A change request's "Open full job" opens the job page and closes the request

## 2. Build

- [x] 2.1 The hint; the touch sizes; "Open full job"

## 2b. After the fresh review

- [x] 2b.1 Test first, watched failing: a card chosen from the keyboard after a tap elsewhere gets the double-click wording
- [x] 2b.2 The fix; Decline and Open full job stay stacked on the phone layout up to its widest; Open full job waits while an answer sends (these two not covered by tests)

## 3. Checks

- [x] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
