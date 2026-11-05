# Challenge r1: component-registry-repo

- Reviewed at: `f1424df87c7b7629ce0b23b0dc9d795209311e3e` (branch `mark/component-registry-spec`)
- Verdict: **partial**
- Confidence: medium (repository checked directly; GitHub and shadcn network behaviour not checked, and marked where it matters)
- `openspec validate component-registry-repo --strict`: "Change 'component-registry-repo' is valid" (exit 0)

## Phase 1: what I worked out before reading past "Why"

From the repo alone, a correct change would have to:
1. Move `registry/`, `public/r/`, `tests/registry/*`, the drift script and `vite.registry-test.config.ts` out, and replace every app check that reads `registry/` or `src/styles/theme.css`. Those checks are `installed-controls.test.js`, `colours.test.js`, `design-tokens.test.js`, `design-sand.test.js` and `design-fonts.test.js`.
2. Port the app's guards (raw colours, fixed text sizes, `--muted` misuse, ESLint) into the new repo, so a bad component is rejected before release and not only later in the app's sync pull request.
3. Reconcile shadcn's token meanings with Wheelhouse's. Here `--accent` is the charcoal action colour (`theme.css:61`, `:245`), but in stock shadcn it is the subtle hover surface. Also, `--primary: var(--accent)` is resolved on `:root` (`theme.css:154`).
4. Make `registryDependencies` (`@wheelhouse/input`, `@wheelhouse/dialog`…, `registry/patterns/registry.json:13,28,43`) resolve to the pinned release, not to whatever address `components.json` holds.
5. Recognise that the GitHub settings (branch protection, Actions permissions, secrets) sit on Jack's personal repositories, where Mark is a collaborator, not an admin (`.github/workflows/test.yml:5-8`: "Renaming needs repo admin").
6. Put the "full range" interpretation, and especially deferring parts that are already drawn, to Mark as a choice.

Points 1 to 6 are where the change and my derivation differ. They are the findings below.

## Findings

1. **[P1] Holding drawn components is a product answer made by assumption.** Mark asked for "a FULL range of shadcn components available for everything we plan to use". `design.md` §1 labels `sonner` (toasts with Undo, drawn at j06:25, j08:13, j14:23, j18:38, j19:7), `command` (building blocks 17 and 21) and `chart` (block 5) as **Hold**. Each is only added "in the piece that first needs it". These are planned uses with drawings, so holding them narrows Mark's request. That is defensible, but it is decided in the design rather than asked. Proposal "Open questions" 4–5 ask Mark only about dependency rows and account steps, not about Add versus Hold. Needed: an open question for Mark with numbered options, for example (1) add everything with a drawn use now, including its package, or (2) hold until the piece starts, with the cost of each.

2. **[P2] The shop-colour mechanism is overstated, and its test cannot catch the gap.**
   - `design.md` §2 says setting `--accent` "on `<html>` or on a wrapping element … recolours every component". The spec has the same claim ("Components SHALL take the shop colour from `--accent`…").
   - But `theme.css:154` defines `--primary: var(--accent)` on `:root`. That value is worked out once at `:root`, so a wrapper that overrides `--accent` does not change `bg-primary`, `ring-ring` (`--ring: var(--accent)`, `:165`) or `--sidebar`.
   - Stock shadcn components, which group 7 ports, colour themselves with `bg-primary` and `ring-ring`.
   - The planned test (`tests/visual/accent-override.spec.ts`) checks only the Wheelhouse `Button` accent variant, which reads `var(--accent)` directly (`registry/primitives/button.tsx:32`). Even Button's `primary` variant reads `--wh-brand` (`:31`). So the test passes while most components ignore a wrapper override.
   - Needed: either limit the claim to overrides on `<html>`, or change the mapping. Then test a component that uses `bg-primary`.

3. **[P2] shadcn's `accent` means something different here, and nothing says how ported components handle it.**
   - In stock new-york components, `accent` is the light hover/focus surface: `hover:bg-accent` on outline and ghost buttons, `focus:bg-accent` on menu items, the "on" state of toggles.
   - In Wheelhouse, `--color-accent` is the charcoal action colour (`theme.css:61`, `:245`), with `--accent-foreground` set to light text.
   - Ported as-is, every menu hover and every ghost hover becomes a solid charcoal block. A shop override would then also recolour hovers. That is a visual change (D-007; "changing a screen's design" needs Jack).
   - `design.md` §1 "How a ported component is changed" says only "the Soft sand classes". It needs an explicit rule, for example "`bg-accent` in shadcn becomes `bg-[var(--wh-hover)]`" or similar, with the drawing or decision that sets the hover colour.

4. **[P2] The registry repo does not port the app's colour and text-size guards, so a broken component can be released.**
   - `design.md` §1 says ported components use "tokens only, never a raw colour, as the ESLint gate already demands". The ESLint gate (`eslint.config.js:41-57`) catches only hex values.
   - Palette classes and colour functions are caught by `tests/design-tokens.test.js:65-101`, and fixed text sizes (Larger text) by `:112-117`. Neither file is copied by task 1.5, which copies only `tests/registry/*.test.js` and two helpers.
   - Stock shadcn uses `bg-black/50` (dialog and sheet overlays) and `text-white` (destructive), and can carry `text-[…px]`. Such a component passes registry CI, gets released, and only fails in the app's sync pull request.
   - Needed: a task porting those three guards (raw colours, fixed sizes, `--muted`) into the registry's `npm test`, each watched failing.

5. **[P2] Splitting the tokens file breaks app tests that task 5.6 neither names nor repoints.** After task 5.6, `src/styles/theme.css` no longer defines the tokens, the fonts or the text scale:
   - `tests/registry/colours.test.js:10-11` builds its list of defined names from `theme.css`, so every registry file will "read names theme.css does not define".
   - `tests/design-fonts.test.js:27` expects both `@font-face` rules in `src/styles/theme.css`.
   - `tests/design-tokens.test.js:120-124` looks for `--text-size-*` and `--text-{xs…3xl}` in `theme.css`.

   Task 5.6 repoints only `design-sand.test.js`. It then asks the coder to "verify `design-tokens.test.js` pass", which as written will fail. The spec also says the existing checks keep working "untouched" through step C (`design.md` §5). Needed: list all four files, say what each reads after the split, and say whether `colours.test.js` reads the tokens file or both files.

6. **[P2] Dependencies between registry items bypass the pinned release.**
   - Three items carry namespaced dependencies: `confirm-dialog` (`@wheelhouse/dialog`, `@wheelhouse/button`), `data-table` and `money-input` (`registry/patterns/registry.json:13,28,43`). `shadcn add ./vendor/…/<name>.json` resolves these through `components.json`'s `@wheelhouse` address, not through `vendor/`. The schema requires a `{name}` URL (`node_modules/shadcn/dist/chunk-4WBGNKSZ.js:1`).
   - Today that address is the relative `/r/{name}.json`, which task 6.3 deletes. After task 5.7 it is Pages, which serves the latest build. That contradicts §3.2's "what is tested is exactly what is pinned".
   - Ported shadcn files also list shadcn's own names in `registryDependencies` (for example `input-group` → `button`, `input`, `textarea`). Left as they are, `--add input-group … --overwrite` would fetch shadcn's stock `button` and overwrite Wheelhouse's.
   - Separately, the installed shadcn installs an item's npm `dependencies` during `add` (`chunk-JKB2HING.js:128`, `skipInstalled`, and `--force` under npm). So a sync or `--add` can change `package.json` and the lockfile without the dependency approval the proposal requires, and the lock's hashes do not cover that.
   - Task 5.7 has no verification at all.
   - Needed: rewrite `registryDependencies` to `@wheelhouse/*` when porting; make `sync.mjs` resolve them from `vendor/` (or fail); fail the sync if `package.json` changes; and a test for each.

7. **[P2] The steps given to Mark need repository admin, and the "missing check blocks merge" guarantee is never proven.**
   - Steps for Mark 4 (protect `main`), 5 (save a secret in `wheelhouse-epos`) and 7 (make `Tests` required) all need admin on Jack's personal repositories. The repo itself records that this is not Mark (`.github/workflows/test.yml:5-8`, "Renaming needs repo admin"). The proposal already moves step 2 to Jack for the same reason, but not these.
   - Also missing (from memory, not checked): the repository setting that lets GitHub Actions create pull requests ("Allow GitHub Actions to create and approve pull requests"). Without it, `gh pr create` with `github.token` in §3.3 step 5 fails.
   - Task 4.4 only applies the setting. Nothing tries to merge a pull request with no check and watches it refused. The spec scenario "The check never ran → it cannot be merged" therefore rests on an untested setting, which is the "absent check" trap the global rules forbid.
   - Minor point in the same area: the required check's name will be the job id `test`, not the workflow name `Tests` (`test.yml:13`), and the same applies to `CI` in the registry. Needed: move steps 4, 5, 7 and the Actions setting to Jack (or say Mark is given admin), and add a task that proves a check-less pull request is blocked.

8. **[P2] Task 6.1 blocks every new component until Jack approves the deletion.** 6.1 keeps the rule that every installed file "must still match its source" in the app's `registry/` while that folder exists. A new component installed by `sync.mjs --add` (for example `switch` for `row-switch.tsx`, `design.md` §5) has no source in the app's `registry/`. So the test fails until task 6.3, which waits on Jack's open question 2. Needed: apply the old rule only to the 15 original items, or only to names present in `registry/`.

9. **[P2] Registry pictures would be taken without the real fonts.** The tokens file's `@font-face` rules point at `/fonts/public-sans/…` and `/fonts/dm-mono/…` (`theme.css:41-54`). The registry repo's `site/` (task 2.4) and its baselines (task 3.3) have no font files and no task that copies them (with `OFL.txt`, as `tests/design-fonts.test.js:20-23` requires in the app). The pictures would show fallback fonts and so would not check the Soft sand look they claim to check.

10. **[P2] A recorded constraint is left out of the citation and the contradiction list.** The proposal cites `docs/superpowers/plans/2026-09-20-phase-4-screens.md:36-49` for "components come from the registry". The same range (line 39) says components come from the registry, "not stock shadcn, and carry no Radix dependency". Separately, `select` is labelled **Leave out** citing Jack's 26 Sep decision 2, but that decision (`2026-09-26-book-c-form-controls-design.md:23-24`) is about the booking screens and says "a dropdown is added if a long one appears". Applying it app-wide as "Leave out" rather than "Hold" stretches the decision. Needed: list both under "Contradictions flagged for Jack", and relabel `select` (and `calendar`, also booking-scoped at `:19-22`) with the decision's actual scope.

11. **[P2] Tests are claimed for `money-input` that do not exist.** The proposal ("Risky areas") says `money-input` "is moved byte for byte and its tests move with it". There are no `money-input` tests: `tests/registry/` holds button, checkbox, choice-card, day-diary, month-calendar, photo-picker, pill-group, textarea and colours. The only guard is the identity test (task 1.3). Because this is the money box, fix the claim; adding a component test is optional.

12. **[P3] The `[careful]` tags match no listed kind.** `openspec/config.yaml` has no `rules.tasks` careful kinds; its `tasks` rules are tests-first, PR size and finish checks. So the tags on 1.3, 1.4, 3.5, 5.8, 6.3 and 8.2 are not required by any rule. Keep them as ask-first markers if wanted, but say so.

13. **[P3] Task 7.1 is larger than the stated PR size.** It lists 7 components against the stated "About 3 to 5 components per pull request".

14. **[P3] No one is named to merge sync pull requests.** `CLAUDE.md` rule 4 assumes the author self-reviews, and a bot has no author. Say whose job it is and what "read the diff" means for 68 KB of JSON plus component changes.

15. **[P3] Dependency row 1 is incomplete.** It omits `@eslint/js` (imported by `eslint.config.js:1`), the `@types/*` packages, and the Playwright Linux container image named in §4.3.

16. **[P3] The spec scenario "Opening any screen → shows the Soft sand light look" has no task that checks it.** It is only implied by `theme-split.test.js`.

## What was checked and held up

- `components.json`, `package.json` versions and scripts, the contents of `registry/` and `public/r/`, the 11 installed copies, and the 31 files importing the dialog: these match `design.md` §0.
- `Dockerfile:15,42`, the CI drift steps (`test.yml:91-98`), and Ocean Blue `#2f5f96` (`public/app.js:4488`) are as cited.
- D-005 open item 3 (`frontend-platform.md:89-92`) and the open dark-palette item are as cited.
- The `j*.mjs` evidence lines I sampled match their claims (j06:25,56; j08:13,29,64; j09:24; j10:28 is marked "inferred" in the source; j12:10,15,18,47; j16:17; j19:7,10).
- The §1 table has 55 rows, and the counts 21/12/10/12 add up.
- The Radix contradiction with Jack's 26 Sep decision is flagged and blocks only group 8.
- The real-account steps are written as steps, not done.
