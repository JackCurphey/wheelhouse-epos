# STATUS — Wheelhouse EPOS

**Updated:** 2026-09-19
**Branch:** `docs/status-2026-09-19`, off `main` at `4947bcf`.
**Blocked on:** Mark, for the 84-screen review on issue #50. Every other open
item below is Jack's.

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
> **Never put a destructive command here** — a stale `git reset --hard` was one
> edit away from destroying the 2,880-line WorkOS plan (`9da1d75`). State facts
> and point at documents; let the reader run the verbs.

## Where this stands

**Release 1 has a narrowed scope and a plan.** PR #51, 10 Sep.
`docs/decisions/2026-09-10-release-1-scope-reduction.md` is the live scope —
booking, diary, job cards, statuses, capacity, line-level quote approval,
messaging, printing and tags, one Lightspeed adapter. Invoicing, payments,
refunds, customer import, reports, group capacity and recovery are Later. It
**supersedes the #47 Hubtiger ranking**, now closed. The plan —
`docs/superpowers/plans/2026-09-10-release-1-workshop-plan.md` — is packages
P00–P09 over 154 of the original 172 rows, not yet split into issues.

**The 84-screen journey atlas is reviewed and waiting on Mark.** Issue #50,
`docs/design/release-1-journey/`. Jack marked all 84 on 17 Sep: 71 approved as
shown, 13 with notes; nothing since. It is the visual build target for store
review, not design sign-off.

**There is still no Lightspeed technical spec, and no account.**
`2026-09-10-release-1-lightspeed-readiness.md` recommends R-Series *conditional
on the first shop*, carries the integration contract, and leaves proof steps
LS-01 to LS-09 all "Pending". None start without the shop's series and an
authorised test account, which is Jack's to supply.

Architecture stage one merged 7 Sep (PR #37): pooler trap, migration race,
outbound timeouts, process lifecycle and README closed. Recovery — managed
Postgres, PITR, a rehearsed restore — is untouched and now outside Release 1.
WorkOS auth and design remediation stay approved and unbuilt. The **workshop
prototype** (PR #45) is an in-memory demo under `prototype/`: a learning
artefact, not product code, and not a step toward WorkOS.

**Check the checkout before judging state.** On 9 Sep work sat 156 commits
behind on a branch forked 31 Aug, and stage one was reported open when it had
merged 7 Sep. Run `git rev-list --left-right --count origin/main...HEAD` first.

**Stage one did less than its name suggests.** It makes the app safe to run as
more than one process; it does nothing about recovering data if the volume is
lost, and its request-wide transaction mode is OFF — `DB_TENANT_SCOPE` defaults
to `session` until three handlers are restructured.

## Operational traps

- **The app is on `localhost:8080`, not 4000.** Compose stops publishing the app
  port deliberately: `TRUST_PROXY=1` is only safe while the gateway is the sole
  entrance. 4000 refuses host connections.
- **Never delete the `cf-*` header names in `server/gateway.js`.** That is the
  strip list, not Cloudflare residue; removing it reintroduces a login
  brute-force bypass (14/14 spoofed IPs passed before PR #8, 11 blocked after).

## Read order for a fresh session

1. This file
2. `2026-09-10-release-1-scope-reduction.md` — what Release 1 is now
3. `2026-09-10-release-1-lightspeed-readiness.md` — integration contract, proof
4. `2026-09-10-release-1-workshop-plan.md` — the package breakdown
5. `2026-08-31-business-plan.md` — ownership, the Jack/Mark split
6. `2026-09-06-tenant-scoping-and-pooler-safety.md` — the
   `DB_TENANT_SCOPE=transaction` checklist

Under `docs/decisions/`, bar the plan under `docs/superpowers/plans/`.

## Immediate next actions

1. **Jack: the first shop's Lightspeed series, and an authorised test account.**
   Nothing in P00-LS moves without it, and no honest claim of API access can be
   made. Other packages proceed meanwhile; P07 stays conditional.
2. **Jack: the hardware answers** — printer model, tag dimensions, the Windows
   driver host, 1D or 2D scanner. P08a is early and blocked on these.
3. **Jack: the message providers**, and what inbound replies should do.
4. **Mark: the 84-screen review**, issue #50, outstanding since 17 Sep. The 13
   screens carrying notes are the ones that change the build.
5. **Split the plan into issues** — row IDs, allowed state changes, expected
   failure, test command and proof artefact per package.

**Carried, unchanged, and still open:** whether CI should gate `prototype` and
the Python runner (neither is in `.github/workflows/test.yml`, so both merged on
a local run only and will rot); three tenant-isolation gaps confirmed ABSENT on
`main` 9 Sep — no composite tenant-consistent FKs, no privilege boundary on the
resolver tables, no idempotency key, so `withRetry` can still double-create on a
timeout; whether `gateway` should wait for a healthy `app`; and the five
ownership queries `PF-3`, `DP-1`–`DP-4`, which need Mark. Evidence and full text
for each: `.agents/ARCHIVE.md`.

**The Hubtiger trial lapsed about 15 Sep**, with the quote-approval round trip
and the booking-page disclosure re-test (§3.5c) never run. Re-entry needs a
fresh login: Jack's.

## Done

43 PRs merged, #1–#51; #51 carried the scope reduction, the plan and the atlas.
#48 and #52 were closed unmerged, both accounted for in `.agents/ARCHIVE.md`,
where ageing content moves rather than being deleted.

## Branches

Cleaned 19 Sep: 29 remote and 19 local deleted, each verified at zero commits
`main` cannot reach. Three kept, reasons in `.agents/ARCHIVE.md`. One matters
here: `docs/jack-ranking-2026-09-10` holds the only copy of the filled **Jack's
priority** column, which is empty on `main`.

## Decisions in force

| Decision | Status |
|---|---|
| `2026-09-10-release-1-scope-reduction.md` | **Instructed by Mark after review with Jack, 10 Sep — the live scope** |
| `2026-09-10-release-1-lightspeed-readiness.md` | R-Series recommended, conditional; access unproven |
| `2026-09-10-hubtiger-feature-comparison.md` | Reference, 317 rows; superseded as scope, #47 closed 19 Sep |
| `2026-09-06-tenant-scoping-and-pooler-safety.md` | Decided by Jack 6 Sep; carries the flag-flip checklist |
| `2026-09-04-job-type-before-diary.md` | **Proposed, not decided** |
| `2026-09-04-booking-mode-and-downtime.md` | Booking mode decided 5 Sep; downtime model proposed |
| `2026-09-08-competitive-trials.md` | Two decisions by Jack, 8 Sep; three OPEN in §6.4 |

Six older decisions stay in force unchanged — business plan, frontend platform,
Lightspeed platform, R-Series sync (its timestamp question is now LS-07), the
wedge, ownership sign-off — plus the 214-row feature catalogue. Cells and
reasoning: `.agents/ARCHIVE.md`.

## Plan register

LOCKED: `2026-08-31-master-implementation-plan.md` — the arc, superseded where
its Release 1 sequencing conflicts with the 10 Sep reduction. Current: the
Release 1 workshop plan. Approved and unbuilt: the 2,880-line WorkOS migration,
design remediation. Executed plans and per-plan detail: `.agents/ARCHIVE.md`.

## Canonical commands

```sh
npm test  # node --test "tests/**/*.test.js"
npm run typecheck && npm run lint && npm run build
npm run docker:up
```

**Last verified:** 278 pass, 0 fail, 10 Sep on the PR #44 merge. **Lint and
typecheck were NOT re-run on it** — last clean 9 Sep. Nothing ran on 19 Sep:
docs and branches only. The docker `app` image is from 31 Aug and runs
stale code — verify the working tree, never that container.

## Open items needing Mark

Eight. The 84-screen review is the urgent one; the other seven are in
`.agents/ARCHIVE.md`.

## Keeping this file honest

Update at every phase boundary and before ending a session. Cap is 8,000 bytes
(`~/.claude/process/major-project.md`). Past that, trim by **moving** — stale
content to `.agents/ARCHIVE.md`, decisions to `docs/decisions/`. Never by
deleting.
