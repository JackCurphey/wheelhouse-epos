# STATUS — Wheelhouse EPOS

**Updated:** 2026-09-07
**Branch:** `main`
**Blocked on:** nothing. Every open item below is Jack's to decide.

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
>
> **Never put a destructive command here.** A stale `git reset --hard` was one
> edit away from destroying the 2,880-line WorkOS plan (`9da1d75`). State facts
> and point at documents; let the reader run the verbs.

## Where this stands

Architecture stage one merged 7 Sep (PR #37): the pooler trap, migration race,
outbound timeouts, process lifecycle and README are closed. The sixth ceiling —
managed Postgres, PITR, a rehearsed restore — is untouched, and is Jack's.
Two designs remain approved and unbuilt: WorkOS auth, and design remediation.

**Do not assume stage one did more than it did.** It makes the app safe to run
as more than one process. It does nothing about recovering data if the volume
is lost. And its request-wide transaction mode is OFF — `DB_TENANT_SCOPE`
defaults to `session`, the behaviour that already shipped. Three handlers must
be restructured first; that checklist lives in
`docs/decisions/2026-09-06-tenant-scoping-and-pooler-safety.md`.

## Provenance

Replaces Mark's `.agents/STATUS.md` (`fa32b60`, 31 Aug); the full account and his
original file are in `.agents/ARCHIVE.md`.

## Read order for a fresh session

1. This file
2. `docs/decisions/2026-08-31-business-plan.md` — ownership, the Jack/Mark split
3. `docs/decisions/2026-09-02-lightspeed-first-platform.md` — the platform bet,
   and the open items that would falsify it (§7, §8)
4. `docs/decisions/2026-09-06-tenant-scoping-and-pooler-safety.md` — what stage
   one did, and what must change before `DB_TENANT_SCOPE=transaction`
5. `docs/superpowers/plans/2026-08-31-master-implementation-plan.md` — LOCKED;
   changes to it are decisions, not edits

## Immediate next actions

1. **Velodrop and Bikebook trials.** Named in the Lightspeed decision (§7.2) as
   the highest-value open item, unstarted since 31 August. It is the only thing
   that tests the "better than theirs" claim the product rests on. Both free,
   no card. Account creation is Jack's — an agent cannot sign up.
2. **Test the timestamp question against a live Lightspeed account.** Signing
   off the R-Series research did not settle it, because documentation cannot: if
   a `Workorder`'s `timeStamp` does not move when a child `WorkorderLine`
   changes, polling parents silently misses line edits and the diary shows a job
   as unchanged while its contents changed. A design fork — test it **before the
   sync loop is written**. Needs an account, so it is Jack's. Read the real
   bucket size from `X-LS-Api-Bucket-Level` on the same call; 90 and 60 are both
   published and neither has been seen live.
3. **Decide on branch cleanup.** 22 of 26 remote branches have zero commits
   `main` cannot reach; deleting those removes a label, not history. Analysis and
   recommendation: `.agents/ARCHIVE.md`, "Branch audit". Not tidiness — the
   ownership sign-off hid for a week in a list where 25 of 26 lines were dead.
4. **Decide whether `gateway` should wait for a healthy `app`.** It has a bare
   `depends_on: app`, so the new `/healthz` check gates `docker compose up
   --wait` and health reporting but not gateway startup. Topology change, so
   it was deliberately left out of PR #42.
5. **Answer the five ownership queries.** `2026-09-01-ownership-signoff.md`
   leaves `PF-3` (print agent — could it just be browser-based?) and `DP-1`
   through `DP-4` (design-partner recruitment and cadence — "dont think this is
   necessary") open. They need Mark before those owners are settled.

## Done

36 PRs merged, spanning #1-#42 (counted 7 Sep; #36 open, #15 closed unmerged,
5/16/17/18 are issue numbers). The earlier "36 merged, #1-#40" overcounted by
two. Nothing here is deleted when it ages — it moves to `.agents/ARCHIVE.md`,
which holds the detail to 2 September. Full list:
`gh pr list --state merged -L 100`.

## Decisions in force

| Decision | Status |
|---|---|
| `2026-08-31-business-plan.md` | Decided, except lines marked OPEN |
| `2026-08-31-frontend-platform.md` | Decided (approver: Mark) |
| `2026-09-02-lightspeed-first-platform.md` | DECIDED by Jack, 2 Sep 2026 |
| `2026-09-02-r-series-sync-and-rate-limits.md` | **SIGNED OFF by Jack, 7 Sep** (PR #30). §4 and §5 binding on the master plan; two open questions survive the sign-off — next action 2 |
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

**Last verified:** 278 pass, 0 fail on `main`, 7 Sep, lint and typecheck clean;
CI green on PR #42. An earlier `main` run added RLS coverage, build, registry
validate and drift check. The docker `app` image is from 31 Aug and runs stale
code — verify against the working tree, never that container.

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

Mark's fifth item — `git reset --hard 8514727` on `design/workos-auth-migration`
— is **deliberately dropped as obsolete**, not lost. PR #29 put the plan on
`main`; see the housekeeping notes in `.agents/ARCHIVE.md`.

## Keeping this file honest

Update at every phase boundary and before ending a session. Cap is 8,000 bytes
(`~/.claude/process/major-project.md`). Past that, trim by **moving** — stale
content to `.agents/ARCHIVE.md` (tracked precisely so "move, never delete" is
not a synonym for delete), decisions to `docs/decisions/`. Never by deleting.
