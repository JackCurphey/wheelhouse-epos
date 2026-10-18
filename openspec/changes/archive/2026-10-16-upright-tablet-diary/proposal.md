# Proposal: the diary on an upright tablet

## Why

The diary layout review (#238, item 7): nothing was drawn for an upright
tablet (an iPad held upright, about 834 wide), so it got the computer layout
squeezed: the toolbar wrapped untidily and the Waiting column took width the
week needed. Jack, 16 Oct: draw it first, then build it
(`docs/decisions/2026-10-16-workshop-test-copy-changes.md`, item 9). He
approved the drawing.

## What Changes

- **The drawing:** `uprightTabletDiary()` in
  `docs/design/user-journeys/generator/diary.mjs`, at 834 × 1112, built from
  the tablet drawing's own pieces; `shellTablet` takes a width and height.
  It isn't on the canvas yet (the drawings know three sizes; a fourth is
  a larger change).
- **The build:** below computer width (1024px) and above the phone, the
  toolbar sits on two rows (Week/Day with the dates; the people chips on the
  left, Waiting and New job on the right), and "Waiting for you" is a
  "Waiting (n)" button that opens the phone's Waiting sheet, so the week has
  the full width. The phone and the sheet share one piece of code now.
- The computer layout is unchanged.

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/diary-page.tsx` and the drawings.
- **Drawings:** the new upright-tablet drawing; the Waiting button follows
  the built phone's (no inbox icon, as built).
- **Decisions:** decision 14 kept (a card chosen in the sheet, tapped again,
  opens). Jack's approval of 16 Oct.

## Out of scope

- Adding a fourth size to the canvas and mockup.
- The narrow columns' truncation (the same on every size).

## Impact

- `src/screens/diary/diary-page.tsx`, `docs/design/user-journeys/generator/diary.mjs`,
  `tests/browser/diary-extras.spec.ts`.
