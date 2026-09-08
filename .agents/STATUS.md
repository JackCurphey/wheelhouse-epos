# STATUS — Wheelhouse EPOS

**Updated:** 2026-09-08
**Branch:** `docs/competitive-trials-2026-09-08`
**Blocked on:** nothing. Every open item below is Jack's to decide.

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
>
> **Never put a destructive command here.** A stale `git reset --hard` was one
> edit away from destroying the 2,880-line WorkOS plan (`9da1d75`). State facts
> and point at documents; let the reader run the verbs.

## Where this stands

Architecture stage one merged 7 Sep (PR #37): pooler trap, migration race,
outbound timeouts, process lifecycle and README closed. The sixth ceiling —
managed Postgres, PITR, a rehearsed restore — is untouched, and is Jack's. Two
designs approved and unbuilt: WorkOS auth, design remediation. Competitive
research moved substantially on 8 Sep — read `2026-09-08-competitive-trials.md`
before believing any "better than theirs" claim.

**Do not assume stage one did more than it did.** It makes the app safe to run
as more than one process. It does nothing about recovering data if the volume is
lost. Its request-wide transaction mode is OFF — `DB_TENANT_SCOPE` defaults to
`session`, what already shipped. Three handlers need restructuring first; that
checklist is in `docs/decisions/2026-09-06-tenant-scoping-and-pooler-safety.md`.

Replaces Mark's `.agents/STATUS.md` (`fa32b60`, 31 Aug); his original and the
full account are in `.agents/ARCHIVE.md`.

## Read order for a fresh session

1. This file
2. `docs/decisions/2026-08-31-business-plan.md` — ownership, the Jack/Mark split
3. `docs/decisions/2026-09-02-lightspeed-first-platform.md` — the platform bet,
   and the open items that would falsify it (§7, §8)
4. `docs/decisions/2026-09-06-tenant-scoping-and-pooler-safety.md` — what stage
   one did, and what must change before `DB_TENANT_SCOPE=transaction`
5. `docs/decisions/2026-09-08-competitive-trials.md` — who the competitors
   actually are, and what that does to "better than theirs"
6. `docs/superpowers/plans/2026-08-31-master-implementation-plan.md` — LOCKED;
   changes to it are decisions, not edits

## Immediate next actions

1. **Hubtiger trial, and the Hubtiger ↔ Lightspeed integration test.** Velodrop
   trialled 8 Sep; Hubtiger replaced Bikebook as priority the same day. Hubtiger
   gives 7 days, no card; the Lightspeed trial has ~15. That overlap is the only
   window to test their "parts pulled from your POS" claim end to end.
2. **The timestamp question is still blocked, and the reason changed.** If a
   `Workorder`'s `timeStamp` does not move when a child `WorkorderLine` changes,
   polling parents misses line edits and the diary shows a job as unchanged
   while its contents changed. Test **before the sync loop is written**. The
   8 Sep trial account is **X-Series**, so it cannot answer an R-Series
   question — see action 5. Read `X-LS-Api-Bucket-Level` on the same call; 90
   and 60 are both published, neither seen live.
3. **Decide on branch cleanup.** 22 of 26 remote branches have zero commits
   `main` cannot reach; deleting those removes a label, not history. Analysis,
   recommendation and why it matters: `.agents/ARCHIVE.md`, "Branch audit".
4. **Decide whether `gateway` should wait for a healthy `app`.** Its bare
   `depends_on: app` means `/healthz` gates `docker compose up --wait` and
   health reporting, not gateway startup. Topology change, so left out of PR #42.
5. **Decide the first adapter, and whether to chase R-Series.** The plan targets
   R-Series; the account a new shop can actually get is X-Series. Asking
   Lightspeed UK sales settles both that and §7.1 in one conversation.
6. **Answer the five ownership queries.** `2026-09-01-ownership-signoff.md`
   leaves `PF-3` (print agent — could it just be browser-based?) and `DP-1`
   through `DP-4` (design-partner recruitment and cadence — "dont think this is
   necessary") open. They need Mark before those owners are settled.

## Done

36 PRs merged, #1-#42 as at 7 Sep. Ageing content moves to `.agents/ARCHIVE.md`,
never deleted. Full list: `gh pr list --state merged -L 100`.

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
| `2026-09-08-competitive-trials.md` | **Two decisions by Jack, 8 Sep** — Hubtiger replaces Bikebook as trial priority; free software, customer-supplied integration accounts. Three OPEN in §6.4. Corrects four §10.3 lines |
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

**Last verified:** 278 pass, 0 fail on `main`, 7 Sep; lint and typecheck clean;
CI green on PR #42. An earlier `main` run added RLS coverage, build, registry
validate and drift check. The docker `app` image is from 31 Aug and runs stale
code — verify against the working tree, never that container. **Nothing in this
session ran the test suite; no code changed.**

## Open items needing Mark

Three design items from Mark's 31 August file — paid-ink contrast token,
unapproved dark-mode palette, registry `<dialog>` primitives — are in
`.agents/ARCHIVE.md`. Still open; just not what this file is for.

1. **A connection dying mid-request still crashes the process**, taking every
   shop's in-flight requests with it. Full text in `.agents/ARCHIVE.md`, "Open
   item for Mark". Wants an explicit decision at "hundreds of shops" scale.
2. **Gate spacing / dates.** `2026-08-31-business-plan.md:583` — OPEN pending
   Mark's weekly time budget.

Mark's fifth item — `git reset --hard 8514727` on `design/workos-auth-migration`
— is **deliberately dropped as obsolete**, not lost. PR #29 put the plan on
`main`; see the housekeeping notes in `.agents/ARCHIVE.md`.

## Keeping this file honest

Update at every phase boundary and before ending a session. Cap is 8,000 bytes
(`~/.claude/process/major-project.md`). Past that, trim by **moving** — stale
content to `.agents/ARCHIVE.md`, decisions to `docs/decisions/`. Never delete.
