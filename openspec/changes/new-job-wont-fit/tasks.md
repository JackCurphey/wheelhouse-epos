# Tasks: New job warns when the work won't fit

## 1. Tests first, each watched failing

- [x] 1.1 Work longer than the gap shows the warning, with Save still offered; work that fits, and the Shared queue, show none
- [x] 1.2 A start in busy time reads "No free time at [time]"
- [x] 1.3 "Find the next free [m] minutes" moves the job to the next gap the same day, or on a later day, and the warning goes; with none in 60 days it says so
- [x] 1.4 Saving with the warning showing saves at the time chosen
- [x] 1.5 From "Enter a time instead", the warning follows the date and time typed, and the button fills the boxes

## 2. Build

- [x] 2.1 The warning and the button on New job

## 3. Checks

- [x] 3.1 The decided-here choices logged in Jack's section of `decided-while-building.md`
- [ ] 3.2 A fresh review; `npm test` and `npm run test:browser` pass
