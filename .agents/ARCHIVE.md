# ARCHIVE — Wheelhouse EPOS

Superseded resume-file content, kept verbatim. Nothing is deleted from the
project's history; when `.agents/STATUS.md` outgrows its 8,000-byte cap,
content moves here rather than being dropped. Decisions move to
`docs/decisions/` instead.

---

## Mark's original `.agents/STATUS.md`

Authored by Mark Curphey. Last updated `fa32b60`, 31 August 2026 (blob
`0eca91d3`, 2,007 bytes). Untracked from `main` by `9da1d75` on 2 September;
still present unchanged on nine unmerged branches. Reproduced here in full so
that it survives any merge. Recover the original directly with
`git show fa32b60:.agents/STATUS.md`.

**Do not act on the commands in the text below.** It is a historical record.
Its `git reset --hard 8514727` line was accurate when written and is now
obsolete and destructive: `8514727` predates the commit that added the
2,880-line WorkOS plan, which is on `main` via PR #29.

````markdown
# STATUS — Wheelhouse EPOS

**State:** phase one merged-ready; architecture stage one **set up, not started**
**Branch:** `feat/shadcn-foundation` (PR #9, CI green)
**Updated:** 2026-08-31

> This directory is gitignored volatile scratch and an earlier copy of it was
> destroyed mid-session. Durable records live in `docs/`. Do not put anything
> here that matters.

## Start here if you are a fresh session

Read `docs/superpowers/plans/2026-08-31-architecture-stage-1.md`. It has the
exact commands. Short version — from a new branch off master, with docker up:

```
Workflow({ name: 'wheelhouse-architecture-stage-1' })
```

Decisions that govern the work: `docs/decisions/2026-08-31-frontend-platform.md`.

## Done

- **`fix/cross-tenant-login-scope` merged** (PR #4). Master had no CI at all
  before that; it also carried the fix scoping every `logins` write to the
  caller's shop.
- **Frontend phase one** — PR #9, CI green on run `33396591409` (89/89 tests,
  41s). Vite 8 + React 19 + TS + Tailwind 4.3.3 + a shadcn registry with four
  enforcement gates, each mutation-tested. Nothing user-visible changed.

## Next

Architecture stage one, via the workflow above. Six ceilings; the seventh
(managed Postgres with PITR and a rehearsed restore) is infrastructure and is
deliberately excluded — a human owns it.

## Open items needing Mark

1. `--status-complete-paid-ink` — held back on purpose, needs sign-off.
2. Dark-mode palette in `src/styles/theme.css` was invented during the scaffold
   with no design approval. Nothing renders it yet.
3. Registry primitives use native `<dialog>` rather than Radix, because
   `@radix-ui/*` was not installed. Should be an explicit decision.
4. `design/workos-auth-migration` carries duplicate copies of two commits from
   when the working tree switched branches mid-session.
   `git reset --hard 8514727` cleans it. Mark's branch, Mark's call.
5. After stage one lands: repoint the `app` healthcheck in `docker-compose.yml`
   at `/healthz`.
````

---

## Provenance of the current `.agents/STATUS.md`

Moved out of `STATUS.md` on 6 September 2026 when the file passed its
8,000-byte cap. Verbatim as it stood there:

This file replaces Mark's `.agents/STATUS.md` (`fa32b60`, 31 Aug, blob
`0eca91d3`). That version is still on nine unmerged branches, where it is
identical everywhere. A merge of any of them will **silently** keep this file
and drop Mark's with no conflict — so its live content was carried forward here
by hand rather than left to git. Recover the original with:
`git show fa32b60:.agents/STATUS.md`

---

## Merged work, 30 August - 2 September 2026

Moved out of `STATUS.md` on 6 September 2026 when the file passed its
8,000-byte cap. Verbatim as it stood there. Full list any time:
`gh pr list --state merged -L 100`.

**Carried forward verbatim from Mark's file (`fa32b60`):**

- **`fix/cross-tenant-login-scope` merged** (PR #4). Master had no CI at all
  before that; it also carried the fix scoping every `logins` write to the
  caller's shop.
- **Frontend phase one** — PR #9, CI green on run `33396591409` (89/89 tests,
  41s). Vite 8 + React 19 + TS + Tailwind 4.3.3 + a shadcn registry with four
  enforcement gates, each mutation-tested. Nothing user-visible changed.

**Since (30 Aug - 2 Sep):**

- **Storefronts and checkout** — per-shop public storefronts (#1), Shopify
  checkout (#2), owner preview button (#3). Plans archived (#6).
- **Platform and infra** — Cloudflare Tunnel assumption dropped (#8), CI push
  trigger on main (#10), architecture stage-one workflow set up (#11), README
  made accurate (#12), ESLint stopped parsing workflow files (#26).
- **Workshop / diary** — booking portal data leak closed (DS-7, #19), server
  enforces diary rules (DS-8, #20), first workshop tests (DS-9, #21), service
  catalogue and labour lines (JOB-12/13, #24).
- **Design** — audit findings, shared tokens, WCAG contrast gate (#14).
- **Research and direction** — business/market research (#7), business plan and
  workshop-first direction (#13), wedge decision (#22) and plan reconciliation
  (#23), Book My Bike In teardown + Hubtiger research (#25), Lightspeed R-Series
  as first platform (#27).
- **WorkOS auth** — design spec and 2,880-line plan on `main` (#29, replaces
  #15). Approved, not implemented.
- **Process** — `.agents/STATUS.md` untracked (#28), then rebuilt and tracked.

---

## Housekeeping notes

Moved out of `STATUS.md` on 7 September 2026 when the file passed its
8,000-byte cap after the stage-one merge. Verbatim as it stood there.

- `origin/design/workos-auth-migration` (0dad2a4, 31 Aug) is the superseded
  pre-rebuild branch. Its content is safe: the 2,880-line plan and 760-line
  spec are both on `main`, byte-identical, merged via PR #29. Deleting the
  stale remote branch is a judgement call nobody has made.

---

## Open design items carried from Mark's 31 August STATUS.md

Moved out of `STATUS.md` on 7 September 2026 when the file passed its
8,000-byte cap. STILL OPEN — moved for space, not resolved. Verbatim.

Items 1-4 are carried forward verbatim in substance from Mark's own STATUS.md
(`fa32b60`, 31 Aug) and re-verified against the tree on 2026-09-03.

1. **`--status-complete-paid-ink` needs sign-off.** Held back on purpose.
   Still unapplied and now inconsistent: `public/tokens.css:75` has the fixed
   `#4d7364`, `src/styles/theme.css:84` still has `#6b9484` at 3.21 contrast,
   which fails AA. `docs/decisions/2026-08-31-frontend-platform.md:68` records
   it as NOT applied.
2. **Dark-mode palette** in `src/styles/theme.css` was invented during the
   scaffold with no design approval. Nothing renders it yet. Design direction
   is Mark's to approve.
3. **Registry primitives use native `<dialog>`** rather than Radix, because
   `@radix-ui/*` was not installed. Should be an explicit decision, not a
   default that hardened.

---

## Branch audit — 7 September 2026

Run at session close, after the stage-one merge. 26 remote branches.

**22 have zero commits `main` cannot reach.** Verified with
`git rev-list --count origin/main..<branch>` returning 0 for each. That check
also rules out the squash-merge case: a squash-merged branch keeps its own
commit objects and would have returned non-zero. For these 22, deleting the
remote branch removes a ref, not history — every commit remains reachable from
`main`, and the GitHub PR page survives deletion and still shows the diff.

**Two are safe in content but not in commits:**

- `docs/ownership-signoff` — 1 commit (`90f1f23`). Its content was brought to
  `main` by cherry-pick on 6 Sep, so `main` holds an equivalent commit under a
  different SHA. Deleting the branch orphans the original object.
- `design/workos-auth-migration` — 5 commits. Every file on it also exists on
  `main`, and the two documents that matter — the 2,880-line WorkOS plan and the
  760-line spec (`2026-08-31-workos-auth-migration-design.md`) — are
  byte-identical to `main`'s copies, confirmed by diff. What looked like unique
  content is older versions of files `main` has since rewritten. The five commit
  objects are not in `main`'s history.

**One is genuinely unmerged:** `chore/purge-test-shops-script`, PR #36, open.
More relevant now than when it was raised — the cross-tenant verifier left
throwaway shops around ids 18389-18391 in the dev database on 7 Sep.

**Recommendation:** delete the 22, leave the other two, keep #36's branch.

**Why this is worth doing at all.** Mark's ownership sign-off sat on
`docs/ownership-signoff` for a week, 103 commits behind `main`, with no PR ever
opened — and it read as "never signed off" in every document that referenced it.
Nothing was broken. It was invisible because it was one line in a list where
almost every other line was dead. Deleting the dead ones is what makes the next
live branch visible.


## PR accounting, moved from STATUS 8 September 2026

Moved to keep STATUS under its 8,000-byte cap. Accurate as at 7 September 2026.

36 PRs merged, spanning #1-#42 (counted 7 Sep; #36 open, #15 closed unmerged,
5/16/17/18 are issue numbers). The earlier "36 merged, #1-#40" overcounted by
two. The detail to 2 September is elsewhere in this file. Full list:
`gh pr list --state merged -L 100`.

## Hubtiger trial — records created 8 September 2026

Left in the Hubtiger trial account by the 8 Sep testing. Listed so a later
session knows why they are there.

- Job **#96** (demo-seeded) — a `Repair` line, SKU 100002, £75.00, added to test
  the POS parts pull. Also dragged from Tue 09:00 to Wed 08:00 to test
  rescheduling.
- Customer **ZZTest PosPush** (`zztest@example.com`) and job **#100** — created
  from scratch to rule out demo data as the cause of the quote-push failure.
  Job #100 was later moved to Bike Ready as part of that testing. That customer
  also synced through to the Lightspeed X-Series trial as `ZZTest-53CH`, which
  is what proved writes to the POS work.
- Job **#101** — created through the public booking widget to test the
  customer-facing flow. Mobile 07700 900456, an Ofcom-reserved fictitious
  number that cannot reach anyone.
- Job **#99** — two POS lines (Repair £75.00, Replacement Parts £50.00) and a
  quote sent to `jack@curphey.com`, testing the quote-approval round trip.
- Setting changed: Technician 2 linked to POS user Jack Curphey, on the POS
  integration page.

In the Velodrop trial: appointment **241105 ("ZZTest Trial")**.
## Moved out of STATUS.md, 9 September 2026

STATUS.md hit its 8,000-byte cap when the workshop prototype and the restored
operational traps were added. Trimmed by moving, per its own rule. Verbatim:

### Immediate next action 2, full text (moved 9 Sep)

```
2. **Test the timestamp question against a live Lightspeed account.** Signing
   off the R-Series research did not settle it, because documentation cannot: if
   a `Workorder`'s `timeStamp` does not move when a child `WorkorderLine`
   changes, polling parents silently misses line edits and the diary shows a job
   as unchanged while its contents changed. A design fork — test it **before the
   sync loop is written**. Needs an account, so it is Jack's. Read the real
   bucket size from `X-LS-Api-Bucket-Level` on the same call; 90 and 60 are both
   published and neither has been seen live.
```

### Immediate next action 3, full text (moved 9 Sep)

```
3. **Decide on branch cleanup.** 22 of 26 remote branches have zero commits
   `main` cannot reach; deleting those removes a label, not history. Analysis and
   recommendation: `.agents/ARCHIVE.md`, "Branch audit". Not tidiness — the
   ownership sign-off hid for a week in a list where 25 of 26 lines were dead.
```

### Decisions in force — full status cells (moved 9 Sep)

```
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
```

### Open items needing Mark — full text (moved from STATUS.md, 9 Sep)

(as written 7 Sep)

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

### Plan register — full table (moved from STATUS.md, 9 Sep)

(as written 7 Sep)

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

## Tenant isolation — two gaps confirmed on `main`, 9 September 2026

Both were carried in STATUS as "unknown, not open". Both are ABSENT, verified
against the code and, for the second, against the running database. Neither is
fixed; this is a record of what is true, not of work done.

### 1. Composite tenant-consistent foreign keys — ABSENT

Every foreign key in the schema is single-column, referencing only the parent's
`id`. 61 `REFERENCES` clauses across the 15 files in `server/migrations/`; not
one `FOREIGN KEY (...)` or `REFERENCES x (...)` clause contains a comma, and
there is no `UNIQUE (shop_id, id)` anywhere to make a composite FK possible. The
only composite key of any kind is the junction primary key at
`001_init_schema.sql:159`. No schema SQL exists outside `server/migrations/`.

Examples of the single-column pattern: `customer_bikes.customer_id`
(`001:135`), `workshop_jobs.customer_id`/`bike_id`/`mechanic_id`
(`001:171-173`), `sales.customer_id`/`cashier_id` (`001:193-194`),
`sale_items.sale_id`/`product_id` (`001:232-233`).

**What it permits.** FK referential checks bypass RLS, so shop A can insert a
`customer_bikes` or `workshop_jobs` row pointing at shop B's `customer_id` —
creating a tenant-A-visible record attached to another tenant's entity, and
confirming which of B's row IDs exist (an existence oracle). This was already
demonstrated in-repo: `docs/reviews/2026-08-31-architecture-stage-1-review.md`,
lines 70-84.

### 2. Privilege boundary on the non-RLS resolver tables — ABSENT

The resolver tables are `shops`, `logins`, `sessions`
(`001_init_schema.sql:22-50`) and `customer_logins`, `customer_sessions`
(`003_customer_portal.sql:5-30`). `logins` and `customer_logins` are the two
declared RLS exemptions in `scripts/ci/assert-rls-coverage.mjs:26`; `shops` and
`sessions` have no `shop_id`, so that check never considers them.

There is exactly one grant statement in the entire repository —
`docker/init-db.sh:18`, `GRANT ALL ON SCHEMA public TO epos_app`. No `REVOKE`,
no second role, no per-table grants. And migrations run through the app's own
pool (`server/migrations/run-migrations.js` imports `pool` from `../db.js`), so
`epos_app` **creates and therefore owns** every table — owner-level DML applies
regardless of grants.

Confirmed against the running container, 9 Sep:

```
     tablename     | tableowner | sel | ins | upd | del
 customer_logins   | epos_app   | t   | t   | t   | t
 customer_sessions | epos_app   | t   | t   | t   | t
 logins            | epos_app   | t   | t   | t   | t
 sessions          | epos_app   | t   | t   | t   | t
 shops             | epos_app   | t   | t   | t   | t
```

**What it permits.** The only thing separating tenants on these tables is
application code — `server/auth.js` queries `shops`/`logins` by email or id with
no shop predicate (`:53,:67,:74,:139,:165`). Any SQL-capable path can rewrite
the shop-to-login mapping or repoint a session's `login_id` and obtain
RLS-legitimate access to another tenant. RLS cannot defend this, because the
mapping is what RLS trusts.

**The adjacent control is real, and is a different thing.** `init-db.sh`'s
comment promises only that `epos_app` is not a superuser, which protects against
RLS bypass. Verified: `rolsuper=f`, `rolbypassrls=f` for `epos_app`, both `t`
for `postgres`. That guarantee holds and is orthogonal to resolver-table
writability.

### How this was verified

A subagent surveyed and reported both as absent; the load-bearing absence claims
were then re-checked directly in the main session (the grep patterns above) and,
for the privilege claim, proven by catalog query against the live database
rather than inferred from source. Recorded because a delegated "X does not
exist" is not evidence on its own.

## Moved out of STATUS.md, 19 September 2026

### Working-tree trap of 10 Sep — resolved

The 10 Sep close recorded uncommitted Release 1 work sitting on `main` in the
root checkout: two decisions, an adversarial review,
`docs/design/release-1-journey/`, `docs/presentations/`, and edits to the master
plan and workshop spec. It landed in PR #51 (`21c811c`, 10 Sep 23:58). The
working tree is clean; the warning is retired, not lost.

### Branch cleanup — 19 September 2026

Executed the recommendation from the 7 Sep audit above, twelve days later and
against a larger list. **29 remote and 19 local branches deleted**, each checked
individually with `git rev-list --count origin/main..<branch>` returning 0 — so
this removed refs, not history, and every commit stays reachable from `main`.
The GitHub PR pages survive the deletion and still show their diffs.

Remote branches deleted: `chore/architecture-stage-1-setup`,
`chore/ci-trigger-main`, `chore/untrack-agents-status`,
`design/audit-remediation-plan`, `design/workos-auth-migration-rebuilt`,
`design/workshop-service-catalogue`, `docs/archive-executed-plans`,
`docs/bmbi-and-hubtiger-research`, `docs/business-plan`,
`docs/business-research`, `docs/competitive-trials-2026-09-08`,
`docs/job-type-before-diary`, `docs/lightspeed-first-platform`,
`docs/plan-wedge-reconciliation`, `docs/readme-accuracy`,
`docs/status-after-healthcheck-merge`, `docs/status-after-pr-45`,
`docs/status-close-2026-09-10`, `docs/wedge-booking-vs-workshop`,
`feat/booking-mode-foundations`, `feat/shadcn-foundation`,
`feat/workshop-prototype`, `feat/workshop-server-rules`,
`fix/compose-healthcheck-healthz`, `fix/cross-tenant-login-scope`,
`fix/eslint-ignore-claude`, `fix/portal-data-exposure`,
`refactor/drop-cloudflare-assumptions`, `test/workshop-ds9-coverage`. The local
set was the same list minus the ones that never existed locally.

`docs/status-close-2026-09-10` was the one with a commit of its own (`081a616`,
PR #52). It was deleted anyway, after diffing it against `main`: `STATUS.md` was
byte-identical and every other path on it was a deletion of something `main`
has. The orphaned object carries no unique content.

**Kept, and why** — `docs/jack-ranking-2026-09-10` (PR #48, closed) holds the
only copy of the filled **Jack's priority** column and the four duplicate-row
removals; `main`'s comparison file still has that column empty.
`docs/ownership-signoff` and `design/workos-auth-migration` are the two the
7 Sep audit called "safe in content but not in commits", for the reasons given
there.

### Issue #47 and PR #52, closed 19 September 2026

#47 asked Jack to rank 317 Hubtiger features. He did, on 10 Sep: 172 Release 1,
102 Later, 43 Not for us, with the order inside Release 1 attributed to Claude
rather than himself. The write-back into
`docs/decisions/2026-09-10-hubtiger-feature-comparison.md` rode PR #48, which was
closed, so that column on `main` is still empty and the issue comment is the
record. The ranking is no longer the live scope: the 10 Sep scope reduction says
in terms that it supersedes the Release 1 selections in it, and the revised plan
carries 154 of the 172 forward with reasons for the 18 moved to Later.

PR #52 proposed a STATUS update whose content had already reached `main` through
PR #51 — the two copies of `.agents/STATUS.md` were byte-identical — so it was
closed as redundant rather than merged.

### Superseded next actions, as they stood on 10 Sep

Actions 1 (commit the other session's Release 1 work), 1b (answer F05, then
write the Lightspeed adapter spec), 1c (the Hubtiger trial), 2 (the `Workorder`
timestamp question), 3 (branch cleanup) and 6 (decide the first adapter) are all
either done or absorbed. F05 and the adapter choice now live in the Lightspeed
readiness brief; the timestamp question is its step LS-07; the trial lapsed
about 15 Sep with the quote-approval round trip and the booking-page disclosure
re-test still untested.

---

# Moved from STATUS.md, 20 September 2026

Moved to keep STATUS within its 8,000-byte cap after the Phase 0 entry was
added. Both were historical record rather than live state.

## Done (as at 19 Sep 2026)

43 PRs merged, #1–#51; #51 carried the scope reduction, the plan and the atlas.
#48 and #52 were closed unmerged, both accounted for in `.agents/ARCHIVE.md`,
where ageing content moves rather than being deleted.

## Branches (cleaned 19 Sep 2026)

Cleaned 19 Sep: 29 remote and 19 local deleted, each verified at zero commits
`main` cannot reach. Three kept, reasons in `.agents/ARCHIVE.md`. One matters
here: `docs/jack-ranking-2026-09-10` holds the only copy of the filled **Jack's
priority** column, which is empty on `main`.

## Decisions in force (table moved from STATUS.md, 20 Sep 2026)


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


The live decisions themselves are the files under `docs/decisions/`; this
table was a summary of them, and summaries of documents that exist do not
belong in a capped file.

## Architecture stage one, moved from STATUS.md 20 Sep 2026

Architecture stage one merged 7 Sep (PR #37): pooler trap, migration race,
outbound timeouts, process lifecycle and README closed. Recovery — managed
Postgres, PITR, a rehearsed restore — is untouched and now outside Release 1.
WorkOS auth and design remediation stay approved and unbuilt. The **workshop
prototype** (PR #45) is an in-memory demo under `prototype/`: a learning
artefact, not product code, and not a step toward WorkOS.

## Read order, fuller version moved from STATUS.md 20 Sep 2026

## Read order for a fresh session

1. This file
2. `2026-09-10-release-1-scope-reduction.md` — what Release 1 is now
3. `2026-09-10-release-1-lightspeed-readiness.md` — integration contract, proof
4. `2026-09-10-release-1-workshop-plan.md` — the package breakdown
5. `2026-08-31-business-plan.md` — ownership, the Jack/Mark split
6. `2026-09-06-tenant-scoping-and-pooler-safety.md` — the
   `DB_TENANT_SCOPE=transaction` checklist

Under `docs/decisions/`, bar the plan under `docs/superpowers/plans/`.

## Canonical commands, earlier version moved from STATUS.md 20 Sep 2026

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

## Carried open items, moved from STATUS.md 20 Sep 2026

**Carried, unchanged, and still open:** CI gating for `prototype` and the Python
runner; three tenant-isolation gaps confirmed ABSENT on `main` 9 Sep (no
composite tenant-consistent FKs, no privilege boundary on the resolver tables,
no idempotency key — `withRetry` can still double-create on a timeout); whether
`gateway` should wait for a healthy `app`; the five ownership queries needing
Mark. Full text and evidence: `.agents/ARCHIVE.md`.

## Operational traps, earlier version moved from STATUS.md 20 Sep 2026

## Operational traps

- **The app is on `localhost:8080`, not 4000.** Compose stops publishing the app
  port deliberately: `TRUST_PROXY=1` is only safe while the gateway is the sole
  entrance. 4000 refuses host connections.
- **Never delete the `cf-*` header names in `server/gateway.js`.** That is the
  strip list, not Cloudflare residue; removing it reintroduces a login
  brute-force bypass (14/14 spoofed IPs passed before PR #8, 11 blocked after).

## Plan register, earlier version moved from STATUS.md 20 Sep 2026

## Plan register

LOCKED: `2026-08-31-master-implementation-plan.md` — the arc, superseded where
its Release 1 sequencing conflicts with the 10 Sep reduction. Current: the
Release 1 workshop plan. Approved and unbuilt: the 2,880-line WorkOS migration,
design remediation. Executed plans and per-plan detail: `.agents/ARCHIVE.md`.

## Atlas revision detail, moved from STATUS.md 20 Sep 2026

**The journey atlas has been revised against Jack's review: 84 screens → 82.**
His export is committed at `docs/reviews/2026-09-17-release-1-screen-review-jack.md`
(71 approved, 13 noted) rather than living only in a browser. Phase 0 applied all
13 notes on 20 Sep: mechanic phone flow (10 screens) → one tablet `job-page`;
Code 128 tag instead of QR; a third appointment-only booking mode; diary and slot
picker following `public/app.js` and `public-portal/portal.js`; services grouped
by category; deposits left out. `check-notes.mjs` asserts each applied note.
**The PDFs and board PNG are stale** — rendered from the 84-screen version, and
WeasyPrint/PyMuPDF/Pillow are not installed here. **The barcode is a declared
non-scanning specimen**; Jack has a scanner from Mon 21 Sep, and a generated,
verified Code 128 replaces it in P00b.

## Read order, 20 Sep version moved from STATUS.md

## Read order for a fresh session

1. This file
2. The Phase 0 plan and the build design, named under **Phase plan** below
3. `docs/decisions/2026-09-10-release-1-scope-reduction.md` — what Release 1 is
4. `2026-09-10-release-1-lightspeed-readiness.md` — integration contract, proof
5. `2026-09-10-release-1-workshop-plan.md` — the package breakdown

Older entries (business plan, tenant-scoping checklist) moved to `ARCHIVE.md`.

## Phase 1 STATUS entry, superseded 20 Sep 2026

## Phase 1 — state machines, built

`server/workshop/state-machines.js` replaces the ambiguous single
`workshop_jobs.status` with seven machines (bookingRequest, custody, work,
quote, capacityHold, printTask, messageIntent) — 35 states, 48 transitions,
with `docs/design/workshop-states.md` generated from them. **No schema and no
endpoint changed**: `JOB_STATUSES` still governs the API, and
`readLegacyStatus` *reads* the old column rather than migrating it.

Phase 2 inherits one open question: **`readLegacyStatus('complete')` returns
`custody: null`**, because the old column never recorded whether a finished
bike went home. A test pins that open so no migration guesses it.

## Atlas paragraph, second version moved from STATUS.md 20 Sep 2026

**The journey atlas is revised: 84 screens → 82.** All 13 of Jack's notes
applied 20 Sep, each asserted by `check-notes.mjs`. PR #54, Mark told on #50.
Detail in `ARCHIVE.md`. Two carried: the tag barcode is a declared
**non-scanning specimen** until Jack's scanner (Mon 21 Sep), and the PDFs and
board PNG are **stale** — WeasyPrint/PyMuPDF/Pillow are not installed here.

## Operational traps, longer version moved from STATUS.md 20 Sep 2026

## Operational traps

- **The app is on `localhost:8080`, not 4000.** Compose stops publishing the app
  port deliberately: `TRUST_PROXY=1` is only safe while the gateway is the sole
  entrance.
- **Never delete the `cf-*` header names in `server/gateway.js`.** That is the
  strip list, not Cloudflare residue; removing it reintroduces a login
  brute-force bypass (14/14 spoofed IPs passed before PR #8, 11 blocked after).
- **Never hand-edit the atlas HTML.** It is generated by `package.py` from
  `screens.js` / `branches.js`; a hand edit is overwritten on the next run.
- **`npm run build` dirties tracked files** under `public/dist` with no app
  source change. Revert that churn; do not commit it.

## Release 1 scope paragraph, longer version moved from STATUS.md 20 Sep 2026

**Release 1 has a narrowed scope and a plan.** PR #51, 10 Sep.
`docs/decisions/2026-09-10-release-1-scope-reduction.md` is the live scope —
booking, diary, job cards, statuses, capacity, line-level quote approval,
messaging, printing and tags, one Lightspeed adapter. Invoicing, payments,
refunds, customer import, reports, group capacity and recovery are Later. It
**supersedes the #47 Hubtiger ranking**, now closed. The workshop plan is
packages P00–P09 over 154 of the original 172 rows, not yet split into issues.

## Decisions in force, longer version moved from STATUS.md 20 Sep 2026

## Decisions in force

Every decision is a file under `docs/decisions/`; the status summary table
moved to `.agents/ARCHIVE.md` on 20 Sep. The live scope is
`2026-09-10-release-1-scope-reduction.md`. Two remain undecided:
`2026-09-04-job-type-before-diary.md` (proposed) and the downtime model in
`2026-09-04-booking-mode-and-downtime.md`. Five decisions were added 20 Sep
and live in the Phase 0 plan's constraints: barcode-now-QR-later, the
appointment-only walk-in rule, deposits out of Release 1, the two-column
tablet job page, and services grouped by category.

