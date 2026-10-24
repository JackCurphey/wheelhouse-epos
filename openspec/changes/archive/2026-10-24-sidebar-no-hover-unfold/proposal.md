# Proposal: the folded sidebar opens only with Unfold

## Why

Jack, 24 Oct, using the workshop screens: the folded sidebar opening by
itself when the pointer rests on the rail for about 300 ms is jarring. He
wants it to stay folded until Unfold is pressed, and to fold again with Fold
(or Escape, or a tap on the page beside it). This replaces app map review
decision 5 (`docs/decisions/2026-09-29-app-map-review.md`); the new decision
is `docs/decisions/2026-10-24-sidebar-no-hover-unfold.md`.

## What Changes

- **Resting the pointer on the rail no longer opens the full sidebar.**
  Unfold opens it; Fold, Escape or a tap beside it closes it, as now.
- **The code only the rest used goes**: the hover rule on the panel and the
  "don't reopen until the pointer has left" state (decided while building,
  23 Oct, item 2), which only existed for it.
- **Your settings' Folded sidebar hint on a computer** drops "Rest the
  pointer on it": "Folds the sidebar down to icons on every page, for more
  room. Press Unfold to open it. The Till always has it folded." The same
  words go in the drawing's generator (`app-map.mjs`, `ys-rail`).

## Capabilities

### Modified Capabilities
- `your-settings`: the Folded sidebar requirement loses the 300 ms rest.

## Lane, work package, drawings and decisions

Jack's lane, a follow-up to the folded sidebar (`openspec/changes/archive/2026-10-24-folded-sidebar`).
Drawings: `foldedRail` and `ys-rail` in `app-map.mjs`. Decisions: app map
review 4, 5 (replaced), 7; Jack's 24 Oct decision. Touches no risky area.

## Out of scope

The diary's own hover cards and stack fan-outs, which keep their timings.
