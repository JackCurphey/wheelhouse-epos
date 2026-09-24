# STATUS — Wheelhouse EPOS

**Updated:** 2026-09-24
**Branch:** `main` at `9291119`. #63 (component tests, malformed-id 404)
and #64 (book server piece 1: migration 022, service categories, `GET
/api/portal/:shopSlug/services`) merged 24 Sep; CI on `9291119` 471/471.
**Phases 0-3 merged** (#54-#59). **Phase 4 foundation merged** (#60-#62).
**Working branches:** `feat/book-server-2-modes` (2a, PR #65 open) and
`feat/book-server-2b-modes` cut from it - piece 2b built, not yet pushed;
its PR waits on #65 merging. Mark's #50 review is against the superseded
84-screen version; told 20 Sep. Other open items are Jack's.

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
> **Never put a destructive command here** — one stale reset nearly destroyed
> the WorkOS plan. State facts; let the reader run the verbs.

## Where this stands

**Release 1 scope is narrowed and settled** (#51); live scope file
`docs/decisions/2026-09-10-release-1-scope-reduction.md`. **The atlas is 82
screens**, 13 notes applied, asserted by `check-notes.mjs` (#54). The tag
barcode is a declared **non-scanning specimen**; PDFs and board PNG **stale**.

**Still no Lightspeed technical spec and no account.** LS-01 to LS-09 are
"Pending", needing the first shop's series and an authorised test account.
Recovery is outside Release 1; WorkOS auth and design remediation stay approved
and unbuilt. The `prototype/` demo has **no week view** — the staff diary
(`public/app.js:1496`; `buildWeekGridHtml` :2038, `renderWeekGrid` :2072,
interactions :1878-2285) and customer slot grid (`public-portal/portal.js:364`)
are the spec for screens 38/39/44.

**Check the checkout before judging state; stage one's transaction mode is
OFF.** Detail: `ARCHIVE.md`.

## Operational traps

- **The app is on `localhost:8080`, not 4000; Postgres on 5433, not 5432.**
- **Never delete the `cf-*` header names in `server/gateway.js`** — the strip
  list; removing it reopens a login brute-force bypass.
- **Never hand-edit the atlas HTML**; `package.py` regenerates it.
- **`public/dist` is untracked** (23 Sep; three stale files were committed
  in `fa32b60`). A fresh checkout must `npm run build` before `/workshop`
  serves or `tests/workshop-page.test.js` passes.
- **`npm run docker:down` keeps the volume** — not a clean database. Use a
  scratch one to test migrations from empty.
- **`npm test` hangs silently** without the compose Postgres up.
- **`public/index.html` loads `/app.js`, never `/dist/`** — before Task 1 the
  bundle loaded on no page. The React app is only `/workshop` and below.
- **`npm run test:browser` builds and boots its own server on 8091**, never
  reusing one: 8080 is the docker `app`, from a 31 Aug image.

## Read order for a fresh session

This file → **Plan register** below and the plans it names →
`2026-09-10-release-1-scope-reduction.md` → `…-lightspeed-readiness.md`.

## Immediate next actions

1. **Book server piece 2b built** (24 Sep) on `feat/book-server-2b-modes`
   (cut from `feat/book-server-2-modes`, PR #65): migration 024 (hold index
   narrowed to timed holds), mode-aware customer booking POST, the
   per-(shop, date) advisory booking lock, the 409 `capacity` / 400
   shop-rule split, one live hold per live job (`syncJobHold`), walk-in
   queue lengths, and settle-on-read-and-write for a scheduled mode change.
   Rulings made during build, not in the original spec: plan's Decision log,
   `docs/superpowers/plans/2026-09-24-book-server-2b-booking-modes.md`,
   decisions 1-11; spec updated to match. Its pull request waits on #65
   merging first. **Next: piece 3** (the booking request). Plan 4a stays
   STOPPED at Task 7 item 3 until piece 2 merges; routing decided 23 Sep
   (`docs/decisions/2026-09-23-book-journey-routing-and-modes.md`): customer
   screens under `/book`, two modes, deposits out, all four J2 gaps in.
2. **Jack: Lightspeed series + test account.** P00-LS and P07 wait on it.
3. **Jack: printer, tag dimensions, driver host.** The **scanner half of P00b
   is closed** (`2026-09-23-p00b-scanner-evidence`): 1D, **cannot read QR**, so
   the tag carries Code 128 as note 11 has it. No tag from our printer has been
   scanned — the atlas barcode stays a non-scanning specimen.
4. **Jack: the message providers**, and what inbound replies do.
5. **Mark: the screen review** (#50), open since 17 Sep.
6. **Split the Release 1 plan into issues** — row IDs, state changes, expected
   failure, test command, proof per package.

**Carried open:** four, incl. three tenant-isolation gaps confirmed ABSENT on
`main` 9 Sep. Three closed 20 Sep (Jack): atlas checks **run in CI**;
`prototype/` and review-pack scripts stay **out** of CI; money stays a JS
float, **totalled in SQL, never in JavaScript** — binds Phase 4. **Hubtiger
trial lapsed ~15 Sep**; re-entry needs Jack's login.

## Done and branches

43 PRs merged (#1–#51), plus #54-#64. Record in `ARCHIVE.md`. One branch still
matters — `docs/jack-ranking-2026-09-10` holds the only copy of the filled
**Jack's priority** column, empty on `main`. `plan/phase-4-screens` was
deleted 23 Sep (its plans are on `main`, newer).

## Phases 0-3

Seven state machines replace `workshop_jobs.status`, now a **generated
column**; fifteen action endpoints are guarded by them and an optimistic
`version`, **which every Phase 4 mutation must echo**. **A 409 carries `code:
'stale' | 'illegal'`** (#60, Jack). **Quote line decisions are final** (#59).
Full detail, including #58's four carried items: `ARCHIVE.md`.

## Phase 4 foundation (Tasks 1-6)

`/workshop/*` serves the React app (`src/staff/`). `ROUTES` (`routes.ts`)
maps atlas id → URL; `SCREENS` (`app-shell.tsx`) registers built screens.
Server calls go through `src/lib/api/client.ts` (`jobAction` needs
`version`); identity only via `useSession`. `src/lib/adapters/intent.ts`
records print/message intent, stores nothing, never claims delivery. **Not
yet:** nav, styling, shop theme (Jack's calls), auth guard. Full endpoint gap
list (screens without one, and why): `ARCHIVE.md`.

## Plan register

Decisions: files under `docs/decisions/`; undecided ones in `ARCHIVE.md`.
LOCKED: `2026-08-31-master-implementation-plan.md`. Current: the Release 1
workshop plan and the Phase 4 screens plan; the phase plan summary is in
`ARCHIVE.md`. Approved, unbuilt: WorkOS, design
remediation. Detail: `ARCHIVE.md`.

## Canonical commands

```sh
npm run docker:up   # the suite hangs silently without it
npm test && npm run typecheck && npm run lint && npm run build
node scripts/ci/assert-rls-coverage.mjs
node scripts/ci/assert-screen-trace.mjs
npm run registry:validate && node scripts/ci/check-registry-drift.mjs
python3 docs/design/release-1-journey/package.py && node docs/design/release-1-journey/check-static.mjs && node docs/design/release-1-journey/check-notes.mjs
npm run test:browser
```

All run in CI too, so a green PR means they passed.


**Verified 24 Sep: CI on `main` `9291119` green, 471/471.** Same day, piece 2b
on `feat/book-server-2b-modes` (not yet pushed): every gate above exits 0,
563/563. Prior verification (piece 2a 528/528, 23 Sep 437/437): `ARCHIVE.md`.
Check a PR's CI against the run's own SHA, not the PR pane.

**A worktree needs its own `.env`** — gitignored, so it does not travel;
without it the server uses 5432 not 5433 and every server-booting test fails
with `ECONNREFUSED`, which looks like broken code and is not. Live-server tests
must `import '../server/load-env.js'` first.

## Open items needing Mark

Eight. The screen review (#50) is urgent, needs re-pointing at the 82-screen
atlas; the other seven in `ARCHIVE.md`.

## Keeping this file honest

Update at every phase boundary and before ending a session. Cap 8,000 bytes.
Past that, trim by **moving** — to `ARCHIVE.md` or `docs/decisions/`, never by
deleting. Check the byte count before committing, not after.
