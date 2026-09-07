# STATUS — Wheelhouse EPOS

**Updated:** 2026-09-07
**Branch:** `main`
**Blocked on:** nothing. Every open item below is Jack's to decide.

> **This file is tracked and authoritative.** It and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`; everything else here is scratch. Hold
> it to the same standard as anything in `docs/`: if it is wrong, that is a bug.
>
> **Never put a destructive command in this file.** A stale `git reset --hard`
> here was one edit away from destroying the 2,880-line WorkOS plan (see
> `9da1d75`). State facts and point at documents; let the reader run the verbs.

## Where this stands

Architecture stage one is merged (PR #37, 7 Sep). Five of its six ceilings are
closed: the pooler trap, the migration race, outbound timeouts, process
lifecycle, and the README. The sixth — managed Postgres with point-in-time
recovery and a rehearsed restore — is untouched infrastructure and is Jack's.

The platform decision is made and the research behind it is close to complete.
Two designs remain approved and unbuilt: WorkOS auth, and design remediation.

**What stage one did NOT do, and must not be assumed to have done.** It makes
the app safe to run as more than one process. It does nothing about getting
data back if the database volume is lost. And the request-wide transaction mode
it adds is OFF: `DB_TENANT_SCOPE` defaults to `session`, which is the behaviour
that shipped before. Three handlers must be restructured before that flag can
be turned on — the checklist is in
`docs/decisions/2026-09-06-tenant-scoping-and-pooler-safety.md`, not here,
because it must outlive this file.

## Provenance

This file replaces Mark's `.agents/STATUS.md` (`fa32b60`, 31 Aug). The full
account, and Mark's original file verbatim, are in `.agents/ARCHIVE.md`.

## Read order for a fresh session

1. This file
2. `docs/decisions/2026-08-31-business-plan.md` — ownership, the Jack/Mark split
3. `docs/decisions/2026-09-02-lightspeed-first-platform.md` — the platform bet,
   and the open items that would falsify it (§7, §8)
4. `docs/superpowers/plans/2026-08-31-master-implementation-plan.md` — LOCKED;
   changes to it are decisions, not edits

## Immediate next actions

1. **Velodrop and Bikebook trials.** Named in the Lightspeed decision (§7.2) as
   the highest-value open item, unstarted since 31 August. It is the only thing
   that tests the "better than theirs" claim the product rests on. Both free,
   no card. Account creation is Jack's — an agent cannot sign up.
2. **Sign off the R-Series research.** PR #30 is open and CI-green. §4
   (architecture consequence) and §5 (product requirement) need Jack's sign-off
   before they change any plan.
3. **Repoint the `app` healthcheck** in `docker-compose.yml:62` at `/healthz`.
   Stage one added the endpoint and deliberately did not edit compose. Until
   this is done the container still probes `/`, which serves index.html off
   disk and reports healthy with Postgres completely down. One line, and it is
   now unblocked.
4. **Answer the five ownership queries.** `2026-09-01-ownership-signoff.md`
   leaves `PF-3` (print agent — could it just be browser-based?) and `DP-1`
   through `DP-4` (design-partner recruitment and cadence — "dont think this is
   necessary") open. They need Mark before those owners are settled.

## Done

31 PRs merged, #1-#38 (verified 7 Sep: `gh pr list --state merged -L 100`). Nothing here is removed when it ages — it moves to
`.agents/ARCHIVE.md`. Full list any time: `gh pr list --state merged -L 100`.

Detail for everything merged to 2 September has moved to `.agents/ARCHIVE.md`
under "Merged work, 30 August - 2 September 2026". Nothing was dropped.

## Decisions in force

| Decision | Status |
|---|---|
| `2026-08-31-business-plan.md` | Decided, except lines marked OPEN |
| `2026-08-31-frontend-platform.md` | Decided (approver: Mark) |
| `2026-09-02-lightspeed-first-platform.md` | DECIDED by Jack, 2 Sep 2026 |
| `2026-09-02-r-series-sync-and-rate-limits.md` | Research complete, awaiting sign-off |
| `2026-09-01-wedge-booking-vs-workshop.md` | **DECIDED** 1 Sep, ratified 6 Sep; §4 and §5b superseded by the Lightspeed decision |
| `2026-09-01-ownership-signoff.md` | Signed off by Jack 1 Sep — 58 agreed, 5 queried (`PF-3`, `DP-1`–`DP-4`), 0 reassigned. The five queries still need Mark |
| `2026-09-06-tenant-scoping-and-pooler-safety.md` | **DECIDED by Jack, 6 Sep** — the pooler guard hard-fails; the pool error handler was fixed on the stage-one branch. Also carries the flag-flip checklist and what the new tests do and do not prove |
| `2026-09-04-job-type-before-diary.md` | **Proposed 4 Sep, not decided** |
| `2026-09-04-booking-mode-and-downtime.md` | Booking mode + customer picker **DECIDED** (5 Sep); downtime model proposed |
| `2026-08-31-feature-catalogue.md` | Reference |

## Plan register

| Plan | Status |
|---|---|
| `2026-08-31-master-implementation-plan.md` | LOCKED — the arc |
| `2026-08-31-architecture-stage-1.md` | Executed — merged 7 Sep (PR #37), five of six ceilings closed |
| `2026-09-05-booking-mode-foundations.md` | Executed — merged 5 Sep (PR #35) |
| `2026-08-31-workos-auth-migration.md` | Approved design (2,880 lines), not implemented |
| `2026-08-31-workshop-service-catalogue.md` | Design agreed; server rules and tests merged |
| `2026-08-31-design-remediation.md` | Findings recorded in `docs/design/` |
| `plans/done/2026-08-30-storefront-framework.md` | Executed |
| `plans/done/2026-08-30-shopify-checkout.md` | Executed |

## Canonical commands

```sh
npm test        # node --test "tests/**/*.test.js"
npm run typecheck
npm run lint
npm run build
npm run docker:up
```

**Last verified:** 275 tests, 275 pass, 0 fail — run locally on `main` after the
stage-one merge, 2026-09-07, alongside RLS coverage, typecheck, lint, build,
registry validate and drift check. CI green on PR #37 (run `34085367882`).
Note the docker `app` container image is from 31 August and runs stale code;
verify against the working tree, not that container.

## Open items needing Mark

Three design items carried from Mark's 31 August file — the paid-ink contrast
token, the unapproved dark-mode palette, and the registry's native `<dialog>`
primitives — have moved to `.agents/ARCHIVE.md`. They are still open; they are
just not what this file is for any more.

1. **A connection dying while actively serving a request still crashes the
   process**, taking every shop's in-flight requests with it. `pool.on('error')`
   was added by stage one, but pg-pool removes the error listener at checkout,
   so it covers idle clients only. Pre-existing, and the crash guard treats it
   as a deliberate restart policy — but it wants an explicit decision at
   "hundreds of shops" scale rather than an inherited default.
2. **Gate spacing / dates.** `2026-08-31-business-plan.md:583` — OPEN pending
   Mark's weekly time budget.

The compose healthcheck repoint is immediate next action 3 above, not repeated
here — one owner, one entry.

Mark's fifth item — `git reset --hard 8514727` on `design/workos-auth-migration`
— is **deliberately dropped as obsolete**, not lost. PR #29 put the plan on
`main`; see the housekeeping notes in `.agents/ARCHIVE.md`.

## Keeping this file honest

Update it at every phase boundary and before ending a session. Hot-file cap is
8,000 bytes (`~/.claude/process/major-project.md`). When it grows past that,
trim by **moving**: anything no longer current to `.agents/ARCHIVE.md` (tracked
for exactly this reason — an ignored archive would make "move, never delete"
a synonym for delete), anything that is a decision to `docs/decisions/`.
