# STATUS — Wheelhouse EPOS

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
> **Never put a destructive command here** — one stale reset nearly destroyed
> the WorkOS plan. State facts; let the reader run the verbs.

## Start here (updated 13 Nov 2026)

Who is on what, and what's next. Change these lines in the pull request
that takes or finishes a piece. Everything that was here before 11 Nov is in
`ARCHIVE.md`, "Moved from STATUS on 2026-11-11 (#669)".

**Jack is on:** the website and Cycle to Work. Website browse (WP-6.2,
`website-browse`): the plan (#742), the read and product routes (#744, #745)
and the pages (#750 to #752, #754 to #756) are in; timing the suggestions,
removing the old website and the archive are in the last pull request
(#774); the follow-ups found in review are listed at the end of its
`tasks.md`. Buy online (WP-6.3, `website-buy-online`): the plan (#746), the
order tables and settings on the server (#753, migration 154) and the six
order messages (#758), the settings screen (#773, #775) and the order
emails' review fixes (#776) and the basket and checkout's server half
(#777, stopping where paying would start) and the basket screens (#797) are
in, and checkout's screen up to paying (#801); paying on the server
(group 5, guards 5.0a–e first), behind the pretend provider, is being built
(claude/buy-online-7-paying), then refunds (group 7). Jack answered questions 9 and 11 (14 Nov, option 1 each: a
sale and the stock drop at payment; a Hand over button on the staff order
page), so paying, the staff steps and refunds follow the screens
(`docs/decisions/2026-11-13-website-buy-online-defaults-taken.md`). The
staff's online orders on the server (group 6: the list, Mark ready, Not
ready after all, Hand over) are in (#803); paying (group 5) and refunds (group 7)
are taken by the checkout screen's builder. Cycle to
Work (WP-7.1, `cycle-to-work`): the plan (#703), tables and settings (#706,
#707), orders and quotes (#708, #721), holding bikes (#718, migration 145),
the certificate, Ready to collect and ordering the bike (#723, #726, #728,
#731, #733), the customer's page and messages (#719, #730, #738), Today and
the header search (#725, #734), hand-over at the till and the provider's
money on the server (#757, #762) and the customer's account (#720) are in;
cancelling an order and the rest of the screens (#763, #767 to #772) are open.

Merged 11 to 13 Nov, all Jack's apart from Mark's below: `your-data-download`
finished and archived, with sales and refunds, workshop jobs (#668), the
screen (#677) and the Citrus Lime left-out rows with See them (#678). Reports
(WP-5.3): part 1 built and archived (#664, #683, #685, #689, #690, #692);
part 2, Workshop, Returning customers, VAT and the stock half of Margin and
stock value (#680, #694, #699, #736 migration 149, #741); part 3, your own
reports, built and archived (#691, #724, #727 migration 146, #729, #732);
part 4, reopen a closed day and the accounts software (#739, #760 migration
151, #761 migration 152, #764 migration 153). Settings (WP-5.1, WP-1.3): the
plan (#693), quick buttons (#698 migration 131, #713, #740), End of day (#701
migration 132), the Cash card and Other ways to pay (#709 migration 140); the
till showing quick buttons waits for Mark's yes on #693. Website management
(WP-6.1, `website-management`): the plan (#702), publish, discard and
History (#704), the Website page (#710), the three-step start (#711),
tracking tools (#712), online payments setup (#714), Shopify (#715, #716,
#743) and See them (#737); not archived, as roles wait for WP-1.1 and moving
waits for WP-8.1. Money shows the thousands comma (#697, #717). Tests and
the full run: time limits so `npm test` can't hang (#676), `npm run
full-check` one run at a time, first come first served (#684, #688, #705),
and flaky tests fixed (#672, #679, #681, #682, #686, #695, #696, #700).
Decisions: re-run everything only when main overlaps (#687), and the
overnight questions answered (#735). Tests that waited too little under load (#747,
#748, #749); WP-1.5 piece 10 ticked (#759).

**Jack next:**
1. Finish website browse, Buy online and Cycle to Work (the open pull
   requests above).
2. Products, stock, sizes and colours (WP-1.5): all in but piece 7, which
   waits for a real Citrus Lime export (piece 10 was built in #632 to #635;
   its box is ticked, #759).
3. Paying a repair online: waits on Mark's deposit taken at the till.
4. The text receipt and its page: waits on Mark's step C.

**Mark is on:** the changes Jack agreed on #669 are in: Sonnet by default
with a Haiku reader and two reviewers (#670), the board filling itself in
(#673), the rules after #669 (#674) and test files no longer waiting five
minutes to exit (#675).

**Mark next:**
1. Sales in pence step C.
2. A deposit taken at the till (`till-job-deposit`, waiting for Mark's yes).
3. Roles and the settings store (WP-1.1, WP-1.2).

**Waiting on Jack:** (Buy online questions 9 and 11 were answered 14 Nov,
option 1 each, in `docs/decisions/2026-11-13-website-buy-online-defaults-taken.md`.)
Defaults taken overnight for you to overrule, in the 12 and 13 Nov
`*-defaults-taken.md` files and
`docs/decisions/decided-while-building/2026-11-jack.md`; who may edit a supplier (#543); stock take, sales
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
copy), roles and the settings store, WP-1.5 (he closed #499, #511 and #520 on
11 Nov). Also: `PUT /api/sale-documents/:id` can write an order
back to open; read what was built on his word (#357 onward, #265); his
opinion on replying to texts; the front page switch.

**Build board:** fills itself in each night (`.github/workflows/board.yml`,
#673); its hand-written parts, STATUS and the published copy are done by the
daily status job (Jack, 13 Nov, `docs/decisions/2026-11-13-daily-status-job-stays.md`).
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
