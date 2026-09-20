# STATUS — Wheelhouse EPOS

**Updated:** 2026-09-20
**Branch:** `feat/phase-2-schema`, stacked on Phase 1 (#55) on Phase 0 (#54).
**Blocked on:** nothing, for the atlas. Mark's #50 review is against the
superseded 84-screen version; he was told on 20 Sep. Other open items are
Jack's.

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
> **Never put a destructive command here** — one stale `git reset --hard` nearly
> destroyed the WorkOS plan (`9da1d75`, detail in `ARCHIVE.md`). State facts and
> point at documents; let the reader run the verbs.

## Where this stands

**Release 1 has a narrowed scope and a plan.** PR #51, 10 Sep.
`docs/decisions/2026-09-10-release-1-scope-reduction.md` is the live scope;
invoicing, payments, refunds, customer import, reports, group capacity and
recovery are Later. It supersedes the #47 Hubtiger ranking, now closed. The
workshop plan is packages P00–P09, not yet split into issues.

**The journey atlas is revised: 84 screens → 82**, all 13 notes applied and
asserted by `check-notes.mjs`. PR #54; Mark told on #50. Carried: the tag
barcode is a declared **non-scanning specimen** until Jack's scanner, and the
PDFs and board PNG are **stale**. Detail in `ARCHIVE.md`.

**There is still no Lightspeed technical spec, and no account.**
`2026-09-10-release-1-lightspeed-readiness.md` recommends R-Series *conditional
on the first shop* and leaves proof steps LS-01 to LS-09 all "Pending". None
start without the shop's series and an authorised test account: Jack's to
supply.

Architecture stage one merged 7 Sep (PR #37); detail in `ARCHIVE.md`. Recovery
is outside Release 1. WorkOS auth and design remediation stay approved and
unbuilt. The **workshop prototype** (PR #45) is an in-memory demo, not product
code, and has **no week view** — the diary Jack built is in `public/app.js`, the
customer slot grid in `public-portal/portal.js`.

**Check the checkout before judging state.** On 9 Sep work sat 156 commits
behind. Run `git rev-list --left-right --count origin/main...HEAD` first.

**Stage one's request-wide transaction mode is OFF** — `DB_TENANT_SCOPE`
defaults to `session` until three handlers are restructured.

## Operational traps

- **The app is on `localhost:8080`, not 4000.** Postgres is on **5433**, not
  5432. Compose publishes neither service port directly.
- **Never delete the `cf-*` header names in `server/gateway.js`.** That is the
  strip list; removing it reintroduces a login brute-force bypass.
- **Never hand-edit the atlas HTML** — `package.py` regenerates it.
- **`npm run build` dirties tracked files** under `public/dist`. Revert it.
- **`npm run docker:down` keeps the volume**, so it does not give you a clean
  database. Use a scratch database to test migrations from empty.
- **`npm test` hangs silently** if the compose Postgres is not up.

## Read order for a fresh session

1. This file
2. **Phase plan** below — the design and the two phase plans it names
3. `docs/decisions/2026-09-10-release-1-scope-reduction.md` — what Release 1 is
4. `2026-09-10-release-1-lightspeed-readiness.md` — integration contract, proof

Older entries moved to `ARCHIVE.md`.

## Immediate next actions

1. **Jack: the first shop's Lightspeed series, and an authorised test account.**
   Nothing in P00-LS moves without it; P07 stays conditional meanwhile.
2. **Jack: the hardware answers** — printer model, tag dimensions, the Windows
   driver host, 1D or 2D scanner. Scanner arrives Mon 21 Sep; the atlas barcode
   stays a declared specimen until it is proven.
3. **Jack: the message providers**, and what inbound replies do.
4. **Mark: the screen review**, issue #50, outstanding since 17 Sep — now
   against a superseded version. He needs telling that the atlas changed.
5. **Split the plan into issues** — row IDs, allowed state changes, expected
   failure, test command and proof artefact per package.

**Carried, unchanged, and still open:** six items, including three
tenant-isolation gaps confirmed ABSENT on `main` 9 Sep. Full text and evidence:
`ARCHIVE.md`.

**The Hubtiger trial lapsed about 15 Sep**; two tests never ran. Re-entry
needs Jack's login.

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

## Phases 1 and 2 — the state model, built

`server/workshop/state-machines.js` replaces the ambiguous single
`workshop_jobs.status` with seven machines — 35 states, 48 transitions,
`docs/design/workshop-states.md` generated from them. Migrations 016–020 give
them somewhere to live: job states, `reference`, `planned_minutes`, `version`,
`shops.next_job_number`, four new `workshop_*` tables and
`customer_messages.intent_state`. CHECK constraints are generated from the
machines; a drift test fails if a machine changes without a migration.

**Additive. `workshop_jobs.status` is still the live column** and nothing reads
the new ones; Phase 3 switches them over. **No backfill exists, deliberately** —
there was no data, only test residue, which answers Phase 1's open question
about the old column never recording collection.

Proven, not assumed: tests run as `epos_app` (`rolsuper = false`); removing
`FORCE ROW LEVEL SECURITY` let shop B read shop A's quotes; breaking the
capacity index predicate let two concurrent bookings both win; all 20
migrations apply cleanly into an empty database. Full detail in PRs #55 and the
Phase 2 PR.

## Phase plan for building the atlas

Design: `docs/superpowers/specs/2026-09-20-release-1-screen-build-design.md`,
which records who decided what. Agreed with Jack 20 Sep: a **new staff app** for
these screens only, cut over at the end, on the **existing server and schema**,
sequenced **by layer** because nothing is deployed. The old app keeps till,
inventory, suppliers and storefront. Phases: 0 atlas, 1 state machines and 2
schema (all built) → 3 API (each endpoint traced to a named screen) → 4 screens
→ 5 integration. P00 proofs run alongside, all Jack's. Plans written: phase-0,
phase-1 and phase-2, all dated 2026-09-20 under `docs/superpowers/plans/`.

## Plan register

LOCKED: `2026-08-31-master-implementation-plan.md`. Current: the Release 1
workshop plan and the Phase 0 plan above. Approved and unbuilt: the WorkOS
migration, design remediation. Per-plan detail: `.agents/ARCHIVE.md`.

## Canonical commands

```sh
npm run docker:up   # the suite hangs silently without it
npm test && npm run typecheck && npm run lint && npm run build
node scripts/ci/assert-rls-coverage.mjs
python3 docs/design/release-1-journey/package.py && node docs/design/release-1-journey/check-static.mjs && node docs/design/release-1-journey/check-notes.mjs
```

**Last verified 20 Sep, all green:** 347 pass / 0 fail, typecheck/lint/build
clean, RLS OK across 30 protected tables, atlas 82 screens no errors. The docker
`app` image is from 31 Aug — verify the working tree, not that container.

## Open items needing Mark

Eight. The screen review is the urgent one, and it now needs re-pointing at the revised atlas; the other seven are in
`.agents/ARCHIVE.md`.

## Keeping this file honest

Update at every phase boundary and before ending a session. Cap is 8,000 bytes
(`~/.claude/process/major-project.md`). Past that, trim by **moving** — stale
content to `.agents/ARCHIVE.md`, decisions to `docs/decisions/`. Never by
deleting.
