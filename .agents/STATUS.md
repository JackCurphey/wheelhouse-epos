# STATUS — Wheelhouse EPOS

**Updated:** 2026-09-20
**Branch:** `docs/phase-3-merged`, unpushed. **Phases 0-3 are all merged to
`main`** — PRs #54, #55, #56 and #57 (Phase 3, merged 20 Sep, CI green).
Next: Phase 4, the screens. No plan for it yet.
**Blocked on:** nothing. Mark's #50 review is against the
superseded 84-screen version; he was told on 20 Sep. Other open items are
Jack's.

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
> **Never put a destructive command here** — one stale `git reset --hard` nearly
> destroyed the WorkOS plan. State facts; let the reader run the verbs.

## Where this stands

**Release 1 has a narrowed scope and a plan.** PR #51.
`docs/decisions/2026-09-10-release-1-scope-reduction.md` is the live scope;
invoicing, payments, refunds, import, reports, group capacity and recovery are
Later. The workshop plan is packages P00–P09, not yet split into issues.

**The journey atlas is revised: 84 screens → 82**, all 13 notes applied and
asserted by `check-notes.mjs` (#54). Carried: the tag barcode is a declared
**non-scanning specimen**, and the PDFs and board PNG are **stale**.

**There is still no Lightspeed technical spec, and no account.** LS-01 to
LS-09 are all "Pending" and need the first shop's series plus an authorised test
account: Jack's to supply. Architecture stage one merged 7 Sep (PR #37);
recovery is outside Release 1; WorkOS auth and design remediation stay approved
and unbuilt. The `prototype/` demo has **no week view** — the diary Jack built
is in `public/app.js`, the customer slot grid in `public-portal/portal.js`.

**Check the checkout before judging state.** On 9 Sep work sat 156 commits
behind. Run `git rev-list --left-right --count origin/main...HEAD` first.

**Stage one's request-wide transaction mode is OFF** — `DB_TENANT_SCOPE`
defaults to `session` until three handlers are restructured.

## Operational traps

- **The app is on `localhost:8080`, not 4000; Postgres on 5433, not 5432.**
- **Never delete the `cf-*` header names in `server/gateway.js`** — the strip
  list; removing it reintroduces a login brute-force bypass.
- **Never hand-edit the atlas HTML**; `package.py` regenerates it.
- **`npm run build` dirties `public/dist`.** Revert it.
- **`npm run docker:down` keeps the volume**, so it does not give you a clean
  database. Use a scratch database to test migrations from empty.
- **`npm test` hangs silently** without the compose Postgres up.

## Read order for a fresh session

1. This file
2. **Phase plan** below — the design and the two phase plans it names
3. `docs/decisions/2026-09-10-release-1-scope-reduction.md` — what Release 1 is
4. `2026-09-10-release-1-lightspeed-readiness.md` — integration contract, proof

Older entries moved to `ARCHIVE.md`.

## Immediate next actions

0. **Phase 4 — the screens.** No plan yet. React app, journey order, against
   the Phase 3 API. Edges last: 24 of the 82 are alternative outcomes.
1. **Jack: the first shop's Lightspeed series and an authorised test account.**
   Nothing in P00-LS moves without it; P07 stays conditional.
2. **Jack: the hardware answers** — printer, tag dimensions, Windows driver
   host, scanner. Scanner arrives Mon 21 Sep; the atlas barcode stays a
   declared non-scanning specimen until it is proven.
3. **Jack: the message providers**, and what inbound replies do.
4. **Mark: the screen review**, #50, outstanding since 17 Sep and now against
   the revised 82-screen atlas — he was told on 20 Sep.
5. **Split the Release 1 plan into issues** — row IDs, allowed state changes,
   expected failure, test command and proof artefact per package.

**Carried open:** four items, including three tenant-isolation gaps confirmed
ABSENT on `main` 9 Sep. Three closed 20 Sep (Jack): the atlas checks **run in
CI**, confirmed as actually executed; `prototype/` and the review-pack Python
scripts stay **out** of CI; money stays a JS float and is **always totalled in
SQL, never in JavaScript**. Detail in `ARCHIVE.md`. **The Hubtiger trial lapsed
about 15 Sep**; re-entry needs Jack's login.

## Done and branches

43 PRs merged (#1–#51), plus PR #54. Record and the 19 Sep cleanup:
`ARCHIVE.md`. One branch still matters — `docs/jack-ranking-2026-09-10` holds
the only copy of the filled **Jack's priority** column, empty on `main`.

## Decisions in force

Every decision is a file under `docs/decisions/`; the summary table is in
`ARCHIVE.md`. Live scope: `2026-09-10-release-1-scope-reduction.md`. Still
undecided: `2026-09-04-job-type-before-diary.md` and the downtime model in
`2026-09-04-booking-mode-and-downtime.md`. The eight decisions taken 20 Sep are
in the Phase 0 and Phase 2 plans' constraint sections.

## Phases 0-3

`server/workshop/state-machines.js` replaces the ambiguous single
`workshop_jobs.status` with seven machines - 35 states, 48 transitions.
Migrations 016-020 house them. Phases 0-2 merged to `main` 20 Sep (PRs #54-#56);
detail in `ARCHIVE.md`.

**Phase 3 is merged** (PR #57, 20 Sep). `status` is now
a **generated column** derived from `booking_state` and `work_state` (migration
021), so the old diary and portal keep reading it and **nothing can write it**.
Fifteen action endpoints are guarded by the machines and an optimistic `version`
check. Job references (`WH-1000`) are per shop; capacity holds are taken in the
job's transaction; quotes supersede rather than mutate, per-line. Detail and the
tender rule are in `ARCHIVE.md`.

**One deliberate hole:** the old `status` is still accepted, unguarded, on
`POST`/`PUT /api/workshop-jobs` for the old diary's buttons (`ARCHIVE.md`). It
dies with `public/app.js` in Phase 4.

**Print tasks and message intent are not built** - they need P00b and P00c.
Seven atlas screens have no backing endpoint as a result.

## Phase plan for building the atlas

Design: `docs/superpowers/specs/2026-09-20-release-1-screen-build-design.md`,
which records who decided what. A **new staff app** for these screens only, cut
over at the end, on the **existing server and schema**, sequenced **by layer**
because nothing is deployed. The old app keeps till, inventory, suppliers and
storefront. Phases 0-2 built; 3 API → 4 screens → 5 integration remain. P00
proofs run alongside, all Jack's. Plans for phases 0-3 are under
`docs/superpowers/plans/`, all dated 2026-09-20.

## Plan register

LOCKED: `2026-08-31-master-implementation-plan.md`. Current: the Release 1
workshop plan and the Phase 0 plan above. Approved and unbuilt: the WorkOS
migration, design remediation. Per-plan detail: `.agents/ARCHIVE.md`.

## Canonical commands

```sh
npm run docker:up   # the suite hangs silently without it
npm test && npm run typecheck && npm run lint && npm run build
node scripts/ci/assert-rls-coverage.mjs
node scripts/ci/assert-screen-trace.mjs
python3 docs/design/release-1-journey/package.py && node docs/design/release-1-journey/check-static.mjs && node docs/design/release-1-journey/check-notes.mjs
```

All of these run in CI too, so a green PR means they passed.


**Last verified 20 Sep on PR #57, all green:** 394 pass / 0 fail,
typecheck/lint/build clean, RLS OK across 30 protected tables, screen trace OK,
atlas 82 screens no errors. **`main` itself has not been run since the merge** —
the hook closed the session first. Run the canonical commands before trusting it. The docker
`app` image is from 31 Aug — verify the working tree, not that container.

## Open items needing Mark

Eight. The screen review is the urgent one, and it now needs re-pointing at the revised atlas; the other seven are in
`.agents/ARCHIVE.md`.

## Keeping this file honest

Update at every phase boundary and before ending a session. Cap is 8,000 bytes.
Past that, trim by **moving** — to `ARCHIVE.md` or `docs/decisions/`. Never by
deleting. Check the byte count before committing, not after.
