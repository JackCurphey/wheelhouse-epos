# Design: Wheelhouse's components in their own repository

Plain-English words used below:

- **Component**: one reusable piece of screen (a button, a pop-up box).
- **Registry**: the list of components plus the built files the `shadcn`
  tool copies into an app (`public/r/<name>.json` today).
- **Installed copy**: the component file inside the app
  (`src/components/ui/<name>.tsx`), copied from the registry.
- **Tokens**: the named colours, fonts, sizes and corners of the look
  (`--wh-bg`, `--accent` and so on).
- **Release**: a numbered, frozen version of the registry (`v1.0.0`).

## 0. What was checked, and what could not be

Checked directly in this repository on 25 Oct (branch
`mark/component-registry-spec`):

- `components.json`: style `new-york`, Tailwind css `src/styles/theme.css`,
  `cssVariables: true`, `registries: { "@wheelhouse": "/r/{name}.json" }`.
- `package.json`: `shadcn` 4.19.1, `tailwindcss` 4.3.3, `@tailwindcss/vite`
  4.3.3; scripts `registry:build` (`shadcn build registry/registry.json --output public/r`)
  and `registry:validate`; `pretest` builds `vite.registry-test.config.ts`.
  Confirmed in `node_modules/shadcn/package.json` and
  `node_modules/tailwindcss/package.json`.
- `registry/registry.json` includes `./primitives/registry.json` (button,
  input, label, dialog, table, checkbox, textarea, choice-card, pill-group)
  and `./patterns/registry.json` (money-input, data-table, confirm-dialog,
  photo-picker, month-calendar, day-diary). `public/r/` holds the 15 built
  items plus `registry.json`.
- Installed copies in `src/components/ui/`: 11 (button, checkbox,
  choice-card, day-diary, dialog, input, label, month-calendar, photo-picker,
  pill-group, textarea). `table`, `data-table`, `money-input` and
  `confirm-dialog` are in the registry but not installed.
- Checks: `scripts/ci/check-registry-drift.mjs` (rebuilds and compares
  `public/r/` byte for byte), CI steps "Validate the registry" and "Fail if
  the registry is out of date" (`.github/workflows/test.yml:91-98`),
  `tests/customer/installed-controls.test.js` (each installed copy equals its
  registry source byte for byte), `tests/registry/*.test.js` (8 component
  tests plus `colours.test.js`, run on `.test-build/registry/`),
  `tests/design-sand.test.js` (Soft sand values; `public/tokens.css` against
  `src/styles/theme.css`; contrast), and the two ESLint gates in
  `eslint.config.js:12-56` (no direct Radix import; no raw hex colour).
- `Dockerfile:15` runs `npm run registry:build`; `Dockerfile:42` copies
  `public/r/` into the image.
- The installed `shadcn` 4.19.1 code (`node_modules/shadcn/dist/chunk-JKB2HING.js`)
  reads its component list from `https://ui.shadcn.com/r/index.json`
  (`REGISTRY_URL`, default `https://ui.shadcn.com/r`), uses style
  `new-york-v4` for Tailwind 4 projects, marks `toast` and `toaster`
  deprecated in favour of `sonner`, and knows two underlying libraries,
  `radix` and `base`. Its schema (`node_modules/shadcn/dist/schema/index.d.ts`)
  allows an item to carry `cssVars` (theme, light, dark), `css`, files with a
  `target`, and a registry address given as `{ url, params, headers }`.
- The same CLI installs an item's npm `dependencies` during `add` when they
  are not already in `package.json` (`chunk-JKB2HING.js:128`, `skipInstalled`;
  in a non-interactive npm run it passes `--force`). So `shadcn add` can
  change `package.json` and `package-lock.json`; §3.6 stops that.
- Four app tests read `src/styles/theme.css` as text:
  `tests/design-sand.test.js:17`, `tests/design-fonts.test.js:27`,
  `tests/design-tokens.test.js:120` and `tests/registry/colours.test.js:10`.
  (`tests/staff-app-theme.test.js` only names it in a comment, line 14; it
  reads `public/app.js` and `public-storefront/storefront.js`.)
- `money-input` has no tests: no file under `tests/` mentions `money-input`,
  `parsePence` or `formatPence`, and no screen imports it.

**Not checked, because the session's tool rules blocked network access:**
the live contents of `https://ui.shadcn.com/r/index.json`. The component
names in §1 are from memory of shadcn's list and are marked so. Task 1.1
fetches the real list with the installed CLI's address and records it in
`upstream/index.snapshot.json`; the coverage check (task 3.2) then fails on
any name the table below does not sort, and on any name in the table that is
not upstream. So a wrong memory here cannot survive into the build.

Also from memory, each with the task that proves it by watching it happen:
a pull request opened by GitHub's built-in `GITHUB_TOKEN` does not start
other workflows (task 5.8); GitHub Pages on a private repository needs a paid
plan (Steps for Mark 2, decided by Mark there); which shadcn files import
Radix's `Slot` or `Separator` (task 1.1 lists the real imports per file);
the name of GitHub's "Allow GitHub Actions to create and approve pull
requests" setting (task 5.8 sees whether the job can open its pull
request); that a commit message containing `[skip ci]` stops the Tests
workflow (task 4.5 uses it and stops if it does not); the Playwright
image's tag format (task 3.3).

## 1. What "a full range of shadcn components" means

**Decision.** Every `registry:ui` item in shadcn's own list for style
`new-york-v4` gets exactly one of four labels in `upstream/coverage.json`:

1. **Add**: ported into the registry in the Soft sand look.
2. **Wheelhouse**: a Wheelhouse component already does the job; it keeps its
   own name and behaviour.
3. **Hold**: wanted later; added in the piece that first needs it, which is
   named.
4. **Leave out**: a recorded decision or the app's own built version rules
   it out.

**Why, in plain English.** "Full" could mean copying all of shadcn's
components in today. That gives the most to pick from, but half of them have
nothing on any drawing, several bring a package each (charts, carousel,
calendar), and some would undo Jack's choices (the calendar, the dropdown
list). Sorting every one instead means nothing is missing by accident, each
"no" has a reason someone can overrule, and the check keeps it true when
shadcn adds more.

Evidence key: `jNN:line` is `docs/design/user-journeys/generator/consolidate/jNN.mjs`;
"block N" is the building-blocks list in `docs/design/user-journeys/README.md:111-165`.
Names marked * need Radix and wait for Jack (open question 1, §6).

| shadcn component (from memory; task 1.1 confirms) | Label | Wheelhouse plan and evidence |
|---|---|---|
| accordion | Add, on the browser's own `<details>` | settings sections that open ("Banking open", j16:17; "'Showing products' open", j02:59) |
| alert | Add | bars and status lines: "This till is Bolton's…" (j19:10); block 22 |
| alert-dialog | Wheelhouse: `confirm-dialog` | block 8 "Are you sure?" box; already native, ignores backdrop taps on destructive confirms |
| aspect-ratio | Leave out | Tailwind's own `aspect-*` classes do it with no component |
| avatar | Hold | no screen in `consolidate/j*.mjs` mentions one |
| badge | Add | status chips (the `--wh-state-*` colours), "Arrivals · 3" (j10:28) |
| breadcrumb | Hold | none found; phone settings use "‹ Settings" (README.md:195) |
| button | Wheelhouse: `button` | used across the screens |
| button-group | Add | buttons that share a row: "'Change what's shown' and 'Download' share a row" (README.md:204) |
| calendar | Wheelhouse: `month-calendar` | Jack 26 Sep decision 1 chose a hand-built calendar over react-day-picker for the booking screens; `month-calendar` is that calendar |
| card | Add | Today cards (block 6), Shop card (34), Quote card (38) |
| carousel | Hold | none found; would need `embla-carousel-react` |
| chart | Hold: the Reports piece (block 5) | "Show graphs in reports" (`app-map.mjs:179-195`); needs `recharts`, asked for then |
| checkbox | Wheelhouse: `checkbox` | the phone's own tick box (Jack 26 Sep decision 3) |
| collapsible | Add, with accordion, on `<details>` | as accordion |
| command | Hold: the piece that builds block 17 | search with grouped results (17), pick-one box (21); needs `cmdk` |
| context-menu * | Add after Jack | right-click a diary block: "Open job" or "View overview" (j12:15) |
| dialog | Wheelhouse: `dialog` | the browser's own pop-up box, in 31 files |
| drawer | Leave out | `sheet` below covers it without `vaul` |
| dropdown-menu * | Add after Jack | "'More…' menu open" (j06:56); a saved report's menu (j17:9); "Add photo… opens a menu" (j12:47); the "Serving: [name]" menu (j11:95) |
| empty | Add | block 11 Empty list |
| field | Wheelhouse: `label` | `label` already exports `Field` and `FieldError` (`registry/primitives/registry.json`, label item) |
| form | Leave out | needs `react-hook-form` and `zod`; the app's forms do not use them |
| hover-card * | Add after Jack | `diary-stack-hover` (build plan line 587) |
| input | Wheelhouse: `input` | |
| input-group | Add | a search box with its icon (block 17); a text box with a fixed prefix |
| input-otp | Leave out | the 6-digit code box is built on the browser's own one-time-code field (`src/screens/book/sign-in.tsx:116`; drawn that way, `signin.mjs:269-274`) |
| item | Add | list rows: Settings row (block 2), Activity list (14) |
| kbd | Hold | none found |
| label | Wheelhouse: `label` | |
| menubar | Leave out | none found; the app frame (block 16) is built |
| native-select | Add | a short list that opens the phone's own picker, as Jack wanted (26 Sep decisions 1-2): "choices [5, 10, 15, 30]" (j08:64) |
| navigation-menu | Hold | website header (blocks 31-35); its phone menu is a plain list (ja:18) |
| pagination | Hold | block 3 tables; paging not drawn |
| popover * | Add after Jack | "'2 jobs at 09:00' popover" (j12:18) |
| progress | Add, on the browser's own `<progress>` | "Ready to switch over: 3 of 4" (j09:24) |
| radio-group | Wheelhouse: `pill-group` | single choices as pills over the browser's own radios |
| resizable | Leave out | none found |
| scroll-area | Leave out | `table` already scrolls sideways with the browser's own scrolling |
| select * | Hold: the first screen with a long list | Jack 26 Sep decision 2 is about the booking screens: no dropdown there, and "a dropdown is added if a long one appears" (`2026-09-26-book-c-form-controls-design.md:23-24`). `native-select` covers short lists; the booking screens never get this one |
| separator | Add, as a plain `<hr>` | |
| sheet | Add, on the browser's own pop-up box like `dialog` | "Phone menu open over the dimmed page" (ja:10); "'Filter' opens a full-screen panel" (README.md:188) |
| sidebar | Leave out | the app frame (block 16) is already built (`src/staff/app-shell.tsx`, `staff-layout.tsx`) |
| skeleton | Add | the loading state `data-table` already has |
| slider | Leave out | none found |
| sonner | Hold: the piece that builds block 10 | toasts with Undo (j06:25, j08:13, j14:23, j18:38, j19:7); D-005 named Sonner |
| spinner | Add | "Saving…" states (block 10) |
| switch | Add, on a button with `role="switch"` | many settings switches (j02:59-60, j07:44, j08:29); matches the built `src/screens/settings/row-switch.tsx` |
| table | Wheelhouse: `table` | |
| tabs * | Add after Jack | "'Arrivals · 3' tabs" (j10:28) |
| textarea | Wheelhouse: `textarea` | |
| toast | Leave out | deprecated by the installed shadcn CLI in favour of `sonner` |
| toggle | Wheelhouse: `pill-group` | "filled when on, outlined when off" pills (decision 50, `2026-09-27-workshop-day-review.md:238-242`) |
| toggle-group | Wheelhouse: `pill-group` | "'Me' / 'Everyone' switch" (j12:10) |
| tooltip | Hold | none found; on phones a hover hint cannot be seen (README.md:195 "no hover-only Edit and Remove") |

Counts, from memory: Add 21 (of which 5 after Jack), Wheelhouse 13, Hold 11
(`select` needs Radix too), Leave out 10; 55 in all. Task 1.1 replaces these
with the real counts.

Four of the Hold rows have a drawn use: `sonner`, `command`, `chart` and
`navigation-menu`. Whether they are added now or when their piece starts is
Mark's call (proposal, open question 6); the table shows option 2 until he
answers, and task 7.6 adds them if he picks option 1 or 3.

**What happens to today's Wheelhouse components.** All 15 move unchanged into
the new repository, with the same names, folders (`primitives/`,
`patterns/`) and files. `money-input`, `data-table`, `confirm-dialog`,
`photo-picker`, `month-calendar`, `day-diary`, `choice-card` and `pill-group`
are Wheelhouse-only. Where a shadcn name is also a Wheelhouse name (`button`,
`dialog`, `input`, `label`, `table`, `checkbox`, `textarea`), the Wheelhouse
one is the one published; shadcn's is never installed beside it.

**How a ported component is changed.** Each starts from shadcn's file for
style `new-york-v4` and gets: the Soft sand classes (tokens only, never a raw
colour or palette class, as the registry's guards demand, task 1.9; this
replaces shadcn's `bg-black/50` overlays and `text-white`); every
shadcn colour class rewritten to the form the Wheelhouse components already
use, `<utility>-[var(--token)]` (see `registry/primitives/button.tsx:23-34`;
no file in `registry/` or `src/` uses `bg-accent`, `bg-primary` or
`ring-ring` today), by this table:

| shadcn class (and its `hover:`, `focus:`, `data-[state=...]:` forms) | Means in shadcn | Becomes | Because |
|---|---|---|---|
| `bg-accent`, `text-accent-foreground` | the light hover, focus and "on" surface | `bg-[var(--wh-hover)]`, `text-[var(--wh-ink)]` | in Wheelhouse `--accent` is the charcoal action colour (`theme.css:61`); the light hover is `--wh-hover`, as the Wheelhouse button's default and ghost looks use (`button.tsx:30,34`) |
| `bg-primary`, `text-primary-foreground` | the main action fill | `bg-[var(--accent)]`, `text-[var(--wh-on-brand)]` | as the Wheelhouse button's accent look (`button.tsx:32`); reading `--accent` directly keeps a shop colour override working (section 2) |
| `ring-ring`, `outline-ring`, `border-ring` | the focus ring | `outline-[var(--accent)]` | as `button.tsx:23` |
| `text-muted-foreground` | quiet text | `text-[var(--wh-muted)]` | `--muted` is a surface here (`theme.css:158`; `colours.test.js` already bans it for text) |
| `bg-muted`, `bg-secondary` | quiet surface | `bg-[var(--wh-surface-muted)]` | `theme.css:156,158` |
| `bg-background`, `bg-popover`, `bg-card` | page and panel | `bg-[var(--wh-bg)]` for the page, `bg-[var(--wh-panel)]` for panels and pop-overs | the Soft sand page and panel tokens |
| `border`, `border-input` colours | edges | `border-[var(--wh-border)]` for hairlines, `border-[var(--wh-input-border)]` for form fields | `theme.css:71-72` |
| `bg-destructive`, `text-destructive` | delete | outlined `text-[var(--wh-danger)]`, `border-[var(--wh-danger)]`, hover `bg-[var(--wh-danger-bg)]` | decision 53: delete buttons are outlined (`button.tsx:33`) |

A shadcn class not in this table is mapped to the nearest token and the
choice is logged in `docs/decisions/decided-while-building.md` (Mark's
section) with the component name, as `CLAUDE.md` rule 3 asks for gaps the
drawings leave. A guard (task 1.9) fails on any shadcn named colour class
(`bg-accent`, `bg-primary`, `ring-ring`, `text-muted-foreground` and the
other names in the left column) in a registry file. Also: every
`registryDependencies` entry is rewritten to `@wheelhouse/<name>` with
`<name>` an item in this registry (shadcn's `input-group` lists `button`,
`input`, `textarea`, which must become `@wheelhouse/button` and so on, or
the install would fetch shadcn's stock ones); a test fails on any other
form (task 1.9). Radix's `Slot` and `asChild`
removed where the component does not otherwise need Radix (the Wheelhouse
`button` already does this with an exported `buttonVariants`); targets at
least 44px tall where it can be tapped (the Wheelhouse rule, e.g. the
checkbox and day-diary descriptions); and a header comment naming the shadcn
file, the date fetched, its sha256 and each change. `upstream/ported.json`
holds the same facts for the watch job (§4.3). shadcn/ui is MIT-licensed;
its licence text goes in `THIRD_PARTY_NOTICES.md` (task 1.1 copies the text
from the shadcn repository, not from memory).

## 2. The look: one tokens file, Tailwind 4

**Decision.** One file in the registry repository,
`registry/theme/wheelhouse-tokens.css`, published as the item `theme` (type
`registry:file`, target `src/styles/wheelhouse-tokens.css`). It holds,
moved from today's `src/styles/theme.css` with every value unchanged:

1. `@custom-variant dark (&:is(.dark *));`
2. the two `@font-face` rules (Public Sans, DM Mono), which expect the app to
   serve `/fonts/public-sans/…` and `/fonts/dm-mono/…` as it already does.
   The registry repository carries the same font files and their `OFL.txt`
   licences under `site/public/fonts/` (copied from the app's
   `public/fonts/`, task 2.4), so its pictures show the real fonts, and
   `tests/fonts.test.js` checks the tokens file declares both faces and that
   each file and its licence exist (as the app's `tests/design-fonts.test.js`
   does). The fonts are not published as an item; the app already serves
   them;
3. `:root` with every `--wh-*` token, `--accent`, `--accent-dark`,
   `--modal-bg`, the shadcn names mapped onto them (`--background`,
   `--primary`, `--sidebar-*` …), `--radius: 6px`, `--wh-shadow`, and
   `--wh-text-scale: 1`;
4. `.dark { … }`, unchanged and marked "unapproved, nothing switches it on"
   (D-005 open item 1);
5. `html.wh-larger-text { --wh-text-scale: calc(17 / 14); }` (Larger text,
   Jack 24 Oct answer 8);
6. the whole `@theme inline { … }` block (text sizes times the scale, every
   `--color-*`, the radius scale, shadows, fonts);
7. new, for the ported components only: the few open/close keyframes they
   use, so `tw-animate-css` is not needed, all already stopped by the app's
   `html.wh-reduce-motion` rule.

The app's `src/styles/theme.css` keeps only what is about the app, not the
look: `@import "tailwindcss";`, then `@import "./wheelhouse-tokens.css";`,
the pointing-finger cursor rule, the receipt print rules and the Reduce
motion rule.

**Why a whole file and not shadcn's `cssVars`.** shadcn can carry tokens
inside an item (`cssVars`, seen in the installed schema) and merge them into
the app's CSS file on install. That rewrites `theme.css` in place, drops its
comments, and leaves no clean way to tell a merge from a hand edit. A whole
file is copied as is, can be checked byte for byte like the components, and
keeps the explanations next to the values. What it costs: shadcn's own
theme-picker items would not apply to this app. Nobody plans to use them.

**How the app uses it without forking.** The app never edits
`wheelhouse-tokens.css` (the drift check, §3.5, fails if it does), and a new
app test fails if `theme.css` sets any custom property the tokens file sets.
The only overrides are made while the app runs, below.

**A shop's own colour, set while the app runs.** `--accent`, `--accent-dark`
and `--modal-bg` are the shop-colour variables. What an override reaches
depends on where it is set, because the shadcn names are worked out on
`:root` (`--primary: var(--accent)`, `theme.css:154`; `--ring: var(--accent)`,
`:165`; `--sidebar: var(--accent-dark)`, `:166`), and a custom property that
refers to another is resolved where it is declared:

1. **Set on `<html>`** (`document.documentElement.style.setProperty('--accent', …)`):
   recolours everything that uses the shop colour, including anything using
   `bg-primary`, `ring-ring` or the sidebar colours.
2. **Set on a wrapping element:** recolours only what reads `var(--accent)`,
   `var(--accent-dark)` or `var(--modal-bg)` directly. Every Wheelhouse
   component does (they use the `[var(--…)]` form), and every ported one
   will, because the porting table in section 1 rewrites `bg-primary` and
   `ring-ring` to `var(--accent)` and the guard (task 1.9) rejects the shadcn
   names. `bg-primary`, `ring-ring` and the sidebar colours in screen code
   do not follow a wrapper override.

Changing the `:root` mapping so wrappers reach `bg-primary` too would
change the built CSS, which `v1.0.0` must not do (D-007); if a per-section
shop colour is ever wanted, it is a later minor release. Nothing sets the
shop colour today: the staff app no longer follows a shop's scheme (the
header comment of `src/styles/theme.css`; Soft sand for every page,
decision 48), and only customer pages may in future. Not every component
takes the shop colour: the Wheelhouse button's `primary` look reads
`--wh-brand` (`button.tsx:31`), a fixed Soft sand value, by design.

The registry proves both cases with a browser test using Ocean Blue's
accent, `#2f5f96` (`THEME_PRESETS.ocean.accent`, `public/app.js:4488`): set on
`<html>`, a `Button` with its accent look and a test element with
`bg-primary` both turn `rgb(47, 95, 150)`; set on a wrapper, the accent
`Button` inside turns `rgb(47, 95, 150)` and the `bg-primary` element keeps
the Soft sand charcoal, `rgb(42, 40, 34)` (`#2a2822`, `theme.css:61`), so the
limit is pinned and a later change to it is noticed. Each ported component
that uses the shop colour is added to this test in its group 7 task.

**The old app's copy.** `public/tokens.css` stays, for the old app.
`tests/design-sand.test.js` goes on comparing it value by value, now with
`src/styles/wheelhouse-tokens.css` instead of `theme.css` (task 5.6), so the
two copies still cannot drift. The registry's own `tests/tokens.test.js`
carries the approved Soft sand values and the contrast checks, so a change to
the look fails in the registry before it reaches the app.

## 3. How the app picks up each change

### 3.1 The three ways compared

| | (a) Built files released by the registry; the app copies them in on a pull request | (b) An npm package | (c) A git submodule or a workspace |
|---|---|---|---|
| How a change arrives | a release; a job in the app copies the built JSON into `vendor/`, runs `shadcn add` for each installed component, opens a pull request | Dependabot or Renovate opens a pull request raising the version number | Dependabot (its `gitsubmodule` updates) or a person moves the pinned commit |
| What the pull request shows | the real lines that changed in each component | one version number; the component changes are hidden inside `node_modules` | one commit id |
| Fits shadcn's model (files you own and can read) | yes, as today | no: components become a compiled package; Tailwind must be told to scan `node_modules`; the ESLint gates and the installed-copy test stop making sense | partly: still needs a copy step |
| Works with the hosted copy's Docker build and every computer as now | yes, everything is in the app's git | needs a token on every computer and in CI if private | every clone needs `--recursive`; the Docker build needs the submodule; a known source of "it works on my machine" |
| Can break the app without a pull request | no (§3.4) | no, if updates go through Dependabot pull requests | no, if pinned |
| Extra accounts or keys | none if the registry is public | a package registry login, a publish token | a read token if private |

**Decision: (a).** It is the only one where the pull request shows what
actually changed on screen, it keeps shadcn's "the code is yours" model the
app is already built around (D-005), and it needs no new account if the
registry is public. What it costs: the sync job is ours to write and look
after (about 150 lines, task 5.3), and Dependabot and Renovate cannot do it,
because they do not understand a shadcn registry. Workspaces are out anyway:
Mark asked for a separate repository.

### 3.2 Where the released files live

- **The release is the master copy.** Each version is a GitHub release in the
  registry repository, tag `vX.Y.Z`, with two files attached:
  `react-repo-vX.Y.Z.tar.gz` (the `r/` folder of built JSON) and
  `SHA256SUMS`. A release is never edited or deleted after it is published.
- **GitHub Pages is a convenience, optional.** It serves the latest built
  files at `https://jackcurphey.github.io/react-repo/r/{name}.json`,
  so anyone can try `npx shadcn add @wheelhouse/card` in a scratch project.
  The app's sync job never reads Pages, only releases, and it never lets the
  CLI look up an `@wheelhouse/` name through `components.json` (section 3.6),
  so what is tested is exactly what is pinned. `components.json`'s
  `@wheelhouse` address is pointed at Pages only once Pages exists (task
  5.7), for people trying components; a component a person installs that
  way in the app is caught by the drift check ("Not from the registry" or
  "Installed component edited by hand") unless it matches the lock.

### 3.3 The sync job in the app

New workflow `.github/workflows/registry-sync.yml`:

- **Runs:** every day at 06:00 UTC, by hand (`workflow_dispatch`, optional
  input `version`), and on `repository_dispatch` type `registry-released` (only
  fires if the registry is later given a token to send it; not needed).
- **Permissions:** `contents: write`, `pull-requests: write`, `actions: write`.
  Opening a pull request with the built-in token also needs the repository
  setting that lets GitHub Actions create pull requests (Steps for Mark 8).
- **Steps:**
  1. Find the newest release with `gh release view --repo JackCurphey/react-repo --json tagName`
     (token: `secrets.WHEELHOUSE_REGISTRY_TOKEN` if set, else `github.token`).
  2. Stop with "Already on vX.Y.Z" if the lock has it, "vX.Y.Z is in
     skipVersions" if listed there, or if a pull request from
     `registry-sync/vX.Y.Z` is already open.
  3. Download both files, check the sums, unpack to a temporary folder.
  4. `node scripts/registry/sync.mjs --from <folder> --version vX.Y.Z --commit <sha>`.
  5. Commit on branch `registry-sync/vX.Y.Z` (never `main`), push, and
     `gh pr create` titled "Registry vX.Y.Z" (prefixed "MAJOR: " for a new
     major version), the body holding that version's `CHANGELOG.md` section
     and the line "Merge only when the Tests check on the last commit is
     green. A missing check is not a pass."
  6. `gh workflow run test.yml --ref registry-sync/vX.Y.Z`, because a pull
     request opened with the built-in token does not start other workflows by
     itself (from memory; task 5.8 watches it). This needs `workflow_dispatch:`
     added to `test.yml`'s triggers.
- **Never** merges, never pushes to `main`, never runs at build time.

### 3.4 Why a registry change can never break the app without a pull request and green tests

1. The app never fetches components when it builds, starts or runs: the
   released files (`vendor/react-repo/r/`) and the installed copies
   are in the app's git.
2. Only `scripts/registry/sync.mjs` writes those, and only the sync job (on
   its own branch) or a person on a branch runs it.
3. The drift check (`--vendored`, §3.5) fails CI if anything in `vendor/` or
   any installed copy differs from the hashes in
   `react-repo.lock.json`, so a hand edit cannot slip past.
4. The sync pull request runs the whole of `test.yml`: type check, lint,
   build, registry checks, `npm test`, `npm run test:browser`.
5. It merges only after that check is green on its last commit (working
   agreement; `CLAUDE.md` rule 4), never by itself. Steps for Mark 7 makes the
   check named `test` (the job id in `test.yml:13`) required, so a missing
   check blocks the merge rather than reading as a pass, and task 4.5 proves
   it by trying to merge a pull request with no check and seeing GitHub
   refuse.

**Who merges a sync pull request.** Mark, who looks after the registry, or
Jack or Mark as either may (working agreement). "Read the diff" for a sync
pull request means: read the release's `CHANGELOG.md` section in the pull
request body; read every changed file under `src/components/ui/` and
`src/styles/`; open the registry release pull request's changed pictures if
the changelog says anything changes on screen. The JSON under `vendor/` is
not read line by line: the lock's hashes and the drift check prove it is the
release. A sync that changes an installed copy of `money-input` (once a
screen installs it) also gets `/review`, as a money pull request.
6. A release that breaks the app gives a red pull request that sits unmerged;
   `main` and the hosted copy are untouched.

### 3.5 The lock file and the vendored check

`react-repo.lock.json` at the app's root:

```json
{
  "registry": "JackCurphey/react-repo",
  "version": "v1.0.0",
  "commit": "<registry commit sha>",
  "snapshot": { "button.json": "<sha256>", "…": "…" },
  "installed": {
    "button": { "src/components/ui/button.tsx": "<sha256>" },
    "theme": { "src/styles/wheelhouse-tokens.css": "<sha256>" }
  },
  "skipVersions": []
}
```

Hashing the installed files after `shadcn add` (rather than comparing them
with the JSON) avoids re-implementing the import rewriting `shadcn add` does
(`tests/customer/installed-controls.test.js:8-13` describes it).

### 3.6 Items that depend on other items, and items that need a package

Three of today's items depend on other items: `money-input` on
`@wheelhouse/input`, `data-table` on `@wheelhouse/table` and
`@wheelhouse/button`, `confirm-dialog` on `@wheelhouse/dialog` and
`@wheelhouse/button` (`registry/patterns/registry.json:13,28,43`). Left to
itself, `shadcn add ./vendor/react-repo/r/money-input.json` looks `@wheelhouse/input`
up through `components.json`'s `@wheelhouse` address: today a relative
`/r/{name}.json` it cannot fetch (`scripts/ci/check-registry-drift.mjs:13-21`),
later Pages, which serves the newest build rather than the pinned one.

So `sync.mjs` never lets the CLI resolve a dependency:

1. `installOrder(names, snapshotDir)` reads each planned item's
   `registryDependencies` from the vendored release, adds any dependency not
   already planned, and orders the list so every dependency comes before
   the item that needs it (`theme` and `utils` first). It throws
   "<item> depends on <dep>, which is not a @wheelhouse item. Rewrite it as
   @wheelhouse/<name> in react-repo." for a bare or other
   namespace, and "<item> depends on @wheelhouse/<name>, which is not in
   registry <version>." for a missing one.
2. For each item, in that order, it writes a copy of the item's JSON with
   `registryDependencies` emptied into a temporary folder and runs
   `shadcn add` on that copy. The dependencies were installed by the earlier
   steps, from the same release.
3. Before running anything, `missingPackages(names, snapshotDir, packageJson)`
   lists each planned item's npm `dependencies` (name without the version)
   that `package.json` does not already have, in `dependencies` or
   `devDependencies`. If any are missing it stops with "Registry <version>
   item <item> needs npm package(s) <list>, which package.json does not
   have. Add them in their own pull request after approval, then sync
   again." and changes nothing.
4. As a second guard, it hashes `package.json` and `package-lock.json`
   before and after; if either changed, it puts back the saved bytes and
   stops with "shadcn add changed package.json or package-lock.json; the
   change was undone. Add packages in their own pull request."

The same steps run for `--add <name>`. The registry repository's own test
(task 1.9) also fails on any `registryDependencies` entry that is not
`@wheelhouse/<an item in this registry>`.

### 3.7 The first sync

No lock exists before the first sync. `node scripts/registry/sync.mjs --from <dir> --version v1.0.0 --commit <sha> --bootstrap`
builds the first lock with `bootstrapLock({ uiDir, snapshotDir, registry, version, commit }): Lock`:
the installed names are the `*.tsx` files in `src/components/ui/` (found the
same way `tests/customer/installed-controls.test.js:29` finds them), plus
`theme` once task 5.6 adds it. Each must be in the release, or it throws
"src/components/ui/<file> is not in registry <version>." `--bootstrap`
refuses when a lock already exists ("A lock already exists; sync without
--bootstrap."). The lock is then written by `writeLock`, never by hand.

## 4. The registry repository

### 4.1 Name, place, owner

- **Name:** `react-repo`. Says what it is in shadcn's own word; the
  app is `wheelhouse-epos`. Turned down: `wheelhouse-ui` (vaguer).
- **Built first as a local folder:** `~/Documents/GitHub/react-repo/`,
  `git init` with a `main` branch and work on branches, no remote until Steps
  for Mark 3.
- **On GitHub:** `JackCurphey/react-repo`, next to the app, owned by
  Jack like the app (`CLAUDE.md`: Jack owns this project).
- **Who builds and looks after it:** Mark. Either person can fix anything
  (working agreement). The look stays Jack's: a change to how something looks
  needs a drawing or Jack's word, as in the app.

### 4.2 Layout

```
react-repo/
  README.md                  what it is, how to release, how the app picks it up, push commands
  CHANGELOG.md               one section per version, with "What changes on screens"
  THIRD_PARTY_NOTICES.md     shadcn/ui's MIT licence
  package.json               "version" equals the latest tag
  components.json            for building and testing inside this repo
  registry.json              includes the three below
  registry/
    theme/registry.json, theme/wheelhouse-tokens.css
    lib/utils.ts             cn(), item "utils" (registry:lib), same as the app's src/lib/utils.ts
    primitives/registry.json + the 9 today + ported components
    patterns/registry.json   + the 6 today
  public/r/                  built, committed, drift-checked
  upstream/index.snapshot.json, coverage.json, ported.json
  site/                      one page showing every component, light and dark, desktop and phone width
  site/public/fonts/         Public Sans and DM Mono with their OFL.txt, copied from the app's public/fonts/
  scripts/ci/check-registry-drift.mjs, check-coverage.mjs
  scripts/upstream/refresh.mjs   re-fetches shadcn's list into upstream/index.snapshot.json
  scripts/release/pack.mjs
  tests/                     component tests (node:test + jsdom, as in the app), money-input.test.js,
                             guards.test.js, registry-deps.test.js, tokens.test.js, fonts.test.js,
                             identity.test.js, fixtures/, visual/ (Playwright; baselines in visual/baselines/)
  .github/workflows/ci.yml, release.yml, pages.yml, upstream-watch.yml
  .github/dependabot.yml     npm and GitHub Actions, weekly, this repo only
```

### 4.3 Checks (CI)

`ci.yml`, one job with the id `ci` (so the check GitHub shows, and Steps for
Mark 4 requires, is named `ci`), on every pull request and push to `main`:
`npm ci`, `typecheck`, `lint` (the app's two ESLint gates, ported),
`validate` (`shadcn registry validate`), the drift check (rebuild and compare
`public/r/`), the coverage check (offline, against
`upstream/index.snapshot.json`), `npm test` (component tests including the
money box's, the guards ported from the app's `tests/design-tokens.test.js`
and `tests/registry/colours.test.js`, the dependency-name test, tokens,
fonts, identity), and `npm run test:visual` (each component in `site/`, light and
dark, at 1280px and 390px wide, against committed pictures; the pop-up box
behaviour tests; the shop-colour test). Pictures are made in Playwright's
Linux image so fonts match CI; they are updated only by
`npm run test:visual:update` inside that image, and the changed pictures show
in the pull request.

`upstream-watch.yml`, weekly: fetches shadcn's list and each ported
component's file, and opens or updates one issue, "shadcn changes to sort",
naming new components not yet labelled and ported ones whose file changed.
It never changes code. The issue body says how to answer it: run
`npm run upstream:refresh` (`scripts/upstream/refresh.mjs`, which re-fetches
`https://ui.shadcn.com/r/index.json` into `upstream/index.snapshot.json` with
the date), label each new name in `upstream/coverage.json`, and commit both
in one pull request. Without the refresh, `check:coverage` still checks
against the old list, so a new label for a name only in the new list would
fail as "Not in shadcn's list any more".

`release.yml`, by hand with input `version`: refuses unless CI passed on that
commit, `package.json`'s version equals the input and `CHANGELOG.md` has a
section for it; then builds, runs `scripts/release/pack.mjs`, and
`gh release create`. `pages.yml` publishes `public/` after a release, if Pages
is on.

### 4.4 Versions

Numbered `MAJOR.MINOR.PATCH`:

- **Major:** something the app's screens may need changing for: a component,
  export, prop or token removed or renamed, or a default that changes how
  something looks.
- **Minor:** a new component or token.
- **Patch:** a fix that keeps every name and prop.

`v1.0.0` is today's 15 components plus `theme` and `utils`, unchanged.

**Public or private** (Jack's call, open question 3): public needs no token
anywhere and Pages is free; anyone can read the components, which hold no
shop data, keys or prices. Private keeps them to Jack and Mark, but the sync
job needs Steps for Mark 5's token and Pages needs a paid plan (from memory).

## 5. Moving the app over, a step at a time

| Step | What | What keeps passing | Way back |
|---|---|---|---|
| A | Registry repository, local: the 15 components, `theme`, `utils`, checks, `v1.0.0` ready (groups 1-3) | the app is untouched | none needed |
| B | Mark's steps: repository created, pushed, `v1.0.0` released (group 4) | the app is untouched | delete nothing; just don't sync |
| C | App: `vendor/`, the lock, `sync.mjs`, the `--vendored` check, the tokens file split out of `theme.css` (group 5). Syncing `v1.0.0` must leave every installed component file unchanged | the old drift check and the installed-copy test, untouched, beside the new check; all agree because `v1.0.0` is identical. The four tests that read `theme.css` as text are repointed, path only, in the same pull request as the split (task 5.6): `design-sand.test.js` and `design-fonts.test.js` read `src/styles/wheelhouse-tokens.css` instead; `design-tokens.test.js`'s size-scale test reads it too; `tests/registry/colours.test.js` builds its list of defined names from both files. Their assertions do not change | revert the step C pull request; the app's own `registry/` is still there |
| D | App: the installed-copy test reads the lock; component tests read the installed copies (group 6, tasks 6.1-6.2) | both old and new checks | revert |
| E | After Jack's yes (open question 2): remove the app's `registry/`, `public/r/`, `registry:*` scripts, `vite.registry-test.config.ts`, the old CI steps and the `Dockerfile` lines (task 6.3) | the new checks only | revert the deletion pull request; git has every file |
| F | New components in the registry, no Radix first (group 7); then the Radix ones after Jack (group 8) | each arrives in the app as a sync pull request with every test | revert the sync pull request and add the version to `skipVersions` |

**Which components switch first in the app.** The move itself (step C)
switches all 11 installed ones at once, with no byte changed, which is the
safest possible first switch. The first new ones a screen takes are those
replacing something hand-built today, each in its own later change with its
drawing: `switch` (for `src/screens/settings/row-switch.tsx` and the switches
in `your-settings-page.tsx`), `badge` (status chips), `card`, then, after
Jack, `dropdown-menu` and `context-menu` for the diary's menus
(`src/screens/diary/diary-page.tsx`).

**Undoing a bad release once merged:** revert the sync pull request's merge on
a branch, merge that on green, and add the version to `skipVersions` so the
daily job doesn't offer it again. The registry fixes forward with a new
patch version, which the job then offers. Tags are never moved or deleted.

**Pull request sizes.** Step A copies about 1,900 lines of components and
tests (`wc -l registry/*/*.tsx tests/registry/*.js`) into a new repository,
and step C commits about 68 KB of released JSON into `vendor/`. Both are
copies proven by a test (identity in A, the empty diff in C), so they are
checked by those tests rather than read line by line; every other pull
request keeps to 250-600 changed lines.

**The before-and-after check on the built CSS.** `tests/theme-split.test.js`
proves the split changed no rule: every rule in
`tests/fixtures/theme-css-rules-before.json` (captured from the built CSS
before the split by `node scripts/registry/capture-css-rules.mjs`) must still
be in the built CSS with the same declarations. Rules the built CSS has in
addition (the open/close animations a later release adds) do not fail it.
When a release changes or removes a rule on purpose (its changelog says
what changes on screen), the person syncing runs the same script against a
fresh `npm run build` in that sync pull request, and the fixture's diff shows
there; the sync job never regenerates it, and nobody edits it by hand.

## 6. Radix and D-005's open item 3

**Background.** D-005 expected Radix ("Radix and Tailwind provide these
directly", `docs/decisions/2026-08-31-frontend-platform.md:23-27`), but the
scaffold used the browser's own `<dialog>` and plain `<label>` because Radix
wasn't installed (open item 3, lines 89-92). Jack then chose the browser's
own controls for the booking form and turned Radix down
(`docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md:19-22`).
The ESLint gate already allows Radix only inside `src/components/ui/`
(`eslint.config.js:12-34, 112-118`).

**Recommendation (option 1 in the proposal's open question 1):** the
browser's own controls first. Keep every Wheelhouse component as it is;
build `switch`, `sheet`, `accordion`, `collapsible`, `progress`, `separator`
and `native-select` on the browser's own elements too; use Radix only for
`dropdown-menu`, `context-menu`, `popover`, `hover-card` and `tabs`, where the
browser has nothing that handles keyboard, screen reader and placement well
on its own. No Radix on the customer booking pages.

**Why.** It keeps every behaviour the app's 31 pop-up box screens and the
booking pages have been tested with; it uses Radix exactly where hand-building
is hardest to get right (menus that open from a button or a right-click and
must be usable with arrow keys and a screen reader); and every other shadcn
component in §1 already works without it. What it costs: one package, and a
small mix (most components native, five on Radix) that a newcomer has to read
about in the README.

shadcn 4.19.1 can also build on Base UI instead of Radix (the `base` library
seen in its code). Not recommended now: not checked in detail, and it is a
second unfamiliar library rather than none.

**What the pop-up box must keep, now tested in the registry** (it has no
component test today; jsdom cannot open a native `<dialog>`, so these are
browser tests, task 2.5): opening calls `showModal()`; Escape closes it and
calls `onOpenChange(false)` (`registry/primitives/dialog.tsx:45-53`);
focus stays inside while open and returns afterwards; a backdrop click closes
it only when `dismissOnBackdrop` is true, and `confirm-dialog`'s destructive
confirmations ignore it; the close button is named "Close"; the panel is
480px wide, 640px with `wide`; its background is `var(--modal-bg)`. `sheet`
reuses these tests.

**Recording it.** Once Jack answers, the answer is written as D-008 in a new
`docs/decisions/` file (the registry's component policy), and open item 3 of
the 31 Aug file gets a line pointing to it (task 8.1).

## 7. Interfaces the tasks' tests touch

### Registry repository

- `package.json` scripts: `build` = `shadcn build registry.json --output public/r`;
  `validate` = `shadcn registry validate registry.json`;
  `check:drift` = `node scripts/ci/check-registry-drift.mjs`;
  `check:coverage` = `node scripts/ci/check-coverage.mjs`;
  `pretest` = the Vite build of `registry/**/*.tsx` into `.test-build/`
  (as the app's `vite.registry-test.config.ts`);
  `test` = `node --test "tests/**/*.test.js"`; `test:visual` = `playwright test`;
  `test:visual:update`; `typecheck`; `lint`.
- Items: `theme` (`registry:file`, `theme/wheelhouse-tokens.css`, target
  `src/styles/wheelhouse-tokens.css`); `utils` (`registry:lib`,
  `lib/utils.ts`); the 15 existing items with unchanged names, types,
  `dependencies` and `registryDependencies`.
- `upstream/coverage.json`: `{ "source": "https://ui.shadcn.com/r/index.json", "style": "new-york-v4", "cli": "4.19.1", "fetched": "<YYYY-MM-DD>", "items": { "<name>": { "label": "add" | "wheelhouse" | "hold" | "leave-out", "reason": "<text>", "wheelhouseItem"?: "<name>", "evidence"?: "<path:line>" } } }`.
- `upstream/ported.json`: `{ "<name>": { "upstreamSha256": "<hex>", "fetched": "<YYYY-MM-DD>", "changes": ["<text>"] } }`.
- `scripts/ci/check-coverage.mjs` exports
  `findUnsorted(indexNames: string[], coverage: Coverage): string[]` and
  `findNotUpstream(indexNames: string[], coverage: Coverage): string[]`;
  run as a script it reads the snapshot and exits 1 with
  "Not yet sorted: <names>. Label each in upstream/coverage.json as add, wheelhouse, hold or leave-out."
  or "Not in shadcn's list any more: <names>." Only `registry:ui` items
  count.
- `scripts/release/pack.mjs` exports
  `packRelease({ version: string, outDir: string }): Promise<{ tarball: string, sums: string }>`,
  writing `react-repo-<version>.tar.gz` (containing `r/*.json`) and
  `SHA256SUMS`; refuses with "Version <v> does not match package.json <p>"
  or "CHANGELOG.md has no section for <v>".
- `tests/identity.test.js`: for each of the 15 items, `name`, `type`,
  `dependencies`, `registryDependencies` and every `files[].content` in
  `public/r/<name>.json` equal those in
  `tests/fixtures/epos-public-r/<name>.json`, copied from
  `wheelhouse-epos`'s `public/r/` at a recorded commit
  (`tests/fixtures/epos-public-r/SOURCE.txt`).
- `tests/tokens.test.js`: every custom property `src/styles/theme.css`
  defines today (fixture `tests/fixtures/epos-theme.css`, same commit) is in
  `wheelhouse-tokens.css` with the same value in the same block (`:root`,
  `.dark`, `html.wh-larger-text`, `@theme inline`); the Soft sand values and
  contrast minimums from `tests/design-sand.test.js:21-47, 119-150`.
- `tests/visual/accent-override.spec.ts`, two cases with Ocean Blue's
  `#2f5f96` (`public/app.js:4488`): (1) set on `<html>`: a `Button` with
  `variant="accent"` and a test element with class `bg-primary` both have
  computed `background-color` `rgb(47, 95, 150)`; (2) set as
  `style="--accent: #2f5f96"` on a wrapper: the accent `Button` inside is
  `rgb(47, 95, 150)` and the `bg-primary` element inside is
  `rgb(42, 40, 34)`.
- `tests/money-input.test.js` (node:test + jsdom, on
  `.test-build/registry/patterns/money-input.js`, as the other component
  tests), pinning today's behaviour of `parsePence(input: string): number | null`,
  `formatPence(pence: number): string` and `MoneyInput`:
  `parsePence('27.75')` is `2775` (the drawn price "£27.75", `consolidate/j11.mjs:58`);
  `'£1,234.5'` is `123450`; `'12.'` is `1200`; `'-0.05'` is `-5`; `''`, `'.'`,
  `'-'`, `'1.234'` and `'abc'` are `null`; `formatPence(2775)` is `'27.75'`,
  `formatPence(-5)` is `'-0.05'`, `formatPence(0)` is `'0.00'`;
  `formatPence(1.5)` throws a `TypeError` naming the value; typing `12.`
  into `MoneyInput` keeps `12.` on screen and calls `onValueChange(1200)`;
  leaving the field shows `12.00`; typing `1.234` sets `aria-invalid` and
  does not call `onValueChange`; emptying the field calls
  `onValueChange(null)`; the `£` symbol is drawn outside the editable text.
- `tests/guards.test.js`, over `registry/**/*.{ts,tsx,css}` except
  `registry/theme/wheelhouse-tokens.css`: the raw-colour guard ported from
  the app's `tests/design-tokens.test.js:65-101` (hex, colour functions,
  palette classes such as `text-white`, `white`/`black` in arbitrary
  values; extended to catch an opacity suffix such as `bg-black/50`), its
  self-test sample, the fixed-text-size guard (`:112-117`, `text-[13px]`),
  and the shadcn named-colour guard (section 1 table, left column), message
  "<file>:<line> uses shadcn's <class>; use the Wheelhouse token form from design.md section 1".
- `tests/registry-deps.test.js`: every item's `registryDependencies` entry
  is `@wheelhouse/<name>` with `<name>` an item in `registry.json`; message
  "<item> depends on <dep>; write it as @wheelhouse/<name> of an item in this registry".
- `tests/fonts.test.js`: `registry/theme/wheelhouse-tokens.css` declares an
  `@font-face` for `Public Sans` and `DM Mono`, and
  `site/public/fonts/public-sans/public-sans-latin-wght.woff2`,
  `site/public/fonts/dm-mono/dm-mono-latin-500.woff2` and each folder's
  `OFL.txt` exist. The visual tests wait for `document.fonts.ready` and
  check `document.fonts.check('16px "Public Sans"')` is true before taking
  pictures.
- `scripts/upstream/refresh.mjs` (`npm run upstream:refresh`): re-fetches
  the list into `upstream/index.snapshot.json` with the date.
- `tests/visual/dialog.spec.ts`: the behaviours listed in §6.

### App (`wheelhouse-epos`)

- `scripts/registry/sync.mjs`, run as
  `node scripts/registry/sync.mjs --from <dir> --version <vX.Y.Z> --commit <sha>`
  or `node scripts/registry/sync.mjs --add <name>`. Exports:
  - `hashFile(path: string): string` (sha256, hex);
  - `readLock(path: string): Lock`, `writeLock(path: string, lock: Lock): void`
    (keys sorted, two-space indent, trailing newline);
  - `planInstall(lock: Lock, snapshotDir: string): string[]`: the installed
    names, theme first; throws
    "Installed item <name> is missing from registry <version>. Change the app to stop using it first."
    when the new release lacks one;
  - `installOrder(names: string[], snapshotDir: string): string[]` and
    `missingPackages(names: string[], snapshotDir: string, packageJson: object): { item: string, package: string }[]`,
    with the messages in section 3.6;
  - `bootstrapLock({ uiDir, snapshotDir, registry, version, commit }): Lock`,
    section 3.7, run by `--bootstrap`;
  - `syncFrom({ from, version, commit, lockPath, vendorDir, packageJsonPath, run }): Lock`:
    refuses a version in `skipVersions` with "<version> is in skipVersions";
    replaces `vendorDir` with `from`'s `r/`; stops on `missingPackages`;
    for each name from `installOrder`, writes the item with
    `registryDependencies` emptied to a temporary folder and runs
    `npx --no-install shadcn add <that file> --yes --overwrite` through the
    injected `run(cmd, args)`; puts back and stops if `package.json` or
    `package-lock.json` changed (section 3.6); then records `snapshot` and
    `installed` hashes. Dependencies pulled in by `installOrder` are added
    to `installed`.
- `scripts/ci/check-registry-drift.mjs --vendored [--root <dir>]`, exit 1 with:
  - "Vendored registry changed by hand: <file>. Run the registry sync instead."
  - "Installed component edited by hand: <path>. Change it in react-repo and sync a new version."
  - "Not from the registry: <path>. Install it with node scripts/registry/sync.mjs --add <name>, or move it out of src/components/ui."
  - on success: "Registry check OK - <n> vendored file(s) and <m> installed file(s) match react-repo.lock.json (<version>)."
  Without `--vendored` it behaves exactly as today.
- `.github/workflows/test.yml`: a `workflow_dispatch:` trigger, and a step
  "Fail if a registry file was edited by hand" running the `--vendored` check
  after the existing drift step.
- `.github/workflows/registry-sync.yml`: §3.3.
- `src/styles/wheelhouse-tokens.css` (installed); `src/styles/theme.css`
  (imports it, keeps cursor, print, Reduce motion).
- New app tests: `tests/registry-sync.test.js`,
  `tests/registry-drift-vendored.test.js`, `tests/theme-split.test.js`
  (theme.css redefines no token from the tokens file, message
  "theme.css redefines --<name>, which comes from the registry's tokens file. Change it in react-repo instead.";
  every rule in `tests/fixtures/theme-css-rules-before.json` is still in the
  built CSS with the same declarations, message
  "The built CSS lost or changed <selector>"; and no file under `src/`, no
  `*.html` page and no installed registry file adds the `dark` class to the
  page, matching `classList.add('dark')`, `classList.toggle('dark'` or a
  `class` attribute containing `dark` on `<html>`, message
  "<file> switches the dark look on, which is not approved (D-005 open item 1)").
- `scripts/registry/capture-css-rules.mjs`: reads the built CSS from
  `public/dist/` and writes `tests/fixtures/theme-css-rules-before.json`
  (selector to sorted declarations), section 5.

## 8. Decision log

| # | Decision | Because |
|---|---|---|
| 1 | Sort every shadcn component into add / Wheelhouse / hold / leave out | Mark's "FULL range … for everything we plan to use"; Jack's 26 Sep choices; nothing missing by accident |
| 2 | Input-otp and form left out; calendar covered by `month-calendar`; select held until a long list appears (r1: was "calendar and select left out") | built native code box; no form library in the app; Jack 26 Sep decisions 1-2 are about the booking screens, and decision 2 says "a dropdown is added if a long one appears" (challenge r1 finding 10) |
| 3 | One whole tokens file, not `cssVars` | checkable byte for byte; keeps comments; no rewriting of `theme.css` |
| 4 | Releases plus a sync pull request (a) | the pull request shows real changes; keeps shadcn's model; no new account if public |
| 5 | Sync job never merges; `Tests` required on `main` | Mark: "a registry change can never break the app without a PR and green tests"; global rule "no red is not green" |
| 6 | `v1.0.0` identical to today | D-007, no visual change during a move |
| 7 | Browser's own controls first, Radix only for five, waiting on Jack | D-005 open item 3; Jack 26 Sep decision 1 |
| 8 | Old `registry/` kept until Jack agrees to delete it | `CLAUDE.md`: deleting needs Jack |
| 9 | The shadcn list and three GitHub behaviours are from memory, each with a task that proves it | network blocked in this session (§0) |
| 10 | Add-or-hold for the four drawn Hold rows (`sonner`, `command`, `chart`, `navigation-menu`) asked of Mark, not decided here | challenge r1 finding 1: holding drawn parts narrows "everything we plan to use"; a product question |
| 11 | The shop colour claim narrowed: an override on `<html>` reaches everything, one on a wrapper reaches what reads `var(--accent)` directly; the `:root` mapping is unchanged in `v1.0.0`; ported components read `var(--accent)` directly | challenge r1 finding 2: `--primary: var(--accent)` is resolved on `:root` (`theme.css:154`); changing it would change the built CSS (D-007) |
| 12 | A colour-class table for porting; shadcn's `bg-accent` becomes `bg-[var(--wh-hover)]`; a guard rejects shadcn colour names | challenge r1 finding 3: `accent` means the hover surface in shadcn and the charcoal action colour here; the table follows the built button (`button.tsx:23-34`) |
| 13 | The app's raw-colour, fixed-size and `--muted` guards run in the registry's own tests | challenge r1 finding 4: a bad component must fail before release, not in the app's sync pull request |
| 14 | The four tests that read `theme.css` as text are named and repointed in task 5.6; the registry's `colours.test.js` reads a fixture until the tokens file exists | challenge r1 finding 5; r1-second finding 3 |
| 15 | `sync.mjs` installs dependencies itself, in order, from the vendored release, never through `components.json`; it stops on a missing npm package and undoes any `package.json` change | challenge r1 finding 6; r1-second finding 2; the installed CLI installs packages during `add` (`chunk-JKB2HING.js:128`) |
| 16 | Repository settings steps are Jack's (or Mark's as admin); the Actions pull-request setting added; required check names are job ids (`test`, `ci`); task 4.5 proves a check-less pull request is refused | challenge r1 finding 7 |
| 17 | The old installed-copy rule applies only to names with a source in the app's `registry/` | challenge r1 finding 8: a new component would otherwise fail until the deletion |
| 18 | Font files and licences copied into the registry's `site/`; a fonts test; pictures wait for the fonts | challenge r1 finding 9; r1-second finding 7 |
| 19 | Phase 4 contract's "not stock shadcn, no Radix" listed as contradiction 4 | challenge r1 finding 10 |
| 20 | `money-input` gets its first tests (task 1.8); the money claim corrected; the group 5 pull request runs `/review` | challenge r1 finding 11; r1-second finding 1 (no tests existed) |
| 21 | `theme-split` compares "every old rule still present", with a capture script for intended changes | r1-second finding 4: a frozen equal-set fixture fails on the first legitimate change |
| 22 | A `--bootstrap` first sync builds the lock from `src/components/ui/` | r1-second finding 6 |
| 23 | `upstream:refresh` script and its use in the watch issue | r1-second finding 11 |
| 24 | Dependency row 1 completed (`@types/*`, `@eslint/js`, Playwright image); `recharts` row 6 added | challenge r1 finding 15; r1-second finding 5 |
