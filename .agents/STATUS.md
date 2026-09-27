# STATUS — Wheelhouse EPOS

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
> **Never put a destructive command here** — one stale reset nearly destroyed
> the WorkOS plan. State facts; let the reader run the verbs.

**Updated:** 2026-09-27. **Branch:** `feat/staff-diary-waiting` (not pushed), built on
`docs/status-handover` (the handover commit `2b47759`) on top of `main` at `705ef0f`.

## Where things stand

The customer booking journey at `/book` is built end to end (d1–d5: service →
service list → problem → date → details → pending/private link; PRs #75,
#78–#80, #82, #84, #85, #87, #88) on top of server pieces 1–12 (piece 7 #76,
8 #77, 9 #81, 10 #83, 11 #86, 12 #89). Piece 12 (27 Sep) is the server side of
customer change/cancel via the private link, plus staff accept/decline-change
and `GET /api/workshop-waiting` with "Seen". Its spec is
`docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md`.

**The staff diary piece is built on `feat/staff-diary-waiting` (27 Sep), not
merged.** Spec `docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md`;
plan, decision log and spec walk in
`docs/superpowers/plans/2026-09-27-staff-diary-waiting.md`. In the legacy diary
(`public/app.js`) there is now a "Waiting for you" column, a review pop-up
(Accept / Decline / Seen), grid markings, and version-checked diary saves. The
rule scripts are `public/diary-waiting.js`, `diary-marks.js` and
`diary-review.js`, and the first browser tests for the legacy diary are in
`tests/browser/diary-waiting.spec.ts`. Local checks all pass; CI has not run
(no pull request yet).

## Next, in order (Jack, 26–27 Sep)

1. **Finish the staff diary piece:** push, open a pull request, and wait for CI
   to pass. Merge only when Jack says. (Marked jobs now show their label on
   the first line: Jack's choice, 27 Sep.)
2. **d6** — the customer's change and cancel screens from the pending
   screen. Replace `pending-rules.ts`'s `contactLine`; use the link view's
   `canChange`/`canCancel`/`requested`/`changeDeclined` and the
   cancel/change/withdraw-change routes.
3. **Later, recorded but not scheduled:** the shop colour-scheme piece (each
   shop picks one colour scheme for staff and booking apps, including
   "Pop-ups: our colours / plain white" — Jack, 26 Sep); customer sign-in in
   the booking app plus picking/adding saved bikes; staff settings screens
   for booking terms, minimum notice and time zone (the server exists, no
   screen yet); a staff question-setup screen that suggests one overall
   question per service; a staff action to turn a booking's bike note into a
   bike record.

## Open for Jack

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
- A shop's storefront subdomain can show another shop's `/book/<slug>`.
- Dashboard and sales "today" still use a UTC-midnight window in the
  database.
- Pressing Back while "Sending…" can leave a customer without their private
  link.
- A lost reply after a saved booking can lead to a duplicate if the customer
  retries.
- `timed_lead_minutes` isn't used in any customer confirmation yet.
- Other workstreams and Mark's open items (Lightspeed readiness, the design
  atlas, WorkOS/design remediation, the items needing Mark, the decision and
  plan registers) were not touched by the booking work; their last-known
  state is in `ARCHIVE.md` under "Moved from STATUS on 2026-09-27".

## Working notes for the next agent

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
