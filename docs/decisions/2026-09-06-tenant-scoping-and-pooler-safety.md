# Tenant scoping, pooler safety, and what must happen before the flag flips

**Date:** 6 September 2026
**Status:** **DECIDED** — two decisions by Jack, recorded below. The rest of this
document is a record of what was built, what it proves, and what it does not.
**Affects:** `server/db.js`, `server/server.js`, `server/auth.js`, and anyone choosing
the production database topology.
**Source:** architecture stage one, branch `feat/architecture-stage-1`.

This file exists because its contents were produced in a gitignored agent workspace
that gets deleted when that work finishes. The checklist in §3 is the only written
statement of what must change before `DB_TENANT_SCOPE=transaction` can be turned on,
and losing it would leave a switch in the codebase that looks flippable and is not.

## 1. What changed

`runWithShop` set the tenant with `set_config('app.current_shop_id', $1, false)` —
session-scoped. Correct while each request holds one dedicated client start to finish.
Dangerous the moment a transaction-mode connection pooler sits in front: the setting
outlives the transaction on a shared backend and the next tenant's transaction can
inherit it. A cross-tenant leak caused by an infrastructure change that never touches
application code.

The naive fix — `is_local=true` plus wrapping every request in a transaction — would
have broken the app. Eleven explicit transaction blocks already run inside
`runWithShop` (seven in `server.js`, four in `team.js`). Postgres does not error on a
nested `BEGIN`; it warns and does nothing, after which the inner `COMMIT` commits the
outer transaction, collapsing all eleven boundaries.

So `dbExec` became savepoint-aware and the eleven call sites were left untouched. A
request-wide transaction exists behind `DB_TENANT_SCOPE`, which **defaults to
`session`** — today's behaviour. What actually shipped is that default, plus a tenant
reset before any client returns to the pool, plus a boot-time pooler probe.

## 2. Decisions

**2.1 The pooler guard hard-fails. Decided by Jack, 6 September 2026.**
If the boot probe detects a shared-connection pooler while `DB_TENANT_SCOPE=session`,
the server refuses to start rather than warning and continuing.
`POOLER_GUARD_ON_UNSAFE = 'fail'` in `server/db.js` is therefore a recorded decision,
not a default. Jack's reasoning: *"customer data security is paramount"* — a
cross-tenant exposure is worse than downtime. One word changes it; do not change it
without replacing this record.

**2.2 The pool error handler was fixed on this branch. Decided by Jack, 6 September 2026.**
`server/db.js` had no `pool.on('error')`, so a dying idle connection — a Postgres
restart, a failover, a load balancer reset — threw unhandled and killed the whole
shared process. Pre-existing: Node's default for an uncaught exception was also
exit(1), so the crash guard added in this same stage changed the crash from
unexplained to logged, not from absent to present. Offered as a separate task; Jack
chose to fix it here.

## 3. Before `DB_TENANT_SCOPE=transaction` can be enabled

Three handlers do work AFTER their `COMMIT` and still inside the `try` whose `catch`
issues the `ROLLBACK`. Under session mode that `ROLLBACK` no-ops at depth 0 and none
of this matters. Under transaction mode it runs at depth 1 and discards work that
appeared to commit:

| Site | Location | What runs after COMMIT inside the try |
|---|---|---|
| 4 | `server/server.js:1618-1623` (`createSale`) | Shopify inventory pushes |
| 1 | `server/server.js:812-813` (PO create) | post-commit statements |
| 5 | `server/server.js:1876-1879` (`POST /api/sale-documents`) | two `db.prepare` reads and a `sendJson` |

`server/server.js:1982-1990` (site 6, same route family) is the shape to copy: its
post-commit reads sit outside the `try`. None of the three was restructured, because
the flag is off and rewriting live sale routes was out of scope — not because they
were missed.

Also required first, from the original design: `pushInventoryLevel`, `sendSms`,
`readJsonBody` and the storefront static/stream branch must move outside the
`runWithShop` scope, and the response write must happen after the commit rather than
before it. Until then, enabling transaction mode means telling a customer a sale
succeeded before it is committed.

## 4. What the tests prove, and what they do not

Recorded because both were originally claimed wrongly, and the correct version is
less flattering.

**The sale-rollback test cannot prove rollback works.** It forces failure with a
statement error, which aborts the transaction before the site's own `ROLLBACK` runs —
and Postgres treats `COMMIT` on an aborted transaction as a rollback. Measured, not
argued: with a mutation making a top-level `ROLLBACK` issue `COMMIT` instead, the test
still passed. **No mutation of the rollback path can fail it.** What it proves is that
every write in the sale path sits inside one boundary. Rollback semantics rest on the
`dbExec` shim tests, where removing `ROLLBACK TO SAVEPOINT` does drive real failures.

**The pooler probe cannot prove a topology is safe.** An `unsafe` result is proof: a
session variable crossing between clients has no innocent explanation. A `safe` result
means only that this probe did not observe sharing on this sample. PgBouncer in
transaction mode with `pool_size > 1` can hand every probe client a different backend,
and the probe runs at boot when a pooler is most idle and most able to do so. Raising
the client count narrows the gap; nothing short of knowing the deployment closes it.
Treat `safe` as "no evidence of a transaction-mode pooler", never as "verified direct
connection".

## 5. Still open, for Jack

1. **The production topology.** PgBouncer session mode (safe today, does not lift the
   connection ceiling much) vs transaction mode (lifts it, requires §3 first) vs a
   larger managed pool. This decision is what the whole change exists to prepare for.
2. **Whether commit-after-response is ever acceptable** if transaction mode is enabled
   before the §3 refactor. The design's view, and the reviewers': not on the sale path.
3. **Repoint `docker-compose.yml`'s healthcheck at `/healthz`.** It still GETs `/`,
   which serves `index.html` off disk and passes with Postgres down. Deliberately left
   for a human by every task that touched it.
