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
