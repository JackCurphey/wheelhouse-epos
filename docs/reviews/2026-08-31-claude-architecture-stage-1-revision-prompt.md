# Prompt: revise architecture stage one after corrective review

Give everything after the horizontal rule to Claude in a fresh session at the
repository root.

---

You wrote the Wheelhouse EPOS architecture stage-one plan and workflow. An
independent review found load-bearing engineering errors and omissions. Update
your work from the evidence; do not defend the previous plan and do not merely
append caveats.

## Your task

Revise these two files:

- `docs/superpowers/plans/2026-08-31-architecture-stage-1.md`
- `.claude/workflows/wheelhouse-architecture-stage-1.js`

Read the full corrective review first:

- `docs/reviews/2026-08-31-architecture-stage-1-review.md`

Also re-read the actual code and migrations it cites. Independently verify any
line numbers that moved.

This is a **plan and workflow revision only**. Do not implement production code,
run the workflow, commit, merge, or push. Preserve unrelated user changes.

## Fixed product and platform decisions

- Wheelhouse is heading toward hosted multi-tenant SaaS for hundreds of bike
  shops in 12–18 months.
- PostgreSQL forced RLS remains the primary tenant row-visibility boundary.
- Do not weaken RLS or replace it with application-only `WHERE shop_id` rules.
- The server remains plain JavaScript using Node `http` and `pg` as its only
  runtime dependency.
- The approved React/Tailwind/shadcn frontend platform decision remains valid,
  but the scaffold is not an architectural prerequisite for data-safety work.

## Corrections you must incorporate

### 1. Remove request-wide transactions from the design space

Do not wrap an entire HTTP request in `BEGIN`/`COMMIT`, with or without
savepoints. `runWithShop` enters before handlers read bodies, and handlers can
await Shopify or Twilio. An outer transaction would remain open across client
input, read-only work, external retries, and response construction.

Do not claim a `dbExec()` savepoint shim preserves semantics without changing
the 11 call sites. It can translate syntax, but an existing inner `COMMIT`
would only release a savepoint and all later work would remain in the outer
transaction.

### 2. Do not support PgBouncer transaction pooling in stage one

The pool size of ten is a local application setting, not proof a pooler is
needed. Stage one must explicitly support only:

- direct managed PostgreSQL connections; or
- PgBouncer session pooling.

State that transaction pooling is unsupported and must fail deployment review
until measured connection pressure justifies it and the application has short,
explicit database-unit transactions.

Include the connection-budget trigger:

```text
replicas * pool_max <= 70-80% of usable PostgreSQL connections
```

Require measurement of checkout latency, lease duration, queue depth, database
CPU/I/O, and managed-database connection limits before adding PgBouncer.

### 3. Correct the `DISCARD ALL` analysis

Do not present `DISCARD ALL` or `RESET` after local `pg` pool release as a fix
for PgBouncer transaction pooling. In that mode, the standalone
`set_config(..., false)` query can release its PostgreSQL backend before the
next statement in the same request. A later reset can hit a different backend
and is already too late.

For direct/session pooling, require safe cleanup before local pool release:
rollback abandoned transactions, reset `app.current_shop_id`, and destroy the
client if cleanup fails. Describe this only as direct/session-pool hygiene.

Include `server/auth.js` in the isolation work: `createShop` also uses
`set_config(..., false)` inside an explicit transaction and should use
transaction-local state. Search for every runtime `set_config` call rather than
assuming `db.js` is the only one.

### 4. Add structural tenant relationship enforcement

The review demonstrated that tenant A can insert a tenant-A row referencing
tenant B's hidden row because foreign keys use global `id` alone and PostgreSQL
referential-integrity checks bypass RLS.

Add a schema-design and migration task that:

- adds unique `(shop_id, id)` keys to tenant-owned parents;
- converts tenant relationships to composite foreign keys such as
  `(shop_id, customer_id) -> customers(shop_id, id)`;
- covers all tenant relationships, not a hand-picked subset;
- retains application pre-validation only for user-friendly errors; and
- proves cross-tenant references fail at the database boundary.

The migration must be designed for existing data and repeatable deployment.
Require an audit query before constraints are validated and use a safe
add/backfill/validate sequence where necessary.

### 5. Add a database privilege boundary for non-RLS resolver tables

Do not accept “queried before tenant context exists” as sufficient protection.
Keep legitimate pre-context resolution but remove broad direct table access
from the normal request role.

Design narrowly scoped, hardened `SECURITY DEFINER` functions with a safe fixed
`search_path` for session, login, shop-slug, and controlled account lifecycle
operations. Revoke underlying table privileges from the normal app role and add
adversarial tests. Account for staff and customer auth.

Treat `uploaded_image_types` accurately: a 192-bit random storage key makes
brute-force discovery implausible, so do not invent a demonstrated leak. It is
nevertheless a bearer capability with weak revocation because responses are
immutable for one year. Add an explicit ownership, deletion, and abuse-response
decision rather than calling the current design complete.

### 6. Repair external-side-effect boundaries

Keep explicit `AbortSignal.timeout()` on the two funnelled fetch helpers, but
reduce its prominence: it is a small implementation task.

Do not limit client-release work to sale-completion Shopify pushes. Find every
path that awaits Shopify or Twilio while inside `runWithShop` and design a short
database/network/database lifecycle as appropriate.

Add stage-one tasks for:

- client-generated, per-shop idempotency keys on irreversible POS mutations,
  especially sale completion;
- an RLS-protected database outbox for outgoing Shopify work;
- processing outbox work outside the originating request's database lease; and
- retryable inbound Shopify event states where claim, completion, and failure
  are distinct.

The existing `shopify_processed_events` sequence can drop an event permanently:
the claim row commits, processing fails, and the retry conflicts and skips the
work. The revised plan must fix that concrete sequence.

### 7. Add pool backpressure and instrumentation

The current `pg` pool has no checkout timeout. Add a bounded
`connectionTimeoutMillis`, request failure behavior, and instrumentation for:

- `waitingCount`, `totalCount`, and `idleCount`;
- checkout latency and client lease duration;
- active and idle-in-transaction age; and
- per-endpoint latency around database and external phases.

Do not choose the new `max` value without a load-test task and an explicit
managed-database connection budget.

### 8. Correct lifecycle and health semantics

Keep bounded SIGTERM/SIGINT drain and fatal-error logging followed by non-zero
exit.

Separate readiness from liveness:

- readiness queries PostgreSQL and controls whether the replica receives
  traffic;
- liveness reports whether the process event loop is functioning and must not
  cause every app replica to restart during a shared database outage.

Do not call the health ceiling closed until Docker/deployment configuration
actually uses the new endpoint. Remove the instruction that leaves Compose
wiring for an unspecified later human step.

### 9. Reorder the work

Use this priority unless code inspection proves a dependency requires a small
adjustment:

1. Prohibit transaction pooling and harden tenant-state cleanup.
2. Enforce tenant-consistent foreign keys and resolver-table privileges.
3. Establish managed PostgreSQL, PITR, and a completed restore drill as a
   deployment gate, even though automation cannot perform the infrastructure
   work.
4. Add migration locking, idempotency/outbox behavior, pool backpressure, and
   network timeouts.
5. Add graceful shutdown and correctly wired readiness/liveness.
6. Correct documentation.
7. Treat the frontend scaffold as independent, not a prerequisite.

If the scaffold is already merged on the branch you inspect, state that the
sequencing issue is historical and do not try to undo it.

### 10. Preserve the parts that were sound

Keep, with proportionate scope:

- a session advisory lock covering the migration run;
- timeouts on both outbound fetch helpers;
- managed PostgreSQL with PITR and a rehearsed restore;
- bounded graceful shutdown and fatal crash logging; and
- an accurate README.

## Workflow requirements

Revise the workflow task ownership and ordering to match the new plan. In
particular:

- Do not allow a design agent to choose request-wide transactions or
  transaction pooling compatibility.
- Include every file that contains runtime tenant setting, including
  `server/auth.js`.
- Give schema isolation changes a single coherent owner; do not let parallel
  agents edit overlapping migrations or database-role setup.
- Separate database schema/privilege work from route lifecycle work.
- Keep external I/O and idempotency/outbox changes under one design owner so
  the commit/side-effect boundary is coherent.
- Make infrastructure gates report `blocked/not completed`, never `done`, when
  PITR or restore rehearsal has not actually happened.
- Preserve adversarial verification, but add concrete attacks for composite
  foreign keys, direct access to resolver tables, duplicate sale retries, and
  retry of failed Shopify events.
- Keep test mutation checks only where they add confidence; do not let workflow
  ceremony dominate the engineering work.

## Acceptance criteria for your revision

Your response is complete only when:

1. Both plan and workflow files are updated.
2. Neither file recommends or permits a request-wide transaction.
3. Transaction pooling is explicitly unsupported for stage one.
4. `DISCARD ALL` is described only as direct/session cleanup, not a transaction
   pooling fix.
5. `auth.js` and every runtime `set_config` site are in scope.
6. Composite tenant foreign keys and resolver privilege boundaries are planned
   with executable verification.
7. Sale idempotency, outgoing outbox processing, and retryable incoming Shopify
   events are covered.
8. Pool checkout timeout and measurements precede any pool-size or pooler
   decision.
9. Readiness and liveness have distinct semantics and deployment wiring.
10. Frontend work is not presented as a prerequisite for data-safety work.
11. The revised plan clearly distinguishes automated code work, infrastructure
    gates, and decisions still requiring the owner.

After editing, report:

- the engineering decisions you removed or reversed;
- the new tasks and their order;
- the files changed;
- any factual disagreement with the corrective review, supported by code or a
  reproducible PostgreSQL probe; and
- anything that remains blocked on traffic data, provider limits, or owner
  decisions.
