# Proposal: Folded sidebar, and the Till folded

## Why

App map review (`docs/decisions/2026-09-29-app-map-review.md`) decisions 4, 5,
7 and 9: on the Till the sidebar folds to the icon rail so the till gets the
width; the rail unfolds on a 300 ms rest or with Unfold; a folded sidebar on
every page is a personal setting, off by default, in Your settings. Neither is
built: the computer always shows the full sidebar.

## What Changes

- **The rail gains Unfold** (drawn as `foldedRail`, `app-map.mjs` :144–156):
  the full sidebar opens over the page, with Fold ("Fold the menu"); Escape
  closes it. On a computer it also opens when the pointer rests on the rail
  for about 300 ms. Reduce motion drops the slide, not the unfolding.
- **The Till is always folded** on a computer (decision 4).
- **Your settings gains Folded sidebar**, last as drawn, with the computer's
  or the tablet's hint, and not on a phone (`yourSettingsDialog`). With it on,
  every page is folded on a computer (decision 7).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `your-settings`: a third accessibility switch.

## Lane, work package, drawings and decisions

- **Work package:** WP-1.11, Jack (overnight queue, 23 Oct). Stacked on #444.
- **Risky areas:** none.
- **Drawings:** `foldedRail`, `tillRail`, `your-settings` (`app-map.mjs`).
- **Decisions:** app map review 4, 5, 7, 9; workshop day 68 (the rail).

## Out of scope

- The till's own foot ("Check out") and the shop switcher in the panel (later).

## Impact

`src/staff/staff-layout.tsx` (the `Rail`), `src/staff/nav-icon.tsx` (a chevron),
`src/screens/your-settings/your-settings-page.tsx`.
