# Wheelhouse EPOS — Status

**Last updated:** 31 August 2026
**Branch:** `docs/business-research` (commit `2a9fd86`) — committed, **not pushed**
**Session ended:** context budget ceiling. Resume in a fresh session.

---

## Where this stands

Two pieces of work happened, both research/review. **No production code was changed.**
The working tree is clean and `master` is untouched.

### 1. Full code review (complete)
Findings live in `~/Desktop/Wheelhouse-EPOS-Code-Review.pptx` (10 slides).

**Verified by running the code, not by reading it:**
- Tests: **66/66 pass** in 455ms against real Postgres. Suite is healthy; three
  prerequisites are undocumented (`npm install` → `DATABASE_URL` → `docker compose up`
  + `npm run migrate`).
- Tenant isolation **holds**: 25 tables RLS-enabled and FORCEd, cross-shop reads
  return zero rows, cross-shop writes rejected with `42501`.

**Critical, unfixed:** cross-tenant staff account takeover. `server/team.js:165/173/182`
update `logins` filtered on id alone; routes at `server/server.js:2676/2688` check only
`ctx.login.is_owner`. **A working two-shop exploit was demonstrated over HTTP** — both
lockout and re-enable returned HTTP 200. Fix: thread `shopId` through team.js and add
`AND shop_id = ?`, matching the pattern `attachLogin` already uses.

**Also unfixed:** `docker/init-db.sh` is committed mode `100644` (not executable), so the
Postgres bootstrap silently fails while the container reports healthy. `git update-index
--chmod=+x docker/init-db.sh`.

### 2. Business and market research (complete)
Committed this branch at `research/business/`:
- `business-research.md` — the evidence base, ~6,700 words
- `strategy.md` — recommendations

Same content also on Desktop, plus `Wheelhouse-EPOS-Strategy.pptx` (14 slides).

---

## Next actions

**Immediate, small, no dependencies:**
1. Fix the cross-tenant login vulnerability (write the regression test first — watch it fail)
2. `chmod +x docker/init-db.sh`
3. Add CSV export — unblocks the anti-lock-in pitch and inbound migration
4. Rewrite README (it still describes SQLite; the app is Postgres) and the Shopify
   onboarding docs (custom-app creation moved to Shopify's Dev Dashboard on 1 Jan 2026)
5. Add CI running `npm test` — nothing has ever gated a merge

**Three phone calls, no engineering needed first:**
6. **Duda** — three questions that decide buy-vs-build on the storefront: is there an API
   to attach a *primary* custom domain? Does their domain purchase cover `.co.uk`? Volume
   pricing above the White Label tier?
7. **Madison** — open the trade account now (credit review takes time). Seven questions in
   business-research.md §4.3.
8. **TrueCommerce** — 30 minutes: is there a standard export a distributor can switch on?

---

## Read before trusting anything in the research

`business-research.md` **§11 is a corrections log** — ten findings changed during the work,
including a Citrus-Lime price that was fabricated by a competitor and repeated as fact, and
a workshop demand signal whose source was never actually readable. Every claim carries a
confidence tag. Check it before quoting.

**Known gaps, recorded as gaps:** Reddit was unreachable in every pass; no vendor DPA/ToS
has been read; the per-supplier SIM licence price is published nowhere.

---

## Housekeeping

- Branch `docs/business-research` is committed but **not pushed** — no PR opened.
- Three remote branches are fully merged with zero unique commits and are safe to prune:
  `origin/storefront-preview`, `origin/worktree-shopify-checkout`,
  `origin/worktree-storefront-framework`.
- `docs/superpowers/plans/` holds **103 unchecked steps describing work that is already
  built**. A fresh session will read them as open and re-implement. Tick or archive them.
- Minor: the committed copy of `business-research.md` still refers to companion files by
  their Desktop paths rather than repo paths. Cosmetic.
