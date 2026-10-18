# Tasks: a Shared queue button in the diary

## 1. Tests first, each watched failing

- [x] 1.1 Screen tests: the Shared queue button shows only jobs with no mechanic; the Day view has one "Shared queue" column; the phone list's last line is Shared queue (all three failed: no button, no column, a different last line)
- [x] 1.2 In a real browser at 1280 and 1366px, the toolbar with four people buttons stays one row (at 1280 New job dropped to a second row, 56px lower)

## 2. Build

- [x] 2.1 `?who=shared`: the jobs with no mechanic, a one-column Day view, the button and the phone line
- [x] 2.2 The toolbar spaced as the drawing, so it fits at 1280px

## 2b. After the fresh review

- [x] 2b.1 Test first, watched failing: at 834 and 1024px the toolbar keeps the tablet drawing's spacing, 12px from Week/Day to the dates and 6px between people buttons (it was 4 and 4)
- [x] 2b.2 The tighter spacing applies from 1280px only; the 1280 test gets its own two-mechanic shop, as other tests add mechanics to the shared one

## 3. Checks

- [x] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
