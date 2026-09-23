# STATUS — Wheelhouse EPOS

**Updated:** 2026-09-23
**Branch:** `fix/phase-3-quote-reads` (PR open). **Phases 0-3 merged to `main`**
(#54-#57, 20 Sep, CI green). **Phase 4 is planned, not started.** The quote read
endpoints Phase 3 omitted ship in this branch, and must merge before Phase 4
Task 1.
**Blocked on:** nothing. Mark's #50 review is against the superseded 84-screen
version; told 20 Sep. Other open items are Jack's.

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
> **Never put a destructive command here** — one stale reset nearly destroyed
> the WorkOS plan. State facts; let the reader run the verbs.

## Where this stands

**Release 1 scope is narrowed and settled** (#51); live scope file
`docs/decisions/2026-09-10-release-1-scope-reduction.md`. **The atlas is 82
screens**, 13 notes applied and asserted by `check-notes.mjs` (#54). The tag
barcode is a declared **non-scanning specimen**; PDFs and board PNG **stale**.

**Still no Lightspeed technical spec and no account.** LS-01 to LS-09 are
"Pending", needing the first shop's series and an authorised test account:
Jack's. Recovery is outside Release 1; WorkOS auth and design remediation stay
approved and unbuilt. The `prototype/` demo has **no week view** — the staff
diary (`public/app.js:1496`) and customer slot grid
(`public-portal/portal.js:364`) are the spec for screens 38/39/44; line map in
the screen-build design.

**Check the checkout before judging state** (on 9 Sep work sat 156 commits
behind), and note **stage one's request-wide transaction mode is OFF**. Both
in `ARCHIVE.md`.

## Operational traps

- **The app is on `localhost:8080`, not 4000; Postgres on 5433, not 5432.**
- **Never delete the `cf-*` header names in `server/gateway.js`** — the strip
  list; removing it reopens a login brute-force bypass.
- **Never hand-edit the atlas HTML**; `package.py` regenerates it.
- **`npm run build` dirties `public/dist`.** Revert it.
- **`npm run docker:down` keeps the volume** — not a clean database. Use a
  scratch one to test migrations from empty.
- **`npm test` hangs silently** without the compose Postgres up.

## Read order for a fresh session

This file → **Phase plan** below and the plans it names →
`2026-09-10-release-1-scope-reduction.md` → `…-lightspeed-readiness.md`.

## Immediate next actions

0. **Phase 4 — the screens.** Plan:
   `docs/superpowers/plans/2026-09-20-phase-4-screens.md`. Start at Task 1 —
   nothing mounts today, no page creates `#wh-root`. Six journey plans follow,
   one per group as reached, to its Task 7 contract.
1. **Jack: Lightspeed series + test account.** P00-LS and P07 wait on it.
2. **Jack: the hardware answers** — printer, tag dimensions, driver host,
   scanner (due 21 Sep). The atlas barcode stays a declared non-scanning
   specimen until a real printed tag is read.
3. **Jack: the message providers**, and what inbound replies do.
4. **Mark: the screen review** (#50), open since 17 Sep.
5. **Split the Release 1 plan into issues** — row IDs, allowed state changes,
   expected failure, test command, proof artefact per package.

**Carried open:** four, including three tenant-isolation gaps confirmed ABSENT
on `main` 9 Sep. Three closed 20 Sep (Jack): atlas checks **run in CI**;
`prototype/` and review-pack scripts stay **out** of CI; money stays a JS
float, **always totalled in SQL, never in JavaScript** — binds Phase 4. **The
Hubtiger trial lapsed ~15 Sep**; re-entry needs Jack's login.

## Done and branches

43 PRs merged (#1–#51), plus #54-#57; record in `ARCHIVE.md`. One branch still
matters — `docs/jack-ranking-2026-09-10` holds the only copy of the filled
**Jack's priority** column, empty on `main`.

**Unpushed:** `plan/phase-4-screens` holds an older Phase 4 plan copy; this
branch's is authoritative.

## Decisions in force

Each decision is a file under `docs/decisions/`; summary table in `ARCHIVE.md`.
Still undecided: `2026-09-04-job-type-before-diary.md` and the downtime model
in `2026-09-04-booking-mode-and-downtime.md`. The eight taken 20 Sep are in the
Phase 0/2 plans' constraints; the five Phase 4 ones (A-E) in its plan.

**Open product question for Jack:** a customer can re-decide a line they
already approved or declined while the quote is `sent`. Intended, or one-shot
per line? Owned by the plan that builds screen 21.

## Phases 0-3

`server/workshop/state-machines.js` replaces the ambiguous single
`workshop_jobs.status` with seven machines — 35 states, 48 transitions,
migrations 016-021. 0-2 merged 20 Sep (#54-#56); **3 merged** (#57). `status`
is a **generated column** — nothing can write it. Fifteen action endpoints are
guarded by the machines and an optimistic `version` check, **which every Phase
4 mutation must echo**. Detail: `ARCHIVE.md`.

**One deliberate hole:** the old `status` is still accepted unguarded on
`POST`/`PUT /api/workshop-jobs` for the old diary. It dies with the workshop
half of `public/app.js` in Phase 4's last task.

**Print tasks and message intent are not built** — they need P00b/P00c, so
seven screens have no endpoint: 12, 28, 29, 39, 56, 57, 58. Three more wait on
the scanner and the auth model: 13, 59, 60.

**Quote reads (this branch)** add the three GETs Phase 3 omitted; totals from
SQL; the portal read is owner-scoped and hides drafts, both 404. Carried into
Phase 4, detailed in `ARCHIVE.md`: **widen `COVERED` again** as read endpoints
land or they escape the trace; a non-numeric id **500s echoing the Postgres
message** (`server.js:4439`), fix route-wide first; a missing job's quote list
answers `200 []`; **a draft quote has exactly one revision** however often it
is edited.

## Phase plan for building the atlas

Design: `docs/superpowers/specs/2026-09-20-release-1-screen-build-design.md`.
A **new staff app** for these screens only, cut over at the end, on the
**existing server and schema**, sequenced **by layer** because nothing is
deployed. The old app keeps till, inventory, suppliers, storefront. 0-3 built;
4 → 5 remain. P00 proofs run alongside, all Jack's. Full text and the five
Phase 4 decisions (A-E): `ARCHIVE.md`.

## Plan register

LOCKED: `2026-08-31-master-implementation-plan.md`. Current: the Release 1
workshop plan and the Phase 4 screens plan. Approved, unbuilt: WorkOS, design
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


**Last verified 23 Sep, `fix/phase-3-quote-reads` head `9beb7e7`, locally,
every exit code 0:** 412 pass / 0 fail, typecheck/lint/build clean, RLS OK (30
protected, 2 exempt), screen trace, registry validate + drift, atlas 82 screens
no errors. **CI has not run this branch** — a local pass is not a CI pass.
**`main` has still not been run since #57.** The docker `app` image is from
31 Aug — verify the working tree, not that container.

**A worktree needs its own `.env`** — gitignored, so it does not travel;
without it the server uses 5432 not 5433 and every server-booting test fails
with `ECONNREFUSED`, which looks like broken code and is not. Live-server
tests must `import '../server/load-env.js'` first.

## Open items needing Mark

Eight. The screen review (#50) is urgent, needs re-pointing at the 82-screen
atlas; the other seven are in `ARCHIVE.md`.

## Keeping this file honest

Update at every phase boundary and before ending a session. Cap 8,000 bytes.
Past that, trim by **moving** — to `ARCHIVE.md` or `docs/decisions/`, never by
deleting. Check the byte count before committing, not after.
