# Architecture stage one — corrective review

**Date:** 31 August 2026  
**Subject:** `docs/superpowers/plans/2026-08-31-architecture-stage-1.md` and
`.claude/workflows/wheelhouse-architecture-stage-1.js`  
**Verdict:** Proceed only after named engineering changes. Do not execute the
current isolation-design phase as written.

## Executive conclusion

The plan correctly identifies the session-scoped tenant setting, migration
race, missing network timeouts, missing shutdown handling, false health check,
missing restore plan, and stale README. Its proposed decision space for tenant
scoping is wrong in two important ways:

1. A transaction around an entire HTTP request is a worse operational design,
   even if all nested transactions are translated perfectly to savepoints.
2. `DISCARD ALL` cannot make session state safe through PgBouncer transaction
   pooling. The application should not support that pooling mode until it has
   short, explicit database-unit transactions.

The plan also misses existing isolation and durability gaps that are more
important than speculative PgBouncer support:

- Tenant-owned rows can reference another tenant's rows because most foreign
  keys use global `id` alone. PostgreSQL referential-integrity checks bypass
  RLS.
- The non-RLS resolver tables depend on every application query remembering
  manual tenant predicates; commit `5cdd4fd` proves this is not a durable
  boundary.
- Irreversible EPOS writes have no client idempotency key.
- Shopify webhook events are claimed before their work succeeds, so a retry
  can be skipped permanently after a processing failure.
- Network I/O holds database clients in more paths than the sale-completion
  path named by the workflow.

## Verified facts

- PostgreSQL in Compose is 16.13.
- `server/db.js:111` uses `set_config(..., false)`, which is session-scoped.
- The pool maximum is 10.
- There are 11 request transaction blocks: seven in `server/server.js` and
  four in `server/team.js`.
- There are two outbound `fetch()` implementations, in `server/shopify.js`
  and `server/sms.js`, with no abort signal. The Shopify helper is reached by
  multiple request paths.
- There are no SIGTERM/SIGINT handlers, crash guards, or database-backed
  health endpoint.
- Twenty-five tables have RLS both enabled and forced.
- Seven public tables lack RLS: `shops`, `logins`, `sessions`,
  `customer_logins`, `customer_sessions`, `uploaded_image_types`, and the
  non-tenant `schema_migrations` table.
- `auth.js:104` independently uses session-scoped `set_config(..., false)`
  inside `createShop`; the workflow's isolation build does not own that file.
- `pg-pool` has no configured checkout timeout. When all ten clients are busy,
  pending acquisition can wait without a bound.

### Nested transaction probe

On PostgreSQL 16.13, a second `BEGIN` inside an active transaction emitted:

```text
WARNING: there is already a transaction in progress
```

The following `COMMIT` committed the outer transaction. A later `ROLLBACK`
reported that no transaction was in progress, and both probe rows survived.
The original plan is correct about this failure mode.

### Cross-tenant foreign-key probe

In a rolled-back probe executed as `epos_app`:

1. A customer was inserted for tenant B.
2. `app.current_shop_id` was changed to tenant A.
3. A `customer_bikes` row was inserted for tenant A with B's `customer_id`.
4. PostgreSQL accepted it.

RLS checked the new bike row's `shop_id`; the global foreign key found B's
hidden customer because referential-integrity checks bypass row security.

## Required corrections

### 1. Do not wrap HTTP requests in transactions

`runWithShop` enters before route handlers read their bodies. Many handlers
also await Shopify or Twilio before returning. An outer request transaction
would therefore be open across slow client input, read-only work, response
construction, and external retries.

Savepoint translation fixes only the nested `BEGIN` syntax. It does not restore
the meaning of the existing inner `COMMIT`: releasing a savepoint leaves all
subsequent work inside the outer transaction. It also changes rollback
semantics for errors that currently occur after an explicit commit.

The stage-one design must instead:

- support direct PostgreSQL connections or PgBouncer session pooling only;
- keep current atomic database transactions short and explicit;
- use transaction-local tenant state inside every explicit transaction;
- clean session state before returning direct/session clients to the local
  `pg` pool, destroying a client if cleanup fails;
- add a bounded pool checkout timeout and pool-wait instrumentation; and
- record transaction pooling as unsupported until a later, measured need.

If transaction pooling becomes necessary, add an explicit
`withShopTransaction(shopId, fn)` primitive and migrate transaction boundaries
deliberately. Do not infer transaction semantics by parsing SQL strings.

### 2. Do not present `DISCARD ALL` as a transaction-pooling option

The connection layers are:

```text
request -> local pg Pool client -> PgBouncer client connection -> PostgreSQL server connection
```

In transaction mode, the current standalone `set_config()` query is one
transaction. PgBouncer may release that PostgreSQL connection immediately.
The next application query can receive a different backend with absent or stale
tenant state. By the end of the request, the contaminated backend may already
have served another client.

A later `DISCARD ALL` is therefore too late and is not guaranteed to reach the
backend that was contaminated. PgBouncer's own documentation says reset queries
are not normally run in transaction pooling because clients must not use
session features.

For direct PostgreSQL or session pooling, rollback abandoned work and reset
`app.current_shop_id` before local pool release. That is useful hygiene, but it
must not be described as transaction-pooling compatibility.

### 3. Size the direct pool before adding a pooler

For a pool of ten clients, the theoretical throughput ceiling per process is:

| Mean client lease | Ceiling before queueing |
|---:|---:|
| 50 ms | 200 requests/second |
| 100 ms | 100 requests/second |
| 250 ms | 40 requests/second |
| 5 seconds | 2 requests/second |
| 30 seconds | 0.33 requests/second |

The immediate bottleneck is lease duration, not the number of shops. Two or
three replicas with 20 direct connections each and short leases are likely to
cover hundreds of interactive shops, subject to measurement and the managed
database's connection budget.

Introduce PgBouncer transaction pooling only when all of the following hold:

- pool checkout wait is sustained under representative load;
- PostgreSQL still has CPU and I/O headroom;
- increasing direct pools would consume the usable connection budget; and
- the code has already moved tenant state into short explicit transactions.

A practical budget is:

```text
replicas * pool_max <= 70-80% of usable PostgreSQL connections
```

The remainder is needed for migrations, monitoring, administration, and
failure recovery.

### 4. Enforce tenant-consistent relationships in the schema

Every tenant-owned parent should expose a unique `(shop_id, id)` key. Tenant
relationships should use composite foreign keys, for example:

```sql
FOREIGN KEY (shop_id, customer_id)
  REFERENCES customers (shop_id, id)
```

Apply this systematically to relationships involving customers, bikes,
employees, products, sales, sale documents, workshop jobs, purchase orders,
suppliers, messages, attachments, and login/customer-login links.

Application pre-validation remains useful for friendly errors, but the schema
must reject cross-tenant relationships by itself.

### 5. Put a database privilege boundary around resolver tables

Pre-context token, email, and slug resolution is legitimate. Broad direct table
access is not the only way to implement it.

Revoke general access from the request role and expose a small set of hardened
`SECURITY DEFINER` functions, with a fixed safe `search_path`, for:

- resolving a staff or customer session to a tenant;
- verifying tenant-qualified login identities;
- resolving public shop slugs with a minimal result shape;
- creating and destroying sessions; and
- controlled account/shop creation.

Once a tenant has been resolved, use normal forced RLS for tenant-owned access.
Add adversarial tests for every function and keep the application role unable
to issue arbitrary queries against the underlying resolver tables.

`uploaded_image_types` is not currently a demonstrated brute-force leak: its
storage key has 192 random bits. It is a permanent bearer capability once the
URL leaks, however, and a one-year immutable cache prevents prompt revocation.
Record that as an explicit public-media policy and add ownership, deletion, and
abuse-response lifecycle rather than calling obscurity complete access control.

### 6. Repair external-side-effect correctness, not only timeouts

Timeouts on the two funnelled `fetch()` calls are correct and small. The
workflow must also remove database leases from every network path, not only the
sale-completion loop.

Add:

- a client-generated idempotency key, unique per shop, for sale and other
  irreversible mutation endpoints;
- an RLS-protected database outbox committed with outgoing Shopify state
  changes;
- processing of that outbox outside the originating HTTP request's database
  lease; and
- retryable inbound Shopify event states, where `claimed` is distinct from
  `completed` and an error can be reclaimed safely.

The existing claim-before-work sequence can permanently drop an order or
refund: the first attempt inserts the unique event row, processing fails, and
the retry observes the conflict and returns without processing.

### 7. Reorder stage one

The frontend platform decision remains approved, but the scaffold is not a
dependency of the isolation work and its caching change is not free. It changes
server cache behavior, Docker construction, CI, and the frontend dependency
tree.

Use this order:

1. Prohibit transaction pooling and harden current tenant cleanup.
2. Add tenant-consistent foreign keys and resolver-table privilege boundaries.
3. Establish managed PostgreSQL, PITR, and a successful restore drill.
4. Add migration serialization, idempotency/outbox behavior, pool backpressure,
   and network timeouts.
5. Add graceful shutdown and deployment health wiring.
6. Correct documentation.
7. Land or continue the frontend scaffold independently.

The database-backed probe should be readiness, not liveness. A shared database
outage should remove an app replica from routing; it should not make every
replica restart continuously. The stage is incomplete until deployment config
actually points at the new readiness endpoint.

## RLS scalability assessment

There is no evidence of a performance cliff at hundreds of shops. The current
policy is a direct equality against a denormalized `shop_id`, which is the
simplest RLS shape. PostgreSQL marks `current_setting()` stable and can use it
in index conditions.

Instrument now:

- local pool checkout latency and `waitingCount`;
- active and `idle in transaction` counts and oldest transaction age;
- `pg_stat_statements` latency, rows, and buffer reads;
- `EXPLAIN (ANALYZE, BUFFERS)` on a realistic, skewed 300-shop dataset;
- plans that filter large row counts instead of using a `shop_id` index
  condition; and
- dead tuples, autovacuum lag, and table/index bloat.

Do not weaken RLS or partition per tenant pre-emptively. Change the storage
shape only after those measurements show a real table-size, skew, or maintenance
problem.

## Recommendations that remain sound

- Add a session-level advisory lock around migration discovery and execution.
- Add explicit timeouts to the two outbound fetch helpers.
- Add bounded graceful shutdown and log fatal process errors before exiting
  non-zero.
- Move to managed PostgreSQL with PITR and rehearse a restore.
- Rewrite stale documentation.

These items should be retained, but they do not compensate for the isolation,
idempotency, or connection-lifecycle corrections above.

## Evidence and primary references

- PostgreSQL `BEGIN` behavior:
  <https://www.postgresql.org/docs/16/sql-begin.html>
- PostgreSQL function volatility and index scans:
  <https://www.postgresql.org/docs/16/xfunc-volatility.html>
- PostgreSQL row security and referential-integrity bypass:
  <https://www.postgresql.org/docs/16/ddl-rowsecurity.html>
- PgBouncer pooling and reset-query semantics:
  <https://www.pgbouncer.org/config.html>

## Evidence still required before final pool sizing

- Peak and sustained request rate by endpoint.
- Pool checkout latency and lease-duration distributions.
- Shopify and Twilio latency distributions, including retry duration.
- Managed PostgreSQL tier and usable connection limit.
- Tenant data-size distribution, including the largest expected shop.
- A representative load test and restore drill.
