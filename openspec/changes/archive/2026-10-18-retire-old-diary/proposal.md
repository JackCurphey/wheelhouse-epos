# Proposal: retire the old app's workshop diary

## Why

Nobody uses the old app's workshop diary (`public/app.js`, `#workshop`); the
new diary at `/workshop/diary` does its job. Jack, 18 Oct: remove it
completely and build what only it did into the new diary
(`docs/decisions/2026-10-18-retire-old-diary.md`). Project rule 5 allows
removing an old-app screen once its replacement is merged.

## What Changes

- The old app's Workshop tab, and any old `#workshop` address, open the new
  diary.
- Removed from the old app: the week and month diary, mechanic pills,
  "Waiting for you" column, booking pop-up (Accept, Decline, Seen), dragging
  and stretching jobs, hover summary, right-click menu and the busy day's
  "+[n] more" list, with their styles and the three helper scripts
  (`public/diary-waiting.js`, `diary-marks.js`, `diary-review.js`).
- Kept: the old job form, still opened from an order ("Show in workshop
  diary", "View / edit workshop job"). It now loads the shop's mechanics
  itself, since the old diary used to load them first; without it the
  mechanic list was empty. Deleting a job from it refreshes the orders list
  instead of drawing the old diary.
- Kept, not part of the diary: Office > Edit Shop > Workshop (opening hours)
  and a bike's service history.

## Lane, drawings and decisions

- **Lane:** Jack's (the whole workshop): `public/app.js`, `public/styles.css`,
  `public/index.html`, `src/screens/diary/rules.ts` (a comment). The tests
  touched are workshop tests; `tests/design-scale.test.js` loses the old
  diary's selectors.
- **Drawings:** none; nothing new is drawn.
- **Decisions:** `docs/decisions/2026-10-18-retire-old-diary.md`. Month view
  and stretching (CAL-02, CAL-05 in `2026-08-31-feature-catalogue.md`) are
  kept as features, to be drawn and built in the new diary; until then they
  are missing, which Jack accepted as nobody uses the old diary.

## Out of scope

- Building the features only the old diary had (the decision's list); each
  is drawn for Jack first.
- The old job form, Edit Shop > Workshop and bike service history: each goes
  when the screen it sits on is rebuilt.
- The server's old-app routes and tests (Mark's lane), which the old job
  form still uses.

## Impact

- The old app loses about 1,300 lines of script and 600 of styles.
- `tests/browser/diary-waiting.spec.ts` and `tests/diary-rules.test.js`
  tested only the old diary and go; `tests/browser/old-app-workshop.spec.ts`
  is new.
