# Tasks: every diary label is at least 12 pixels

## 1. Tests first, each watched failing

- [x] 1.1 No diary label is smaller than 12px (it found 17)
- [x] 1.2 A half-hour block shows the bike only; an hour block shows the job too

## 2. Build

- [x] 2.1 The labels raised; short job and stack blocks show one line
- [x] 2.2 Before and after screenshots; Jack approved

## 2b. After the fresh review

- [x] 2b.1 Lines are 14px as drawn, so a 45-minute block fits two (a check that a 45-minute block shows its job; the pixel fit itself isn't tested); the stack's count badge keeps 30px clear, as drawn
- [x] 2b.2 Noted, not changed: the phone drawing shows a half-hour job as one "bike · job" line in 14px; the app shows 12px lines

## 3. Checks

- [x] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
