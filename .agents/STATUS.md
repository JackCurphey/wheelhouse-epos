# STATUS — Wheelhouse EPOS

**Updated:** 2026-09-03
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

Pre-implementation. The platform decision is made and the research behind it is
close to complete, but no work plan is currently executing. Three designs are
approved and unbuilt.

## Provenance

This file replaces Mark's `.agents/STATUS.md` (`fa32b60`, 31 Aug, blob
`0eca91d3`). That version is still on nine unmerged branches, where it is
identical everywhere. A merge of any of them will **silently** keep this file
and drop Mark's with no conflict — so its live content was carried forward here
by hand rather than left to git. Recover the original with:
`git show fa32b60:.agents/STATUS.md`

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
3. **Architecture stage one** — set up, not started. Entry point, from a new
   branch with docker up: `Workflow({ name: 'wheelhouse-architecture-stage-1' })`.
   Commands are in `docs/superpowers/plans/2026-08-31-architecture-stage-1.md`.
4. **Formally decide the wedge.** `docs/decisions/2026-09-01-wedge-booking-vs-workshop.md`
   has been acted on since 1 September but its own status line says it was never
   formally decided.

## Done

24 PRs merged, #1-#29. Nothing here is removed when it ages — it moves to
`.agents/ARCHIVE.md`. Full list any time: `gh pr list --state merged -L 100`.

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

## Decisions in force

| Decision | Status |
|---|---|
| `2026-08-31-business-plan.md` | Decided, except lines marked OPEN |
| `2026-08-31-frontend-platform.md` | Decided (approver: Mark) |
| `2026-09-02-lightspeed-first-platform.md` | DECIDED by Jack, 2 Sep 2026 |
| `2026-09-02-r-series-sync-and-rate-limits.md` | Research complete, awaiting sign-off |
| `2026-09-01-wedge-booking-vs-workshop.md` | Proposed, acted on, **never ratified** |
| `2026-09-04-job-type-before-diary.md` | **Proposed 4 Sep, not decided** |
| `2026-09-04-booking-mode-and-downtime.md` | Booking mode + customer picker **DECIDED** (5 Sep); downtime model proposed |
| `2026-08-31-feature-catalogue.md` | Reference |

## Plan register

| Plan | Status |
|---|---|
| `2026-08-31-master-implementation-plan.md` | LOCKED — the arc |
| `2026-08-31-architecture-stage-1.md` | Set up, not started |
| `2026-09-05-booking-mode-foundations.md` | Written 5 Sep, not started |
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

**Last verified:** 187 tests, 187 pass, 0 fail, 11.9s — run locally on `main`
2026-09-03. CI (`.github/workflows/test.yml`) green on run `33674169347`.

## Open items needing Mark

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
4. **After stage one lands: repoint the `app` healthcheck** in
   `docker-compose.yml:62` at `/healthz`. Still open — it currently probes
   `http://localhost:4000/`, and `/healthz` is not defined in `server/` yet.
5. **Gate spacing / dates.** `2026-08-31-business-plan.md:583` — OPEN pending
   Mark's weekly time budget.

Mark's fifth item — `git reset --hard 8514727` on `design/workos-auth-migration`
— is **deliberately dropped as obsolete**, not lost. PR #29 put the plan on
`main`; see Housekeeping.

## Housekeeping, not urgent

- `origin/design/workos-auth-migration` (0dad2a4, 31 Aug) is the superseded
  pre-rebuild branch. Its content is safe: the 2,880-line plan and 760-line
  spec are both on `main`, byte-identical, merged via PR #29. Deleting the
  stale remote branch is a judgement call nobody has made.

## Keeping this file honest

Update it at every phase boundary and before ending a session. Hot-file cap is
8,000 bytes (`~/.claude/process/major-project.md`). When it grows past that,
trim by **moving**: anything no longer current to `.agents/ARCHIVE.md` (tracked
for exactly this reason — an ignored archive would make "move, never delete"
a synonym for delete), anything that is a decision to `docs/decisions/`.
