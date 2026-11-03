## Why

The server half of WP-2.4 brings products and stock across (`citrus-import-products`), but nobody can reach it. This is the page the owner uses: drop the files in, watch them come across, see what came across.

## What Changes

- Office › Moving from Citrus Lime, in the Owner's sidebar after Today, with the three stages across the top.
- Bring your data: the files to download and one drop zone. It starts by itself, with no Import button.
- Bringing your data across: progress that announces itself, and the note that you can leave the page. A file Wheelhouse can't read says so, with Choose another file.
- Here's what came across: how many, All in or how many need a look.

## Out of scope

Customers and bikes, Look at the [n], `mv-fix`, `mv-sorted` and Ask us to help (next pull requests of WP-2.4). Run alongside, Switch over and Next: run alongside (WP-8.1). Getting started's link here (WP-5.1).

## Who and risk

WP-2.4, Jack's. Screens only, on the server routes of the pull request below it. No risky area of its own.

## Follows

- Drawings: `mv-start`, `mv-progress`, `mv-progress-failed`, `mv-summary` (`docs/design/user-journeys/generator/moving.mjs`).
- Decisions: `docs/decisions/2026-09-30-moving-from-citrus-lime-review.md` 2, 4 and 9 (H1, M4).

## Capabilities

### New Capabilities

### Modified Capabilities
- `moving-from-citrus-lime`: the page the owner uses.

## Impact

`src/screens/moving/move-page.tsx`, `src/staff/nav.ts`, `src/staff/nav-icon.tsx`, `src/staff/routes.ts`, `src/staff/app-shell.tsx`, `src/staff/staff-layout.tsx`.
