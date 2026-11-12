# STATUS — Wheelhouse EPOS

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
> **Never put a destructive command here** — one stale reset nearly destroyed
> the WorkOS plan. State facts; let the reader run the verbs.

## Start here (updated 11 Nov 2026)

Who is on what, and what's next. Change these lines in the pull request
that takes or finishes a piece. Everything that was here before 11 Nov is in
`ARCHIVE.md`, "Moved from STATUS on 2026-11-11 (#669)".

**Jack is on:** the Settings plan (`owner-setup-till-payments-eod`): quick
buttons on the server (#698) and in Settings, End of day (#701) and Ways to
pay (#709) are in; quick buttons on the till waits for Mark's yes on #693,
and the change is archived with it. `your-data-download` is in (#678).
`finish-account` is built and archived (#657 to #666).
Also on: WP-6.1 website management (`website-management`), built
overnight from 12 Nov, pull requests 1 to 6b; 7 waits for WP-1.1, 8 for WP-8.1.
Also on: WP-6.2 find the shop and browse, the customer website (`website-browse`), from 12 Nov in nine pull requests (Jack's answers: `docs/decisions/2026-11-12-website-browse-answers.md`).
Also on: Reports part 3, your own reports (`reports-your-own`, WP-5.3), built overnight from 12 Nov in four pull requests: 1 Change what's shown and the changed Sales report, 2 saving a report (migration), 3 rename and delete, 4 Workshop's Change what's shown. Margin's measure waits for part 2's sale-line costs.

**Jack next:**
1. Products, stock, sizes and colours (WP-1.5): nine of ten pieces in.
2. Paying a repair online: waits on Mark's deposit taken at the till.
3. The text receipt and its page: waits on Mark's step C.

**Mark is on:** the changes Jack agreed on #669: #670 is in; the rules,
faster tests and the board filling itself in are next. Before that, Mark's
last merged work was on 26 Oct.

**Mark next:**
1. Sales in pence step C.
2. A deposit taken at the till (`till-job-deposit`, waiting for Mark's yes).
3. Roles and the settings store (WP-1.1, WP-1.2).

**Waiting on Jack:** who may edit a supplier (#543); stock take, sales
during a count (#562); adding a till-only person (#558); settings on a
workshop computer (#568); ending a check-in to set up a till (#564);
supplier imports and stock history (#566); 491 leftover test shops (#567);
try once on Staging, the WorkOS password prompt (#578); "System restart
required"; overrule the 26 and 28-29 Oct sections of
`docs/decisions/decided-while-building.md` if you want. Later: switching
real sending on, Stripe and the S700 reader, a Google account (#140).

**Waiting on Mark:** his yes on #693 for quick buttons on the till
(`till-page.tsx`); what would free up more work (#560): the till deposit,
step C (an offline key for a new till, #564; PIN hashes in the offline
copy), roles and the settings store, WP-1.5, and his open pull requests
(#499, #511, #520). Also: `PUT /api/sale-documents/:id` can write an order
back to open; read what was built on his word (#357 onward, #265); his
opinion on replying to texts; the front page switch.

**Build board:** fills itself in each night (`.github/workflows/board.yml`,
once merged); its hand-written parts are changed by hand.
https://claude.ai/artifact/NSgsNTKzrYr6GUK4GjF3by, source
`docs/build-progress/build-board.html`.

## Links

- **Build plan:** `docs/superpowers/plans/2026-10-03-release-2-build-plan.md`;
  Jack's answers in `docs/decisions/2026-10-03-build-plan-questions.md`.
- **Split plan:** `docs/superpowers/plans/2026-10-04-release-2-two-person-split.md`
  (§5 this file's layout, §9 stage 0 order, §10 its decision log).
- **Decisions:** `docs/decisions/`. Wording derived while building, for Jack
  to overrule: `docs/decisions/decided-while-building/` (from 12 Nov) and
  `docs/decisions/decided-while-building.md` (before). Project rules:
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

## Working notes for the next agent

- Route moves: a move, not a rewrite; `tests/route-files-defined.test.js`
  catches a name left undefined. A database per worktree:
  `scripts/new-db.sh <name>`.
- Jack wants plain English, numbered options with concrete trade-offs,
  mock-ups for anything visual, one question at a time. Merging: until the
  build starts, only when Jack says; after, as `CLAUDE.md` sets out.
- CI (Jack, 28 Oct, #557, `docs/decisions/2026-10-28-ci-once-a-day.md`):
  it runs once a day on main and when started by hand, not on each pull
  request; main's required check is off. Merge when `npm test` and `npm run
  test:browser` pass locally; on a risky-area pull request, also run CI by
  hand (`gh workflow run test.yml --ref <branch>`) and merge when it is green.
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
- Keep "Start here" short. Move finished-piece history to `ARCHIVE.md`
  rather than deleting it.
- House style (Jack, 3 Oct 2026): any PowerPoint or slide deck about this
  project is titled "Deez Nuts".
