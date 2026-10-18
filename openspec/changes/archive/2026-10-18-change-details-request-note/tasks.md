# Tasks: Change details notes a waiting change request

## 1. Tests first, each watched failing

- [x] 1.1 Screen tests: the note's words; another mechanic named; no note without a request (the first two failed with no note; the third is watched failing with the note always shown)

## 2. Build

- [x] 2.1 The note in `change-details-dialog.tsx`

## 2b. After the fresh review

- [x] 2b.1 Tests first: a drop-off day with no time shows no note (watched failing with the time check removed); on a job over several days the note says to answer it from Waiting for you (failed before the fix)
- [x] 2b.2 The spec narrowed to a request for a set day and time; both cases logged; the drawing notes its scenery page

## 3. Checks

- [x] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
