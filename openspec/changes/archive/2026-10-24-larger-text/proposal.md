# Proposal: Larger text

## Why

Jack's 24 Oct answer 8 (`docs/decisions/2026-10-24-morning-questions.md`):
"Larger text scales the text sizes themselves: every screen's sizes move to one
shared scale that Larger text raises a step (14 to 17, as drawn), so layouts,
dragging and pop-ups are untouched. Not a zoom, which put the diary's drops off
their marks." Drawn as Your settings' "Larger text" row with its preview
(`app-map.mjs` line 190, `diary.mjs` `largerTextPreview`). Jack wants the app
as accessible as possible. No risky area.

## What Changes

- Every text size in the app (`text-xs`… and each `text-[Npx]`) becomes a
  size on one shared scale, `--wh-text-scale`, 1 to start.
- Your settings gets the drawn "Larger text" switch, "Makes text across
  Wheelhouse a step larger.", with its Normal / Larger preview; on, the scale
  is 17/14 for that person, on every page, straight away.
- A check keeps new code on the scale: no fixed `text-[Npx]` sizes.

## Capabilities

### Modified Capabilities

- `your-settings`: Larger text makes every text a step larger.

## Out of scope

The customer's booking pages (Larger text is a staff person's own setting;
they use the same scale at 1); line heights and spacing, which stay as they are.

## Impact

`src/styles/theme.css`, every `.tsx` with a fixed text size (a mechanical
change), `src/lib/your-settings.ts`, `your-settings-page.tsx`,
`tests/design-tokens.test.js`, tests.
