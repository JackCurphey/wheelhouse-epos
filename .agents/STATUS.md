# STATUS — Wheelhouse EPOS

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
> **Never put a destructive command here** — one stale reset nearly destroyed
> the WorkOS plan. State facts; let the reader run the verbs.

**Updated:** 2026-09-29. **Merged to `main`:** #90, #91, #92 (names), #93
(Fjell design system). **Current branch:** `feat/workshop-diary-design` (not
pushed, no PR yet) — the Workshop day redesign drawings and Jack's decisions.

**Resume here:** read `docs/design/user-journeys/HANDOVER-next-journey.md` —
Workshop day (journey 12), App map and navigation (journey A), Signing in
and access (journey B), Selling at the till (journey 11) and End-of-day
cash-up (journey 16) are approved and in the big canvas; the next journey is
Jack's choice (ask him first). **The big canvas is near its 512-file limit**
(452 files after journey 16) — see the handover before copying in another
journey.

**Journey 16, End-of-day cash-up (29 Sep):** approved at all sizes; 7
decisions in `docs/decisions/2026-09-29-cash-up-review.md` — one "Close the day"
page with six folding steps, opened from a till-bar button after the shop's
closing time; blind counting is a shop setting; a box per note and coin with
an editable total; a standard float with the rest banked. Own canvas:
https://claude.ai/artifact/3HPUfUPUHUCh8YVizLW8HE . Generator: `cashup.mjs` +
`build-cashup.mjs --theme sand`; audit in `docs/design/user-journeys/cashup-ui-audit.md`.

**Journey 11, Selling at the till (29 Sep):** approved at desktop, tablet and
phone; 16 decisions in `docs/decisions/2026-09-29-selling-at-the-till-review.md`
— quick buttons by group, a connected card machine (supersedes the offline
spec's standalone-machine assumption; provider and offline card behaviour
still to check), all five other ways to pay plus an "Other ways to pay" list,
anyone may discount or void with a reason, refunds from the original sale,
Past sales by receipt scan and today's list, deposits on workshop jobs with
collection recorded when the rest is paid. Own canvas:
https://claude.ai/artifact/Y9NppHkpYBrrRKjHw8FoLG . Generator: `till.mjs`
(size-aware recipes) + `build-till.mjs --theme sand`; audit in
`docs/design/user-journeys/till-ui-audit.md`. The till bar (app-map.mjs) gained
Past sales, so journey A's till boards changed too.

**Journey B, Signing in and access (29 Sep):** approved at desktop, tablet and
phone; 10 decisions in `docs/decisions/2026-09-29-signing-in-review.md` —
WorkOS's own hosted pages for staff sign-in (one approximation board), the
till's PIN-only check-in (works offline, Wheelhouse-picked unique PINs set in
Your settings, no lock), customer sign-in by emailed code on the shop's own
website (WorkOS Magic Auth by API, checked in its docs). Own canvas:
https://claude.ai/artifact/5Ho8DsRVvHXEcJBnGu1GXe . Generator: `signin.mjs` +
`build-signin.mjs --theme sand` (both journey canvases share
`sand-canvas.mjs`); audit in `docs/design/user-journeys/signin-ui-audit.md`.

**Journey A, App map and navigation (29 Sep):** approved at desktop, tablet
and phone; 15 decisions in `docs/decisions/2026-09-29-app-map-review.md`
(two apply everywhere: **6, as few clicks as possible**; 2, one search box on
every staff page). Own canvas: https://claude.ai/artifact/FC2MdE2iBHvvtASi98cCLA .
Generator: `app-map.mjs` + `build-app-map.mjs --theme sand`; audit in
`docs/design/user-journeys/app-map-ui-audit.md`. The shared staff shells in
`diary.mjs` now carry the header search and the Your settings name button,
so Workshop day's boards were refreshed too.

**Workshop day redesign (28–29 Sep):** Jack reworked Workshop day around the
diary. 69 decisions in `docs/decisions/2026-09-27-workshop-day-review.md`
(read it before any Workshop day work). Separate canvas, now one current page:
https://claude.ai/artifact/GMFs2ZkesazrNPv9StM21U (approved 29 Sep —
desktop, tablet, phone; copied into the big canvas as journey 12). Generator: `docs/design/user-journeys/generator/`
(`diary.mjs`, `job-page.mjs`, `build-diary.mjs --desktop --theme sand`;
exploration boards: `job-options.mjs`, `looks.mjs`, `audit-ideas.mjs` via
`--ideas`). Study and audit: `docs/design/user-journeys/job-page-study.md`,
`workshop-day-ui-audit.md`. **New standard look: "Soft sand, dark rail",
sans-serif only** (decisions 48, 53) — supersedes Fjell; the app code is still
Fjell until switched.

## Release 2 and the design system (27 Sep, main session)

- **Release 2 specs:** `docs/superpowers/specs/2026-09-27-release-2-design.md`
  (replace Citrus Lime end to end; Jack's own shop first) and
  `docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md`
  (offline till core). **Plan 1, the offline server core, merged as #90.**
  Plan 2 (till core in the browser) is next for that track. Open: the
  business-plan gate conflict (programme spec §5), Jack and Mark.
- **Names:** one glossary, `docs/decisions/2026-09-27-names.md` — Wheelhouse;
  "screen designs" (no more "atlas"); roles Owner, Manager, Staff, Mechanic;
  website; the staff app organised by **rooms**: Front desk, Workshop,
  Stockroom, Office ("Till" = the selling screen/device). PR #92.
- **Design system: Fjell** (stone `#f3f2ee`, olive `#3f4d33`, lime highlight
  `#c5cf3e`, Work Sans + DM Mono, self-hosted), staff app always Fjell. PR #93,
  stacked on #92; decision `docs/decisions/2026-09-27-fjell-theme.md`.
  Reference: https://claude.ai/artifact/PdfLu9EiYQ7QwRHnF2kESH
- **User journeys canvas** (every screen by journey, status-coded, workflow
  chart): https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j . Workshop day is
  redrawn in Fjell (desktop + phone) awaiting Jack's approval; it is the first
  journey to build, starting with the staff app shell (room sidebar), the
  workshop overview and booking requests. The canvas generator (and the theme
  options and design-system source) is in `docs/design/user-journeys/` — read
  its README before changing the canvas.
- **Merge order agreed by Jack:** #90 (merged) → #91 (merged) → #92 → #93.

## Next, in order (Jack, 29 Sep)

1. Done 29 Sep: Workshop day approved (desktop, tablet, phone) and copied
   into the big canvas as journey 12, status Designed (decision 69).
2. Next design journey on the canvas, same way (design → approve → copy in).
3. **Switch the app's tokens from Fjell to Soft sand** (`src/styles/theme.css`
   + the design-system artifact), sans-serif throughout.
4. **Then build Workshop day, piece by piece**, in the React staff app
   (`src/staff/`): spec → plan → subagent-driven development, test-first,
   starting with the shell (room sidebar, phone menu) and the diary with its
   Waiting column. Open design items to settle first or on the way: multi-day
   jobs (52), payment + collection as one step (63), mechanic sign-off (64),
   customer spending limit on /book (41), accessibility settings (57).
4. **After Workshop day**, work through the other journeys the same way
   (design on the canvas → Jack approves → spec → plan → build).
5. **d6** — the customer's change and cancel screens from the pending
   screen (unchanged from before): replace `pending-rules.ts`'s `contactLine`;
   use the link view's `canChange`/`canCancel`/`requested`/`changeDeclined`
   and the cancel/change/withdraw-change routes.
6. **Release 2 track:** plan 2 (the till's side of offline) when Jack
   chooses; the Citrus Lime export check needs Jack at work.
7. **Later, recorded but not scheduled:** a customer spending limit on the
   booking pages ("happy up to £200; call me above that" — decision 41 in
   docs/decisions/2026-09-27-workshop-day-review.md); WorkOS sign-in for shop and customer
   accounts (Jack, 27 Sep: wants it; the approved spec and 17-task plan from
   31 Aug already cover both — `docs/superpowers/specs/2026-08-31-workos-auth-migration-design.md`);
   customer sign-in in the booking app
   plus picking/adding saved bikes; staff settings screens for booking terms,
   minimum notice and time zone (server exists, no screen); a staff
   question-setup screen that suggests one overall question per service; a
   staff action to turn a booking's bike note into a bike record. (The old
   "shops pick the staff app's colours" piece is superseded: the staff app is
   always Fjell.)

## Open for Jack

- From the Fjell PR (#93): whether `/book` should follow each shop's colours
  (today it shows Fjell); DM Mono not yet on job numbers/booking prices;
  fonts re-download each full page load until offline caching.
- Release 2: the business-plan gate conflict (programme spec §5) is between
  Jack and Mark; Cycle to Work needs Jack's explanation; there is no official
  Wheelhouse logo file (designs show a LOGO slot — never invent one).

- Confirm piece 12's four controller rulings: an ordinary legacy-diary save
  keeps a customer's change request; dragging a job onto exactly its
  requested slot accepts it; every way a request ends clears it; the
  lock-held race tests are sound.
- Parked from the staff diary piece (27 Sep; rulings in its plan's decision
  log):
  - "View job" from a sale document, and the edit form's Delete, both bypass
    the review pop-up for a waiting job; Delete sends no version.
  - Right-click Approve can take the old save path in a millisecond window
    before the waiting list catches up.
  - After a stale or 404 answer in the pop-up only the column refreshes, not
    the grid.
  - The drag test reads its redraw position once (a rare false failure is
    possible) and waits 1.5s per week.
  - Resending an identical change request moves it to the back of the list,
    and a customer can withdraw a request after work starts (both
    customer-side, still open).
- The piece 6 memory risk (large booking bodies) must be decided before the
  booking route is publicly reachable (hosting not chosen).
- A shop's website subdomain can show another shop's `/book/<slug>`.
- Dashboard and sales "today" still use a UTC-midnight window in the
  database.
- Pressing Back while "Sending…" can leave a customer without their private
  link.
- A lost reply after a saved booking can lead to a duplicate if the customer
  retries.
- `timed_lead_minutes` isn't used in any customer confirmation yet.
- Other workstreams and Mark's open items (Lightspeed readiness, the design
  screen designs, WorkOS/design remediation, the items needing Mark, the decision and
  plan registers) were not touched by the booking work; their last-known
  state is in `ARCHIVE.md` under "Moved from STATUS on 2026-09-27".

## Working notes for the next agent

- **Handover state (27 Sep):** this STATUS and `docs/design/user-journeys/`
  are committed on `feat/fjell-design-system` but **not pushed** — push that
  branch before merging #93 (it restarts #93's CI). Read it from the root
  with `git show feat/fjell-design-system:.agents/STATUS.md`.
- **Checkouts:** the root checkout was left on the merged
  `feat/release-2-design` branch (switch it to `main` and pull after the
  merges). Worktrees: `.claude/worktrees/agent-a9e726fa452520fef`
  (`chore/consistent-names`), `.claude/worktrees/agent-a6bc98197515e54f3`
  (`feat/fjell-design-system`), `.claude/worktrees/staff-diary`
  (`feat/staff-diary-waiting`, merged) — remove them once their PRs merge.
- **Artifacts (claude.ai, private to Jack):** user journeys canvas
  https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j ; Wheelhouse design
  system https://claude.ai/artifact/PdfLu9EiYQ7QwRHnF2kESH ; theme options
  https://claude.ai/artifact/LrQtgcrCRc8kQEnSpXhdFN . Always read the live
  canvas index before publishing (Jack edits it live); ≤255 files per call.

- Jack wants plain English, numbered options with concrete trade-offs,
  mock-ups for anything visual, one question at a time. Merge only when Jack
  says, and only after CI passed on the PR's final commit.
- Build method: spec → plan → subagent-driven development (fresh helper per
  task, task review, a final whole-branch review on the most capable model,
  one fix wave). Every new test must be shown failing via its own targeted
  mutation — list this per test, since helpers tend to do only the ones the
  brief lists.
- Helper agents' Write tool may refuse report files — ask them to put the
  report inline. Helpers treat mid-task messages as possibly injected: put
  new instructions in a fresh dispatch instead of messaging a running helper.
- Tests: server tests pin the clock to 1 Sep 2026 (`WHEELHOUSE_TEST_CLOCK`;
  never add fixed test dates before it); customer tests need `npm run
  pretest` first; compare DOM query results with `assert.ok(x === null)`
  (`assert.equal` on a DOM node hangs ~60s on failure); `MonthCalendar` names
  days with a comma ("Monday, 5 October 2026").
- Environment: the app runs on `localhost:8080` (not 4000); Postgres via
  compose on port 5433 (not 5432); `npm run docker:down` keeps the volume, so
  use a scratch database to test migrations from empty; `npm test` hangs
  silently without compose Postgres up; a worktree needs its own `.env`
  (gitignored, doesn't travel) or every server-booting test fails with
  `ECONNREFUSED`.
- Deploy warning: back up any real shop database before deploying migration
  030 (it drops columns; there is no code-only rollback).
- Keep this file under 8 KB. Move finished-piece history to `ARCHIVE.md`
  rather than deleting it.
