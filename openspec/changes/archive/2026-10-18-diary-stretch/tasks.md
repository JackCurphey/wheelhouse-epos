# Tasks: stretching a job in the diary

## 1. Tests first, each watched failing

- [x] 1.1 Rules: where a stretched job ends (snapped, 15 minutes at least, closing at most) and its length in words (failed: not exported)
- [x] 1.2 Screen tests: Change length in the menu, the arrows and Enter save the end time; the limits; Escape; a refusal; no Change length on a booking request (four failed with no menu item; the fifth was watched failing with the item offered to every job)
- [x] 1.3 Browser: a mouse drag of the bottom edge saves 12:00 and doesn't open the job; on a tablet the edge is hidden until Change length, then the grip is at least 44px (both failed with the edge's drag and its touch-screen hiding removed)

## 2. Build

- [x] 2.1 `stretchEnd` and `lengthText` in `rules.ts`
- [x] 2.2 The edge with a mouse; the finger-sized grip and the times label while stretching; the chosen ring, as drawn
- [x] 2.3 "Change length" in the job's menu, the keyboard steps, and a tap elsewhere leaving it

## 2b. After the fresh review

- [x] 2b.1 Tests first, watched failing: a job stops at its own day's closing time (it ran to the week's latest); grabbed at the top of the edge, an hour's drag adds exactly an hour, and a 2px wobble saves nothing and leaves no grip (the end followed the pointer)
- [x] 2b.2 The end follows the edge; a 4px threshold; a cancelled touch saves nothing; the label wraps inside a narrow column; a stack's jobs use Change length (logged)
- [x] 2b.3 The existing menu test lists Change length for a movable job

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
