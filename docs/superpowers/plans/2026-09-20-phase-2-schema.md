# Phase 2 — Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Phase 1 state machines somewhere to live — job states, a job reference, planned effort and a version on `workshop_jobs`; new tables for quotes, quote lines, capacity holds and print tasks; message states on `customer_messages` — with `CHECK` constraints generated from the machine declarations so the database cannot hold a state the model does not allow.

**Architecture:** Forward-only numbered `.sql` migrations, applied in filename order by the existing hand-rolled runner under an advisory lock. Constraints are **generated** from `server/workshop/state-machines.js` by a script, and the generated SQL is committed as ordinary migration text — migrations stay static and reviewable, while a drift test re-generates and fails if a machine changes without a matching migration. Every new shop-scoped table carries RLS, because tenant isolation here is enforced by Postgres, not by application code.

**Tech Stack:** PostgreSQL, Node ESM, `node:test`, `pg`. No new dependencies.

**Spec:** [`docs/superpowers/specs/2026-09-20-release-1-screen-build-design.md`](../specs/2026-09-20-release-1-screen-build-design.md) — Phase 2.

**Preceding phases:** [Phase 0](2026-09-20-phase-0-atlas-revision.md) (PR #54), [Phase 1](2026-09-20-phase-1-state-machines.md) (PR #55). The machines in `server/workshop/state-machines.js` are this phase's input.

## Global Constraints

- **Purely additive. Nothing existing changes behaviour.** `workshop_jobs.status` keeps its five values, its default and every reader — `server/server.js`, `public/app.js` and the customer portal all keep working untouched (Jack's decision, 20 Sep). Phase 3 moves the API across; a later migration drops the column once nothing reads it. **Do not** alter, constrain or backfill `status` in this phase.
- **Every new shop-scoped table needs RLS.** `ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY`, plus a policy on `shop_id = current_setting('app.current_shop_id')::int` for both `USING` and `WITH CHECK`. `scripts/ci/assert-rls-coverage.mjs` runs in CI and fails otherwise. ENABLE without FORCE is not enough: the app connects as the table owner, which bypasses its own policies.
- **Follow the `001_init_schema.sql` table shape**: `shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id)`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- **Migrations are forward-only and each runs in its own transaction.** Where two changes would leave a nonsensical half-state between them, put them in one file — `015_booking_mode.sql` says exactly this and is the model to copy.
- **No new dependencies.** `pg` remains the only runtime dependency.
- **Money is `NUMERIC(10,2)`**, matching `sales`. Never floating point.
- **There is no data to migrate.** The database holds 30 workshop jobs, all in `Test Shop` tenants, and the two `complete` rows are both titled "Edited after completion" — test residue. Nothing is deployed and no shop uses this. So **write no backfill**: new columns take defaults, and the open question Phase 1 recorded (`readLegacyStatus('complete')` returning `custody: null`) is answered by there being no real history to recover. Record that in the migration comment rather than inventing a rule for rows that do not exist.
- **The suite needs the compose Postgres up** — `npm run docker:up` — or it hangs with no output.

## Decisions taken in this plan

| Decision | Rationale |
|---|---|
| Job reference is a **per-shop counter**, `WH-1042` style, allocated by `UPDATE shops SET next_job_number = next_job_number + 1 RETURNING` | A global sequence would leak one shop's job volume to another shop's customers. The atomic update is the same concurrency-safe pattern the capacity work needs. |
| `version INTEGER NOT NULL DEFAULT 1` on `workshop_jobs`, for stale-edit detection | The workshop plan's P02a requires a conditional-version update. Cheaper to add now than to backfill later. |
| Quote line decisions live on the line, not the quote | Line-level approval is the whole point of the approval contract; a quote-level decision cannot express "approved two, declined one". |
| `customer_messages` gains a state column rather than getting a new table | It already exists with a free-text `status`. A parallel table would be a second home for the same fact. |

## File Structure

| File | Responsibility | This plan |
|---|---|---|
| `server/workshop/render-constraints.mjs` | Generates `CHECK` SQL from the machine declarations | **Create** (Task 1) |
| `tests/workshop-state-drift.test.js` | Fails when a machine and its committed constraint disagree | **Create** (Task 1) |
| `server/migrations/016_workshop_job_states.sql` | Job states, reference, planned effort, version; `shops.next_job_number` | **Create** (Task 2) |
| `server/migrations/017_workshop_quotes.sql` | `workshop_quotes`, `workshop_quote_lines` | **Create** (Task 3) |
| `server/migrations/018_workshop_capacity_holds.sql` | `workshop_capacity_holds` | **Create** (Task 4) |
| `server/migrations/019_workshop_print_tasks.sql` | `workshop_print_tasks` | **Create** (Task 5) |
| `server/migrations/020_message_intent_state.sql` | `customer_messages.intent_state` | **Create** (Task 6) |
| `tests/workshop-schema.test.js` | Constraints reject illegal states; RLS isolates; the race has one winner | **Create** (Task 2, extended after) |
| `server/workshop/state-machines.js` | Phase 1's declarations | **Read only** |
| `server/server.js`, `public/app.js`, `public-portal/` | Still on the old column | **Untouched** |

---

### Task 1: Generate constraints from the machines, and fail on drift

No migration yet. This task builds the thing every later task uses, and proves it catches divergence.

**Files:**
- Create: `server/workshop/render-constraints.mjs`
- Create: `tests/workshop-state-drift.test.js`

**Interfaces:**
- Produces: `checkConstraint(machine, column)` returning one line of SQL, e.g. ``CHECK (custody_state IN ('expected', 'in_shop', 'collected'))``. Every migration in this plan pastes its output.
- Produces: `MIGRATION_COLUMNS`, mapping each machine to the migration file and column that must contain its constraint. The drift test reads it.

- [ ] **Step 1: Write the failing test**

Create `tests/workshop-state-drift.test.js`:

```js
// tests/workshop-state-drift.test.js
//
// The database's CHECK constraints are generated from the state machines, then
// committed as ordinary migration text. That gives reviewable, static SQL, but
// it also means the two can drift: add a state to a machine, forget the
// migration, and the model allows something the database rejects at 2am.
//
// This test re-generates each constraint and looks for it, verbatim, in the
// migration that is supposed to carry it. It does not query the database - it
// compares the model against the committed SQL, so it fails the moment a
// machine changes, not the moment a row is written.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkConstraint, MIGRATION_COLUMNS } from '../server/workshop/render-constraints.mjs';

test('checkConstraint renders a machine as SQL', () => {
  const machine = { name: 'x', states: ['a', 'b'] };
  assert.equal(checkConstraint(machine, 'x_state'),
    "CHECK (x_state IN ('a', 'b'))");
});

test('every machine constraint appears verbatim in its migration', async () => {
  for (const { machine, column, migration } of MIGRATION_COLUMNS) {
    const sql = await readFile(new URL(`../server/migrations/${migration}`, import.meta.url), 'utf8');
    const expected = checkConstraint(machine, column);
    assert.ok(sql.includes(expected),
      `${migration} does not contain the current constraint for ${machine.name}.\n`
      + `Expected to find:\n  ${expected}\n`
      + `Regenerate with: node server/workshop/render-constraints.mjs`);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test tests/workshop-state-drift.test.js
```

Expected: `Cannot find module '../server/workshop/render-constraints.mjs'`.

- [ ] **Step 3: Write the generator**

Create `server/workshop/render-constraints.mjs`:

```js
// server/workshop/render-constraints.mjs
//
// Renders each state machine as a Postgres CHECK constraint. The output is
// pasted into a migration and committed, so the SQL a reviewer reads is the SQL
// that runs - no generation at migration time, no surprises.
//
// tests/workshop-state-drift.test.js re-runs this and fails if a committed
// migration no longer matches its machine, which is the only thing stopping the
// model and the database from quietly diverging.
//
// Run it to print every constraint:  node server/workshop/render-constraints.mjs
import {
  bookingRequest, custody, work, quote, capacityHold, printTask, messageIntent,
} from './state-machines.js';

export function checkConstraint(machine, column) {
  const values = machine.states.map(s => `'${s}'`).join(', ');
  return `CHECK (${column} IN (${values}))`;
}

// Which machine belongs to which column, in which migration. The drift test
// walks this, so a machine missing from here is a machine nothing checks.
export const MIGRATION_COLUMNS = [
  { machine: bookingRequest, column: 'booking_state', migration: '016_workshop_job_states.sql' },
  { machine: custody, column: 'custody_state', migration: '016_workshop_job_states.sql' },
  { machine: work, column: 'work_state', migration: '016_workshop_job_states.sql' },
  { machine: quote, column: 'state', migration: '017_workshop_quotes.sql' },
  { machine: capacityHold, column: 'state', migration: '018_workshop_capacity_holds.sql' },
  { machine: printTask, column: 'state', migration: '019_workshop_print_tasks.sql' },
  { machine: messageIntent, column: 'intent_state', migration: '020_message_intent_state.sql' },
];

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const { machine, column, migration } of MIGRATION_COLUMNS) {
    console.log(`-- ${migration}: ${machine.name}`);
    console.log(`  ${checkConstraint(machine, column)}`);
  }
}
```

- [ ] **Step 4: Run and confirm the first test passes, the second fails honestly**

```bash
node --test tests/workshop-state-drift.test.js
```

Expected: `checkConstraint renders a machine as SQL` passes; the drift test fails with `ENOENT` because `016_workshop_job_states.sql` does not exist yet. That is correct — it starts passing as each migration lands. Do not weaken it to skip missing files; Task 7 confirms it goes green once all six exist.

- [ ] **Step 5: See the generated SQL**

```bash
node server/workshop/render-constraints.mjs
```

Copy this output into the migrations below rather than retyping the state lists — a hand-typed list that disagrees with the machine is exactly what the drift test exists to catch, and there is no reason to create the problem by hand.

- [ ] **Step 6: Commit**

```bash
git add server/workshop/render-constraints.mjs tests/workshop-state-drift.test.js
git commit -m "feat(workshop): generate state CHECK constraints, and fail on drift"
```

---

### Task 2: Job states, reference, planned effort and version

**Files:**
- Create: `server/migrations/016_workshop_job_states.sql`
- Create: `tests/workshop-schema.test.js`

**Interfaces:**
- Produces: `workshop_jobs.booking_state`, `.custody_state`, `.work_state`, `.reference`, `.planned_minutes`, `.version`; `shops.next_job_number`.
- Produces: the unique index `(shop_id, reference)` that Phase 3 relies on for "one reference per shop".

- [ ] **Step 1: Write the failing test**

Create `tests/workshop-schema.test.js`:

```js
// tests/workshop-schema.test.js
//
// The database's half of the Phase 1 state model. These tests write real rows
// against real constraints, because a CHECK that was never exercised is a
// comment: the point of generating them is that the database refuses a state
// the machines do not allow, and only an attempted INSERT proves it does.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

async function insertJob(shopId, overrides = {}) {
  const cols = { title: 'Service', job_date: '2026-09-17', shop_id: shopId, ...overrides };
  const names = Object.keys(cols);
  const params = names.map((_, i) => `$${i + 1}`).join(', ');
  const { rows: [job] } = await pool.query(
    `INSERT INTO workshop_jobs (${names.join(', ')}) VALUES (${params}) RETURNING *`,
    Object.values(cols),
  );
  return job;
}

test('a new job starts at each machine\'s initial state', async () => {
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id);
    assert.equal(job.booking_state, 'pending');
    assert.equal(job.custody_state, 'expected');
    assert.equal(job.work_state, 'not_started');
    assert.equal(job.version, 1);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the database refuses a state no machine declares', async () => {
  const shop = await createTestShop();
  try {
    await assert.rejects(
      insertJob(shop.id, { work_state: 'nearly_done' }),
      /violates check constraint/,
    );
    await assert.rejects(
      insertJob(shop.id, { custody_state: 'complete' }),
      /violates check constraint/,
    );
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the old status column is untouched and still works', async () => {
  // Phase 2 is additive. server.js, public/app.js and the portal all still
  // read and write this, and they must keep working until Phase 3 moves them.
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id, { status: 'waiting_parts' });
    assert.equal(job.status, 'waiting_parts');
    const dflt = await insertJob(shop.id);
    assert.equal(dflt.status, 'scheduled');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('two shops can hold the same job reference; one shop cannot', async () => {
  const a = await createTestShop();
  const b = await createTestShop();
  try {
    await insertJob(a.id, { reference: 'WH-1042' });
    await insertJob(b.id, { reference: 'WH-1042' });   // different shop, fine
    await assert.rejects(
      insertJob(a.id, { reference: 'WH-1042' }),
      /duplicate key value|unique constraint/,
    );
  } finally {
    await deleteTestShop(a.id);
    await deleteTestShop(b.id);
  }
});

test('job numbers are allocated per shop, so volume does not leak between them', async () => {
  // A global sequence would tell one shop's customers how many jobs another
  // shop has taken. Each shop counts from its own start.
  const a = await createTestShop();
  const b = await createTestShop();
  try {
    const next = async shopId => {
      const { rows: [row] } = await pool.query(
        'UPDATE shops SET next_job_number = next_job_number + 1 WHERE id = $1 RETURNING next_job_number - 1 AS allocated',
        [shopId],
      );
      return row.allocated;
    };
    assert.equal(await next(a.id), 1000);
    assert.equal(await next(a.id), 1001);
    assert.equal(await next(b.id), 1000);
  } finally {
    await deleteTestShop(a.id);
    await deleteTestShop(b.id);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm run docker:up
node --test tests/workshop-schema.test.js
```

Expected: `column "booking_state" of relation "workshop_jobs" does not exist`.

- [ ] **Step 3: Write the migration**

Create `server/migrations/016_workshop_job_states.sql`. Take the three CHECK lines from `node server/workshop/render-constraints.mjs`:

```sql
-- The Phase 1 state machines, given somewhere to live. See
-- docs/design/workshop-states.md (generated) and
-- server/workshop/state-machines.js (the source of truth for these values).
--
-- ADDITIVE ONLY. workshop_jobs.status keeps its five values, its default and
-- every reader: server.js, public/app.js and the customer portal are all still
-- on it and must keep working. Phase 3 moves the API across; a later migration
-- drops the column once nothing reads it. Nothing here touches it.
--
-- No backfill. When this was written the database held 30 workshop jobs, all in
-- Test Shop tenants, and both 'complete' rows were titled "Edited after
-- completion" - test residue. Nothing is deployed and no shop uses this
-- product, so there is no history to recover and no rule to invent. The open
-- question Phase 1 recorded - that the old column never said whether a finished
-- bike was collected - is answered by there being no real finished bikes.

-- One file, not five: a job with booking_state but no custody_state would be a
-- real half-state between two migrations, and each file runs in its own
-- transaction. Same reasoning as 015_booking_mode.sql.

ALTER TABLE workshop_jobs
  ADD COLUMN booking_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (booking_state IN ('pending', 'scheduled', 'reschedule_requested', 'declined', 'expired', 'cancelled')),
  ADD COLUMN custody_state TEXT NOT NULL DEFAULT 'expected'
    CHECK (custody_state IN ('expected', 'in_shop', 'collected')),
  ADD COLUMN work_state TEXT NOT NULL DEFAULT 'not_started'
    CHECK (work_state IN ('not_started', 'in_progress', 'waiting_parts', 'on_hold', 'complete'));

-- The immutable job reference a tag is printed with (WH-1042 in the atlas).
-- Nullable because every existing row predates it and this migration writes no
-- data; Phase 3 allocates one when it creates a job.
ALTER TABLE workshop_jobs ADD COLUMN reference TEXT;
CREATE UNIQUE INDEX idx_workshop_jobs_shop_reference
  ON workshop_jobs (shop_id, reference) WHERE reference IS NOT NULL;

-- Effort the shop has committed to this job, independent of any start time: a
-- drop-off job reserves minutes without reserving a slot.
ALTER TABLE workshop_jobs ADD COLUMN planned_minutes INTEGER;

-- Optimistic concurrency. A conditional update on this column is how a stale
-- edit is rejected rather than silently overwriting someone else's change.
ALTER TABLE workshop_jobs ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Job numbers count per shop. A global sequence would leak one shop's job
-- volume to another shop's customers, who see the reference on their tag and
-- in their messages. 1000 so the first reference reads WH-1000, not WH-1.
ALTER TABLE shops ADD COLUMN next_job_number INTEGER NOT NULL DEFAULT 1000;
```

- [ ] **Step 4: Apply and confirm the tests pass**

```bash
npm run migrate
node --test tests/workshop-schema.test.js
```

- [ ] **Step 5: Prove the constraint is real**

Against the database directly, try to write a state no machine declares and watch Postgres refuse it:

```bash
docker exec wheelhouse-epos-postgres-1 psql -U postgres -d epos \
  -c "UPDATE workshop_jobs SET work_state = 'nearly_done' WHERE id = (SELECT min(id) FROM workshop_jobs);"
```

Expected: `ERROR: new row for relation "workshop_jobs" violates check constraint`. A constraint nobody has seen refuse anything is a comment.

- [ ] **Step 6: Confirm the drift test now covers this migration**

```bash
node --test tests/workshop-state-drift.test.js
```

Expected: the three `016` entries now find their constraints; the later migrations still fail with `ENOENT` until their tasks land.

- [ ] **Step 7: Commit**

```bash
git add server/migrations/016_workshop_job_states.sql tests/workshop-schema.test.js
git commit -m "feat(db): job states, reference, planned effort and version"
```

---

### Task 3: Quotes and quote lines

**Files:**
- Create: `server/migrations/017_workshop_quotes.sql`
- Modify: `tests/workshop-schema.test.js`

**Interfaces:**
- Produces: `workshop_quotes` (job, revision, state) and `workshop_quote_lines` (kind, description, qty, unit amount, decision).
- Produces: the unique index `(workshop_job_id, revision)` Phase 3's `canApprove` checks a link against.

- [ ] **Step 1: Write the failing test**

Append to `tests/workshop-schema.test.js`:

```js
test('a quote belongs to a job and starts as a draft revision 1', async () => {
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id);
    const { rows: [quote] } = await pool.query(
      'INSERT INTO workshop_quotes (shop_id, workshop_job_id) VALUES ($1, $2) RETURNING *',
      [shop.id, job.id],
    );
    assert.equal(quote.revision, 1);
    assert.equal(quote.state, 'draft');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('one job cannot have two quotes at the same revision', async () => {
  // Revision is what a customer's approval link is bound to. Two rows claiming
  // revision 2 would make "is this link current?" unanswerable.
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id);
    const insert = () => pool.query(
      'INSERT INTO workshop_quotes (shop_id, workshop_job_id, revision) VALUES ($1, $2, 2)',
      [shop.id, job.id],
    );
    await insert();
    await assert.rejects(insert(), /duplicate key value|unique constraint/);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the database refuses a quote state no machine declares', async () => {
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id);
    await assert.rejects(
      pool.query('INSERT INTO workshop_quotes (shop_id, workshop_job_id, state) VALUES ($1, $2, $3)',
        [shop.id, job.id, 'half_approved']),
      /violates check constraint/,
    );
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a line records its own decision, so some can be approved and others not', async () => {
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id);
    const { rows: [quote] } = await pool.query(
      'INSERT INTO workshop_quotes (shop_id, workshop_job_id) VALUES ($1, $2) RETURNING *',
      [shop.id, job.id],
    );
    const line = async (description, amount, decision) => {
      const { rows: [row] } = await pool.query(
        `INSERT INTO workshop_quote_lines
           (shop_id, workshop_quote_id, kind, description, quantity, unit_amount, decision)
         VALUES ($1, $2, 'labour', $3, 1, $4, $5) RETURNING *`,
        [shop.id, quote.id, description, amount, decision],
      );
      return row;
    };
    const approved = await line('Standard service', '65.00', 'approved');
    const declined = await line('Replace gear cable', '12.00', 'declined');
    assert.equal(approved.decision, 'approved');
    assert.equal(declined.decision, 'declined');
    assert.equal(approved.unit_amount, '65.00');   // NUMERIC comes back as a string
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a line decision outside the three allowed values is refused', async () => {
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id);
    const { rows: [quote] } = await pool.query(
      'INSERT INTO workshop_quotes (shop_id, workshop_job_id) VALUES ($1, $2) RETURNING *',
      [shop.id, job.id],
    );
    await assert.rejects(
      pool.query(
        `INSERT INTO workshop_quote_lines
           (shop_id, workshop_quote_id, kind, description, quantity, unit_amount, decision)
         VALUES ($1, $2, 'labour', 'x', 1, '1.00', 'maybe')`,
        [shop.id, quote.id]),
      /violates check constraint/,
    );
  } finally {
    await deleteTestShop(shop.id);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Expected: `relation "workshop_quotes" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- Quotes and their lines. A quote is a revision of a proposal; approving is a
-- per-line decision, because the approval contract is line-level - a customer
-- approves the pads, declines the cable, and the agreed total must reflect
-- exactly that.
--
-- Revisions supersede rather than mutate (see quote in
-- server/workshop/state-machines.js), so the amounts a customer saw when they
-- agreed stay readable afterwards. That is why lines belong to a quote revision
-- and carry their own amount snapshot rather than pointing at a catalogue price
-- that can change underneath them.

CREATE TABLE workshop_quotes (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  workshop_job_id INTEGER NOT NULL REFERENCES workshop_jobs(id),
  revision INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft', 'sent', 'partly_approved', 'approved', 'declined', 'superseded', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A customer's approval link is bound to a revision. Two rows claiming the same
-- revision would make "is this link still current?" unanswerable.
CREATE UNIQUE INDEX idx_workshop_quotes_job_revision
  ON workshop_quotes (workshop_job_id, revision);

ALTER TABLE workshop_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_quotes FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_quotes_shop_isolation ON workshop_quotes
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

CREATE TABLE workshop_quote_lines (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  workshop_quote_id INTEGER NOT NULL REFERENCES workshop_quotes(id),
  -- Labour never moves physical stock; a part does. Phase 5's Lightspeed
  -- handoff depends on telling them apart.
  kind TEXT NOT NULL CHECK (kind IN ('labour', 'part')),
  description TEXT NOT NULL,
  product_id INTEGER REFERENCES products(id),
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  -- A snapshot, not a lookup. A catalogue price change must not alter what a
  -- customer already agreed to.
  unit_amount NUMERIC(10,2) NOT NULL,
  decision TEXT NOT NULL DEFAULT 'pending'
    CHECK (decision IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workshop_quote_lines_quote ON workshop_quote_lines (workshop_quote_id);

ALTER TABLE workshop_quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_quote_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_quote_lines_shop_isolation ON workshop_quote_lines
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
```

- [ ] **Step 4: Apply and confirm the tests pass**

```bash
npm run migrate && node --test tests/workshop-schema.test.js
```

- [ ] **Step 5: Add the cross-shop isolation test**

The RLS coverage script proves the policies *exist*. This proves they *work*,
which is what the spec asks for. Append to `tests/workshop-schema.test.js`,
adding `runWithShop` to the `server/db.js` import:

```js
test('one shop cannot read another shop\'s quotes', async () => {
  // Tenant isolation here is enforced by Postgres, not application code, so it
  // has to be tested through a real shop context rather than by trusting a
  // WHERE clause. runWithShop sets app.current_shop_id, which is what the RLS
  // policy filters on.
  const a = await createTestShop();
  const b = await createTestShop();
  try {
    const job = await insertJob(a.id);
    await pool.query(
      'INSERT INTO workshop_quotes (shop_id, workshop_job_id) VALUES ($1, $2)',
      [a.id, job.id],
    );

    const seenByOwner = await runWithShop(a.id, async client => {
      const { rows } = await client.query('SELECT * FROM workshop_quotes');
      return rows.length;
    });
    assert.equal(seenByOwner, 1, 'the owning shop should see its own quote');

    const seenByOther = await runWithShop(b.id, async client => {
      const { rows } = await client.query('SELECT * FROM workshop_quotes');
      return rows.length;
    });
    assert.equal(seenByOther, 0, 'another shop must see nothing');
  } finally {
    await deleteTestShop(a.id);
    await deleteTestShop(b.id);
  }
});
```

Check `runWithShop`'s signature in `server/db.js:336` before writing this — if
it passes something other than a client to the callback, follow what it
actually does rather than what this plan assumed.

- [ ] **Step 6: Prove RLS is real on the new tables**

```bash
node scripts/ci/assert-rls-coverage.mjs
```

Expected: passes. Then temporarily comment out the `FORCE ROW LEVEL SECURITY` line, re-run migrations on a fresh database (`npm run docker:down && npm run docker:up && npm run migrate`), and confirm both the script and the isolation test above fail, naming `workshop_quotes`. Restore. A tenant-isolation gate nobody has watched fail is not a gate.

- [ ] **Step 7: Commit**

```bash
git add server/migrations/017_workshop_quotes.sql tests/workshop-schema.test.js
git commit -m "feat(db): quotes and line-level decisions with amount snapshots"
```

---

### Task 4: Capacity holds, and the race against a real database

**Files:**
- Create: `server/migrations/018_workshop_capacity_holds.sql`
- Modify: `tests/workshop-schema.test.js`

**Interfaces:**
- Produces: `workshop_capacity_holds`, and the partial unique index that makes "one live hold per slot" a database fact rather than an application hope.

- [ ] **Step 1: Write the failing test**

```js
test('two concurrent requests for the same slot produce exactly one winner', async () => {
  // The acceptance scenario the workshop plan names first. settleRace in
  // state-machines.js is the model's answer; this proves the database gives the
  // same answer under real concurrency, which is where application-level
  // checking loses.
  const shop = await createTestShop();
  try {
    const hold = () => pool.query(
      `INSERT INTO workshop_capacity_holds (shop_id, job_date, start_time, mechanic_id, minutes)
       VALUES ($1, '2026-09-17', '09:30', NULL, 60)`,
      [shop.id],
    );
    const results = await Promise.allSettled([hold(), hold()]);
    const won = results.filter(r => r.status === 'fulfilled');
    const lost = results.filter(r => r.status === 'rejected');
    assert.equal(won.length, 1, 'exactly one hold should be taken');
    assert.equal(lost.length, 1);
    assert.match(String(lost[0].reason), /duplicate key value|unique constraint/);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a released hold frees the slot for someone else', async () => {
  // Expired and released holds must stop consuming capacity immediately, or
  // the diary promises room the shop has not got.
  const shop = await createTestShop();
  try {
    const { rows: [first] } = await pool.query(
      `INSERT INTO workshop_capacity_holds (shop_id, job_date, start_time, mechanic_id, minutes)
       VALUES ($1, '2026-09-18', '10:00', NULL, 60) RETURNING *`,
      [shop.id],
    );
    await pool.query('UPDATE workshop_capacity_holds SET state = $1 WHERE id = $2',
      ['released', first.id]);
    const { rows: [second] } = await pool.query(
      `INSERT INTO workshop_capacity_holds (shop_id, job_date, start_time, mechanic_id, minutes)
       VALUES ($1, '2026-09-18', '10:00', NULL, 60) RETURNING *`,
      [shop.id],
    );
    assert.equal(second.state, 'held');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the database refuses a hold state no machine declares', async () => {
  const shop = await createTestShop();
  try {
    await assert.rejects(
      pool.query(
        `INSERT INTO workshop_capacity_holds (shop_id, job_date, start_time, minutes, state)
         VALUES ($1, '2026-09-19', '11:00', 60, 'pencilled_in')`, [shop.id]),
      /violates check constraint/,
    );
  } finally {
    await deleteTestShop(shop.id);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Expected: `relation "workshop_capacity_holds" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- Claims on workshop capacity. Only 'held' and 'confirmed' consume space; an
-- expired or released hold must stop counting the moment it changes, which is
-- why the uniqueness rule below is scoped to the live states rather than to
-- every row.
--
-- The partial unique index is what makes "two customers cannot both take the
-- last slot" a fact of the database rather than a hope about application code.
-- Checking availability and then inserting is two statements, and the gap
-- between them is exactly where the double booking happens.

CREATE TABLE workshop_capacity_holds (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  workshop_job_id INTEGER REFERENCES workshop_jobs(id),
  job_date TEXT NOT NULL,
  -- Empty for a drop-off day: it reserves effort without holding a time.
  start_time TEXT NOT NULL DEFAULT '',
  mechanic_id INTEGER REFERENCES employees(id),
  minutes INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'held'
    CHECK (state IN ('held', 'confirmed', 'expired', 'released')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One live hold per shop, date, time and mechanic. COALESCE because a NULL
-- mechanic means the shared queue, and NULL never equals NULL in an index.
CREATE UNIQUE INDEX idx_workshop_capacity_holds_live_slot
  ON workshop_capacity_holds (shop_id, job_date, start_time, COALESCE(mechanic_id, 0))
  WHERE state IN ('held', 'confirmed');

CREATE INDEX idx_workshop_capacity_holds_shop_date
  ON workshop_capacity_holds (shop_id, job_date);

ALTER TABLE workshop_capacity_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_capacity_holds FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_capacity_holds_shop_isolation ON workshop_capacity_holds
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
```

- [ ] **Step 4: Apply and confirm the tests pass**

- [ ] **Step 5: Prove the race test can fail**

Temporarily change the index's `WHERE state IN ('held', 'confirmed')` to `WHERE state = 'nothing'` so it never applies, re-run migrations on a fresh database, and confirm the one-winner test fails with two winners. Restore. This is the single most valuable test in the phase: without watching it fail, "exactly one winner" is an assumption about Postgres, not a demonstrated fact.

- [ ] **Step 6: Commit**

```bash
git add server/migrations/018_workshop_capacity_holds.sql tests/workshop-schema.test.js
git commit -m "feat(db): capacity holds, with one-live-hold-per-slot enforced by the database"
```

---

### Task 5: Print tasks

**Files:**
- Create: `server/migrations/019_workshop_print_tasks.sql`
- Modify: `tests/workshop-schema.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('a print task starts queued and records which job it is for', async () => {
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id);
    const { rows: [task] } = await pool.query(
      `INSERT INTO workshop_print_tasks (shop_id, workshop_job_id, printer_name)
       VALUES ($1, $2, 'Front desk Zebra') RETURNING *`,
      [shop.id, job.id],
    );
    assert.equal(task.state, 'queued');
    assert.equal(task.copies, 1);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('unknown is a storable print state, not an absence', async () => {
  // The whole point of the printTask machine: an agent can print the tag and
  // die before acknowledging. "We do not know" has to be recordable, or the
  // shop is told a label exists that nobody can find.
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id);
    const { rows: [task] } = await pool.query(
      `INSERT INTO workshop_print_tasks (shop_id, workshop_job_id, printer_name, state)
       VALUES ($1, $2, 'Front desk Zebra', 'unknown') RETURNING *`,
      [shop.id, job.id],
    );
    assert.equal(task.state, 'unknown');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the database refuses a print state no machine declares', async () => {
  const shop = await createTestShop();
  try {
    const job = await insertJob(shop.id);
    await assert.rejects(
      pool.query(
        `INSERT INTO workshop_print_tasks (shop_id, workshop_job_id, printer_name, state)
         VALUES ($1, $2, 'p', 'probably_fine')`, [shop.id, job.id]),
      /violates check constraint/,
    );
  } finally {
    await deleteTestShop(shop.id);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

- [ ] **Step 3: Write the migration**

```sql
-- Tags waiting to come out of a printer. The existing print path keeps its
-- queue in memory and clears it when an agent collects a job, so a restart or a
-- lost acknowledgement loses the state entirely. This table is where that
-- becomes durable.
--
-- 'unknown' is a real, storable state: an agent can print and then die before
-- acknowledging, and the honest answer is that nobody knows whether the label
-- exists. A person resolves it. Nothing retries from unknown automatically -
-- that is how a bike ends up with two tags.

CREATE TABLE workshop_print_tasks (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  workshop_job_id INTEGER NOT NULL REFERENCES workshop_jobs(id),
  printer_name TEXT NOT NULL,
  copies INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued', 'claimed', 'acknowledged', 'failed', 'unknown')),
  -- Which agent took it, and when we last heard anything.
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workshop_print_tasks_shop_state
  ON workshop_print_tasks (shop_id, state);

ALTER TABLE workshop_print_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_print_tasks FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_print_tasks_shop_isolation ON workshop_print_tasks
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
```

- [ ] **Step 4: Apply and confirm the tests pass**

- [ ] **Step 5: Prove the constraint is real**

Attempt an `UPDATE ... SET state = 'probably_fine'` directly in psql and watch Postgres refuse it.

- [ ] **Step 6: Commit**

```bash
git add server/migrations/019_workshop_print_tasks.sql tests/workshop-schema.test.js
git commit -m "feat(db): durable print tasks, including an honest unknown state"
```

---

### Task 6: Message intent states

`customer_messages` already exists with a free-text `status`. It gains the machine's state rather than a parallel table.

**Files:**
- Create: `server/migrations/020_message_intent_state.sql`
- Modify: `tests/workshop-schema.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('a message carries a constrained intent state alongside its old status', async () => {
  // The existing free-text status stays, because existing code writes it.
  // intent_state is the constrained one the new model uses.
  const shop = await createTestShop();
  try {
    const { rows: [customer] } = await pool.query(
      'INSERT INTO customers (shop_id, name) VALUES ($1, $2) RETURNING *',
      [shop.id, 'Maya Patel'],
    );
    const { rows: [message] } = await pool.query(
      `INSERT INTO customer_messages (shop_id, customer_id, body, status)
       VALUES ($1, $2, 'Your bike is ready', 'sent') RETURNING *`,
      [shop.id, customer.id],
    );
    assert.equal(message.intent_state, 'intended');
    assert.equal(message.status, 'sent');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a provider timeout is storable as unknown rather than as a failure', async () => {
  // Recording a timeout as failed is how a customer gets the same SMS three
  // times: the message may well have gone.
  const shop = await createTestShop();
  try {
    const { rows: [customer] } = await pool.query(
      'INSERT INTO customers (shop_id, name) VALUES ($1, $2) RETURNING *',
      [shop.id, 'Maya Patel'],
    );
    const { rows: [message] } = await pool.query(
      `INSERT INTO customer_messages (shop_id, customer_id, body, status, intent_state)
       VALUES ($1, $2, 'x', 'sent', 'unknown') RETURNING *`,
      [shop.id, customer.id],
    );
    assert.equal(message.intent_state, 'unknown');
    await assert.rejects(
      pool.query(
        `INSERT INTO customer_messages (shop_id, customer_id, body, status, intent_state)
         VALUES ($1, $2, 'x', 'sent', 'probably_sent')`, [shop.id, customer.id]),
      /violates check constraint/,
    );
  } finally {
    await deleteTestShop(shop.id);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

- [ ] **Step 3: Write the migration**

```sql
-- The messageIntent machine, on the table that already holds messages rather
-- than in a parallel one. customer_messages.status is free text that existing
-- code writes; it is left exactly as it is. intent_state is the constrained
-- column the new model uses, and Phase 3 is where sending starts writing it.
--
-- 'unknown' matters most here. A provider timeout is not a failure - the SMS
-- may well have gone - and recording it as one is how a customer receives the
-- same message three times.

ALTER TABLE customer_messages
  ADD COLUMN intent_state TEXT NOT NULL DEFAULT 'intended'
    CHECK (intent_state IN ('intended', 'sending', 'delivered', 'failed', 'unknown'));
```

- [ ] **Step 4: Apply and confirm the tests pass**

- [ ] **Step 5: Prove the constraint is real**

The second assertion in the test above already attempts an illegal value. Confirm it fails for the right reason by temporarily removing the `CHECK` from the migration, re-running on a fresh database, and watching that assertion fail. Restore.

- [ ] **Step 6: Commit**

```bash
git add server/migrations/020_message_intent_state.sql tests/workshop-schema.test.js
git commit -m "feat(db): constrained message intent state on the existing messages table"
```

---

### Task 7: Close the loop on drift and isolation

- [ ] **Step 1: The drift test should now be fully green**

```bash
node --test tests/workshop-state-drift.test.js
```

Expected: all seven entries find their constraints. This is the first point in the phase where it passes completely.

- [ ] **Step 2: Prove the drift test catches a real divergence**

Add a state to a machine in `server/workshop/state-machines.js` — say `abandoned` on `work` — without touching any migration. Re-run the drift test and confirm it fails naming `016_workshop_job_states.sql` and telling you to regenerate. Remove the state. This is the test that stops the model and the database parting company, and it is worthless unless it has been seen to fire.

- [ ] **Step 3: Confirm RLS coverage across all four new tables**

```bash
node scripts/ci/assert-rls-coverage.mjs
```

Expected: passes with `workshop_quotes`, `workshop_quote_lines`, `workshop_capacity_holds` and `workshop_print_tasks` all protected.

- [ ] **Step 4: Confirm a migration from empty works**

The migrations have been applied incrementally to an existing database. Prove they also work from nothing, which is what CI and any new environment does:

```bash
npm run docker:down && npm run docker:up && npm run migrate && npm test
```

- [ ] **Step 5: Commit any fixes**

---

### Task 8: Close Phase 2

- [ ] **Step 1: Run everything**

```bash
npm run docker:up
npm test && npm run typecheck && npm run lint && npm run build
node scripts/ci/assert-rls-coverage.mjs
node server/workshop/render-constraints.mjs
```

Record the real pass count. `npm run build` rewrites tracked files under `public/dist` with no source change — revert that churn with `git checkout -- public/dist` rather than committing it.

- [ ] **Step 2: Check the phase against the spec**

Phase 2 in the spec is "extend the existing 15 migrations to cover the Phase 1 model" with "two-shop tenant-isolation tests run under the non-superuser role". Confirm every machine has a column and a constraint, and that the cross-shop isolation test in Task 3 ran. Say plainly whether it ran under the non-superuser role or as the owner — if only as owner, name that as a gap rather than implying it away.

- [ ] **Step 3: Update `.agents/STATUS.md`**

Record what the schema now holds, that `workshop_jobs.status` is still the live column, and that no backfill was written because there was no data. Check the byte count **before** committing.

- [ ] **Step 4: Open the pull request**

Base it on the Phase 1 branch. Say in the body that the phase is additive, that nothing reads the new columns yet, and that no backfill exists by deliberate choice.

---

## What this plan does not cover

- **No application code changes.** `server.js`, `public/app.js` and the portal stay on `status`. Phase 3 moves them.
- **No expiry scheduler.** `expires_at` is a column; nothing fires it yet.
- **Dropping `workshop_jobs.status`.** That waits until nothing reads it.
- **The three tenant-isolation gaps** confirmed absent on `main` in September — composite tenant-consistent foreign keys, a privilege boundary on the resolver tables, an idempotency key. Real, and deliberately not mixed into a new-model change.
