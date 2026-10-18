# Tasks: a Shared queue button in the diary

## 1. Tests first, each watched failing

- [x] 1.1 Screen tests: the Shared queue button shows only jobs with no mechanic; the Day view has one "Shared queue" column; the phone list's last line is Shared queue (all three failed: no button, no column, a different last line)
- [x] 1.2 In a real browser at 1280 and 1366px, the toolbar with four people buttons stays one row (at 1280 New job dropped to a second row, 56px lower)

## 2. Build

- [x] 2.1 `?who=shared`: the jobs with no mechanic, a one-column Day view, the button and the phone line
- [x] 2.2 The toolbar spaced as the drawing, so it fits at 1280px

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
