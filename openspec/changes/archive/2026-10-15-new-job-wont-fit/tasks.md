# Tasks: New job warns when the work won't fit

## 1. Tests first, each watched failing

- [x] 1.1 Work longer than the gap shows the warning, with Save still offered; work that fits, and the Shared queue, show none
- [x] 1.2 A start in busy time reads "No free time at [time]"
- [x] 1.3 "Find the next free [m] minutes" moves the job to the next gap the same day, or on a later day, and the warning goes; with none in 60 days it says so
- [x] 1.4 Saving with the warning showing saves at the time chosen
- [x] 1.5 From "Enter a time instead", the warning follows the date and time typed, and the button fills the boxes

## 2. Build

- [x] 2.1 The warning and the button on New job

## 2b. After the fresh review

- [x] 2b.1 Tests first, watched failing: "nothing found" goes when the mechanic changes; a failed search says so; after a move the focus is on the new time and the automatic choice keeps its day
- [x] 2b.2 The fixes; an answer that arrives after the mechanic, work or time changed is dropped; the warning sits below the mechanic note, its button inline, as drawn

## 3. Checks

- [x] 3.1 The decided-here choices logged in Jack's section of `decided-while-building.md`
- [x] 3.2 A fresh review; `npm test` and `npm run test:browser` pass
