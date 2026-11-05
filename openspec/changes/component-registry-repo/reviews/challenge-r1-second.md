# Challenge review — component-registry-repo, round 1 (second)

Change: `component-registry-repo`
Change-dir: `openspec/changes/component-registry-repo/`
Branch checked: `mark/component-registry-spec` @ f1424df
Validation: `openspec validate component-registry-repo --strict` → "Change 'component-registry-repo' is valid" (exit 0)

**Verdict: partial** — the architecture (vendored release + lock + sync PR +
drift check) is sound and almost every citation in the change verifies against
the repo, but there are two P1 problems: a false money-safety claim in the
proposal, and a hole in the sync mechanism for the three items that depend on
other items (one of which is the money box). Both must be fixed before the
tasks they gate.

**Confidence: high** on all findings except the CLI behaviour inside finding
2, which is medium (inferred from the repo's own documentation of the CLI,
not executed — I could not run `shadcn add` under this role's read-only
constraint).

## Phase 1 — what I derived before reading the change

From the "Why" section only, I established from the repository:

- 15 registry items (9 primitives, 6 patterns — `registry/*/registry.json`),
  11 installed copies in `src/components/ui/`; `table`, `data-table`,
  `money-input`, `confirm-dialog` are registry-only.
- The money box (`registry/patterns/money-input.tsx`, `parsePence` /
  `formatPence`) has **no test anywhere in the repo** (repo-wide grep for
  `money-input|moneyInput|parsePence` hits only `registry/`, `public/r/`,
  `docs/` and this change). Any safe-move claim for it must rest on something
  else, or a correct change must add the test first.
- The checks that must survive: `check-registry-drift.mjs`,
  `tests/customer/installed-controls.test.js`, `tests/design-sand.test.js`,
  `tests/registry/*` (8 component tests + colours), the two ESLint gates,
  `vite.registry-test.config.ts` + its half of `pretest`, the CI steps
  (`test.yml:91-98`), `Dockerfile:15,42`.
- `src/styles/theme.css` is read raw by four test files
  (`design-sand`, `design-tokens`, `design-fonts`, `staff-app-theme`), so a
  tokens split must enumerate them.
- The drift check's own header documents that `components.json`'s
  `"@wheelhouse": "/r/{name}.json"` is a relative URL the CLI cannot fetch —
  so any sync design that runs `shadcn add` on items with
  `registryDependencies` (`@wheelhouse/*`) has a resolution problem to answer.
- The installed `shadcn` 4.19.1 carries no component index; it fetches
  `https://ui.shadcn.com/r/index.json` at runtime (verified in
  `node_modules/shadcn/dist/chunk-JKB2HING.js`), so "the full range" is not
  locally verifiable — a correct change must pin a fetched snapshot or say so.
- Recorded constraints: D-005/D-006/D-007 and open items 1 and 3
  (`2026-08-31-frontend-platform.md`), Jack's 26 Sep no-Radix/no-dropdown
  decisions (`2026-09-26-book-c-form-controls-design.md:19-22`), Soft sand
  48/53, the Phase 4 contract ("components … carry no Radix dependency",
  `2026-09-20-phase-4-screens.md:36-49`).

## Findings

1. **[P1] The proposal's money-safety claim is false, and the change adds no
   test for the money component it relocates.** `proposal.md:82-83` justifies
   "Risky areas: none of the four" with "the money box component `money-input`
   is moved byte for byte **and its tests move with it**". There are no tests
   to move: no file under `tests/` references `money-input`, `parsePence` or
   `formatPence`. The change then designs the new repository's entire suite
   (identity, tokens, visual, dialog behaviour, coverage — tasks 1.3-3.4) and
   never adds a pence-parsing test, so the component
   `docs/superpowers/plans/2026-09-20-phase-4-screens.md:28` calls the
   enforcement point for integer pence ships to its new home with only a
   byte-identity pin. Design.md is honest about the same gap for `dialog`
   ("it has no component test today", §6, fixed by task 2.5); nothing
   equivalent exists for `money-input`, and `.agents/STATUS.md` shows
   sales-in-pence work (migrations 075-078) landing this week, making the
   parser live infrastructure. Severity is P1 because the finding touches
   money: the claim is load-bearing for skipping the working agreement's
   money `/review` gate, and it is verifiably untrue. Fix: a task in group 1
   or 2 that writes real `parsePence`/`formatPence`/draft-behaviour tests,
   watched failing for the right reason; correct the proposal sentence;
   reconsider whether the move PRs take `/review`.

2. **[P1] The sync mechanism cannot install the three items with
   `registryDependencies` — including `money-input` — and in the Pages
   configuration it silently installs unpinned code.** `money-input`,
   `data-table` and `confirm-dialog` declare
   `registryDependencies: ["@wheelhouse/input"]` etc.
   (`registry/patterns/registry.json`). Neither `design.md` §3/§7 nor any task
   says how `scripts/registry/sync.mjs` (`--add <name>`, or a full sync that
   ever includes them) resolves those names: the CLI resolves a namespaced
   dependency through `components.json`'s `registries`, whose `@wheelhouse` is
   `"/r/{name}.json"` — "a relative URL with no host - so there is nothing
   for the CLI to fetch without standing up a server"
   (`scripts/ci/check-registry-drift.mjs:13-21`, the change author's own
   words). Two failure branches: (a) Pages off — `shadcn add
   ./vendor/.../money-input.json` fails outright, so the first dependent
   install cannot be built as written; (b) Pages on (task 5.7) — the CLI
   fetches the dependency from Pages, which serves the **latest** build, not
   the pinned release, and the lock then hashes and blesses whatever arrived,
   breaking design §3.2's "what is tested is exactly what is pinned" and the
   spec's "A registry change reaches the app only through a pull request with
   every test passing" for the dependency's content. Group 5 syncs only the
   11 installed items (no `registryDependencies` among them), so the hole
   first bites when a screen piece installs `money-input` — money again — or
   when a ported item in group 7 keeps an upstream `registryDependencies`
   line (e.g. `input-group`, task 7.3). Task 2.6 verifies `shadcn add` byte
   delivery only for `theme`, which has no dependencies. Fix: specify that
   `sync.mjs` resolves `registryDependencies` from the vendored snapshot of
   the same release (install dependencies first from `vendor/`, in order, or
   rewrite the dependency references to the vendored files), and extend the
   2.6-style verification to a dependent item.

3. **[P2] The tests that read `src/styles/theme.css` raw are not all
   accounted for; `npm test` cannot pass at the points the tasks require.**
   - `tests/registry/colours.test.js:10` builds its DEFINED set from
     `src/styles/theme.css`. After task 5.6 cuts that file down to imports +
     cursor/print/motion rules, every colours test fails ("reads names
     theme.css does not define"). Task 6.2 widens the files it scans but no
     task repoints its CSS source at `src/styles/wheelhouse-tokens.css` — and
     task 5.9 requires `npm test` green inside the same group.
   - Ordering bug in the registry repo: task 1.5 copies `colours.test.js` and
     requires "Verify `npm test` passes", but the only CSS it could read there
     (`registry/theme/wheelhouse-tokens.css`, or the fixture from task 2.1)
     does not exist until group 2. "Adjust only paths" has no existing target
     in group 1.
   - `tests/design-fonts.test.js:27` asserts `src/styles/theme.css` itself
     declares both `@font-face` rules; design §2 item 2 moves them into the
     tokens file. Task 5.6 names `design-sand` and `design-tokens` only, so
     this test breaks with no owning task.
   - `tests/design-tokens.test.js:119-120` reads `theme.css` text and asserts
     the `--text-*` scale definitions, which move. Task 5.6 lists it in the
     verify step but, unlike `design-sand`, gives no repointing instruction.

4. **[P2] `tests/theme-split.test.js` as specified goes red on the first
   legitimate registry change, with no update path.** Design §7 freezes "the
   built CSS's set of rules equals the set captured before the split,
   `tests/fixtures/theme-css-rules-before.json`". Design §2 item 7 has group 7
   add open/close keyframes to the tokens file, so the `v1.1.0` sync
   legitimately changes the built CSS and the frozen fixture fails on a
   correct change. No regeneration command or update rule is specified, and
   the fixture is a pinned artifact the project forbids hand-editing. State
   how the fixture is regenerated and verified, or scope the comparison.

5. **[P2] Dependency row 1 omits packages the registry repository cannot
   build without.** The proposal's dependency table (the per-row approval
   list) lacks: `@types/react` and `@types/react-dom` (task 1.4 adds a
   `typecheck` script; the ported TSX cannot typecheck without React's types —
   the app carries both in `package.json` devDependencies), `@types/node`
   (the ported Vite/Playwright configs use `node:url`, `import.meta.dirname`),
   and `@eslint/js` (imported at `eslint.config.js:1`, which task 1.7 ports).
   Each missing row forces the builder into an unapproved install or a stall.
   Add the rows so Mark's approval covers what group 1 actually installs.

6. **[P2] The first sync's bootstrap is unspecified.** Design §7's
   `planInstall(lock, …)` reads the installed names from the lock, but no lock
   exists before the first sync, and task 5.3's "with `installed` listing the
   11 installed components" never says how they get there — hand-written lock
   (a hand-edited lockfile, which the drift design exists to prevent),
   `--add` per component, or discovery from `src/components/ui/` the way
   `installed-controls.test.js` does it. A coder hits this in task 5.1/5.3.
   Specify the bootstrap path and its test.

7. **[P2] The registry's pictures never render the approved fonts.** Design
   §2 item 2 keeps `@font-face` URLs that "expect the app to serve
   `/fonts/…`"; the §4.2 layout has no fonts and nothing serves them to
   `site/`, so the Playwright baselines (task 3.3) render every component in
   a fallback face. The fonts are part of the approved look (decisions 48/53)
   and are deliberately self-hosted (`tests/design-fonts.test.js` exists
   because the offline till must carry them). Two consequences: the
   "pictures of every component" never show the Soft sand look's typeface,
   and a font regression in the tokens file (a dropped `@font-face`, a wrong
   stack) is invisible to the visual gate. Copy `public/fonts/` into the
   registry repo (or serve them to `site/`) in a task.

8. **[P3] "about 35 screens' pop-ups"** (`proposal.md:220`, open question 1
   option 2) is unsourced; the same sentence's parenthetical is exact (31
   files import `@/components/ui/dialog` — verified). Say 31.

9. **[P3] The `[careful]` convention is this change's own and is applied
   inconsistently.** `openspec/config.yaml` `rules.tasks` lists no careful
   kinds, so the tag has no project definition to check against (fine, but
   worth saying). Against the proposal's own sentence ("adding dependencies …
   These tasks are tagged `[careful]`", `proposal.md:86-88`), task 1.2 —
   which installs dependency row 1 — is not tagged, while 8.2 (the Radix
   dependency) is.

10. **[P3] Task 6.3's deletion misses two files.** Its search list covers
    `/r/` and `public/r` across `src/`, `public/`, `server/`, `tests/`; it
    cannot find `tsconfig.json`'s `"@/registry/*"` alias and `"include":
    ["src", "registry"]`, or `eslint.config.js`'s `registry/**` file scopes
    (lines 82, 107) and `@/registry` ban, all left dangling after `registry/`
    is deleted. Name them in the task.

11. **[P3] The snapshot-refresh step is undocumented.** `check-coverage`
    compares `upstream/coverage.json` with `upstream/index.snapshot.json`,
    which only task 1.1 fetches. When the weekly watch issue is answered by
    labelling a new shadcn component, `findNotUpstream` then fails until
    someone re-fetches the index — a step no task names, and the spec's "SHALL
    fail when a component is unlabelled" only holds through this
    stale-by-design snapshot. Add the refresh to the watch-issue workflow or
    to a task.

## What I checked that passed

- Every opened citation matched its source: `j06:25`, `j08:13`, `j14:23`,
  `j18:38`, `j19:7` (toasts); `j12:15` (context menu), `j12:18`, `j12:47`,
  `j12:10`, `j06:56`, `j11:95`, `j17:9`, `j16:17`, `j02:59`, `j07:44`,
  `j08:29`, `j08:64`, `j09:24`, `j10:28`, `j19:10`, `ja:10`, `ja:18`;
  `README.md:188,195,204`; `app-map.mjs:179-195`; build plan line 85 (~240
  PRs) and 587 (`diary-stack-hover`); `workshop-day-review.md:238-242`
  (decision 50); `2026-09-27-workshop-day-review.md:228-261` (48/53);
  `2026-08-31-frontend-platform.md:23-27,89-92`; `book-c-form-controls-design.md:19-22`;
  `phase-4-screens.md:36-49`; `public/app.js:4488` (`#2f5f96` = rgb(47,95,150),
  matching the spec's Ocean Blue scenario); `src/screens/book/sign-in.tsx:116`;
  `signin.mjs:269-274`; `dialog.tsx:45-53`; `installed-controls.test.js:8-13`;
  `eslint.config.js:12-34,112-118`; `test.yml:91-98`; `Dockerfile:15,42`;
  `row-switch.tsx` 48px (`min-h-12`).
- Counts and inventories: 15 items / 9+6, 11 installed, 8 component tests +
  colours, ~1,900 lines (actual 1,928), ~68 KB released JSON (actual 68,434
  bytes), the §1 table's four labels sum to its stated 55/21/12/10/12.
- Design §0's claims about the installed CLI verified in
  `node_modules/shadcn/dist/chunk-JKB2HING.js` and `schema/index.d.ts`
  (`REGISTRY_URL`, `ui.shadcn.com/r`, `new-york-v4`, `radix`/`base`,
  deprecated `toast`→`sonner`, `cssVars`/target/params/headers schema).
- The from-memory disclosures (§0, §8 row 9) are honest and each has a
  fail-closed task (1.1 + `check-coverage`; 5.8's watch for the `GITHUB_TOKEN`
  trigger behaviour). I could not fetch the live shadcn index either (same
  network restriction), so I verified the mitigation rather than the list.
- Contradictions with recorded decisions are correctly flagged for Jack
  (Radix vs his 26 Sep decision 1 and the Phase 4 contract's "no Radix
  dependency"; deleting `registry/` and `public/r/`; tokens mastership), and
  the open questions block only the tasks they should.
- `[careful]` tags cover the genuinely risky operations (money pinning 1.3/1.4,
  workflows 3.5/5.8, deletion + Dockerfile 6.3, Radix 8.2); finding 9 notes
  the one gap.
- The spec delta's requirements trace to design sections and tasks, including
  the rollback/`skipVersions` requirement and the "check never ran" scenario
  (backed by Steps for Mark 7).
