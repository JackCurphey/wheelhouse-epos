# STATUS — Wheelhouse EPOS

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
> **Never put a destructive command here** — one stale reset nearly destroyed
> the WorkOS plan. State facts; let the reader run the verbs.

**Mark is on:** WP-0.4's route moves (split plan §4.1), more areas to move
(eight merged 5 Oct). Then WP-0.5, the hosted
copy.
**Jack is on:** WP-0.2's screens half merged (#164, 5 Oct); the stage
check waits for Mark's lines 4 and 6.
Ready alongside: #136 (Citrus Lime exports, not started) and #138 (card
machine: an Ingenico Move/5000, wifi only; waiting on Jack asking
Paymentsense, questions on the issue), only Jack can do; reviewing Mark's
WP-0.4 pull requests; stage 0's stage check once lines 1–6 of §9 are in.
**Open for Jack:** drawings needed before WP-1.7: the trust-PIN "tap your
name" screen, and the "till only" pop-up's line for a Mechanic (WP-1.1 spec
§8); a Change requested badge on the job window (not drawn).

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
keeps the plan's order, so no workshop piece is built early. Also 5 Oct:
#153 (WP-1.1 roles and switches table, closes #132), #154 (WP-1.4 shops and
sites spec, closes #133), #124 (the clickable mockup's 13 Codex problems,
closes #123). #157 (split plan §3.1, the files both touch, closes #141) is
reviewed and waits on Mark's approval, by Jack's choice; once merged, every
server change Jack makes needs Mark's approval.

## Where the build stands

Stage 0 (split plan §9). Done: line 1 (WP-0.1); line 2 (WP-0.2 server
half, #148, 5 Oct); line 3 (STATUS trim, #149, 5 Oct); line 5 (WP-0.2 screens, #164,
5 Oct). In progress: line 4
(Mark, WP-0.4: route-list test #150, migration checks and
`scripts/new-db.sh` #151, screen-trace reads the route files #152, route
moves #155 suppliers, #156 purchase orders, #158 label settings and shop
theme, #159 website and Shopify, #160 sites and tills, #162 team, #165 printing and messages, #167 sign-in). Waiting: line 6 (Mark, WP-0.5; waits for line 4); line 7
(Jack, the stage check; waits for lines 1–6). Stage 1 starts only after
line 7. Planning fixes before stage 1: #131, #132, #133 closed; #141 in
#157, waiting on Mark. New: #161, for Mark: the migration backstop misses a
rename that duplicates a number (from #151; fix #166 open).

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
- Until WP-0.2's screens half merges: Back while "Sending…" can lose the
  customer's private link, and a lost reply can duplicate a booking (the
  screens don't send the request key yet; #148 fixed the server side).
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
