# Proposal: readable By mechanic columns on a phone

## Why

Found while testing the phone's Today button (#242): on a 360px phone with
many mechanics, "By mechanic" squeezed every column to about 36px, so the
names spilled over their columns and the jobs couldn't be read. Jack, 17 Oct:
keep the columns readable and scroll sideways (option 1).

## What Changes

- On a phone, "By mechanic" columns keep at least 96px each. When they don't
  all fit, the diary scrolls sideways inside its own area: the times down the
  side stay put and the mechanics' names move with their columns. The page
  itself never scrolls sideways.
- With columns that fit (two or three mechanics) nothing changes; "Everyone"
  is one column as before.

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/diary-page.tsx`.
- **Drawings:** the phone By mechanic board draws two mechanics, so this
  case wasn't drawn; Jack's answer of 17 Oct, recorded in
  `docs/decisions/2026-10-16-workshop-test-copy-changes.md`.
- **Decisions:** none changed.

## Impact

- `src/screens/diary/diary-page.tsx`, `tests/browser/diary-extras.spec.ts`.
