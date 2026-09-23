# STATUS — Wheelhouse EPOS

**Updated:** 2026-09-23
**Branch:** `feat/phase-4-foundation`, **PR #60 open**.
**Phases 0-3 merged** (#54-#57), plus #58 quote reads and **#59 quote line
decisions final, both merged 23 Sep** (`c99f441`, `f871d95`). **Phase 4:
Tasks 1-3 built on #60; start at Task 4.**
**Blocked on:** nothing. Mark's #50 review is against the superseded 84-screen
version; told 20 Sep. Other open items are Jack's.

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
(`public/app.js:1496`) and customer slot grid (`public-portal/portal.js:364`)
are the spec for screens 38/39/44.

**Check the checkout before judging state** (on 9 Sep work sat 156 commits
behind), and note **stage one's request-wide transaction mode is OFF**. Both
in `ARCHIVE.md`.

## Operational traps

- **The app is on `localhost:8080`, not 4000; Postgres on 5433, not 5432.**
- **Never delete the `cf-*` header names in `server/gateway.js`** — the strip
  list; removing it reopens a login brute-force bypass.
- **Never hand-edit the atlas HTML**; `package.py` regenerates it.
- **`npm run build` dirties `public/dist`**: gitignored, yet the manifest and
  one CSS/JS pair are tracked (stale; Docker rebuilds). `git checkout --
  public/dist`, then delete the new hashed pair.
- **`npm run docker:down` keeps the volume** — not a clean database. Use a
  scratch one to test migrations from empty.
- **`npm test` hangs silently** without the compose Postgres up.

## Read order for a fresh session

This file → **Phase plan** below and the plans it names →
`2026-09-10-release-1-scope-reduction.md` → `…-lightspeed-readiness.md`.

## Immediate next actions

0. **#60: check CI on its real head, then merge.**
1. **Phase 4 Task 4.** Plan:
   `docs/superpowers/plans/2026-09-20-phase-4-screens.md`; each task carries
   an "Executed" note of where the code overruled it. **Blocker for the journey
   plans:** `node --test` cannot load `.tsx`, so screen component tests need a
   loader (a new dependency — ask Jack) or a build step. Six journey plans
   follow, one per group, to its Task 7 contract.
2. **Jack: Lightspeed series + test account.** P00-LS and P07 wait on it.
3. **Jack: printer, tag dimensions, driver host.** The **scanner half of P00b
   is closed** (`2026-09-23-p00b-scanner-evidence`): 1D, **cannot read QR**, so
   the tag carries Code 128 as note 11 has it. No tag from our printer has been
   scanned — the atlas barcode stays a non-scanning specimen.
4. **Jack: the message providers**, and what inbound replies do.
4a. **Jack:** untrack stale `public/dist`? Five customer edge screens sit
   under staff `/workshop` per the plan — keep, or `/book`?
5. **Mark: the screen review** (#50), open since 17 Sep.
6. **Split the Release 1 plan into issues** — row IDs, state changes, expected
   failure, test command, proof per package.

**Carried open:** four, incl. three tenant-isolation gaps confirmed ABSENT on
`main` 9 Sep. Three closed 20 Sep (Jack): atlas checks **run in CI**;
`prototype/` and review-pack scripts stay **out** of CI; money stays a JS
float, **totalled in SQL, never in JavaScript** — binds Phase 4. **Hubtiger
trial lapsed ~15 Sep**; re-entry needs Jack's login.

## Done and branches

43 PRs merged (#1–#51), plus #54-#59; record in `ARCHIVE.md`. One branch still
matters — `docs/jack-ranking-2026-09-10` holds the only copy of the filled
**Jack's priority** column, empty on `main`. `plan/phase-4-screens` was
deleted 23 Sep (its plans are on `main`, newer).

## Decisions in force

Each decision is a file under `docs/decisions/`; summary in `ARCHIVE.md`. Still
undecided: `2026-09-04-job-type-before-diary.md` and the downtime model in
`2026-09-04-booking-mode-and-downtime.md`. The eight taken 20 Sep are in the
Phase 0/2 plans' constraints; the five Phase 4 ones (A-E) in its plan.

## Phases 0-3

`server/workshop/state-machines.js` replaces the ambiguous single
`workshop_jobs.status` with seven machines — 35 states, 48 transitions,
migrations 016-021. 0-2 merged 20 Sep (#54-#56); **3 merged** (#57). `status`
is a **generated column** — nothing can write it. Fifteen action endpoints are
guarded by the machines and an optimistic `version` check, **which every Phase
4 mutation must echo**. `ARCHIVE.md`.

**One deliberate hole:** the old `status` is still accepted unguarded on
`POST`/`PUT /api/workshop-jobs` for the old diary. It dies with the workshop
half of `public/app.js` in Phase 4's last task.

**Quote line decisions are final** (`2026-09-23-quote-line-decisions-are-final`,
Jack), enforced in `recordLineDecision` (#59). Screen 21 must
show decided lines as settled, not as live controls.

**Print tasks and message intent are not built** — P00b/P00c, so seven screens
have no endpoint: 12, 28, 29, 39, 56, 57, 58. Three more wait on the auth
model: 13, 59, 60.

**Quote reads (#58, merged)** added the three GETs Phase 3 omitted; totals from
SQL; the portal read is owner-scoped and hides drafts. Four things it carries
into Phase 4 — the `COVERED` widening, the 500 on a non-numeric id, the
`200 []` for a missing job, and one-revision drafts — are in `ARCHIVE.md`.

**A 409 carries `code: 'stale' | 'illegal'`** beside `error` on job actions,
quotes and tender (#60, Jack 23 Sep). Screens branch on the code, never the
wording; the client leaves a codeless 409 `unknown`.

## Plan register

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
python3 docs/design/release-1-journey/package.py && node docs/design/release-1-journey/check-static.mjs && node docs/design/release-1-journey/check-notes.mjs
```

All run in CI too, so a green PR means they passed.


**Verified 23 Sep on `feat/phase-4-foundation`, locally:** 432 pass / 0 fail,
typecheck, lint, screen trace, against the committed `public/dist`; browser
check of `/workshop` and deep links. #59 was re-run after its rebase (413/413)
and green in CI on its head `ec15e75` before merging. Check a PR's CI against
the run's own SHA, not the PR pane. The docker `app` image is from 31 Aug.

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
