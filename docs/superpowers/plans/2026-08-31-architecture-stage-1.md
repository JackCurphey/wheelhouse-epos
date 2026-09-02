# Architecture stage one — work plan

**Status:** set up, not started. Run it from a fresh session.
**Workflow:** `.claude/workflows/wheelhouse-architecture-stage-1.js`
**Source:** the architecture review of 31 August 2026 (ceilings 1–7).

## How to start it

**Merge PR #9 first if you can.** It carries the frontend scaffold, and with it
the `build`, `lint`, `typecheck` and registry gates. Without it those scripts do
not exist and the verifier will report them as not-run. The workflow handles
both cases and says which gates were present, but you get better coverage after
#9 lands.

From a fresh session in this repo, on a new branch off `master`:

```
git checkout master && git pull --ff-only
git checkout -b feat/architecture-stage-1
docker compose up -d --wait
```

Then invoke the workflow by name:

```
Workflow({ name: 'wheelhouse-architecture-stage-1' })
```

It runs nine agents across five phases and leaves everything uncommitted in the
working tree. Watch it with `/workflows`.

## What it does

| # | Ceiling | Phase | Owns |
|---|---|---|---|
| 1 | Pooler trap — `set_config` is session-scoped | design, then build | `db.js`, `server.js`, `team.js` |
| 2 | Migrations race with no lock | independent | `run-migrations.js` |
| 3 | No timeout on any outbound fetch | independent | `shopify.js`, `sms.js` |
| 3b | DB client held across Shopify pushes | lifecycle | `server.js` |
| 4 | No SIGTERM drain, no crash guard, fake health check | lifecycle | `server.js` |
| 7 | README describes a system that no longer exists | independent | `README.md` |

**Ceiling 5 (managed Postgres with PITR and a rehearsed restore) is deliberately
excluded.** It is infrastructure, not code, and no agent can do it. The
completeness critic is told to confirm it was left alone rather than counting it
as done. It still needs doing, by a human, and the restore drill matters more
than the backup.

## Why there is a design phase

The obvious fix for the pooler trap is `is_local=true` plus wrapping each request
in a transaction. That would silently break the app.

There are **11 explicit transaction blocks already running inside
`runWithShop`** — 7 in `server/server.js` (sales, purchase orders and others)
and 4 in `server/team.js`. Postgres does not error on a nested `BEGIN`; it emits
`WARNING: there is already a transaction in progress` and does nothing, after
which the inner `COMMIT` commits the *outer* transaction. A naive wrap therefore
collapses all 11 boundaries: a later `ROLLBACK` rolls back nothing, and a
failure after an inner `COMMIT` leaves partially committed data. On the
sale-completion path that means stock movements and payments diverging from the
sale.

So phase two designs the approach — savepoints, session reset on release, or
per-statement scoping — and phase three implements what it chose. The build
agent is told to stop and report rather than improvise if the design turns out
wrong in the code.

## Verification built in

Every agent must follow test-first *and prove the test works*: watch it fail for
the right reason, implement, then break the implementation on purpose, confirm
the mutation actually landed, and watch the test catch it. The report schema has
required fields for the red output, the green output and the mutation output, so
a stage cannot quietly skip it.

Three verifiers run at the end, on different lenses:

1. **Independent re-run** — runs every command itself and checks nothing
   user-visible changed. Explicitly told that a stage reporting success is not
   evidence, and to treat a claimed-but-absent test as a blocker.
2. **Cross-tenant attacker** — tries to prove one shop can reach another's data.
   Aimed at the tables with no RLS (`shops`, `logins`, `sessions`,
   `customer_logins`, `customer_sessions`, `uploaded_image_types`), which are the
   one place application code must remember shop scoping by hand — and which
   already failed once, in `5cdd4fd`.
3. **Completeness critic** — what was missed, what is a facade, what new problems
   a transaction-scoping change introduced (double-released or leaked clients).

The last run of a workflow in this repo returned **broken** with six blockers,
and two of its gates were vacuous on first test. That is the expected and useful
outcome. Read the verdicts before trusting anything.

## Guardrails

The shared briefing forbids agents from running `git clean`, `checkout`,
`switch`, `stash`, `reset`, `commit`, `merge` or `push`. An earlier workflow run
destroyed an untracked directory in this repo. It also forbids touching
`package.json` or installing anything — `pg` stays the only runtime dependency.

## After it finishes

Read the three verdicts first, fix blockers, then commit and open a PR. CI runs
on pull requests and covers typecheck, lint, build, registry validate, registry
drift, RLS coverage, the suite, and migration idempotency.

Two things a human still owns afterwards:

- Repoint the `app` healthcheck in `docker-compose.yml` at `/healthz`. The
  workflow adds the endpoint but is told not to edit compose.
- Ceiling 5: managed Postgres, PITR, and a restore you have actually performed.
