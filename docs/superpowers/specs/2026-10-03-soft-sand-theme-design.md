# Switch the app to Soft sand

**Approved by Jack, 3 Oct 2026** ("yeah go ahead"), as the first build piece
after the journey designs (STATUS "Next, in order", step 3).

## Intent

The app takes on the look of the approved drawings: Soft sand, dark rail,
sans-serif throughout (Workshop day decisions 48 and 53, 28 Sep). It replaces
Fjell (`docs/decisions/2026-09-27-fjell-theme.md`).

## Approach

- Values come from the drawings' generator (`SAND` in
  `docs/design/user-journeys/generator/ui.mjs`; the rail's selected item from
  look-4 in `looks.mjs`), so the app matches what Jack approved.
- Both look files change together: `public/tokens.css` (the old staff app and
  the owner's portal) and `src/styles/theme.css` (`/workshop` and `/book`).
- Public Sans replaces Work Sans, self-hosted: the Latin variable file from
  Fontsource (`@fontsource-variable/public-sans` 5.3.0, OFL), downloaded once
  with Jack's OK; no npm dependency added.
- Delete buttons are outlined, never filled (decision 53), in the React
  button and the old app's `.btn-danger`.
- Cards lose their shadow (`--wh-shadow: none`); the hairline border stays.
- The design-system artifact's `tokens.json` and README follow.

## Tests first

`tests/design-fjell.test.js` becomes `tests/design-sand.test.js`, pinning the
Soft sand values, the rail's selected item and the absent card shadow;
`tests/design-fonts.test.js` expects Public Sans; `tests/registry/button.test.js`
pins the outlined delete button. Each was watched failing before the change.

## Not in this piece

Status chip colours (the diary piece brings the drawings' own), the rooms
sidebar, the phone menu and the diary; the unused dark palette (still
derived from Fjell); removing the Work Sans files (ask Jack).

## Done when

Both files carry the Soft sand values; `npm test`, typecheck, lint, build,
the registry drift check and the browser tests pass.
