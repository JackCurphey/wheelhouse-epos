# STATUS — Wheelhouse EPOS

**Updated:** 2026-09-10
**Branch:** `docs/competitive-trials-2026-09-08` — open as PR #44.
**Blocked on:** nothing. Every open item below is Jack's or Mark's.

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
Competitive research moved on 8 Sep — read `2026-09-08-competitive-trials.md`
before believing any "better than theirs" claim. Hubtiger, not Velodrop, is the
competitor that matters.

The **workshop prototype** landed 9 Sep (PR #45): a standalone in-memory React
demo under `prototype/` with a real-browser suite. A learning artefact, not
product code; persistence, auth and tenancy are out of scope by its spec, so it
is not a step toward WorkOS. Scope
`docs/reviews/2026-09-08-workshop-prototype-decisions.md`; evidence
`prototype/OVERNIGHT.md`.

**Check the checkout before judging state.** On 9 Sep work sat 156 commits
behind on a branch forked 31 Aug, and stage one was reported open when it had
merged 7 Sep. Run `git rev-list --left-right --count origin/main...HEAD` first.
`origin/HEAD` points at `main`; `origin/master` is gone.

**Do not assume stage one did more than it did.** It makes the app safe to run
as more than one process. It does nothing about recovering data if the volume is
lost. Its request-wide transaction mode is OFF — `DB_TENANT_SCOPE` defaults to
`session`; three handlers must be restructured first (checklist in the
tenant-scoping decision).

## Operational traps

In Mark's 31 Aug file, dropped by the 7 Sep rewrite, restored 9 Sep.

- **The app is on `localhost:8080`, not 4000.** Compose stops publishing the app
  port deliberately: `TRUST_PROXY=1` is only safe while the gateway is the sole
  entrance. 4000 refuses host connections.
- **Never delete the `cf-*` header names in `server/gateway.js`.** That is the
  strip list, not Cloudflare residue; removing it reintroduces a login
  brute-force bypass (14/14 spoofed IPs passed before PR #8, 11 blocked after).

## Provenance

Replaces Mark's `.agents/STATUS.md` (`fa32b60`, 31 Aug); his original, the full
account, and the PR arithmetic are in `.agents/ARCHIVE.md`.

## Read order for a fresh session

1. This file
2. `2026-08-31-business-plan.md` — ownership, the Jack/Mark split
3. `2026-09-02-lightspeed-first-platform.md` — the platform bet and its
   falsifiers (§7, §8)
4. `2026-09-06-tenant-scoping-and-pooler-safety.md` — what stage one did, and
   what must change before `DB_TENANT_SCOPE=transaction`
5. `2026-09-08-competitive-trials.md` — who the competitors actually are
6. `2026-08-31-master-implementation-plan.md` — LOCKED; changes are decisions

All under `docs/decisions/`, bar the plan under `docs/superpowers/plans/`.

## Immediate next actions

1. **Finish the Hubtiger trial before it lapses.** Started 8 Sep, 7 days.
   Still open inside it: the quote-approval round trip (needs Jack's inbox) and
   a clean re-test of the booking-page disclosure (§3.5c).
2. **The timestamp question is still blocked, and the reason changed.** If a
   `Workorder`'s `timeStamp` does not move when a child `WorkorderLine` changes,
   polling parents misses line edits. Test before the sync loop is written. The
   8 Sep trial account is **X-Series**, so it cannot answer an R-Series
   question; see action 5. Detail: `2026-09-02-r-series-sync-and-rate-limits.md`.
3. **Decide on branch cleanup.** 22 of 26 remote branches have zero commits
   `main` cannot reach. Analysis and recommendation: `.agents/ARCHIVE.md`,
   "Branch audit".
4. **Decide whether `gateway` should wait for a healthy `app`.** It has a bare
   `depends_on: app`, so the new `/healthz` check gates `docker compose up
   --wait` and health reporting but not gateway startup. Topology change, so
   it was deliberately left out of PR #42.
5. **Decide the first adapter, and whether to chase R-Series.** The plan targets
   R-Series; a new shop gets X-Series. Asking Lightspeed UK sales settles that
   and §7.1 together.
6. **Re-verify two items against `main`** — unknown, not open: composite
   tenant-consistent FKs, and the privilege boundary on the non-RLS resolver
   tables. Confirmed absent on `main`: any idempotency key (no
   `Idempotency-Key`/`outbox`/`webhook_events`), so `withRetry` in
   `server/shopify.js` can still double-create on a timed-out success.
7. **Answer the five ownership queries.** `2026-09-01-ownership-signoff.md`
   leaves `PF-3` (print agent — could it just be browser-based?) and `DP-1`
   through `DP-4` (design-partner recruitment and cadence — "dont think this is
   necessary") open. They need Mark before those owners are settled.

## Done

37 PRs merged, #1-#45 (prototype merged as PR #45, 9 Sep). Ageing content moves
to `.agents/ARCHIVE.md`, never deleted. `gh pr list --state merged -L 100`.

## Decisions in force

| Decision | Status |
|---|---|
| `2026-08-31-business-plan.md` | Decided, except lines marked OPEN |
| `2026-08-31-frontend-platform.md` | Decided (Mark) |
| `2026-09-02-lightspeed-first-platform.md` | Decided by Jack 2 Sep |
| `2026-09-02-r-series-sync-and-rate-limits.md` | Signed off 7 Sep (PR #30); two questions survive — next action 2 |
| `2026-09-01-wedge-booking-vs-workshop.md` | Decided 1 Sep, ratified 6 Sep; §4/§5b superseded by Lightspeed |
| `2026-09-01-ownership-signoff.md` | Signed off 1 Sep; five queries still need Mark |
| `2026-09-06-tenant-scoping-and-pooler-safety.md` | Decided by Jack 6 Sep; carries the flag-flip checklist |
| `2026-09-04-job-type-before-diary.md` | **Proposed, not decided** |
| `2026-09-04-booking-mode-and-downtime.md` | Booking mode decided 5 Sep; downtime model proposed |
| `2026-09-08-competitive-trials.md` | **Two decisions by Jack, 8 Sep** — Hubtiger replaces Bikebook; free software, bring-your-own integrations. Three OPEN in §6.4 |
| `2026-08-31-feature-catalogue.md` | Reference — 214 rows, the feature list |

Reasoning behind each cell, written 7 Sep: `.agents/ARCHIVE.md`.

## Plan register

LOCKED: `2026-08-31-master-implementation-plan.md` — the arc. Executed: stage
one (PR #37, 7 Sep), booking-mode foundations (PR #35, 5 Sep), the workshop
service catalogue, the storefront and Shopify-checkout plans. Approved and
unbuilt: `2026-08-31-workos-auth-migration.md` (2,880 lines) and design
remediation. Per-plan detail: `.agents/ARCHIVE.md`.

## Canonical commands

```sh
npm test        # node --test "tests/**/*.test.js"
npm run typecheck
npm run lint
npm run build
npm run docker:up
```

**Last verified:** 278 pass, 0 fail, 10 Sep on the PR #44 merge of `main`.
**Lint and typecheck were NOT re-run on that merge** — last clean 9 Sep. The
docker `app` image is from 31 Aug and runs stale code — verify against the
working tree, never that container.

## Open items needing Mark

Six carried items — pg-pool's checkout error listener, gate spacing/dates, the
paid-ink token, the dark-mode palette, the registry's native `<dialog>`, and the
five ownership queries. All still open; full text in `.agents/ARCHIVE.md`.

## Keeping this file honest

Update at every phase boundary and before ending a session. Cap is 8,000 bytes
(`~/.claude/process/major-project.md`). Past that, trim by **moving** — stale
content to `.agents/ARCHIVE.md` (tracked precisely so "move, never delete" is
not a synonym for delete), decisions to `docs/decisions/`. Never by deleting.
