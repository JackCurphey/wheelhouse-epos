# Wheelhouse EPOS — project rules

Wheelhouse is a till, workshop and website system for independent UK bike
shops. Jack Curphey owns this project; Mark Curphey is his collaborator. Jack
is not a programmer: write to him in plain English, with numbered options
(1, 2, 3) and concrete trade-offs, one question at a time.

These rules override the matching lines in the global rules for this
project only (Jack, 3 Oct 2026, `docs/decisions/2026-10-03-build-plan-questions.md` Q1).

## Start of every session

1. Read only the "Start here" section at the top of `.agents/STATUS.md` (who
   is on what, and what's next). The rest of STATUS, and `.agents/ARCHIVE.md`,
   is history: send the `reader` agent for a part of it when you need one.
2. If building, read only the build plan's entry for your piece in
   `docs/superpowers/plans/2026-10-03-release-2-build-plan.md` (search for its
   `WP-` id), and what it depends on. Don't read the build plan or the split
   plan in full (Jack, 11 Nov, `docs/decisions/2026-11-11-speeding-up-the-build.md`).
3. **Two people build at once, by feature, not by layer** (Mark, 21 Oct,
   `openspec/changes/working-agreement/`; Jack is told by an issue and can
   overrule it). Whoever starts a piece takes it from the drawing through the
   server to the screen, migration and tests included. Either person can fix
   or pick up anything. Take the piece in STATUS's "who is on what" block
   before you start it, so two people never build the same one. The old
   rules (each file has one owner; every Jack server change needs Mark's
   approval; Mark's server half merges first) no longer apply.
4. **The build has started** (Jack, 4 Oct). Each week STATUS names a theme per
   person from the build plan; take the next piece in a theme. The stage check
   is a checklist issue, ticked when its lines are in; it doesn't stop other work.

## Where things live

- **OpenSpec** (from 8 Oct; Mark's suggestion, Jack's decision):
  `openspec/specs/<area>/spec.md` says what the app does today, one folder
  per area; `openspec/changes/<name>/` holds each piece of work in progress
  (proposal, specs, design, tasks) until it is archived. `openspec/config.yaml`
  carries the project's rules for every proposal.
- **OpenSpec only** (Mark, 8 Oct, for Jack to confirm on #186;
  `docs/decisions/2026-10-08-openspec-only.md`): the split plan and build
  plan set only the order of work and the lanes; every piece of work is an
  OpenSpec change (proposal, specs, design, tasks) instead of a section in
  `docs/superpowers/specs/`. An area's spec is written just before work
  first touches that area, not all at once. A piece is one change: the
  contract in its `design.md`, all its tasks in its `tasks.md`, archived when
  it is built.
- `docs/superpowers/specs/` is history and source material; no new files go
  there. Older plans in `docs/superpowers/plans/` are history too. As each
  area's OpenSpec spec lands, a line at the top of the old documents it
  replaces points to it.
- Jack's decisions: `docs/decisions/` (one file per journey, plus the
  walk-throughs). Never reopen a decision; note when work touches one.
- The drawings: `docs/design/user-journeys/generator/` (screen ids in
  `journeys.mjs`), published as claude.ai canvases listed in `.agents/STATUS.md`.
- Personas for walk-throughs: `docs/design/user-journeys/personas.md`;
  the method: `docs/design/user-journeys/ux-walkthrough-script.md`.
- Gaps the drawings didn't cover, decided while building, for Jack to
  overrule: from 12 Nov, one file per person per month in
  `docs/decisions/decided-while-building/` (its README gives the format);
  before that, `docs/decisions/decided-while-building.md`, which stays as it is.

## Allowed without asking (once the build has started)

1. Build exactly what the drawings and decisions show, taking pieces in this
   week's theme.
2. Make the database changes the plan lists.
3. Where a drawing is silent, follow the closest pattern already built, log
   it in your own month's file in `docs/decisions/decided-while-building/`,
   and carry on.
4. Merge your own pull request once `npm test` and `npm run test:browser`
   have passed locally on its final commit (after merging the latest main) and
   you have read your own diff against the spec and the drawings (a
   self-review). If main moves after a clean full run, and what it brings in
   doesn't overlap your files, touch a risky area or change test
   infrastructure, lint plus your related tests on the merged commit are
   enough (Jack, 11 Nov, `docs/decisions/2026-11-11-rerun-only-when-main-overlaps.md`).
   CI runs once a day, not on each pull request (Jack, 28 Oct,
   `docs/decisions/2026-10-28-ci-once-a-day.md`); in a risky area, also run it
   by hand on the branch (`gh workflow run test.yml --ref <branch>`) and merge
   when it is green. **Four risky areas also need `/review` run first**, and go in the weekly
   digest issue for the other person to read afterwards; their comments never
   block a merge, a problem found becomes a task either can fix:
   (1) migrations; (2) money and stock (sales, payments, refunds, `stock_qty`,
   sign-off); (3) sign-in, customer accounts and public routes
   (`/api/portal/*`); (4) `server/server.js` and the messaging core. The file
   lists are in `openspec/changes/working-agreement/design.md`.
5. Remove an old-app screen (`public/app.js`) once its new replacement is
   merged.
6. Add a small, well-known dependency when a piece needs it; say so in the
   pull request.
7. The build board (`docs/build-progress/build-board.html`, published as
   https://claude.ai/artifact/NSgsNTKzrYr6GUK4GjF3by) fills itself in: each
   night `.github/workflows/board.yml` adds what has merged and opens a
   pull request with it; merge it. Its hand-written parts (slices, what's
   next, what's waiting) are changed by hand when they change, in any pull
   request. There is no daily status pull request (Jack, 11 Nov,
   `docs/decisions/2026-11-11-speeding-up-the-build.md` point 4); until the
   board workflow is merged, the daily one carries on. STATUS's "Start here"
   section is changed in the pull request that takes or finishes a piece.
   Append only to your own file in `docs/decisions/decided-while-building/`.

## Always stop and ask Jack

- Spending money, or creating or connecting a real account or key.
- Touching real shop data. Real Citrus Lime export files never go in the repo.
- Deleting anything not covered by rule 5 above.
- Anything that contradicts a recorded decision.
- A test that can't be made to pass, or a stage check that finds a broken
  story the decisions don't settle.
- Changing a screen's design beyond what the drawings show.

## How each piece is built

OpenSpec change (`/opsx:propose`: proposal, specs, design, tasks, citing
the drawings and Jack's decisions; its first line is `WP: WP-x.y`, the work
package it belongs to, or `WP: none`) → tests first, each watched failing for the right reason
→ build to the drawings, running only the related test files while you go →
self-review with the `reviewer` agent (and `/review` plus
`risky-area-reviewer` in a risky area) → `npm test` and
`npm run test:browser` pass locally → pull request → `/opsx:archive` as the
last commit in that pull request, before it merges, so `openspec/specs/`
describes what was built → merge when the local runs pass on that final
commit (and, in a risky area, the hand-run CI is green). A failed nightly run
on main is fixed first thing, before new work.

**A small piece** (under about 200 changed lines, outside the four risky
areas) has a proposal and `tasks.md` only: set `skip_specs: true` in the
change's `.openspec.yaml`, write no `design.md`, and archive it with
`openspec archive <name> --skip-specs` (Jack, 11 Nov, point 5). Risky areas
keep the full version at any size.

Where a piece has a server and a screen part, one person builds both; the
contract in `design.md` is a note for the reader, not a handoff. Pull requests aim for 250–600 changed lines; a small piece can be smaller.
Outside services (payments, email, sign-in, accounts software, Lightspeed,
Citrus Lime) are built behind an adapter with a pretend version until a real
account exists.

## Models and sessions

To make Claude's allowance go further (issue #669), sessions here start on
Sonnet (`.claude/settings.json`). Switch to Opus with `/model opus` for hard
design or debugging, then back with `/model sonnet`. Start a new session, or
`/clear`, after each piece.

- Reading, searching, or checking whether something exists: the `reader`
  agent (Haiku). Don't read the plans, STATUS, ARCHIVE or the old
  `decided-while-building.md` in full in the main session; send `reader` for
  the part you need.
- Self-review before merging: the `reviewer` agent (Sonnet).
- A change in one of the four risky areas: the `risky-area-reviewer` agent
  (Opus) as well as `/review`.

## Testing and environment

- The app runs on `localhost:8080`; Postgres via `docker compose` on port
  5433. `npm test` hangs silently without compose Postgres up.
- Full runs go through `npm run full-check` (Jack, 11 Nov): it waits its
  turn for a lock shared by every worktree on the Mac
  (`/tmp/wheelhouse-full-run.lock`, saying who holds it and since when), then
  runs `npm run lint`, `npm test` and `npm run test:browser`, all three even if
  one fails. Two full runs at once overload the Mac and fail tests that pass
  alone. A stress run queues the same way:
  `npm run full-check -- --lock-only -- <command>`. Stop a run with Ctrl-C,
  not `kill -9`, which leaves its tests running after the lock is free.
- Server tests pin the clock to 1 Sep 2026 (`WHEELHOUSE_TEST_CLOCK`); never
  add fixed test dates before it. Customer tests need `npm run pretest` first.
- Compare DOM query results with `assert.ok(x === null)`: `assert.equal` on a
  DOM node hangs about 60 s on failure.
- A worktree needs its own `.env` (gitignored), or server-booting tests fail
  with `ECONNREFUSED`.
- Use a scratch database to test migrations from empty.
- Before a full `npm test`, run `npm run build` and `npm run migrate`, as CI
  does; without them, tests fail on a missing `public/dist` manifest or
  missing tables. Four tests also need `ADMIN_DATABASE_URL`, the compose
  Postgres superuser:
  `postgres://postgres:<POSTGRES_SUPERUSER_PASSWORD>@127.0.0.1:5433/postgres`.
- While building, run only the related test files:
  `node --test --test-force-exit tests/<a>.test.js tests/<b>.test.js`
  (screen, customer and registry tests need `npm run pretest` first). Pick
  the tests for the files you changed; a change to a server route also
  counts as touching `server/server.js`. The full `npm test` runs once,
  before merging.

## Never

- Invent data: example data comes from the drawings; unknowns stay as
  bracketed placeholders like `[n]`.
- Invent a logo: there is no official Wheelhouse logo file yet.
- Commit to `main`, or commit `.env` files or keys.
