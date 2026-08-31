export const meta = {
  name: 'wheelhouse-architecture-stage-1',
  description: 'Close the six stage-one architecture ceilings: pooler trap, migration lock, fetch timeouts, lifecycle, health check, README',
  whenToUse:
    'Run once on a fresh branch off master to execute architecture stage one from the Wheelhouse architecture review. Design-first: the tenant-isolation change is spiked before it is implemented.',
  phases: [
    { title: 'Independent fixes', detail: 'advisory lock, fetch timeouts, README - disjoint files, safe in parallel' },
    { title: 'Isolation design', detail: 'spike the transaction-scoping change; propose, do not implement' },
    { title: 'Isolation build', detail: 'implement the chosen design across db.js, server.js, team.js' },
    { title: 'Lifecycle', detail: 'SIGTERM drain, crash guard, /healthz, release client before Shopify pushes' },
    { title: 'Verify', detail: 'independent re-run, adversarial cross-tenant attack, completeness critic' },
  ],
}

// ---------------------------------------------------------------------------
// Shared briefing. Every agent gets this.
// ---------------------------------------------------------------------------

const SHARED = `
You are working in the Wheelhouse EPOS repo at /Users/curphey/Documents/Github/wheelhouse-epos.

WHAT THIS SYSTEM IS
A multi-tenant bike-shop EPOS heading for a hosted SaaS at hundreds of shops.
Plain Node http server, no framework. PostgreSQL. \`pg\` is the ONLY runtime
dependency and must stay that way. Tenant isolation is enforced by Postgres
Row-Level Security, not application code: every shop-scoped table has a
shop_id defaulted from current_setting('app.current_shop_id') and a policy
filtering on it. 25 tables have RLS both ENABLED and FORCED (FORCE matters -
epos_app owns every table and owners bypass unforced RLS).

HOW A REQUEST WORKS TODAY
server/db.js \`runWithShop(shopId, fn)\` checks out ONE pooled client for the
whole request, runs
    SELECT set_config('app.current_shop_id', $1, false)
on it, and stores it in an AsyncLocalStorage that prepare()/dbExec() read. The
pool max is 10.

THE RULES - these are not negotiable
1. NEVER run \`git clean\`, \`git checkout\`, \`git switch\`, \`git stash\`,
   \`git reset\`, \`git commit\`, \`git merge\` or \`git push\`. A previous run of a
   workflow in this repo destroyed an untracked directory; do not repeat it.
   Leave your changes in the working tree, uncommitted.
2. Touch ONLY the files your task says you own. Another agent owns everything
   else and your edits there will be lost or will conflict.
3. Do NOT modify package.json, package-lock.json, or install anything. \`pg\`
   stays the only runtime dependency.
4. server/ is plain JavaScript. Do not convert anything to TypeScript.
5. TEST FIRST, and prove the test works:
   a. Write the failing test. Run it. WATCH IT FAIL for the right reason and
      paste that real output.
   b. Implement. Run it again. Paste the passing output.
   c. Break the implementation on purpose, re-run, confirm the test catches it,
      restore. Paste that output too, and confirm your mutation actually
      landed (grep for it) - a no-op edit makes a test look sound while
      proving nothing.
   A test that still passes when you break the code it covers is not testing
   that code.
6. Never claim something works without having run it and seen the output.
7. Do not change anything user-visible. No UI or visual changes.

ENVIRONMENT
Postgres runs under docker compose (host port 5433); .env holds DATABASE_URL and
server/load-env.js loads it. \`npm test\` runs the node:test suite against it.
There is also CI: .github/workflows/test.yml, which runs typecheck, lint, build,
registry validate, registry drift, an RLS coverage assertion, the suite, and a
migration idempotency check. Do not break any of them.

Report concisely: what you changed, the real commands you ran with their real
output, and anything you could not finish or that needs a human decision.
`

const REPORT = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'filesChanged', 'commandsRun', 'testEvidence', 'problems'],
  properties: {
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    commandsRun: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['command', 'exitOk', 'output'],
        properties: {
          command: { type: 'string' },
          exitOk: { type: 'boolean' },
          output: { type: 'string' },
        },
      },
    },
    testEvidence: {
      type: 'object',
      additionalProperties: false,
      required: ['redOutput', 'greenOutput', 'mutationOutput', 'mutationLanded'],
      properties: {
        redOutput: { type: 'string', description: 'Real output of the test failing BEFORE implementation' },
        greenOutput: { type: 'string', description: 'Real output of it passing after' },
        mutationOutput: { type: 'string', description: 'Real output when you deliberately broke the code' },
        mutationLanded: { type: 'boolean', description: 'Did you grep and confirm the mutation edit actually applied?' },
      },
    },
    problems: { type: 'array', items: { type: 'string' } },
  },
}

// ---------------------------------------------------------------------------
// Phase A - independent fixes (disjoint files) + Phase B design, concurrently.
// ---------------------------------------------------------------------------

phase('Independent fixes')

const INDEPENDENT = [
  {
    label: 'migration-advisory-lock',
    prompt: `YOUR TASK - make migrations safe to run from more than one process.

YOU OWN: server/migrations/run-migrations.js and a new test file under tests/.

Today every process start calls runMigrations(), which reads schema_migrations
and applies whatever is missing. Two replicas booting together both see the
same unapplied file and both try to run it. One wins; the other throws, and a
migration failure exits the process - so that replica can crash-loop, possibly
against a half-advanced schema. This blocks running more than one app process,
which is the whole point of the hosted deployment.

Wrap the entire migration run in a Postgres advisory lock (pg_advisory_lock
with a fixed, documented key) so a second process waits rather than racing.
Release it in a finally block. Keep the existing behaviour otherwise: filename
order, the schema_migrations table, per-file transactions, and the loud failure
on error.

Prove it with a test that actually demonstrates serialisation - e.g. hold the
advisory lock on one connection, confirm a concurrent runMigrations() blocks
rather than proceeding, then release and confirm it completes. Follow the
test-first sequence in the rules, including the mutation step.

Also confirm \`npm run migrate\` twice in a row still passes (CI asserts this).`,
  },
  {
    label: 'fetch-timeouts',
    prompt: `YOUR TASK - put a timeout on every outbound network call.

YOU OWN: server/shopify.js, server/sms.js, and new/updated test files under
tests/ for those two modules ONLY. Do NOT edit server/server.js - a later
agent owns it.

There is currently no AbortSignal or fetch timeout anywhere in server/. Combined
with a retry helper (withRetry, 3 attempts with 0.5s then 1s backoff) and the
fact that a pooled Postgres client is held for the whole request, a slow Shopify
endpoint can pin one of only ten database connections for minutes. Ten
concurrent product saves during a Shopify slowdown stalls every shop's till.

1. Find EVERY outbound call site yourself (grep for fetch( across server/) -
   do not assume the list is just the ones named above.
2. Give each one an explicit AbortSignal.timeout(). Choose a defensible value
   and say why in a comment; a webhook registration can afford longer than an
   inventory push. Make the timeout a named constant, not a magic number.
3. Make sure a timeout is handled the same way the code already handles a
   failed call - it must not become a new unhandled rejection path, and it
   must still mark the connection sync_error where that is the existing
   behaviour.
4. Check how withRetry interacts: a timeout should be retryable, but the total
   worst-case time across all attempts must be bounded and stated in a comment.

Test it. A fake slow endpoint that never responds must cause a bounded failure
rather than hanging. Follow the test-first sequence including the mutation step.`,
  },
  {
    label: 'readme',
    prompt: `YOUR TASK - rewrite the README so it describes the system that exists.

YOU OWN: README.md. Nothing else.

The opening sections are badly stale and actively mislead. They claim the app
uses "Node's built-in SQLite", needs "no internet connection or npm install",
and stores data as "one file per shop under data/shops/". None of that has been
true since the Postgres migration. Someone new starts from a false model of the
single most important thing in the system - how tenant data is isolated.

Read the repo and describe what is actually there:
- PostgreSQL with Row-Level Security as the isolation boundary, and why the app
  connects as the non-superuser epos_app role (superusers bypass RLS).
- Docker Compose: three services, the 5433 host port, docker/init-db.sh.
- The real getting-started path, including .env and which variables are needed.
- The frontend build (Vite/React/Tailwind) and the shadcn registry, if present
  on this branch - check before describing it.
- Backups: say plainly what the current story is. Do not invent one.

Keep the accurate later sections (storefronts, STOREFRONT_BASE_DOMAIN, Shopify
env vars, the gateway) - verify each against the code before keeping it, and
fix anything that has drifted. Update "what's deliberately left out" to match
reality.

Plain English, no marketing tone. Do not describe anything you have not
verified in the code. There is no test to write here; instead, list in your
report every claim you checked and the file you checked it against.`,
  },
]

const independentPromise = parallel(
  INDEPENDENT.map((t) => () =>
    agent(`${SHARED}\n\n${t.prompt}`, { label: `fix:${t.label}`, phase: 'Independent fixes', schema: REPORT })
  )
)

// ---------------------------------------------------------------------------
// Phase B - design the isolation change. Read-only. Runs alongside phase A.
// ---------------------------------------------------------------------------

const DESIGN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recommended', 'rationale', 'transactionSites', 'plan', 'risks', 'rejected', 'needsHuman'],
  properties: {
    recommended: {
      type: 'string',
      description: 'The approach to implement, named in one line',
    },
    rationale: { type: 'string' },
    transactionSites: {
      type: 'array',
      description: 'EVERY existing BEGIN/COMMIT/ROLLBACK that runs inside runWithShop, with file:line',
      items: { type: 'string' },
    },
    plan: {
      type: 'array',
      description: 'Ordered, concrete implementation steps naming files and functions',
      items: { type: 'string' },
    },
    risks: { type: 'array', items: { type: 'string' } },
    rejected: {
      type: 'array',
      description: 'Approaches considered and why they were rejected',
      items: { type: 'string' },
    },
    needsHuman: {
      type: 'array',
      description: 'Anything that must not be decided by an agent',
      items: { type: 'string' },
    },
  },
}

const design = await agent(`${SHARED}

YOUR TASK - design the fix for the connection-pooler trap. DESIGN ONLY. Do not
edit a single file. Your output is a plan another agent will execute.

THE PROBLEM
runWithShop sets the tenant with:
    SELECT set_config('app.current_shop_id', $1, false)
The final \`false\` makes it SESSION-scoped, not transaction-scoped. That is
correct and safe today, because the app holds one dedicated client for the whole
request. But it makes PgBouncer in transaction pooling mode - the standard
answer to a 10-connection ceiling - actively dangerous: the setting outlives the
transaction on a shared server connection, and the NEXT TENANT'S transaction can
inherit it. That is a silent cross-tenant data leak caused by an infrastructure
change that never touches application code, and it defeats the guarantee the
entire schema is built around.

THE COMPLICATION - this is the crux, do not skim it
The obvious fix is is_local=true plus wrapping each request in an explicit
transaction. But the codebase ALREADY runs explicit transactions inside
runWithShop. There are at least 11: about 7 in server/server.js (sales,
purchase orders, and others) and 4 in server/team.js. Find them all yourself
and list every one with file:line.

Postgres does NOT error on a nested BEGIN - it emits
    WARNING: there is already a transaction in progress
and does nothing. The inner COMMIT then commits the OUTER transaction. So a
naive wrap silently collapses all 11 transaction boundaries: a later ROLLBACK
rolls back nothing, and a failure after an inner COMMIT leaves partially
committed data. For the sale-completion path that means stock movements and
payments can diverge from the sale. This must not happen.

WHAT TO PRODUCE
Investigate and recommend ONE approach. Consider at least:
  (a) is_local=true + an outer transaction, converting all 11 inner
      transactions to SAVEPOINT / RELEASE SAVEPOINT / ROLLBACK TO SAVEPOINT.
  (b) Keeping session scope but resetting it (DISCARD ALL or RESET) before the
      client is released, and documenting that only session-mode pooling is
      ever safe.
  (c) Setting the tenant per-statement rather than per-request.
  (d) Anything better you find.

For the recommendation, give a concrete ordered plan naming files and functions,
and say exactly how the existing 11 sites change. Be specific about how
dbExec('BEGIN') callers keep working - a savepoint approach probably needs the
db shim in server/db.js to become transaction-aware rather than every call site
changing, but verify that against the real code rather than assuming.

State honestly what could still leak, and flag anything a human should decide
rather than an agent. Read the code. Do not guess.`, { label: 'design:isolation', phase: 'Isolation design', schema: DESIGN_SCHEMA })

const independent = await independentPromise
log(`Independent fixes: ${independent.filter(Boolean).length}/${INDEPENDENT.length} reported`)
log(design ? `Isolation design: ${design.recommended}` : 'Isolation design FAILED - stopping before implementation')

// ---------------------------------------------------------------------------
// Phase C - implement the isolation change (single owner of the shared files).
// ---------------------------------------------------------------------------

let isolation = null
if (design) {
  phase('Isolation build')
  isolation = await agent(`${SHARED}

YOUR TASK - implement the tenant-isolation scoping change designed in the
previous step. You are the ONLY agent touching these files.

YOU OWN: server/db.js, server/server.js, server/team.js, and test files under
tests/ that cover them.

THE APPROVED DESIGN
Recommended approach: ${design.recommended}

Rationale: ${design.rationale}

Existing transaction sites that must keep working (from the design step):
${design.transactionSites.map((s) => `  - ${s}`).join('\n')}

Implementation plan:
${design.plan.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}

Known risks to respect:
${design.risks.map((s) => `  - ${s}`).join('\n')}

Follow that plan. If you find it is wrong once you are in the code, STOP and say
so in your report rather than improvising a different architecture - flag it as
a problem. Do not silently substitute a different approach.

VERIFICATION THAT MATTERS MOST
Beyond the normal test-first sequence, you must prove tenant isolation still
holds. Write tests that:
  - Confirm a query inside runWithShop for shop A cannot see shop B's rows,
    for at least products, customers and sales.
  - Confirm the tenant setting does NOT survive past the end of a request on a
    recycled pooled client. Check out a client, run a request for shop A,
    release it, then acquire again and confirm the setting is gone or reset -
    this is the actual bug being fixed, so it needs a direct test.
  - Confirm every one of the transaction sites listed above still rolls back
    correctly on failure. The sale-completion path is the important one:
    a failure partway must leave NO sale, NO sale_items and NO stock_movements
    behind. Test that specifically.

Run the full suite plus the RLS coverage assertion
(node scripts/ci/assert-rls-coverage.mjs) and paste the real output of both.`, { label: 'build:isolation', phase: 'Isolation build', schema: REPORT })
}

// ---------------------------------------------------------------------------
// Phase D - process lifecycle. Same file as phase C, so it runs after.
// ---------------------------------------------------------------------------

phase('Lifecycle')

const lifecycle = await agent(`${SHARED}

YOUR TASK - make the process survive a deploy, and make its health check mean
something.

YOU OWN: server/server.js and test files under tests/ covering it. A previous
agent has just changed this file for tenant scoping - read it fresh, and do not
revert or fight their changes.

Four things, all verified absent in this codebase today:

1. GRACEFUL SHUTDOWN. There is no SIGTERM handler, no server.close(), and no
   pool.end(). Every rolling deploy cuts in-flight sales mid-transaction. Add a
   handler that stops accepting new connections, lets in-flight requests finish
   within a bounded grace period, then ends the pool and exits. Handle SIGINT
   the same way so Ctrl+C locally behaves consistently.

2. CRASH GUARD. There is no process.on('unhandledRejection') or
   ('uncaughtException') anywhere. Several comments in this file work around
   that absence case by case. Add a top-level guard that logs with enough
   context to diagnose, then exits cleanly so the orchestrator restarts it.
   Do NOT make it swallow errors and continue - a process in an unknown state
   serving tills is worse than one that restarts.

3. A REAL HEALTH CHECK. docker-compose's app healthcheck currently GETs / ,
   which serves index.html off disk and passes with Postgres completely down. A
   container reporting healthy while unable to take a payment is worse than no
   health check, because the orchestrator keeps routing to it. Add /healthz
   that actually touches the database (SELECT 1) and returns a non-200 when it
   cannot. Do NOT edit docker-compose.yml - note in your report that its
   healthcheck should be repointed, and leave that for a human.

4. RELEASE THE DB CLIENT BEFORE SHOPIFY PUSHES. In the sale-completion path,
   inventory pushes are already deliberately fired after COMMIT (read the
   comment there - it explains why). But they still run inside runWithShop, so
   they hold one of ten pooled connections across an HTTP round-trip with
   retries. Restructure so the pooled client is released before those pushes
   run, while keeping the existing guarantee that a Shopify failure never fails
   a real till sale. Be careful: the pushes need product rows that were read
   inside the request - make sure the data they need is captured before the
   client goes back to the pool.

Test each of 1, 3 and 4. For 2, at minimum demonstrate the handler fires and
the process exits non-zero. Follow the test-first sequence including the
mutation step for each.`, { label: 'build:lifecycle', phase: 'Lifecycle', schema: REPORT })

// ---------------------------------------------------------------------------
// Phase E - verify. Three independent lenses.
// ---------------------------------------------------------------------------

phase('Verify')

const done = [...independent, isolation, lifecycle].filter(Boolean)
const inventory = done
  .map((r) => `- ${r.summary}\n  files: ${r.filesChanged.join(', ')}${r.problems.length ? `\n  problems: ${r.problems.join('; ')}` : ''}`)
  .join('\n')

const VERDICT = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'checks', 'blockers', 'followUps'],
  properties: {
    verdict: { type: 'string', enum: ['green', 'green-with-caveats', 'broken'] },
    checks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'command', 'passed', 'evidence'],
        properties: {
          name: { type: 'string' },
          command: { type: 'string' },
          passed: { type: 'boolean' },
          evidence: { type: 'string' },
        },
      },
    },
    blockers: { type: 'array', items: { type: 'string' } },
    followUps: { type: 'array', items: { type: 'string' } },
  },
}

const VERIFIERS = [
  {
    label: 'independent-rerun',
    prompt: `YOUR TASK - independently verify everything the previous stages built.
You are the gate. Do not take any stage's word for anything; run it yourself.

Run and record REAL output for:
  npm test                                  (exact pass/fail totals)
  npm run typecheck
  npm run lint
  npm run build
  npm run registry:validate
  node scripts/ci/check-registry-drift.mjs
  node scripts/ci/assert-rls-coverage.mjs
  npm run migrate  (twice - CI asserts idempotency)

Then check by inspection:
  A. git status --short and git diff --stat. Confirm nothing user-visible
     changed: public/app.js, public/index.html, public/styles.css,
     public-portal/, public-storefront/ must all be untouched.
  B. package.json "dependencies" still contains ONLY pg.
  C. The server still starts and serves the app. Actually start it and curl it,
     including /healthz. Note the docker compose stack may be running stale
     code - say so if it is rather than reporting its behaviour as current.
  D. Every claimed test genuinely exists and runs - grep the suite output for
     the test names the stages claimed to add. A stage claiming a test that
     is not in the run output is a blocker.

Be adversarial. A stage reporting success is not evidence. Set verdict "green"
only if everything above actually passed when YOU ran it.`,
  },
  {
    label: 'cross-tenant-attack',
    prompt: `YOUR TASK - try to break tenant isolation. You are an attacker, not a
reviewer. Your job is to find a way for one shop to see or modify another
shop's data. Assume the implementers were competent and look for what they
missed.

Do not edit application code. You may write throwaway scripts under /tmp and
query the database directly.

Attack angles worth trying:
  - The change just made to how app.current_shop_id is scoped. Does the setting
    ever survive onto a recycled pooled client? Construct the case directly:
    acquire, set, release, re-acquire, read it back.
  - The tables with NO RLS: shops, logins, sessions, customer_logins,
    customer_sessions, uploaded_image_types, schema_migrations. These are the
    one place application code must remember shop scoping by hand - and it
    already failed once, in commit 5cdd4fd. Look for any read or write to those
    tables that trusts a caller-supplied id without checking it belongs to the
    session's shop.
  - uploaded_image_types has no shop_id at all, and its lookup is a bare
    pool.query outside any shop context. Images are served to anonymous callers
    with a one-year immutable cache. Is the storage key genuinely unguessable,
    and can one shop's key be enumerated or inferred?
  - Any query that runs OUTSIDE runWithShop. Find them all and judge each.
  - The new /healthz and shutdown paths - can either be used to observe or
    affect another tenant?
  - Error messages and status codes that differ between "not found" and "belongs
    to another shop". That is an enumeration oracle.

For each finding: state the concrete sequence of steps, what an attacker gets,
and how confident you are. If you cannot actually demonstrate it, say so and
mark it unproven rather than asserting it. Report real leaks as blockers and
theoretical ones as follow-ups.`,
  },
  {
    label: 'completeness-critic',
    prompt: `YOUR TASK - find what this workstream MISSED.

The intent was to close architecture stage one from the review:
  1. Pooler trap (set_config transaction scoping)
  2. Migration advisory lock
  3. Outbound fetch timeouts + releasing the DB client before Shopify pushes
  4. SIGTERM drain, crash guard, real health check
  5. Managed Postgres with point-in-time recovery and a rehearsed restore
  6. README rewrite

What the stages reported:
${inventory}

Assess honestly:
  - Which of the six are genuinely done, which are partial, which untouched?
    Item 5 is infrastructure and cannot be done by an agent - confirm it was
    correctly left alone and flagged, and do not count it as done.
  - Is any change a facade - present but not actually effective? Check the
    fetch timeouts really bound worst-case time across retries, and that the
    shutdown handler really drains rather than just exiting faster.
  - Are there NEW problems introduced? A transaction-scoping change is exactly
    where deadlocks, connection leaks and lost rollbacks appear. Look for a
    client that can now be released twice, or never.
  - Do the new tests actually test the thing? Pick the two most important and
    try breaking the code they cover; if a test still passes, that is a
    finding.
  - What in the architecture review's stage one is still open, and what should
    the next session do first?

Report blockers for anything that would break in production, follow-ups for
everything else.`,
  },
]

const verdicts = await parallel(
  VERIFIERS.map((v) => () =>
    agent(`${SHARED}\n\nWhat the previous stages reported:\n${inventory}\n\n${v.prompt}`, {
      label: `verify:${v.label}`,
      phase: 'Verify',
      schema: VERDICT,
    })
  )
)

const alive = verdicts.filter(Boolean)
const blockers = alive.flatMap((v) => v.blockers)
log(`Verify: ${alive.length}/${VERIFIERS.length} reported, ${blockers.length} blocker(s)`)

return {
  independent,
  design,
  isolation,
  lifecycle,
  verdicts,
  blockerCount: blockers.length,
  overall: blockers.length === 0 ? 'clean' : 'blockers-found',
}
