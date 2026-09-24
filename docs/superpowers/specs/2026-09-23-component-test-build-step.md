# Component tests by a build step

**Date:** 2026-09-23. **Decided by:** Jack (a build step, not a loader
dependency). **Serves:** Task 7 item 7 of
`docs/superpowers/plans/2026-09-20-phase-4-screens.md` - every screen has a
component test.

## Problem

`node --test` strips TypeScript types but cannot parse JSX, and `src/` imports
through the `@/` alias, which Node does not resolve. So no `.tsx` file - the
app shell, and every screen to come - can be loaded by the existing test
runner. Plain `tsc` emit would keep the alias unresolved.

## Approach

1. **`vite.test.config.ts`** builds `src/` (every `.ts`/`.tsx` except the
   browser entry `src/staff/main.tsx`) as an SSR build into `.test-build/`,
   with Rolldown's `output.preserveModules` so each source file becomes one
   `.js` file at the same relative path (`src/staff/app-shell.tsx` ->
   `.test-build/staff/app-shell.js`). The alias is rewritten to relative
   imports; packages stay external, so a test and the built code share one
   copy of React. No CSS plugin: the test build carries no styling.
2. **`pretest`** runs that build, so `npm test` - locally and in CI - always
   tests the current source. No CI change.
3. **`.test-build/`** is gitignored and ignored by eslint.
4. **`tests/helpers/dom.js`** installs a jsdom window as Node globals at a
   given URL, before the component module is imported (the app shell creates
   its router at import time).
5. **Tests stay `.js`** under `tests/screens/`, rendering with
   `@testing-library/react` (already a dev dependency) or `createElement`.

**Verified before relying on it (23 Sep):** Vite 8.2.2 with Rolldown 1.2.6
honours `preserveModules` in an SSR build - seven output files, one per
module, alias rewritten, packages external.

## Done when

- `npm test` builds `.test-build/` first and runs a new
  `tests/screens/app-shell.test.js` that renders `AppShell` in jsdom.
- That test has been seen to fail against a real mutation of
  `src/staff/app-shell.tsx`, and pass once it is restored.
- `npm run typecheck`, `npm run lint`, `npm run build` still exit 0, and
  `git status` shows no `.test-build/` files.

## Not in scope

Styling in tests, a watch mode, and screens themselves.
