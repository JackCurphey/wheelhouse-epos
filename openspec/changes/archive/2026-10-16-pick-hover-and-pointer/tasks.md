# Tasks: New job's highlighted slot, and the pointing finger

## 1. Tests first, each watched failing

- [x] 1.1 Choosing a time, the slot under the pointer shows its time and goes when the pointer leaves; nothing shows outside choosing a time
- [x] 1.2 In a real browser, "New job" and "Next week" show the pointing finger, a disabled button the arrow, a movable job the open hand

## 2. Build

- [x] 2.1 The highlighted slot in the diary's columns
- [x] 2.2 The cursor rule in the theme's base styles

## 2b. After the fresh review

- [x] 2b.1 Tests first, watched failing: a touch shows no highlight (an iPad could otherwise swallow the tap); a highlight doesn't come back when New job is pressed again
- [x] 2b.2 Pointer events, mouse only; the highlight is forgotten when choosing ends

## 3. Checks

- [x] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
