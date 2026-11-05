# Proposal: Wheelhouse's components in their own repository (component-registry-repo)

> **Status, 26 Oct 2026 (Mark's session).** The repository is called **`react-repo`**
> (not `wheelhouse-registry`; the name is changed throughout). What was built
> locally, at `~/Documents/GitHub/react-repo`, differs from this document in
> scope and in a few places, and is the more recent truth:
>
> - **Scope is wider.** Mark asked for the full shadcn range and "everything we
>   would ever expect": the registry holds all 61 shadcn components shadcn serves
>   for the style we use, and **93 Wheelhouse pieces** built from the 47 building
>   blocks (the till, the diary, settings, forms, customer pages, reports), each
>   with tests, a gallery demo and an accessibility check. See `docs/component-plan.md`
>   in that repository. This document's "version 1.0.0 is the 15 components as
>   they are today, byte for byte" was **not** done: the 15 are not carried over
>   as they were; the app's own `registry/` stays until Jack says it can go.
> - **Themes.** Eleven themes (Soft sand, shadcn's five base colours, five accent
>   colours), each light and dark, with a theme switcher, so designs can be tried
>   on the app. Success, warning and info colours were added (shadcn has none).
> - **Radix.** Mark approved option 1 (Radix only for menus, pop-overs, hover
>   previews and tabs, browser controls elsewhere). 37 of shadcn's 61 components use
>   Radix, so it is in `react-repo`; it reaches the app only when a screen installs
>   one. **Jack's yes is still needed** (it reverses his 26 Sep choice), as is his yes
>   to deleting the app's `registry/` later.
> - **Not done here, and still needs the repository:** the app's sync job
>   (task groups 4 to 6), the checks that run on GitHub, Pages, and the first
>   release. Task groups 1 to 3 were done differently (see that repository's README
>   and `docs/adding-components.md`); `npm run check:consumer` there installs
>   everything into a fresh app and type-checks it.
> - **Waiting on Jack:** create the empty repository, add Mark, then the settings
>   in "Steps for Mark" (#511).

## Why

Mark, 25 Oct: "we want to use shadcn for react components and tailwind 4 for
theming. Create a react registry we can pull from and make sure it is themed
with tailwind. We want a FULL range of shadcn components available for
everything we plan to use. Make this in a separate repo and set this up so it
inherits it whenever changes are made."

In plain English: the buttons, boxes, pop-ups and other pieces every screen is
built from (the "components") live today inside the app's own repository, in
`registry/`. There are 15 of them (9 basic pieces in `registry/primitives/`, 6
bigger ones in `registry/patterns/`, listed in each folder's `registry.json`).
The app's screens use 11 of them, copied into `src/components/ui/`. Everything
else a screen needs (a menu, a switch, a row of tabs) has been built by hand
inside that screen: for example `src/screens/settings/row-switch.tsx` and the
hand-built menus and tabs in `src/screens/diary/diary-page.tsx`. Release 2 has
47 building blocks (`docs/design/user-journeys/README.md:111-165`) still to be
built across about 240 pull requests (build plan §3), so the gap will keep
growing.

This change moves the components into a separate repository, adds the shadcn
components Wheelhouse will use (in the Soft sand look), and sets up how the app
picks up each change: as a pull request that only merges once every test has
passed.

## What Changes

- **A new repository, `react-repo`**, holding every Wheelhouse
  component, the one tokens file (the colours, fonts, sizes and corners of the
  Soft sand look), the component tests, and pictures of every component
  checked on each change. It is built first as a folder on Mark's computer;
  the repository on GitHub is created only after the yes in "Steps for Mark".
- **Version 1.0.0 is the 15 components exactly as they are today**, byte for
  byte, plus the tokens file, so moving them changes nothing on any screen.
- **"A full range of shadcn components" means every component in shadcn's own
  list is accounted for**: added in the Soft sand look, covered by a
  Wheelhouse component that already does the job, held back until the piece
  that needs it is built, or left out because a recorded decision rules it
  out. A check fails when shadcn adds a component nobody has sorted yet. The
  full table is in `design.md` §1.
- **The app picks up a change as a pull request.** When a new version of the
  registry is released, a job in the app's GitHub Actions copies it in on a
  new branch and opens a pull request, which runs every test the app has. The
  app never fetches components while it is being built or used, so nothing
  changes until someone merges that pull request (`design.md` §3).
- **The app's existing checks keep working throughout**: the drift check
  (`scripts/ci/check-registry-drift.mjs`), the test that installed copies
  match their source (`tests/customer/installed-controls.test.js`), the Soft
  sand, font and token checks (`tests/design-sand.test.js`,
  `tests/design-fonts.test.js`, `tests/design-tokens.test.js`) and the
  component tests (`tests/registry/*.test.js`, including `colours.test.js`).
  Each is pointed at the new source only once the old and new give the same
  answer; the four that read `src/styles/theme.css` today are repointed, path
  only, in the same pull request that splits the tokens out (`design.md` §5).
- **The money box gets its first tests.** `money-input` has none today; the
  registry repository adds tests of its whole-pence parsing and display
  before anything else depends on it moving safely.
- **The question in D-005 about Radix is answered, subject to Jack** (Radix is
  a library of ready-made menus, pop-overs and pop-ups that shadcn's own
  components are built on). Recommendation: keep the browser's own controls
  everywhere they exist (the pop-up box, tick boxes, text boxes, pills, the
  booking pages), and use Radix only for the pieces the browser has no good
  version of: menus, a menu on right-click, small pop-overs, previews shown
  on hover, and tabs (`design.md` §6). This touches Jack's 26 Sep decision, so it waits for
  him (see "Contradictions flagged for Jack").

## Capabilities

### New Capabilities

- `component-registry`: where Wheelhouse's screen components and its look
  come from, how a change to them reaches the app, and what is checked before
  it can.

### Modified Capabilities

None. No screen changes in this change.

## Work package, who, risky areas

- **Work package:** none of its own. It supports every package's building
  blocks (build plan §4 "Building blocks built here"). Under the working
  agreement whoever starts a piece takes it from end to end; **Mark** takes
  this one.
- **Risky areas (working agreement):** money, treated as touched. No
  migration, no sign-in or public routes, no `server/server.js`, and no money
  code changes: the money box component `money-input` (`parsePence`,
  `formatPence`, `MoneyInput`) is moved byte for byte. But it has **no tests
  today** (no file under `tests/` mentions `money-input`, `parsePence` or
  `formatPence`), no screen installs it yet, and the app's group 5 pull
  request commits its released file into `vendor/`. So the registry
  repository adds its tests first (task 1.8), and the group 5 pull request
  runs `/review` as a money pull request.
- **Other ask-first areas, authorised here only for what the tasks name:**
  editing the app's CI (`.github/workflows/test.yml`) and adding a new sync
  workflow; the `Dockerfile` line that builds the registry; adding
  dependencies (listed below). These tasks, and the money box's tests, are
  tagged `[careful]` (`tasks.md` says why each is tagged).

## Drawings and decisions followed

- **Drawings:** no screen changes. The look is the drawings' Soft sand
  palette, `SAND` in `docs/design/user-journeys/generator/ui.mjs`, as already
  carried by `src/styles/theme.css`. Which components are needed was checked
  against the building-blocks list (`docs/design/user-journeys/README.md:111-165`)
  and the consolidated screens (`docs/design/user-journeys/generator/consolidate/j*.mjs`);
  the evidence for each component is in `design.md` §1.
- **Soft sand look:** decisions 48 and 53,
  `docs/decisions/2026-09-27-workshop-day-review.md:228-261`. The tokens file
  carries today's values unchanged.
- **D-005** (shadcn and Tailwind), **D-006** (TypeScript for the front end),
  **D-007** (no visual redesign during the move) and the open item 3 (no
  Radix), `docs/decisions/2026-08-31-frontend-platform.md`. D-007 is why
  version 1.0.0 must render every screen exactly as today.
- **The open item 1 in the same file** (the dark palette was invented and
  needs sign-off before anything shows it): the tokens file keeps the dark
  values as they are, marked unapproved, and nothing switches them on.
- **Jack, 26 Sep, the booking form controls**,
  `docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md:19-22`
  (decisions 1 and 2): built on the browser's own controls, no new
  dependency, no dropdown; Radix and react-day-picker considered and turned
  down. Both decisions are about the booking screens; decision 2 adds "a
  dropdown is added if a long one appears". So, app-wide, shadcn's calendar
  is labelled as covered by Wheelhouse's own `month-calendar`, and its
  dropdown list (`select`) is held until a long list appears, not left out
  (`design.md` §1). The booking screens keep the browser's own controls
  either way, and the Radix part waits for Jack.
- **Phase 4 contract**, `docs/superpowers/plans/2026-09-20-phase-4-screens.md:36-49`:
  components come from the registry, never hand-built inside a screen, and
  `--accent`, `--accent-dark` and `--modal-bg` stay live variables so a shop's
  colour can be set while the app runs. The same line (39) says components
  come from the registry "not stock shadcn, and carry no Radix dependency";
  this change touches both halves (see "Contradictions flagged for Jack" 4).
- **Working agreement** (`openspec/changes/working-agreement/`) and
  `CLAUDE.md` "How each piece is built": changes go through pull requests,
  merged once CI passes on the final commit.

## Contradictions flagged for Jack

1. **Using Radix at all.** Jack's 26 Sep decision 1 turned down "a full library
   such as Radix (reverses the no-Radix choice; custom dropdowns are worse on
   phones)". That decision was about the booking form controls, and the
   recommendation keeps every one of those as it is, but adding Radix for
   menus, pop-overs, hover previews and tabs anywhere in the app still reverses
   "the no-Radix choice" in its wider sense. **Nothing that needs Radix is
   built until Jack answers** (open question 1). Everything else in this
   change goes ahead without it.
2. **Deleting the app's own `registry/` folder and `public/r/`** once the new
   repository has proven itself. `CLAUDE.md` says deleting anything outside
   rule 5 needs Jack. Until he says yes, both stay and both are checked
   (open question 2).
3. **Which copy of the look is the master.** The comment at the top of
   `src/styles/theme.css` says `public/tokens.css` (the old app's file) is the
   source of truth. That is a note in the code, not one of Jack's decisions,
   and the Soft sand values themselves do not change. This change makes the
   registry's tokens file the master for the new app and keeps
   `tests/design-sand.test.js` comparing the two, so they cannot drift apart.
   Noted for Jack in case he sees it differently.
4. **The Phase 4 contract's "not stock shadcn, and carry no Radix
   dependency"** (`docs/superpowers/plans/2026-09-20-phase-4-screens.md:39`).
   The new components in group 7 start from shadcn's own files. They are
   restyled into the Soft sand look and published from the Wheelhouse
   registry, so screens still take them from the registry, never stock
   shadcn directly; but they are shadcn's code at heart. The Radix half is
   contradiction 1 above. Group 7 (no Radix) goes ahead unless Jack says the
   "not stock shadcn" line was meant to rule out porting shadcn's files at
   all; if he does, group 7 stops and its components are hand-built instead.

## Dependencies needing Mark's approval

Each needs Mark's yes, item by item (global rules: adding a dependency is
ask-first; `CLAUDE.md` rule 6 allows small well-known ones with a note in the
pull request). Versions are pinned to the ones the app already uses where the
app has them.

| # | Where | Package | Why | When |
|---|---|---|---|---|
| 1 | registry repo (dev) | the app's own front-end toolchain at the versions installed in the app: `react` 19.2.8, `react-dom` 19.2.8, `@types/react` 19.2.18, `@types/react-dom` 19.2.5, `@types/node` 26.4.0, `typescript` ~6.0.3, `vite` 8.3.5, `@vitejs/plugin-react` ^6.1.1, `tailwindcss` 4.3.3, `@tailwindcss/vite` 4.3.3, `shadcn` 4.19.1, `class-variance-authority` 0.7.1, `clsx` ^2.1.1, `tailwind-merge` 3.6.0, `lucide-react` ^1.38.0, `@testing-library/react` ^16.3.3, `@testing-library/dom` ^10.4.2, `jsdom` 30.0.1, `@playwright/test` 1.63.0, `eslint` ^10.9.1 with `@eslint/js` 10.0.1, `typescript-eslint` ^8.68.0 and `eslint-plugin-react-hooks` ^7.1.1, `globals` ^17.11.0; plus, not an npm package, Playwright's Linux container image at the same version (`mcr.microsoft.com/playwright:v1.63.0-noble`; the tag format is from memory, task 3.3 checks it) for making the pictures | builds, type-checks, lints, tests and pictures the components; nothing new to the project, but it is a new repository's first install | task group 1 |
| 2 | app | none | the move, the sync job and every no-Radix component add no package to the app | groups 2 to 5 |
| 3 | registry repo and app | `sonner` | the small "Saved · Undo" messages the drawings show (building block 10; toasts with Undo in `consolidate/j06.mjs:25`, `j08.mjs:13`, `j14.mjs:23`, `j18.mjs:38`, `j19.mjs:7`). D-005 already named Sonner for toasts (retired item 12) | only when the piece that builds block 10 starts |
| 4 | registry repo and app | `radix-ui` (one package holding all the Radix parts) | menus, right-click menu, pop-overs, hover previews, tabs | only if Jack says yes (open question 1) |
| 5 | registry repo and app | `cmdk` | search with grouped results and the pick-one box (building blocks 17 and 21) | only when the piece that builds block 17 starts, or in group 7 if Mark picks option 1 of open question 6 |
| 6 | registry repo and app | `recharts` | graphs in reports (building block 5; "Show graphs in reports", `app-map.mjs:179-195`) | only when the Reports piece starts, or in group 7 if Mark picks option 1 of open question 6 |

Row 3 (`sonner`) also moves to group 7 if Mark picks option 1 or 3 of open
question 6. No row reaches the app's `package.json` through a sync: the sync
script stops when a component needs a package the app does not already
have (`design.md` §3.6), so each package arrives in its own pull request
after its yes.

Not added, on purpose: `next-themes` (shadcn's toast file imports it; the
app has no theme switcher, so the import is removed when porting),
`tw-animate-css` (the few open/close animations go in the tokens file, where
the app's "Reduce motion" setting already stops them), `react-day-picker`,
`date-fns`, `recharts`, `embla-carousel-react`, `vaul`, `input-otp`,
`react-hook-form`, `zod`, `react-resizable-panels` (each belongs to a
component left out or held back in `design.md` §1).

## Steps for Mark (real accounts; nothing here is done by this change)

Creating a repository, turning on GitHub Pages and making a token are
real-account actions. The build makes only a local folder until Mark says yes
to each step below. `CLAUDE.md` also says creating or connecting a real account
or key stops for Jack, and the repository would sit in Jack's account, so Jack
is asked too (open question 3).

Both repositories are Jack's personal repositories, where Mark is a
collaborator. Changing a repository's settings (protecting `main`, required
checks, secrets, what GitHub Actions may do) needs admin, and the repository
records that admin is not something every collaborator has
(`.github/workflows/test.yml:5-8`, "Renaming needs repo admin"). So the
settings steps below are marked **Jack**, or Mark if Jack makes him an admin
of that repository first.

1. Say yes to the plan in `design.md` §3 and §4.
2. Create the empty repository `JackCurphey/react-repo` on GitHub
   (Jack's account, next to `wheelhouse-epos`; Jack creates it and adds Mark
   as a collaborator, since a collaborator cannot create repositories in
   someone else's personal account). Public is recommended; see `design.md`
   §4.4 for what each choice costs.
3. Push the local folder to it (the commands are in the folder's README).
4. **Jack (or Mark as admin):** in the new repository's settings, protect
   `main` so a change needs a pull request and the check named `ci` (the job
   id in `ci.yml`) passing; turn on Pages with "GitHub Actions" as its source
   (optional, see `design.md` §3).
5. **Jack (or Mark as admin), only if the repository is private:** make a
   fine-grained token that can read the registry repository's contents and
   releases, and save it in `wheelhouse-epos` as the secret
   `WHEELHOUSE_REGISTRY_TOKEN`. (Making the token is Mark's or Jack's;
   saving a secret in `wheelhouse-epos` needs admin there.)
6. Publish the first release, `v1.0.0`, by running the registry's release
   workflow.
7. **Jack (or Mark as admin):** in `wheelhouse-epos`'s settings, make the
   check named `test` required on `main` (the job id in
   `.github/workflows/test.yml:13`; the workflow is called "Tests" but the
   check is named after the job), if it is not already, so a pull request
   with a missing or red check cannot merge (`design.md` §3.4). Task 4.5 then
   proves it by trying to merge a pull request with no check.
8. **Jack (or Mark as admin):** in `wheelhouse-epos`'s Actions settings,
   allow GitHub Actions to create pull requests ("Allow GitHub Actions to
   create and approve pull requests"; the setting's name is from memory and
   task 5.8 sees whether the job can open its pull request). Without it the
   sync job cannot open its pull request.

## Out of scope

- Changing how any screen looks or behaves. New components reach a screen
  only in the piece that builds that screen, following its drawing.
- Rebuilding the hand-built switches, menus and tabs in today's screens
  (`row-switch.tsx`, the diary's menus and tabs). They are listed as the first
  candidates in `design.md` §5, each its own later change.
- Turning on the dark look (D-005 open item 1).
- Restyling the old app (`public/app.js`, `public/styles.css`).
- Publishing the components as an npm package, a git submodule or a
  workspace (compared and turned down in `design.md` §3).
- Anything that needs Radix, until Jack answers open question 1.

## Open questions

### For Jack (blocking only the part named)

1. **Radix for menus, pop-overs, hover previews and tabs?** Blocks task
   group 8 only. Options, with what each costs:
   1. *Recommended:* the browser's own controls wherever they exist (all of
      today's components, the booking pages, switches, tick boxes, lists to
      pick from), and Radix only for menus, the right-click menu, small
      pop-overs, hover previews and tabs. Best for: the diary's right-click
      menu and the "More…" menus, which have to work with a keyboard and a
      screen reader. Costs: one new package (`radix-ui`), and it reverses the "no-Radix choice" outside the booking pages.
   2. Stock shadcn everywhere, Radix underneath, replacing today's pop-up box
      too. Best for: matching shadcn's documentation exactly. Costs: the
      pop-ups in the 31 files under `src/` that import
      `@/components/ui/dialog` rebuilt and retested, and
      the booking pages lose the browser's own controls Jack chose on 26 Sep.
   3. No Radix at all: menus and pop-overs built by hand on the browser's
      newer "popover" feature. Best for: no new package, booking-page decision
      kept in full. Costs: more hand-built code to get right for keyboards and
      screen readers, and fewer of the "full range" are really shadcn's.
2. **May the app's `registry/` folder and `public/r/` be deleted** once the
   new repository has run for one full release with every check passing?
   Blocks task 6.3 only. Until then both are kept and checked.
3. **May the new repository be created in your GitHub account, and should it
   be public?** Blocks pushing the local folder (Steps for Mark 2 to 6).
   Public costs nothing and lets anyone read the components (they hold no
   shop data or keys); private keeps them to you and Mark but needs a paid
   GitHub plan for Pages and a token in the app for the sync job.

### For Mark (blocking only the part named)

4. Yes to each dependency in the table above, by row. Row 1 blocks task
   group 1; rows 3 to 5 block nothing in this change.
5. Yes to Steps for Mark 1 to 8 (steps 4, 5, 7 and 8 done by Jack, or by
   Mark once Jack makes him an admin). Blocks task group 4 onwards; groups 1
   to 3 run on the local folder.
6. **What about shadcn components that already have a drawn use but are
   labelled "Hold"?** You asked for "a FULL range … for everything we plan
   to use". Four components have drawings showing them but are held until
   the piece that builds them: `sonner` (the "Saved · Undo" messages, five
   drawings: j06:25, j08:13, j14:23, j18:38, j19:7), `command` (search with
   grouped results and the pick-one box, building blocks 17 and 21), `chart`
   (graphs in reports, block 5) and `navigation-menu` (the website header,
   blocks 31-35; it also needs Radix, so it waits for Jack whatever you
   pick). Blocks only task 7.6. Options:
   1. Add them now, in group 7, with their packages (dependency rows 3, 5
      and 6). Best for: the registry really holding everything drawn, so
      a screen piece just installs. Costs: three packages in the registry
      repository now (they reach the app only when a screen installs the
      component), about three more registry pull requests before any screen
      needs them, and porting them before the piece that uses them has
      settled the details, which may mean porting twice.
   2. Hold them until the piece that builds each one starts (what the
      tables in `design.md` §1 say today). Best for: no packages until a
      screen needs them; each is ported against a real screen. Costs: the
      registry is narrower than "everything we plan to use" until then, and
      each of those pieces carries the porting work.
   3. Add `sonner` now (five drawings use it, and D-005 already named
      Sonner for toasts), hold the rest. Best for: the most-drawn one ready
      first. Costs: one package now (row 3); the other three as in option 2.

## Impact

- **New repository (local folder first):** `~/Documents/GitHub/react-repo/`.
- **App files, when built:** `components.json` (the `@wheelhouse` address),
  a new `vendor/react-repo/` folder (the released registry, copied in
  by a script, never edited by hand), `react-repo.lock.json`, a new
  script `scripts/registry/sync.mjs`, a new mode in
  `scripts/ci/check-registry-drift.mjs`, a new workflow
  `.github/workflows/registry-sync.yml`, a `workflow_dispatch` trigger added
  to `.github/workflows/test.yml`, `src/styles/theme.css` (imports the tokens
  file), a new script `scripts/registry/capture-css-rules.mjs` and its
  fixture, the four tests that read `theme.css` repointed at the tokens file
  (`tests/design-sand.test.js`, `tests/design-fonts.test.js`,
  `tests/design-tokens.test.js`, `tests/registry/colours.test.js`), and the
  tests named in `tasks.md`. After Jack's yes to deleting `registry/`, also
  `tsconfig.json` and `eslint.config.js` (task 6.3).
- **No change** to the server, the database, or any screen file.

## Mark's answers (25 Oct)

Mark approved the three decisions put to Jack in pull request #511, in the form recommended there:

1. **Radix:** option 1. The browser's own controls wherever they exist; Radix only for menus, the right-click menu, small pop-overs, hover previews and tabs. (Open question 1.)
2. **Deleting the app's `registry/` folder and `public/r/`** once `react-repo` has run for one full release with every check passing. (Open question 2.)
3. **Held components:** `sonner`, `command`, `chart` and `navigation-menu` are in `react-repo` now; screens install them when the piece that needs each one starts. (Open question 6, taken as the registry holding the full range.)

**Still Jack's, by the project rules (`CLAUDE.md`):** answers 1 and 2. Answer 1 reverses his 26 Sep "no Radix" choice for the app, and a recorded decision is never reopened without him; answer 2 is a deletion outside rule 5. Mark's answers are the recommendation Jack is asked to confirm; nothing in the app uses Radix or loses `registry/` until he does. The rest of this change does not wait on either.
