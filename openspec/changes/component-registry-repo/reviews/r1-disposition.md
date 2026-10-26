# Disposition, round 1: component-registry-repo

Answers `reviews/challenge-r1.md` (cited as **A**) and
`reviews/challenge-r1-second.md` (cited as **B**). Both reviewed
`f1424df` on `mark/component-registry-spec`.

Each finding was checked against the repository before it was answered.
Checked directly: `src/styles/theme.css` (lines 61, 154-173, 245),
`registry/primitives/button.tsx:23-34`, `registry/patterns/registry.json:13,28,43`,
`registry/patterns/money-input.tsx`, every `tests/` file that reads
`theme.css`, `tests/design-tokens.test.js:59-124`,
`tests/registry/colours.test.js`, `tests/customer/installed-controls.test.js`,
`tests/design-fonts.test.js`, `scripts/ci/check-registry-drift.mjs:1-30`,
`.github/workflows/test.yml:1-20`, `eslint.config.js`, `tsconfig.json`,
`openspec/config.yaml`, `docs/superpowers/plans/2026-09-20-phase-4-screens.md:36-49`,
`docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md:15-26`,
`node_modules/shadcn/dist/chunk-JKB2HING.js:128-131`, the installed versions
of `@playwright/test`, `@eslint/js` and the `@types/*` packages, and
`public/fonts/`.

`openspec validate component-registry-repo --strict` after the changes:
"Change 'component-registry-repo' is valid".

## Summary

| Finding | Severity | Holds? | What changed |
|---|---|---|---|
| A1 Hold for drawn components decided, not asked | P1 | Yes | New open question 6 for Mark, with three options; task 7.6 runs only on option 1 or 3 |
| B1 money-input has no tests; the claim that its tests move is false | P1 | Yes | Proposal corrected; task 1.8 adds the tests; group 5's `vendor/` pull request runs `/review` |
| A11 Same claim about money-input tests | P2 | Yes | Same as B1 |
| B2 / A6 Dependencies between items skip the pinned release; `shadcn add` can change `package.json` | P1 / P2 | Yes | New design §3.6: `sync.mjs` installs dependencies itself from the vendored release and stops on any package change; tests in 5.1, 1.9; a real check in 2.6 |
| A2 Shop colour claim overstated | P2 | Yes | Claim narrowed (on `<html>` versus on a wrapper); test now covers `bg-primary`; spec requirement rewritten |
| A3 shadcn's `accent` means something else here | P2 | Yes | Colour-class table in design §1, with a guard |
| A4 Colour and text-size guards not in the registry | P2 | Yes | Task 1.9 ports them |
| A5 / B3 Tests reading `theme.css` not all repointed | P2 | Yes, with one correction | Task 5.6 names all four; the registry's `colours.test.js` reads a fixture until 2.2 |
| A7 Settings steps need admin; "missing check blocks merge" never proven | P2 | Yes | Steps 4, 5, 7 and new step 8 marked Jack (or Mark as admin); check names corrected; task 4.5 proves it |
| A8 Task 6.1 blocks new components | P2 | Yes | The old rule applies only where `registry/` has a source |
| A9 / B7 Pictures without the real fonts | P2 | Yes | Fonts copied to `site/public/fonts/`; `tests/fonts.test.js`; pictures wait for fonts |
| A10 Phase 4 "not stock shadcn, no Radix" left out; `select` and `calendar` labels stretch Jack's decision | P2 | Yes | Contradiction 4 added; `calendar` now Wheelhouse `month-calendar`; `select` now Hold |
| B4 `theme-split` fixture fails on the first real change | P2 | Yes | Comparison is now "every old rule still present"; capture script for intended changes |
| B5 / A15 Dependency row 1 incomplete | P2 / P3 | Yes | `@types/react`, `@types/react-dom`, `@types/node`, `@eslint/js` and the Playwright image added, at the installed versions |
| B6 First sync's lock bootstrap unspecified | P2 | Yes | `--bootstrap` and `bootstrapLock` (design §3.7), tested in 5.1 |
| A12 / B9 `[careful]` tags match no project list | P3 | Partly | The basis is now stated; task 1.2 tagged |
| A13 Task 7.1 too big | P3 | Yes | Split into 7.1 and 7.2 |
| A14 No one named to merge sync pull requests | P3 | Yes | Design §3.4 names who and what "read the diff" means |
| A16 Dark-look scenario has no test | P3 | Yes | Check added to `theme-split.test.js`; scenario reworded to what is tested |
| B8 "about 35" is unsourced | P3 | Yes | Now says 31 files |
| B10 Task 6.3 misses `tsconfig.json` and `eslint.config.js` | P3 | Yes | Named, with line numbers |
| B11 Snapshot refresh not documented | P3 | Yes | `scripts/upstream/refresh.mjs`, used in the watch issue and task 3.2 |

No finding was rejected outright. One supporting claim in B's phase 1 was
wrong (see B3).

## Answers

### A1 [P1]: Hold for drawn components (holds)

The proposal asked Mark only about dependency rows and account steps.
Holding parts that drawings already show is a product choice, and nobody
asked Mark to make it. Four Hold rows have a drawn use: `sonner`, `command`,
`chart`, `navigation-menu`. Proposal open question 6 now gives three options
with costs: (1) add now, (2) hold, (3) add `sonner` now. `design.md` §1 keeps
showing option 2 until Mark answers. Task 7.6, tagged `[careful]` because it
adds packages, runs only on option 1 or 3. `navigation-menu` needs Radix, so
it waits for Jack whichever option Mark picks. A new dependency row 6
(`recharts`) covers `chart`. Decision log row 10.

### B1 [P1] and A11 [P2]: money-input tests (holds)

Confirmed: no file under `tests/` mentions `money-input`, `parsePence` or
`formatPence`, and no screen imports `MoneyInput`. The proposal sentence
"its tests move with it" was false. It rested on the risky-area claim, so
that claim was wrong too. Changes:

- Proposal "Risky areas" now says money is treated as touched, and gives
  the reasons.
- Task 1.8 `[careful]` adds `tests/money-input.test.js`. The cases are
  listed in design §7, and the example price `£27.75` is taken from
  `consolidate/j11.mjs:58`. The tests pin today's behaviour. So "watched
  failing" means breaking each line they cover, seeing the right test fail,
  restoring it, and checking the file is byte-identical with `git diff`.
- The group 5 pull request that commits `vendor/` runs `/review` (task 5.9,
  group 5 heading).
- A sync that changes an installed copy of `money-input` also gets `/review`
  (design §3.4).
- Spec requirement "The money box keeps working in whole pence".

Decision log row 20.

### B2 [P1] and A6 [P2]: dependencies between items, and packages (holds)

Confirmed: `confirm-dialog`, `data-table` and `money-input` declare
`@wheelhouse/*` dependencies. The app's address is the relative
`/r/{name}.json`, which the drift script's own header says the CLI cannot
fetch. Also confirmed: the installed CLI installs missing npm `dependencies`
during `add` (`chunk-JKB2HING.js:128`, `skipInstalled`, `--force` under npm).
New design §3.6:

- `installOrder` puts each dependency, taken from the vendored release,
  before the item that needs it.
- Each `shadcn add` runs on a copy of the item with its
  `registryDependencies` emptied, so the CLI never looks up a name through
  `components.json`.
- `missingPackages` stops the sync before anything runs.
- If `package.json` or `package-lock.json` still changes, the sync puts the
  bytes back and stops.
- The registry's `tests/registry-deps.test.js` (task 1.9) rejects bare names
  such as shadcn's `button`, and the porting rule in §1 rewrites them.

Tests: task 5.1 (with a fake `run`), and task 2.6, which installs `input`
and then a stripped `money-input` into a scratch app. Task 5.7 is now
verified. Spec requirement "A sync installs only what the pinned release
holds". Decision log row 15.

This removes the Pages contradiction in A6 too. Pages is now only an address
for people trying components. If a person installs from it, the drift check
catches anything that does not match the lock.

### A2 [P2]: shop colour (holds)

Confirmed. `--primary: var(--accent)` sits on `:root` (`theme.css:154`), and
so do `--ring` (`:165`) and `--sidebar` (`:166`). A wrapper override of
`--accent` therefore does not reach `bg-primary`. The Button test read
`var(--accent)` directly and could not catch this.

The `:root` mapping stays as it is, because changing it changes the built
CSS, and D-007 requires `v1.0.0` to be identical. Instead:

- Design §2 now separates an override on `<html>`, which reaches
  everything, from one on a wrapper, which reaches only what reads the
  variable directly.
- The porting table makes every ported component read `var(--accent)`, and
  a guard enforces it.
- The test now has two cases: one shows `bg-primary` following an override
  on `<html>`, the other pins that it does not follow a wrapper.
- The spec requirement is rewritten to match.
- Design §2 also notes that Button's `primary` look reads the fixed
  `--wh-brand` (`button.tsx:31`) on purpose.

Decision log row 11.

### A3 [P2]: `accent` meaning (holds)

Confirmed: `--accent` is the charcoal action colour here (`theme.css:61`).
No file in `registry/` or `src/` uses `bg-accent`, `bg-primary` or `ring-ring`
today; everything uses the `[var(--token)]` form. Design §1 now has a
colour-class table, which follows the built button (`button.tsx:23-34`):

- `bg-accent` becomes `bg-[var(--wh-hover)]`.
- `bg-primary` becomes `bg-[var(--accent)]`.
- `ring-ring` becomes `outline-[var(--accent)]`.
- Further rows cover muted text and surfaces, panels, borders and the
  destructive look.

A class the table does not cover is logged in `decided-while-building.md`
under `CLAUDE.md` rule 3. Following the closest built pattern needs no
separate design approval. Task 1.9's guard rejects the shadcn names.
Decision log row 12.

### A4 [P2]: guards in the registry (holds)

Confirmed. The ESLint gate catches only hex values; palette classes, colour
functions and fixed sizes are caught only by
`tests/design-tokens.test.js:65-117`. Task 1.9 ports those into
`tests/guards.test.js`. The existing palette pattern ends in `\b` and would
miss `bg-black/50`, so the port is extended to catch an opacity suffix. The
`--muted` check was already copied in 1.5 as part of `colours.test.js`.
Decision log row 13.

### A5 [P2] and B3 [P2]: tests that read `theme.css` (holds, with one correction)

Confirmed for `design-sand.test.js:17`, `design-fonts.test.js:27`,
`design-tokens.test.js:120` and `tests/registry/colours.test.js:10`. Task 5.6
now names each one with its new path. The assertions do not change. The
messages at `design-tokens.test.js:100,116` now name the tokens file.
`colours.test.js` reads both files. Design §5 step C no longer says
"untouched".

Correction to B's phase 1: `tests/staff-app-theme.test.js` does not read
`theme.css`. It names the file only in a comment (line 14) and reads
`public/app.js` and `public-storefront/storefront.js`. No change was needed
there; design §0 records this.

B's ordering point holds: in the registry repository, `colours.test.js` had
nothing to read in group 1. Task 1.3 now copies `theme.css` as a fixture at
the same commit. Task 1.5 points `colours.test.js` at it, and task 2.2
repoints it at the tokens file. Decision log row 14.

### A7 [P2]: admin, and proving a missing check blocks a merge (holds)

Mark's admin status was not verifiable from here. The repository records
that repo admin is not a given (`test.yml:5-8`). Changes:

- Steps 4, 5 and 7 are marked Jack, or Mark once Jack makes him admin.
- New step 8 covers the "allow Actions to create pull requests" setting,
  marked as from memory.
- Check names are corrected to job ids: `test` (`test.yml:13`) in the app,
  and `ci` in the registry, where `ci.yml` is specified with a job id `ci`.
- Task 4.5 opens a `[skip ci]` pull request with no check and must see
  `gh pr merge` refused before it is ticked. That `[skip ci]` stops the run
  is from memory; the task stops and asks if it does not.

Decision log row 16.

### A8 [P2]: task 6.1 (holds)

Confirmed: `installed-controls.test.js:35` fails any installed file without a
`registry/` source. Task 6.1 now applies the old byte-for-byte rule only to
names that have a source there; anything else is checked against the lock.
Decision log row 17.

### A9 [P2] and B7 [P2]: fonts (holds)

Confirmed: `public/fonts/` holds the two `.woff2` files and their `OFL.txt`.
Task 2.4 copies them to `site/public/fonts/` and adds `tests/fonts.test.js`.
Pictures wait for `document.fonts.ready`, and task 3.3 checks that a dropped
`@font-face` rule fails the pictures. Decision log row 18.

### A10 [P2]: Phase 4 contract and decision scope (holds)

Confirmed: line 39 says "not stock shadcn, and carry no Radix dependency",
and Jack's 26 Sep decisions are about the booking screens. Decision 2 also
says "a dropdown is added if a long one appears" (lines 23-24). Changes:

- Contradiction 4 added for Jack; only group 7 waits on it, and only if he
  rules out porting.
- `calendar` relabelled Wheelhouse `month-calendar`, the hand-built
  calendar decision 1 chose.
- `select` relabelled Hold until a long list appears, never on the booking
  screens.
- Counts now: Add 21, Wheelhouse 13, Hold 11, Leave out 10.

Decision log row 2 amended, row 19.

### B4 [P2]: `theme-split` fixture (holds)

A frozen equal-set comparison would fail on group 7's keyframes. The test now
checks that every captured rule is still present with the same declarations,
so added rules pass. A release that changes or removes a rule on purpose
regenerates the fixture with `scripts/registry/capture-css-rules.mjs` in its
sync pull request, where the diff shows. The sync job never regenerates it,
and nobody edits it by hand (design §5). Decision log row 21.

### B5 [P2] and A15 [P3]: dependency row 1 (holds)

The missing packages were added at the versions installed in the app:
`@types/react` 19.2.18, `@types/react-dom` 19.2.5, `@types/node` 26.4.0,
`@eslint/js` 10.0.1, `@playwright/test` 1.63.0. The Playwright Linux image
was added too. Its tag format is from memory, and task 3.3 checks it. Task
1.2 now installs exactly row 1 and nothing else. Decision log row 24.

### B6 [P2]: first-sync bootstrap (holds)

Design §3.7 adds `--bootstrap` and `bootstrapLock`, which take the names from
`src/components/ui/*.tsx` the way `installed-controls.test.js:29` does. The
lock is written only by `writeLock`. Both refusals are tested in task 5.1,
and task 5.3 uses it. Decision log row 22.

### A12 and B9 [P3]: `[careful]` tags (partly holds)

`openspec/config.yaml` has no careful list; the reviewers are right about
that. The tags follow the spec author's role list instead: money, CI and
deploy, dependencies. `tasks.md` now says so and names each tagged task. Task
1.2 (installs row 1) was missing a tag and now has one. New tasks 1.8 and 7.6
are tagged too. Mark approves the tags with the spec.

### A13 [P3]: task 7.1 size (holds)

Split into 7.1 (`card`, `badge`, `alert`, `separator`) and 7.2 (`skeleton`,
`spinner`, `empty`); the later tasks are renumbered.

### A14 [P3]: who merges sync pull requests (holds)

Design §3.4 says:

- Mark merges, or either person (working agreement).
- "Read the diff" means the changelog section, every file changed under
  `src/components/ui/` and `src/styles/`, and the registry's changed
  pictures when the changelog says something changes on screen.
- `vendor/` JSON is covered by the lock and the drift check, not read line
  by line.

### A16 [P3]: the dark-look scenario (holds)

`tests/theme-split.test.js` now fails if any file under `src/`, any `*.html`
page or any installed component adds the `dark` class, and task 5.5 watches
it fail. The spec scenario now describes what is tested.

### B8 [P3]: "about 35" (holds)

Proposal open question 1, option 2 now says the pop-ups in the 31 files that
import `@/components/ui/dialog`.

### B10 [P3]: task 6.3 misses config files (holds)

Confirmed: `tsconfig.json:26,29` and `eslint.config.js:25,82,107`. Task 6.3
now names them, adds `registry` to the `REACT_SOURCES` glob clean-up, widens
the search, and adds typecheck and lint to its checks.

### B11 [P3]: snapshot refresh (holds)

Added `scripts/upstream/refresh.mjs` (`npm run upstream:refresh`). The watch
issue's body gives the steps (design §4.3), and task 3.2 builds and runs the
script.

## Still open after this round

- Jack: open questions 1 to 3 and contradictions 1 to 4. Contradiction 4 is
  new.
- Mark: open questions 4 to 6. Question 6 is new and blocks only task 7.6.
- Not proven yet, each with the task that proves it: the live shadcn list
  (1.1), CLI delivery of a stripped dependent item (2.6), the Playwright
  image tag (3.3), the Actions setting name (5.8), `[skip ci]` producing a
  check-less pull request (4.5).
