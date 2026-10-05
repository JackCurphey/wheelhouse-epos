# STATUS — Wheelhouse EPOS

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
> **Never put a destructive command here** — one stale reset nearly destroyed
> the WorkOS plan. State facts; let the reader run the verbs.

**Mark is on:** stage 0 — WP-0.2's server half is #148 (open); WP-0.3 is
this trim; WP-0.4 starts once #148 merges (split plan §9).
**Jack is on:** waiting on #148 for the booking screens. Ready meanwhile:
#136 (Citrus Lime exports) and #138 (card machine), only Jack can do; the
planning fixes due before stage 1 (#132, #133, #141); reviewing WP-0.4 when
Mark opens it; stage 0's stage check once lines 1–6 of §9 are in.
**Open for Jack:** a Change requested badge on the job window (not drawn).

**Updated:** 2026-10-05. **Two people build at once** (Jack agreed to Mark's
split plan, `docs/superpowers/plans/2026-10-04-release-2-two-person-split.md`,
PR #126): Mark takes the server half of each work package and all hosting;
Jack takes the screens and the whole workshop. STATUS and the build board are
updated by **one status pull request a day**, not by every feature pull
request (`CLAUDE.md`, rule 7).

**The build has started** (Jack, 4 Oct: "the corrections are all good, we
can go"). #126 merged with the four blockers fixed (#127–#130 closed);
`main` now requires the `test` check and an up-to-date branch (Jack's yes,
4 Oct). Stage 0, line 1 done: #110 (Quoting, the drawings' status words
everywhere, waiting for parts beats Quoting), #111 (the till; Escape and a
closed window can't hide a sale mid-save) and #112 (diary extras; stacked
jobs move by keyboard, press and hold fans a stack on touch) merged, with
the follow-up #144 (4 Oct). #146 (5 Oct) trimmed §7.2 and closed #131: Jack
keeps the plan's order, so no workshop piece is built early.

## Where the build stands

Stage 0 (split plan §9). Done: line 1 (WP-0.1). Not done: line 2 (Mark,
WP-0.2 server half, #148 open); line 3 (Mark, this trim); line 4 (Mark,
WP-0.4; waits for lines 1 and 2 to merge); line 5 (Jack, WP-0.2 screens;
waits for line 2); line 6 (Mark, WP-0.5; waits for line 4); line 7 (Jack,
the stage check; waits for lines 1–6). Stage 1 starts only after line 7.

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
opens, edit its `BOARD` data block and republish (Jack, 3 Oct: he keeps it open
to see where we are).

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
- A shop's website subdomain can show another shop's `/book/<slug>`.
- Dashboard and sales "today" still use a UTC-midnight window in the
  database.
- Pressing Back while "Sending…" can leave a customer without their private
  link.
- A lost reply after a saved booking can lead to a duplicate if the customer
  retries.
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
