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
