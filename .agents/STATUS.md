# STATUS — Wheelhouse EPOS

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
> **Never put a destructive command here** — one stale reset nearly destroyed
> the WorkOS plan. State facts; let the reader run the verbs.

**Mark is on:** away after 15 Oct. His half of WP-0.4 is done: every
route of his is out of `server.js` (#202, #205, #209, #210–#214; #204 and
#208 were Jack's #151 follow-ups). WP-0.5: the host is DigitalOcean in
London, about £20 a month with VAT (#215; Jack's UK answer in
`docs/decisions/2026-10-15-hosted-copy-region.md`), and the setup script
and Jack's guide are in `scripts/hosting/` and `docs/runbooks/hosted-copy.md`
(#219). #134 answered: the sales-in-pence spec merged (#203). When back:
move the booking link's quote answer to `portal.js` (after #207); a login
for the drawings' test shop (task 3.6); WP-0.5 tasks group 2 (the guard,
the commit in `/healthz`), then the deploy workflow; then #203 step A.
Also waiting for him: approve #225 (Jack's, changes `server.js`); #231
(Jack's 16 Oct answers, and the test shop loader moving the drawn week to
the load week, `scripts/dev/` is his); #234 (`setup.sh` fixed for doctl
2.0, which Jack ran from the branch); and the
server half of #190 A, a guard so a cancelled, declined or expired booking
can't be booked in or started (the `workshop-jobs` spec allows it today;
Jack, 16 Oct, `docs/decisions/2026-10-15-job-page-fixes.md` item 5). Also
his: the bike on "Waiting for you" items (for the tablet cards' drawn bike
line, #241); a place to keep who signed a job off and when
(`docs/decisions/2026-10-16-mechanic-sign-off.md`); and Jack's question,
when the front page switches from the old app to the new one (16 Oct; the
plans don't say).
**Jack is on:** 16 Oct: the online test copy is live at
https://165-22-114-137.sslip.io (#221, lon1), with Jack's shop account on it;
updates by re-running `setup.sh` from #234's branch until #234 merges. Jack
tried the workshop there and, with the diary layout review (#238, a report
by a separate session), these merged on 16 and 17 Oct: the slot under the pointer
and the pointing finger (#236), New job's customer drop-down (#237), passing
messages float so nothing pushes the page, a rule for every screen (#239),
Waiting for you as a panel (#240), the review's four drawing catch-ups
(#241), Week/Day beside the dates and the phone's Today (#242), every diary
label at least 12px (#243), the upright tablet, drawn and built (#244), and
the mechanic sign-off designed (#245). All in
`docs/decisions/2026-10-16-workshop-test-copy-changes.md` and
`2026-10-16-mechanic-sign-off.md`. Also merged: the go-live checklist (#232)
and the till's job warning (#233). Open: #225, #231, #234, waiting for Mark.
Found, not fixed: the phone's "By mechanic" headings spill over with many
mechanics (next); then drawing the sign-off screens. The stage check waits
for lines 4 and 6 of §9.
**Open for Jack:** nothing waiting now. Small to-dos: ask the accountant
which Citrus Lime reports they use; make a Google account for Wheelhouse
(go-live checklist). Later: ask Citrus Lime for the full export (stage 7,
#171); his yes to open Stripe and buy the S700.

**Updated:** 2026-10-17. **Two people build at once** (Jack agreed to Mark's
split plan, `docs/superpowers/plans/2026-10-04-release-2-two-person-split.md`,
PR #126): Mark takes the server half of each work package and all hosting;
Jack takes the screens and the whole workshop. STATUS and the build board are
updated by **one status pull request a day**, not by every feature pull
request (`CLAUDE.md`, rule 7).

**The build started 4 Oct** (Jack). The record of 4–5 Oct's planning
merges (#126, #110–#112, #144, #146, #153, #154, #124, #157's state) is in
ARCHIVE, "Moved from STATUS on 2026-10-05 (evening)".

## Where the build stands

Stage 0 (split plan §9). Done: line 1 (WP-0.1); line 2 (WP-0.2 server
half, #148, 5 Oct); line 3 (STATUS trim, #149, 5 Oct); line 5 (WP-0.2 screens, #164,
5 Oct). In progress: line 4
(Mark, WP-0.4: route-list test #150, migration checks and
`scripts/new-db.sh` #151, screen-trace reads the route files #152, route
moves #155 suppliers, #156 purchase orders, #158 label settings and shop
theme, #159 website and Shopify, #160 sites and tills, #162 team, #165
printing and messages, #167 sign-in, #168 products; 15 Oct: #202 the sale helpers, #205 workshop settings and `server/lib/uploads.js`, #209 image uploads, #210 and #211 the booking pages, #212 customers, #213 sales and orders, #214 employees and the dashboard; Jack's workshop moves #180–#184, with his quote routes (#207) approved; guards that moved files
and `server.js` define every name they use and import nothing unused,
#155 and #158). Waiting: line 6 (WP-0.5: spec #201, DigitalOcean in London #215, setup script #219; Jack sets it up once he says yes on #137); line 7
(Jack, the stage check; waits for lines 1–6). Stage 1 starts only after
line 7. Planning fixes before stage 1: #131, #132, #133 closed; #141 done in
#157 (5 Oct). #161 fixed by #166. Stage 1's 25 drawing gaps answered (#185,
7 Oct). Specs now live in `openspec/` (#186, 8 Oct).

- **Build plan:** `docs/superpowers/plans/2026-10-03-release-2-build-plan.md`;
  Jack's answers in `docs/decisions/2026-10-03-build-plan-questions.md`.
- **Split plan:** `docs/superpowers/plans/2026-10-04-release-2-two-person-split.md`
  (§5 this file's layout, §9 stage 0 order, §10 its decision log).
- **Decisions:** `docs/decisions/`. Wording derived while building, for Jack
  to overrule: `docs/decisions/decided-while-building.md`. Project rules:
  `CLAUDE.md`.
- **Canvases (claude.ai, private to Jack).** Shop floor (shared link)
  https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j ; back office
  https://claude.ai/artifact/5H8Dv294J1eF6idFoLU6e4 ; customers and website
  https://claude.ai/artifact/6XUis1aqRZqeST5f8UHWXh ; clickable mockup
  https://claude.ai/artifact/6rfhPpmSNY8eDtD6bEnChi ; Workshop day
  https://claude.ai/artifact/GMFs2ZkesazrNPv9StM21U ; design system
  https://claude.ai/artifact/PdfLu9EiYQ7QwRHnF2kESH ; theme options
  https://claude.ai/artifact/LrQtgcrCRc8kQEnSpXhdFN . Each journey's own
  canvas link is in ARCHIVE. Always read the live canvas index before
  publishing (Jack edits it live); ≤255 files per call.

**Build board (keep it current):** https://claude.ai/artifact/NSgsNTKzrYr6GUK4GjF3by,
source `docs/build-progress/build-board.html`. After any build piece merges or
opens, edit its `BOARD` data block, including the Overview tab's `overview`
(Needs you, Waiting on Mark, Next up), and republish (Jack, 3 and 8 Oct).
It is not Jack's local task log (`~/Dashboards/`).

## Open for Jack

- Release 2: the business-plan gate conflict (programme spec §5) is between
  Jack and Mark; Cycle to Work needs Jack's explanation; there is no official
  Wheelhouse logo file (designs show a LOGO slot — never invent one).
- Confirm piece 12's four controller rulings: an ordinary legacy-diary save
  keeps a customer's change request; dragging a job onto exactly its
  requested slot accepts it; every way a request ends clears it; the
  lock-held race tests are sound.
- The piece 6 memory risk (large booking bodies) must be decided before the
  booking route is publicly reachable (hosting not chosen).
- `tests/screens/session.test.js:3` says `serializeSession` lives in
  `server.js`; it is in `server/routes/auth.js` now.
- Found in #148, not fixed: on a website address `/api/portal/*` returns the
  website's HTML (`decided-while-building.md`, Mark's lane), for WP-0.5.
- `timed_lead_minutes` isn't used in any customer confirmation yet.

## Moved to ARCHIVE

All in `ARCHIVE.md`, "Moved from STATUS on 2026-10-05 (WP-0.3)":

- Issue #116 record and its open walk questions for Jack (walk 10 L1, walk
  11 M3/L1, drawer wording, size gaps): "Older notes from the top of STATUS".
- Each journey's record, open notes and own canvas link: "Journey and
  walk-through paragraphs".
- Release 2 specs, names and Fjell: "Release 2 and the design system (27
  Sep, main session)". The 29 Sep list (d6, and unscheduled items such as
  WorkOS sign-in): "Next, in order (Jack, 29 Sep)".
- Fjell items, five parked diary items, other workstreams: "Open for Jack —
  the Fjell bullet…".
- Old checkouts, build method, helper notes, migrations 037 and 038: "Working
  notes moved out".

## Working notes for the next agent

- Route moves: a move, not a rewrite; `tests/route-files-defined.test.js`
  catches a name left undefined. A database per worktree:
  `scripts/new-db.sh <name>`.
- Jack wants plain English, numbered options with concrete trade-offs,
  mock-ups for anything visual, one question at a time. Merging: until the
  build starts, only when Jack says; after, as `CLAUDE.md` sets out. Always
  after CI passed on the PR's final commit.
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
- House style (Jack, 3 Oct 2026): any PowerPoint or slide deck about this
  project is titled "Deez Nuts".
