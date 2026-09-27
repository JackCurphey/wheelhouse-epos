# Book server piece 12: customers change or cancel through the private link - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A customer can cancel, move (unconfirmed) or ask to move (confirmed) their booking through its private link; staff accept or decline a change request, mark a customer cancellation as seen, and read one "Waiting for you" list.

**Architecture:** Migration 035 adds the stored request, who cancelled and when, and a `purpose` column on `workshop_capacity_holds` ('booking' | 'requested'), so a requested slot is held by its own row under the unchanged 024 live-slot index. `server/server.js` gains: `syncRequestedHold` (run first inside `syncJobHold`), requested slots counted by `loadCapacity` and `checkJobSlot`, a shared `resolveBookingLink` / `bookingLinkView` for every link route, `withJobBookingLock` (the booking lock for every day a job touches, re-reading the job `FOR UPDATE`), `checkCustomerTime` (the booking route's time checks, extracted so a change runs the very same code), three customer routes, three staff routes and the waiting list. The state machine gains `change_time` (pending and reschedule_requested, both to themselves) and `withdraw` (reschedule_requested to scheduled).

**Tech Stack:** Node (plain `node:http`, `server/server.js`), Postgres 16 via `pg` and the `prepare(...)` `?`-placeholder wrapper (`server/db.js`), tests with `node:test` against a real spawned server (`tests/helpers/liveServer.js`, clock pinned to 07:00 UK time on Tuesday 1 September 2026).

**Spec:** `docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md` (approved by Jack, 26-27 Sep, including migration 035).

## Global Constraints

- Branch `feat/book-server-12-change-cancel` (checked out). Never commit to `main`, never switch branches, never push or open a PR (Jack decides).
- Stage files by name. Never `git add -A` / `git add .` - `.claude/launch.json` is untracked and must stay out.
- Postgres must be up (`npm run docker:up`, port 5433) or every server test hangs silently. Run one file with `node --test tests/<file>.test.js`; one test with `node --test --test-name-pattern "<name>" tests/<file>.test.js`.
- **No `src/` (client) changes. No CI, dependency, lockfile or atlas changes.**
- Create no files other than those this plan names. No scratch or debug files in the repo (use the session scratchpad or `/tmp`).
- **Test-first, every test.** Each new test is run and seen failing for the right reason before the code that passes it. Tests marked *guard* are the exception: they pass before the step's code because they pin behaviour that already holds, and their mutation is the only proof they bite.
- **Mutation proof, per test, by name.** Every task ends with a mutation table naming **every** new test in the task. Do every row, not a sample: make the mutation, confirm it in `git diff` (or, for a live-database mutation, in the printed query result), run the named test, confirm it FAILS for the stated reason, restore, confirm `git diff` no longer shows it, and re-run the task's test file to PASS. A mutation that does not show in `git diff` did not land - redo it. Report each row's actual failure message.
- Never add a fixed test date before the pinned clock (1 Sep 2026). A date in the past is computed from the pin (`shopToday('Europe/London', new Date(TEST_CLOCK_PIN))`), never written as a literal.
- The booking-link limiter allows **30 link requests per server per 15 minutes**, and every new route shares it with the read route. Each test file starts its own server; keep each file's link calls (read, cancel, change, withdraw) **under 30**. Each task states its file's count.
- Portal signups are limited to 5 per server per hour: one `portalSignup` per test file.
- Every new route carries a `// screens: <atlas ids>` comment on the line directly above `route(` (`scripts/ci/assert-screen-trace.mjs`; ids from `docs/design/release-1-journey/screen-index.json`).
- Each new test file opens with a comment naming the spec, as neighbouring files do.
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Wording, verbatim.** New, from the spec:
  - `Your bike is already with the shop - please contact them to cancel` (409, `code: 'in_shop'`)
  - `This booking can't be cancelled online` (409, `code: 'illegal'`)
  - `This booking can't be changed online` (409, `code: 'illegal'`)
  - `There's no change request to withdraw` (409, `code: 'illegal'`)
  - `The requested time is no longer free` (409, `code: 'capacity'`)
- **Wording this plan adds (decision log D7, D8, D9 - Jack to confirm; change here only if he rewords):**
  - customer: `Your bike is already with the shop - please contact them to change it` (409, `code: 'in_shop'`)
  - staff: `There's no change request to accept` (409, `code: 'illegal'`)
  - staff: `There's no change request to decline` (409, `code: 'illegal'`)
  - staff: `This booking has a change request from the customer - accept or decline the change instead` (409, `code: 'illegal'`)
  - staff: `Only a customer's cancellation can be marked as seen` (409, `code: 'illegal'`)
- **Wording reused unchanged** (existing messages; never reworded here):
  - `We can't find that booking` (404), `This link has expired` (410), `Too many attempts - please wait a few minutes and try again.` (429)
  - `A valid date is required` (400), `Please choose a mechanic` (400)
  - `That date has passed - please choose another day.` (400)
  - `That's too soon for the shop - please choose a later time or day.` (400)
  - `This shop takes drop-offs on that day - choose the day, not a time.` (400), `A start time is required` (400)
  - `That mechanic is unavailable at that time - please choose another time or day.` (400)
  - `That mechanic is already booked over part of that window - please choose another time.` (409 `capacity` from the customer route; 400 from staff routes)
  - `That mechanic does not have enough free time that day - please choose another day, or a shorter job.` (409 `capacity`)
  - `That time is no longer available - please choose another.` (409 `capacity`, the hold index firing)
  - `version is required - send the version you last read` (400), `This job changed while you were looking at it. Reload and try again.` (409 `stale`), `Job not found` (404)

## Decision log (spec ambiguities resolved while planning; executors append to it)

- **D1 Requested-hold marking: a new column, not a state value.** `workshop_capacity_holds.purpose TEXT NOT NULL DEFAULT 'booking' CHECK (purpose IN ('booking','requested'))`. `state` belongs to the `capacityHold` machine (`server/workshop/state-machines.js:167-176`) and a requested hold goes through the same held/released life. The 024 index (`server/migrations/024_untimed_holds.sql:8-10`) is keyed `(shop_id, job_date, start_time, COALESCE(mechanic_id,0))` over live timed holds, with no job or purpose in the key - so it protects a requested slot from every other live hold unchanged, and a job can hold its own slot and a requested one at once (different slots). No index change. Considered and left out: a "one live requested hold per job" unique index - it could fail to build on a dev database carrying old test rows, and `syncRequestedHold` keeps it to one.
- **D2 "Capacity counts a requested hold like any other live hold."** The calculator never reads holds: `loadCapacity` (`server/server.js:4686-4700`) counts live **jobs**, and `checkJobSlot`'s overlap query (`server/server.js:2787-2799`) reads jobs. Holds are only the unique-index guard (`syncJobHold`, `server/server.js:2625-2656`). So a requested slot counts by making both readers see a `reschedule_requested` job's requested slot as a live booking (Task 2); its hold row is the index guard, like any booking's.
- **D3 Machine events.** The spec names `change_time` on `pending`. Replacing a request (reschedule_requested to itself) and withdrawing (reschedule_requested to scheduled) are also legal moves, and the machine is the single source of truth for them (`state-machines.js:1-6`), so: `change_time` also on `reschedule_requested` (self-loop), and a new `withdraw` event. Reusing `decline` for withdraw was rejected - it is the shop's act, not the customer's.
- **D4 Customer routes carry no version.** Inside the lock the job is re-read `SELECT ... FOR UPDATE`, and that row's version is what `applyEvent` checks, so a concurrent unlocked staff action (`jobActionRoute`, `server.js:2999-3030`, runs outside the lock) waits for the row instead of racing. The job's days are read before the lock; if it moved before the lock was taken, the lock is taken again for its new days (at most three tries).
- **D5 A confirmed booking asking for the time it already has** makes no request; an outstanding request is withdrawn. Without this, the requested hold would collide with the job's own hold on the 024 index and answer "That time is no longer available". No new wording. (Jack may prefer a refusal - see the reply.)
- **D6 Refusal codes.** The spec gives messages, not codes. Following the repo's rule that screens branch on `code`, never on words (`server.js:3013-3016`): `in_shop` for the bike-with-the-shop refusals, `illegal` for the other state refusals, `capacity` for "The requested time is no longer free".
- **D7 The change refusal once the bike is with the shop.** The spec says "the same refusals as cancel with 'changed' in place of 'cancelled'", but the cancel sentence contains "cancel", not "cancelled". Planned: `Your bike is already with the shop - please contact them to change it`. Needs Jack.
- **D8 The old `accept` / `decline` routes on a customer's change request** refuse (409 `illegal`, new staff wording). Left alone they would move a `reschedule_requested` job to `scheduled` without moving it, keep a stale request, and never tell the customer - the machine allows `reschedule_requested --accept--> scheduled` (`state-machines.js:84`). They stay unchanged for new online bookings and for a staff-made `request-reschedule` (no stored request), as the spec requires and `tests/workshop-holds-follow.test.js:94-107` pins.
- **D9 A `reschedule_requested` job with no stored time** (only reachable through the staff `request-reschedule` route) is not a customer change request: not in the waiting list; `accept-change` / `decline-change` refuse it with new staff wording.
- **D10 "Online booking"** for the waiting list = `terms_accepted_at IS NOT NULL` - only the portal booking route sets it (`server.js:2677-2682`); staff-made pending jobs are not listed.
- **D11 `arrivedAt`:** `created_at` for a new booking, `requested_at` for a change request, `cancelled_at` for a customer cancellation. Ties break by job id.
- **D12 Shapes.** Link view `requested`: `{ jobDate, startTime, mechanicId }` (spec). Staff job view `requested`: `{ jobDate, startTime, endTime, mechanicId }` (the diary needs the end). Waiting item: `{ kind, jobId, reference, jobDate, startTime, endTime, mechanicId, mechanicName, customerName, serviceNames: string[], arrivedAt }`, plus `from` / `to` (`{ jobDate, startTime, endTime, mechanicId, mechanicName }`) on a change request.
- **D13 Stored request columns count only while the job is `reschedule_requested`** (`requestedOf`). Routes this piece adds clear them on the way out; routes it doesn't touch (the legacy diary PUT, staff `cancel`) may leave them, and they are inert.
- **D14 `accept-change`'s "no longer free"** = the shop's slot rules (`checkJobSlot`: closed day, the mechanic's day off, opening hours, overlap with other live bookings and requests), the job itself excluded, plus the hold index. The capacity calculator is not applied: staff are never refused for capacity (`server.js:2827-2830`).
- **D15 "Seen"** keeps the first `cancellation_seen_at`, still needs and bumps the version.
- **D16 A change's length** is the job's `planned_minutes` (the portal stores the booked services' total there, `server.js:5085`), else its own times, else 60 (the "not sure" hour).
- **D17 Customer cancel** also clears a stored request and `change_declined_at`; withdraw clears the request and `change_declined_at`.

## Files

- Create `server/migrations/035_booking_change_cancel.sql`; `tests/migration-035.test.js`.
- Modify `server/workshop/state-machines.js:76-88` (bookingRequest); `tests/workshop-states.test.js`; regenerate `docs/design/workshop-states.md` with `node server/workshop/render-states.mjs`.
- Create `tests/helpers/linkActions.js` (shared by Tasks 2-8).
- Modify `server/server.js`:
  - `serializeWorkshopJob` (:2381-2413) and a new `requestedOf` above it;
  - `syncJobHold` (:2625-2656) and a new `syncRequestedHold` above it;
  - `checkJobSlot` overlap query (:2787-2799);
  - `jobActionRoute` (:2999-3030); new staff routes after `jobActionRoute('expire', ...)` (:3128);
  - `loadCapacity` (:4686-4700);
  - the booking POST's in-lock time checks (:4996-5043) extracted to `checkCustomerTime`;
  - the booking-link GET (:5142-5174) split into `resolveBookingLink` + `bookingLinkView`; new customer routes after it.
- Create tests: `tests/booking-requested-hold.test.js`, `tests/portal-booking-cancel.test.js`, `tests/portal-booking-change.test.js`, `tests/portal-booking-change-request.test.js`, `tests/workshop-change-requests.test.js`, `tests/workshop-waiting.test.js`.
- Modify `tests/portal-booking-link.test.js:68-81` (the read-back's exact shape gains four fields).
- Modify `.agents/STATUS.md` (Task 9).

---

### Task 1: Migration 035 and the machine's new events

**Files:**
- Create: `server/migrations/035_booking_change_cancel.sql`
- Create: `tests/migration-035.test.js`
- Modify: `server/workshop/state-machines.js:76-88`
- Modify: `tests/workshop-states.test.js` (after the test at :94-101)
- Regenerate: `docs/design/workshop-states.md`

**Interfaces:**
- Produces: `workshop_jobs` columns `requested_job_date TEXT`, `requested_mechanic_id INTEGER REFERENCES employees(id)`, `requested_start_time TEXT`, `requested_end_time TEXT`, `requested_at TIMESTAMPTZ`, `cancelled_by TEXT` (constraint `workshop_jobs_cancelled_by_check`: 'customer' | 'staff'), `cancelled_at`, `cancellation_seen_at`, `change_declined_at` (all `TIMESTAMPTZ`), all nullable. `workshop_capacity_holds.purpose TEXT NOT NULL DEFAULT 'booking'` (constraint `workshop_capacity_holds_purpose_check`: 'booking' | 'requested'). Machine events: `bookingRequest` `pending --change_time--> pending`, `reschedule_requested --change_time--> reschedule_requested`, `reschedule_requested --withdraw--> scheduled`. Migrations run when the test server starts (`server/migrations/run-migrations.js`).

- [ ] **Step 1: Write the failing migration test** `tests/migration-035.test.js`

```js
// Migration 035 (piece 12): a booking's stored change request, who cancelled
// it and when, when staff saw a customer's cancellation and declined a change,
// and holds marked as a requested slot's. The 024 live-slot index is keyed on
// the slot, so it guards requested slots too and lets one job hold two slots.
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let sam;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const column = async (table, name) => (await pool.query(
  'SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
  [table, name]
)).rows[0];

const inShop = (fn) => runWithShop(owner.shop.id, fn);
const newJob = () => inShop(() => prepare(
  "INSERT INTO workshop_jobs (title, job_date) VALUES ('x', '2030-02-04')"
).run()).then((r) => r.lastInsertRowid);
const hold = (fields) => inShop(() => prepare(
  `INSERT INTO workshop_capacity_holds (workshop_job_id, job_date, start_time, mechanic_id, minutes${fields.purpose ? ', purpose' : ''})
   VALUES (?, ?, ?, ?, 60${fields.purpose ? ', ?' : ''}) RETURNING purpose`
).get(...[fields.jobId ?? null, fields.date, fields.start, sam, ...(fields.purpose ? [fields.purpose] : [])]));

test('workshop_jobs gains the request, cancellation and decline columns, all optional', async () => {
  const expected = {
    requested_job_date: 'text',
    requested_mechanic_id: 'integer',
    requested_start_time: 'text',
    requested_end_time: 'text',
    requested_at: 'timestamp with time zone',
    cancelled_by: 'text',
    cancelled_at: 'timestamp with time zone',
    cancellation_seen_at: 'timestamp with time zone',
    change_declined_at: 'timestamp with time zone',
  };
  for (const [name, type] of Object.entries(expected)) {
    const c = await column('workshop_jobs', name);
    assert.ok(c, `${name} missing`);
    assert.equal(c.data_type, type, name);
    assert.equal(c.is_nullable, 'YES', name);
  }
});

test('cancelled_by is customer or staff, nothing else', async () => {
  const id = await newJob();
  await inShop(() => prepare("UPDATE workshop_jobs SET cancelled_by = 'customer' WHERE id = ?").run(id));
  await assert.rejects(
    inShop(() => prepare("UPDATE workshop_jobs SET cancelled_by = 'robot' WHERE id = ?").run(id)),
    /check constraint/i
  );
});

test('a hold is for a booking unless it says otherwise', async () => {
  const row = await hold({ date: '2030-02-05', start: '09:00' });
  assert.equal(row.purpose, 'booking');
});

test("a hold's purpose is booking or requested, nothing else", async () => {
  await assert.rejects(hold({ date: '2030-02-05', start: '10:00', purpose: 'maybe' }), /check constraint/i);
  assert.equal((await hold({ date: '2030-02-05', start: '11:00', purpose: 'requested' })).purpose, 'requested');
});

test('a requested hold cannot share a live slot with a booking hold', async () => {
  await hold({ date: '2030-02-06', start: '10:00' });
  await assert.rejects(hold({ date: '2030-02-06', start: '10:00', purpose: 'requested' }), (err) => err.code === '23505');
});

test('one job can hold its own slot and a requested slot at once', async () => {
  const jobId = await newJob();
  await hold({ jobId, date: '2030-02-07', start: '10:00' });
  await hold({ jobId, date: '2030-02-08', start: '14:00', purpose: 'requested' });
  const row = await inShop(() => prepare(
    "SELECT count(*)::int AS n FROM workshop_capacity_holds WHERE workshop_job_id = ? AND state IN ('held', 'confirmed')"
  ).get(jobId));
  assert.equal(row.n, 2);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/migration-035.test.js`
Expected: FAIL - "requested_job_date missing"; the check tests fail on the `UPDATE`/`INSERT` naming a column that does not exist (`column "cancelled_by" ... does not exist`, `column "purpose" ... does not exist`).

- [ ] **Step 3: Write the migration** `server/migrations/035_booking_change_cancel.sql`

```sql
-- Customers change or cancel through the private link (piece 12). A change to
-- a confirmed booking is a request staff answer: the day, mechanic and times
-- asked for are stored beside the booking's own until then, and the requested
-- slot is held in workshop_capacity_holds with purpose 'requested'. The 024
-- live-slot index is keyed on the slot - not the job, not the purpose - so it
-- keeps a requested slot from being double-booked as it does any booking's,
-- and a job may hold its own slot and a requested one at once.
-- cancelled_by says whose cancellation it was: a customer's shows in staff's
-- "Waiting for you" list until cancellation_seen_at is set. change_declined_at
-- tells the customer's link that staff declined their last change.
-- Additive only.
-- Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
ALTER TABLE workshop_jobs
  ADD COLUMN requested_job_date TEXT,
  ADD COLUMN requested_mechanic_id INTEGER REFERENCES employees(id),
  ADD COLUMN requested_start_time TEXT,
  ADD COLUMN requested_end_time TEXT,
  ADD COLUMN requested_at TIMESTAMPTZ,
  ADD COLUMN cancelled_by TEXT
    CONSTRAINT workshop_jobs_cancelled_by_check CHECK (cancelled_by IN ('customer', 'staff')),
  ADD COLUMN cancelled_at TIMESTAMPTZ,
  ADD COLUMN cancellation_seen_at TIMESTAMPTZ,
  ADD COLUMN change_declined_at TIMESTAMPTZ;

ALTER TABLE workshop_capacity_holds
  ADD COLUMN purpose TEXT NOT NULL DEFAULT 'booking'
    CONSTRAINT workshop_capacity_holds_purpose_check CHECK (purpose IN ('booking', 'requested'));
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test tests/migration-035.test.js`
Expected: all 6 PASS. Then `node scripts/ci/assert-rls-coverage.mjs` exits 0 (no new table).

- [ ] **Step 5: Write the failing machine tests** - append to `tests/workshop-states.test.js` after the test ending at :101

```js
test('an unconfirmed booking can move to another time and stays unconfirmed', () => {
  // Piece 12, decision 4: no request, no staff answer - it moves at once.
  assert.equal(bookingRequest.next('pending', 'change_time'), 'pending');
});

test('a change request can be replaced and stays a request', () => {
  assert.equal(bookingRequest.next('reschedule_requested', 'change_time'), 'reschedule_requested');
});

test('the customer can withdraw a change request, back to the booking they had', () => {
  assert.equal(bookingRequest.next('reschedule_requested', 'withdraw'), 'scheduled');
});

test('a confirmed booking cannot change time without asking', () => {
  // Decision 2: a confirmed booking's change is a request staff answer.
  assert.equal(bookingRequest.can('scheduled', 'change_time'), false);
});
```

- [ ] **Step 6: Run and watch the first three fail**

Run: `node --test tests/workshop-states.test.js`
Expected: the first three FAIL with `bookingRequest: cannot change_time from pending` / `... from reschedule_requested` / `cannot withdraw from reschedule_requested`. The fourth is a *guard* and passes already.

- [ ] **Step 7: Add the events** in `server/workshop/state-machines.js`, replacing the `transitions` of `bookingRequest` (:79-85):

```js
  transitions: {
    // change_time: an unconfirmed booking moves at once and stays unconfirmed
    // (piece 12, decision 4); a request replaced by another stays a request.
    pending: { accept: 'scheduled', decline: 'declined', expire: 'expired', cancel: 'cancelled', change_time: 'pending' },
    // A reschedule keeps the original allocation until the shop answers, so a
    // refused move leaves the customer with the booking they already had.
    scheduled: { request_reschedule: 'reschedule_requested', cancel: 'cancelled' },
    // withdraw is the customer taking their request back; decline is the shop's.
    reschedule_requested: {
      accept: 'scheduled', decline: 'scheduled', cancel: 'cancelled', change_time: 'reschedule_requested', withdraw: 'scheduled',
    },
  },
```

- [ ] **Step 8: Regenerate the readable copy and run the machine tests**

Run: `node server/workshop/render-states.mjs && git diff --stat docs/design/workshop-states.md && node --test tests/workshop-states.test.js tests/workshop-state-invariants.test.js tests/workshop-legacy-status.test.js`
Expected: `docs/design/workshop-states.md` shows three added rows; all tests PASS.

- [ ] **Step 9: Prove every test bites.** Live-database rows: run the SQL with
`node --input-type=module -e "import './server/load-env.js'; import {pool} from './server/db.js'; for (const q of process.argv.slice(1)) console.log((await pool.query(q)).command); await pool.end();" "<sql 1>" "<sql 2>"`
and print a check query to show it landed.

| Test | Mutation | Expected failure | Restore |
|---|---|---|---|
| workshop_jobs gains the request, cancellation and decline columns, all optional | `ALTER TABLE workshop_jobs RENAME COLUMN change_declined_at TO change_declined_at_x` | "change_declined_at missing" | rename back |
| cancelled_by is customer or staff, nothing else | `ALTER TABLE workshop_jobs DROP CONSTRAINT workshop_jobs_cancelled_by_check` | "Missing expected rejection" | `ALTER TABLE workshop_jobs ADD CONSTRAINT workshop_jobs_cancelled_by_check CHECK (cancelled_by IN ('customer', 'staff'))` |
| a hold is for a booking unless it says otherwise | `ALTER TABLE workshop_capacity_holds ALTER COLUMN purpose SET DEFAULT 'requested'` | `'requested' !== 'booking'` | `... SET DEFAULT 'booking'` |
| a hold's purpose is booking or requested, nothing else | `ALTER TABLE workshop_capacity_holds DROP CONSTRAINT workshop_capacity_holds_purpose_check` | "Missing expected rejection" | `ALTER TABLE workshop_capacity_holds ADD CONSTRAINT workshop_capacity_holds_purpose_check CHECK (purpose IN ('booking', 'requested'))` |
| a requested hold cannot share a live slot with a booking hold | `DROP INDEX idx_workshop_capacity_holds_live_slot; CREATE UNIQUE INDEX idx_workshop_capacity_holds_live_slot ON workshop_capacity_holds (shop_id, job_date, start_time, COALESCE(mechanic_id, 0)) WHERE state IN ('held', 'confirmed') AND start_time <> '' AND purpose = 'booking'` | "Missing expected rejection" | drop it and recreate exactly as `024_untimed_holds.sql:8-10` |
| one job can hold its own slot and a requested slot at once | `CREATE UNIQUE INDEX mutation_one_hold_per_job ON workshop_capacity_holds (workshop_job_id) WHERE state IN ('held', 'confirmed') AND job_date IN ('2030-02-07', '2030-02-08')` | the second `hold` rejects with 23505 | `DROP INDEX mutation_one_hold_per_job` |
| an unconfirmed booking can move to another time and stays unconfirmed | delete `change_time: 'pending'` from `pending` | `cannot change_time from pending` | put it back |
| a change request can be replaced and stays a request | delete `change_time` from `reschedule_requested` | `cannot change_time from reschedule_requested` | put it back |
| the customer can withdraw a change request, back to the booking they had | change `withdraw: 'scheduled'` to `withdraw: 'reschedule_requested'` | `'reschedule_requested' !== 'scheduled'` | put it back |
| a confirmed booking cannot change time without asking | add `change_time: 'scheduled'` to `scheduled` | `true !== false` | remove it |

After the machine mutations, re-run `node server/workshop/render-states.mjs` and confirm `docs/design/workshop-states.md` matches Step 8's version (`git diff` shows only the three intended rows).

- [ ] **Step 10: Commit**

```bash
git add server/migrations/035_booking_change_cancel.sql tests/migration-035.test.js server/workshop/state-machines.js tests/workshop-states.test.js docs/design/workshop-states.md
git commit -m "feat: migration 035 and change_time/withdraw events (piece 12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: A requested time is held and counted

**Files:**
- Create: `tests/helpers/linkActions.js`
- Create: `tests/booking-requested-hold.test.js`
- Modify: `server/server.js` - new `syncRequestedHold` above `syncJobHold` (:2625); `syncJobHold` (:2625-2656); `checkJobSlot` overlap query (:2787-2799); `loadCapacity` (:4686-4700)

**Interfaces:**
- Consumes: Task 1's columns and `purpose`.
- Produces (server.js, module-private): `async function syncRequestedHold(jobId)`, called first inside `syncJobHold(jobId)`. `syncJobHold` manages only `purpose = 'booking'` holds. `checkJobSlot` and `loadCapacity` treat a `reschedule_requested` job's requested slot as a live booking.
- Produces (tests/helpers/linkActions.js): `codeOf(privateLink)`, `linkActions(baseUrl, shopSlug) -> { read(code), cancel(code), change(code, body), withdraw(code) }` (each resolves to `{ status, body }`), `tryBooking(baseUrl, cookie, shopSlug, body) -> { status, body }`, `bookOnline(baseUrl, cookie, shopSlug, body) -> booking reply + { code }` (throws unless 201), `liveHolds(shopId, jobId) -> [{ job_date, start_time, mechanic_id, purpose }]` (oldest first), `jobRow(shopId, jobId)`, `setJob(shopId, jobId, sql, ...args)`, `seedRequest(shopId, jobId, { jobDate, mechanicId, startTime = '14:00', endTime = '15:00' })`, `dayMaker() -> () => 'YYYY-MM-DD'`, `holdBookingLock(shopId, date) -> release()`, `stillWaiting(promise, ms = 500) -> boolean`.

- [ ] **Step 1: Create the shared helper** `tests/helpers/linkActions.js`

```js
// Shared by the piece 12 tests: the customer's private-link actions, an online
// booking, and the reads and seeds those tests make.
// Every link call goes through the booking-link limiter - 30 per server per 15
// minutes, and each test file starts its own server - so a file keeps its
// link calls under 30.
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
import { pool, runWithShop, prepare } from '../../server/db.js';
import { jsonRequest } from './http.js';
import { futureDate } from './workshopFixtures.js';
import { BOOKING_CONTACT } from './bookable.js';

export const codeOf = (privateLink) => privateLink.split('/').pop();

export function linkActions(baseUrl, shopSlug) {
  const path = (code, action) => `/api/portal/${shopSlug}/booking-links/${code}${action ? `/${action}` : ''}`;
  const post = (code, action, body = {}) => jsonRequest(baseUrl, null, path(code, action), { method: 'POST', body });
  return {
    read: (code) => jsonRequest(baseUrl, null, path(code)),
    cancel: (code) => post(code, 'cancel'),
    change: (code, body) => post(code, 'change', body),
    withdraw: (code) => post(code, 'withdraw-change'),
  };
}

// An online booking by a signed-in customer; the caller gives mechanicId,
// jobDate, startTime and serviceIds.
export function tryBooking(baseUrl, cookie, shopSlug, body) {
  return jsonRequest(baseUrl, cookie, `/api/portal/${shopSlug}/bookings`, {
    method: 'POST',
    body: { description: 'Squeaky brakes', newBike: { make: 'Dawes', model: 'Galaxy' }, ...BOOKING_CONTACT, ...body },
  });
}

export async function bookOnline(baseUrl, cookie, shopSlug, body) {
  const res = await tryBooking(baseUrl, cookie, shopSlug, body);
  if (res.status !== 201) throw new Error(`booking failed (${res.status}): ${JSON.stringify(res.body)}`);
  return { ...res.body, code: codeOf(res.body.privateLink) };
}

export const liveHolds = (shopId, jobId) => runWithShop(shopId, () => prepare(
  `SELECT job_date, start_time, mechanic_id, purpose FROM workshop_capacity_holds
   WHERE workshop_job_id = ? AND state IN ('held', 'confirmed') ORDER BY id`
).all(jobId)).then((rows) => rows.map((r) => ({ ...r })));

export const jobRow = (shopId, jobId) =>
  runWithShop(shopId, () => prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(jobId));

export const setJob = (shopId, jobId, sql, ...args) =>
  runWithShop(shopId, () => prepare(`UPDATE workshop_jobs SET ${sql} WHERE id = ?`).run(...args, jobId));

// A stored change request and its hold, written as the change route writes
// them - for tests whose subject is what a request does, not how one is made.
export async function seedRequest(shopId, jobId, { jobDate, mechanicId, startTime = '14:00', endTime = '15:00' }) {
  await runWithShop(shopId, async () => {
    await prepare(
      `UPDATE workshop_jobs SET booking_state = 'reschedule_requested', requested_job_date = ?, requested_mechanic_id = ?,
         requested_start_time = ?, requested_end_time = ?, requested_at = now() WHERE id = ?`
    ).run(jobDate, mechanicId, startTime, endTime, jobId);
    await prepare(
      `INSERT INTO workshop_capacity_holds (workshop_job_id, job_date, start_time, mechanic_id, minutes, state, purpose)
       VALUES (?, ?, ?, ?, 60, 'held', 'requested')`
    ).run(jobId, jobDate, startTime, mechanicId);
  });
}

// A different weekday date on each call, Monday to Friday, at least three weeks
// out (futureDate), a week further on after every five.
export function dayMaker() {
  let n = 0;
  return () => {
    const i = n++;
    const d = new Date(`${futureDate(1 + (i % 5))}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7 * Math.floor(i / 5));
    return d.toISOString().slice(0, 10);
  };
}

// Takes one shop-and-date booking lock from outside the server, as another
// booking write would, until the returned release() is called.
export async function holdBookingLock(shopId, date) {
  const client = await pool.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock($1::int, $2::int)', [shopId, Number(date.replace(/-/g, ''))]);
  return async () => {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  };
}

// True when the promise has not settled after `ms`.
export async function stillWaiting(promise, ms = 500) {
  let settled = false;
  promise.then(() => { settled = true; }, () => { settled = true; });
  await new Promise((resolve) => setTimeout(resolve, ms));
  return !settled;
}
```

- [ ] **Step 2: Write the failing tests** `tests/booking-requested-hold.test.js` (no link calls)

```js
// A customer's requested new time (piece 12) is held while staff decide: other
// bookings are kept out of it, the calendar stops offering it, the job's own
// request never blocks the job, and the hold goes when the job stops being a
// request. Requests are seeded here; Task 6's route makes real ones.
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedWorkshopJob } from './helpers/workshopFixtures.js';
import { seedJobTypes } from './helpers/bookable.js';
import { tryBooking, liveHolds, seedRequest, dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let sam;
let types;
let customer;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);

// A confirmed job at 10:00-11:00 on one day whose customer asked for 14:00-15:00
// on another, with Sam both times. Seeded rows hold no booking hold of their
// own (seedWorkshopJob inserts directly); the requested one is held.
async function requestingJob() {
  const own = nextDay();
  const wanted = nextDay();
  const { jobId } = await seedWorkshopJob({
    shopId: owner.shop.id, customerId: null, mechanicId: sam, jobDate: own, startTime: '10:00', endTime: '11:00', legacyStatus: 'scheduled',
  });
  await seedRequest(owner.shop.id, jobId, { jobDate: wanted, mechanicId: sam });
  return { jobId, own, wanted };
}

test('a requested time keeps another customer out of it', async () => {
  const { wanted } = await requestingJob();
  // 14:30-15:30 overlaps 14:00-15:00 but starts elsewhere, so only the overlap
  // check can refuse it - the hold index compares start times.
  const res = await tryBooking(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: wanted, startTime: '14:30', serviceIds: [types.repair],
  });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, {
    error: 'That mechanic is already booked over part of that window - please choose another time.',
    code: 'capacity',
  });
});

test('the calendar does not offer a requested time', async () => {
  const { wanted } = await requestingJob();
  const res = await jsonRequest(server.baseUrl, null,
    `/api/portal/${owner.shop.slug}/availability?start=${wanted}&end=${wanted}&minutes=60&mechanicId=${sam}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const times = res.body.days[0].mechanics[0].startTimes;
  assert.ok(times.includes('13:00') && times.includes('15:00'), JSON.stringify(times));
  for (const t of ['13:30', '14:00', '14:30']) assert.ok(!times.includes(t), `${t} offered: ${JSON.stringify(times)}`);
});

// guard: passes before Step 3 (nothing counts requests yet); its mutation proves it.
test("a job's own request never blocks the job", async () => {
  const { jobId, wanted } = await requestingJob();
  const moved = await staff(`/api/workshop-jobs/${jobId}`, {
    method: 'PUT', body: { jobDate: wanted, startTime: '14:30', endTime: '15:30' },
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
});

test('a job that stops being a request lets its requested time go and keeps its own', async () => {
  const { jobId, own } = await requestingJob();
  // The old diary's legacy status PUT is the one way back to scheduled that
  // this piece leaves alone (decision log D13).
  const res = await staff(`/api/workshop-jobs/${jobId}`, { method: 'PUT', body: { status: 'scheduled' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(await liveHolds(owner.shop.id, jobId), [
    { job_date: own, start_time: '10:00', mechanic_id: sam, purpose: 'booking' },
  ]);
});

test("a job's own hold is never mistaken for its requested one", async () => {
  const { jobId, own, wanted } = await requestingJob();
  // The job has only its requested hold; an edit gives it its own as well.
  const res = await staff(`/api/workshop-jobs/${jobId}`, { method: 'PUT', body: { notes: 'Rang to confirm' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(await liveHolds(owner.shop.id, jobId), [
    { job_date: wanted, start_time: '14:00', mechanic_id: sam, purpose: 'requested' },
    { job_date: own, start_time: '10:00', mechanic_id: sam, purpose: 'booking' },
  ]);
});
```

- [ ] **Step 3: Run and watch them fail**

Run: `node --test tests/booking-requested-hold.test.js`
Expected: "keeps another customer out" FAILS (201, not 409); "does not offer" FAILS (`14:00 offered`); "stops being a request" FAILS (one hold, but with purpose 'requested' - `syncJobHold` took the requested hold for the job's own); "never mistaken" FAILS (one hold, at the job's own slot, with purpose 'requested' - `syncJobHold` moved the requested hold). "own request never blocks" passes (*guard*).

- [ ] **Step 4: Implement.** In `server/server.js`:

(a) Directly above `async function syncJobHold` (:2625), add:

```js
// A customer's requested time (piece 12) is held beside the job's own hold,
// marked purpose 'requested', while the job waits on the request: one live
// requested hold, on the requested slot. A request replaced by another lets
// the old slot go; a job that stops being a request lets it go. syncJobHold
// runs this first, so a requested slot is given up before the job's own hold
// may move onto it.
async function syncRequestedHold(jobId) {
  const job = await db.prepare(
    `SELECT booking_state, requested_job_date, requested_mechanic_id, requested_start_time, requested_end_time, planned_minutes
     FROM workshop_jobs WHERE id = ?`
  ).get(jobId);
  const wanted = job && job.booking_state === 'reschedule_requested' && job.requested_job_date
    ? {
      jobDate: job.requested_job_date,
      // As for the job's own hold: an unassigned slot is counted, never slotted.
      startTime: job.requested_mechanic_id ? (job.requested_start_time || '') : '',
      mechanicId: job.requested_mechanic_id,
      minutes: job.requested_start_time
        ? Math.max(0, timeToMinutes(job.requested_end_time) - timeToMinutes(job.requested_start_time))
        : (job.planned_minutes || 0),
    }
    : null;
  const held = await db.prepare(
    `SELECT id, job_date, start_time, mechanic_id FROM workshop_capacity_holds
     WHERE workshop_job_id = ? AND purpose = 'requested' AND state IN ('held', 'confirmed') ORDER BY id`
  ).all(jobId);
  const keep = wanted && held.find((h) =>
    h.job_date === wanted.jobDate && h.start_time === wanted.startTime && h.mechanic_id === wanted.mechanicId);
  for (const h of held) {
    if (h !== keep) await db.prepare("UPDATE workshop_capacity_holds SET state = 'released' WHERE id = ?").run(h.id);
  }
  if (wanted && !keep) {
    await db.prepare(
      `INSERT INTO workshop_capacity_holds (workshop_job_id, job_date, start_time, mechanic_id, minutes, state, purpose)
       VALUES (?, ?, ?, ?, ?, 'held', 'requested')`
    ).run(jobId, wanted.jobDate, wanted.startTime, wanted.mechanicId, wanted.minutes);
  }
}
```

(b) In `syncJobHold`: make its first statement `await syncRequestedHold(jobId);`, and change the own-hold lookup (:2642-2645) to

```js
  const hold = await db.prepare(
    `SELECT id FROM workshop_capacity_holds
     WHERE workshop_job_id = ? AND purpose = 'booking' AND state IN ('held', 'confirmed') ORDER BY id LIMIT 1`
  ).get(jobId);
```

Leave the not-live release (:2629-2634) as it is (it releases every hold of the job). Add one sentence to the comment above `syncJobHold`: "Only the job's own hold (purpose 'booking') - a requested slot's is syncRequestedHold's."

(c) In `checkJobSlot`, replace the overlap query (:2787-2796) with

```js
  // A customer's requested time (piece 12) is held like a booking until staff
  // answer, so it is an overlap too - except for the job that asked for it.
  const overlap = await db
    .prepare(
      `SELECT id FROM workshop_jobs
       WHERE mechanic_id = ? AND job_date = ? AND start_time IS NOT NULL AND start_time != ''
       AND start_time < ? AND end_time > ? AND (?::int IS NULL OR id != ?::int)
       AND booking_state IN (${LIVE_STATES_SQL})
       UNION ALL
       SELECT id FROM workshop_jobs
       WHERE requested_mechanic_id = ? AND requested_job_date = ? AND requested_start_time <> ''
       AND requested_start_time < ? AND requested_end_time > ? AND (?::int IS NULL OR id != ?::int)
       AND booking_state = 'reschedule_requested'
       LIMIT 1`
    )
    .get(mechanicId, jobDate, endTime, startTime, ignoreJobId, ignoreJobId,
      mechanicId, jobDate, endTime, startTime, ignoreJobId, ignoreJobId);
```

(d) In `loadCapacity`, after the `jobs` query (:4695-4698) and before `computeCapacity`, add

```js
  // A customer's requested time (piece 12) takes capacity like a booking while
  // staff decide, so nobody else is offered it.
  jobs.push(...(await db.prepare(
    `SELECT id, requested_mechanic_id AS mechanic_id, requested_job_date AS job_date,
            requested_start_time AS start_time, requested_end_time AS end_time, planned_minutes
     FROM workshop_jobs
     WHERE booking_state = 'reschedule_requested' AND requested_job_date >= ? AND requested_job_date <= ?`
  ).all(start, end)).map(toCapacityJob));
```

- [ ] **Step 5: Run the new tests and the neighbours they touch**

Run: `node --test tests/booking-requested-hold.test.js tests/workshop-holds-follow.test.js tests/portal-capacity-holds.test.js tests/booking-lock.test.js tests/portal-availability-capacity.test.js tests/workshop-capacity-view.test.js tests/workshop-availability.test.js`
Expected: all PASS.

- [ ] **Step 6: Prove every test bites** (protocol in Global Constraints)

| Test | Mutation (server.js) | Expected failure |
|---|---|---|
| a requested time keeps another customer out of it | delete the `UNION ALL SELECT ...` half of the overlap query and its six arguments | 201, not 409 |
| the calendar does not offer a requested time | delete the `jobs.push(...)` block in `loadCapacity` | `14:00 offered` |
| a job's own request never blocks the job | delete `AND (?::int IS NULL OR id != ?::int)` from the requested half, and its two arguments | 400 "That mechanic is already booked over part of that window..." |
| a job that stops being a request lets its requested time go and keeps its own | in `syncRequestedHold`, delete `job.booking_state === 'reschedule_requested' &&` | two live holds, not one |
| a job's own hold is never mistaken for its requested one | in `syncJobHold`'s own-hold lookup, delete `AND purpose = 'booking'` | one hold at the own slot with purpose 'requested' |

- [ ] **Step 7: Commit**

```bash
git add tests/helpers/linkActions.js tests/booking-requested-hold.test.js server/server.js
git commit -m "feat: a requested time is held and counted like a booking (piece 12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The link view says what the customer can do

**Files:**
- Create: `tests/portal-booking-cancel.test.js` (this task's view tests; Task 4 adds cancel tests to it)
- Modify: `tests/portal-booking-link.test.js:68-81`
- Modify: `server/server.js` - `requestedOf` above `serializeWorkshopJob` (:2381); the booking-link GET (:5142-5174) becomes `resolveBookingLink` + `bookingLinkView` + a three-line route

**Interfaces:**
- Consumes: Task 1's columns.
- Produces (server.js): `function requestedOf(row) -> { jobDate, startTime, endTime, mechanicId } | null` (null unless `booking_state === 'reschedule_requested'` and `requested_job_date` is set; times `''` when empty). `const CUSTOMER_ACTIONABLE = new Set(['pending', 'scheduled', 'reschedule_requested'])`; `function customerCanAct(row) -> boolean` (custody `expected` and state in the set). `async function resolveBookingLink(req, res, code) -> { id } | null` (null means it already answered 429/404/410). `async function bookingLinkView(jobId, shop) -> object` (the GET's body plus `requested: { jobDate, startTime, mechanicId } | null`, `canChange`, `canCancel`, `changeDeclined`).

Link calls in `tests/portal-booking-cancel.test.js` after this task: 6.

- [ ] **Step 1: Update the exact-shape test** in `tests/portal-booking-link.test.js`: in the first test's `assert.deepEqual(res.body, {...})` (:68-81) add, after `totalPrice: null,`:

```js
    requested: null,
    canChange: true,
    canCancel: true,
    changeDeclined: false,
```

- [ ] **Step 2: Write the failing view tests** `tests/portal-booking-cancel.test.js`

```js
// The private link says what the customer may do (piece 12): change or cancel
// while the bike has not reached the shop and the booking is live, the change
// they asked for, and whether staff declined their last one. Then cancelling
// through the link (Task 4).
// Link calls in this file must stay under 30 (the limiter is per server).
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import { linkActions, bookOnline, setJob, dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let sam;
let types;
let customer;
let link;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  link = linkActions(server.baseUrl, owner.shop.slug);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const book = () => bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
  mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.repair],
});
const shopId = () => owner.shop.id;

test('an unconfirmed booking can be changed or cancelled, and asks for nothing yet', async () => {
  const booked = await book();
  const res = await link.read(booked.code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.canChange, true);
  assert.equal(res.body.canCancel, true);
  assert.equal(res.body.requested, null);
  assert.equal(res.body.changeDeclined, false);
});

test('once the bike is with the shop the link offers neither', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, "booking_state = 'scheduled', custody_state = 'in_shop'");
  const res = await link.read(booked.code);
  assert.equal(res.body.canChange, false);
  assert.equal(res.body.canCancel, false);
});

test('a cancelled booking offers neither', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, "booking_state = 'cancelled'");
  const res = await link.read(booked.code);
  assert.equal(res.body.canChange, false);
  assert.equal(res.body.canCancel, false);
});

test('a change the customer asked for shows on the link', async () => {
  const booked = await book();
  const wanted = nextDay();
  await setJob(shopId(), booked.id,
    "booking_state = 'reschedule_requested', requested_job_date = ?, requested_mechanic_id = ?, requested_start_time = '14:00', requested_end_time = '15:00'",
    wanted, sam);
  const res = await link.read(booked.code);
  assert.deepEqual(res.body.requested, { jobDate: wanted, startTime: '14:00', mechanicId: sam });
  assert.equal(res.body.stage, 'change_requested');
  assert.equal(res.body.canChange, true);
});

test('a request left on a booking that is no longer waiting on it is not shown', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id,
    "booking_state = 'scheduled', requested_job_date = ?, requested_mechanic_id = ?, requested_start_time = '14:00', requested_end_time = '15:00'",
    nextDay(), sam);
  assert.equal((await link.read(booked.code)).body.requested, null);
});

test('the link says when staff declined the last change', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, "booking_state = 'scheduled', change_declined_at = now()");
  assert.equal((await link.read(booked.code)).body.changeDeclined, true);
});
```

- [ ] **Step 3: Run and watch them fail**

Run: `node --test tests/portal-booking-cancel.test.js tests/portal-booking-link.test.js`
Expected: every new test FAILS (`undefined !== true` / `undefined !== null`), and "a booking returns a private link, and the link reads the booking back" FAILS on the four missing keys.

- [ ] **Step 4: Implement.** In `server/server.js`:

(a) Directly above `function serializeWorkshopJob` (:2381):

```js
// A customer's stored change request (piece 12). It counts only while the job
// is waiting on it: a route that moves the job out of reschedule_requested
// without clearing the columns (the old diary's status PUT, staff cancel)
// leaves them behind, and then they mean nothing.
function requestedOf(row) {
  if (row.booking_state !== 'reschedule_requested' || !row.requested_job_date) return null;
  return {
    jobDate: row.requested_job_date,
    startTime: row.requested_start_time || '',
    endTime: row.requested_end_time || '',
    mechanicId: row.requested_mechanic_id,
  };
}

// A customer may change or cancel through the link while the bike has not
// reached the shop and the booking is live (piece 12).
const CUSTOMER_ACTIONABLE = new Set(['pending', 'scheduled', 'reschedule_requested']);
function customerCanAct(row) {
  return row.custody_state === 'expected' && CUSTOMER_ACTIONABLE.has(row.booking_state);
}
```

(b) Replace the whole booking-link GET route (:5136-5174, its comment included) with:

```js
// The private link's code, checked the same way on every link route: the
// attempt limiter, a well-formed code, a job with that hash in this shop (the
// dispatcher bound the shop from :shopSlug, so row-level security hides every
// other shop's), and not expired. Answers the refusal itself and returns
// null, or returns { id }.
async function resolveBookingLink(req, res, code) {
  if (!bookingLinkLimiter.check(clientIp(req))) {
    sendJson(res, 429, { error: 'Too many attempts - please wait a few minutes and try again.' });
    return null;
  }
  const row = /^[0-9a-f]{64}$/.test(code)
    ? await db.prepare('SELECT id, job_date FROM workshop_jobs WHERE link_token_hash = ?').get(hashLinkCode(code))
    : null;
  if (!row) {
    sendJson(res, 404, { error: "We can't find that booking" });
    return null;
  }
  if (isLinkExpired(row.job_date, await currentShopToday())) {
    sendJson(res, 410, { error: 'This link has expired' });
    return null;
  }
  return { id: row.id };
}

// What the link shows. Deliberately narrow: nothing that identifies the
// customer, no staff notes. The booked services and total only when the shop
// shows prices online (bookedServices). Piece 12 adds what the customer may do
// and the change they asked for.
// Spec: docs/superpowers/specs/2026-09-26-book-server-7-multiple-services-design.md
async function bookingLinkView(jobId, shop) {
  const row = await db.prepare(
    `SELECT w.id, w.reference, w.job_date, w.start_time, w.customer_description, w.customer_bike_note, w.question_answers,
            w.booking_state, w.custody_state, w.work_state,
            w.requested_job_date, w.requested_mechanic_id, w.requested_start_time, w.requested_end_time, w.change_declined_at,
            b.make AS bike_make, b.model AS bike_model,
            (SELECT count(*)::int FROM workshop_job_attachments a
             WHERE a.workshop_job_id = w.id AND a.from_customer) AS photo_count
     FROM workshop_jobs w
     LEFT JOIN customer_bikes b ON b.id = w.bike_id
     WHERE w.id = ?`
  ).get(jobId);
  const requested = requestedOf(row);
  return {
    reference: row.reference,
    shopName: shop.name,
    jobDate: row.job_date,
    startTime: row.start_time || '',
    description: row.customer_description ?? null,
    bikeNote: row.customer_bike_note ?? null,
    // As asked at booking, from the frozen copy - never the service's current wording.
    answers: (row.question_answers ?? []).map(({ wording, answer, text }) => ({ wording, answer, ...(text ? { text } : {}) })),
    bike: row.bike_make !== null || row.bike_model !== null ? { make: row.bike_make, model: row.bike_model } : null,
    stage: bookingStage(row),
    photoCount: row.photo_count,
    requested: requested && { jobDate: requested.jobDate, startTime: requested.startTime, mechanicId: requested.mechanicId },
    canChange: customerCanAct(row),
    canCancel: customerCanAct(row),
    changeDeclined: row.change_declined_at !== null,
    ...(await bookedServices(row.id)),
  };
}

// The private booking link, read back without sign-in.
// screens: pending, change-pending, cancelled
route('GET', '/api/portal/:shopSlug/booking-links/:code', async (req, res, params, query, shop) => {
  const found = await resolveBookingLink(req, res, params.code);
  if (!found) return;
  sendJson(res, 200, await bookingLinkView(found.id, shop));
});
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/portal-booking-cancel.test.js tests/portal-booking-link.test.js tests/booking-link-rate-limit.test.js tests/portal-booking-photos.test.js tests/portal-booked-price.test.js tests/portal-booking-multi.test.js && npm run lint`
Expected: all PASS; lint clean.

- [ ] **Step 6: Prove every test bites**

| Test | Mutation (server.js) | Expected failure |
|---|---|---|
| an unconfirmed booking can be changed or cancelled, and asks for nothing yet | remove `'pending'` from `CUSTOMER_ACTIONABLE` | `false !== true` |
| once the bike is with the shop the link offers neither | in `customerCanAct`, delete `row.custody_state === 'expected' &&` | `true !== false` |
| a cancelled booking offers neither | add `'cancelled'` to `CUSTOMER_ACTIONABLE` | `true !== false` |
| a change the customer asked for shows on the link | in `bookingLinkView`, `requested: null,` | `null` vs the expected object |
| a request left on a booking that is no longer waiting on it is not shown | in `requestedOf`, delete `row.booking_state !== 'reschedule_requested' \|\|` | an object, not `null` |
| the link says when staff declined the last change | `changeDeclined: false,` | `false !== true` |
| (existing) a booking returns a private link, and the link reads the booking back | delete `canCancel: customerCanAct(row),` | the deepEqual names `canCancel` |

- [ ] **Step 7: Commit**

```bash
git add tests/portal-booking-cancel.test.js tests/portal-booking-link.test.js server/server.js
git commit -m "feat: the booking link says what the customer can change or cancel (piece 12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The customer cancels through the link

**Files:**
- Modify: `tests/portal-booking-cancel.test.js` (append; widen its imports)
- Create: `tests/booking-link-actions-rate-limit.test.js` (its own server, so its own limiter)
- Modify: `server/server.js` - `withJobBookingLock`, `applyLocked`, `customerActionRefusal`, `CLEAR_REQUEST` after `withBookingLock` (:2577-2594); the cancel route after the link GET

**Interfaces:**
- Consumes: `resolveBookingLink`, `bookingLinkView`, `customerCanAct`, `CUSTOMER_ACTIONABLE` (Task 3); `syncJobHold` (Task 2).
- Produces (server.js):
  - `async function withJobBookingLock(jobId, extraDates, fn)` - the booking lock for the job's `job_date`, its `requested_job_date` (if any) and `extraDates`; calls `fn(job)` with the row read `FOR UPDATE` under the lock; returns `fn`'s result (a `{ status, body }` refusal, or `undefined` for success), or `{ gone: true }` when the job no longer exists.
  - `async function applyLocked(job, event)` - `applyEvent` on `bookingRequest` with `job.version`; throws if refused.
  - `function customerActionRefusal(job, action) -> { status, body } | null` for `action` `'cancel' | 'change'`.
  - `const CLEAR_REQUEST` - SQL fragment setting the five `requested_*` columns to NULL.
  - Route `POST /api/portal/:shopSlug/booking-links/:code/cancel` -> 200 with `bookingLinkView`.

Link calls in `tests/portal-booking-cancel.test.js` after this task: 6 + 9 = 15. The limiter test's 31 calls run in their own file.

- [ ] **Step 1: Write the failing tests.** In `tests/portal-booking-cancel.test.js` widen the imports to:

```js
import { startLiveServer, TEST_CLOCK_PIN } from './helpers/liveServer.js';
import { shopToday } from '../server/clock.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import {
  linkActions, bookOnline, liveHolds, jobRow, setJob, seedRequest, dayMaker, holdBookingLock, stillWaiting,
} from './helpers/linkActions.js';
```

and append:

```js
// ---- Cancelling (Task 4) ----

const accept = (id) => staffRequest(server.baseUrl, owner.cookie, `/api/workshop-jobs/${id}/accept`, { method: 'POST', body: { version: 1 } });
const holdsOf = (id) => liveHolds(shopId(), id);
const IN_SHOP = { error: 'Your bike is already with the shop - please contact them to cancel', code: 'in_shop' };

test('cancelling an unconfirmed booking frees its time and records the customer', async () => {
  const booked = await book();
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.stage, 'cancelled');
  assert.equal(res.body.canCancel, false);
  const row = await jobRow(shopId(), booked.id);
  assert.equal(row.booking_state, 'cancelled');
  assert.equal(row.cancelled_by, 'customer');
  assert.ok(row.cancelled_at, 'cancelled_at is set');
  assert.deepEqual(await holdsOf(booked.id), []);
});

test('cancelling a confirmed booking works the same', async () => {
  const booked = await book();
  assert.equal((await accept(booked.id)).status, 200);
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.stage, 'cancelled');
  assert.deepEqual(await holdsOf(booked.id), []);
});

test('cancelling a booking with a change request lets both times go and forgets the request', async () => {
  const booked = await book();
  assert.equal((await accept(booked.id)).status, 200);
  await seedRequest(shopId(), booked.id, { jobDate: nextDay(), mechanicId: sam });
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.requested, null);
  assert.equal((await jobRow(shopId(), booked.id)).requested_job_date, null);
  assert.deepEqual(await holdsOf(booked.id), []);
});

test('a bike already with the shop cannot be cancelled online', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, "booking_state = 'scheduled', custody_state = 'in_shop'");
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, IN_SHOP);
  assert.equal((await jobRow(shopId(), booked.id)).booking_state, 'scheduled');
});

test('a declined booking cannot be cancelled online', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, "booking_state = 'declined'");
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: "This booking can't be cancelled online", code: 'illegal' });
});

test('cancelling forgets a declined change', async () => {
  const booked = await book();
  await setJob(shopId(), booked.id, 'change_declined_at = now()');
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.changeDeclined, false);
});

test('cancel refuses a made-up code', async () => {
  const res = await link.cancel('0'.repeat(64));
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: "We can't find that booking" });
});

test('cancel refuses an expired link', async () => {
  const booked = await book();
  const today = shopToday('Europe/London', new Date(TEST_CLOCK_PIN));
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 31);
  await setJob(shopId(), booked.id, 'job_date = ?', d.toISOString().slice(0, 10));
  const res = await link.cancel(booked.code);
  assert.equal(res.status, 410);
  assert.deepEqual(res.body, { error: 'This link has expired' });
  assert.equal((await jobRow(shopId(), booked.id)).booking_state, 'pending');
});

test('a cancel waits while another booking write holds its day', async () => {
  const booked = await book();
  const release = await holdBookingLock(shopId(), booked.jobDate);
  let pending;
  try {
    pending = link.cancel(booked.code);
    assert.equal(await stillWaiting(pending), true, 'the cancel did not wait for the lock');
  } finally {
    await release();
  }
  assert.equal((await pending).status, 200);
});
```

The shared limit needs a server whose limiter nothing else has touched (`tests/booking-link-rate-limit.test.js` already spends its own server's 31), so it gets its own file, `tests/booking-link-actions-rate-limit.test.js`:

```js
// The link's change routes share the read route's attempt limit (piece 12):
// 30 per 15 minutes per IP across every link route, not 30 each.
// Its own file, so its own server and its own limiter.
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { linkActions } from './helpers/linkActions.js';

let server;
let owner;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

test('cancel attempts count against the same limit as reading the link', async () => {
  const link = linkActions(server.baseUrl, owner.shop.slug);
  const madeUp = '0'.repeat(64);
  for (let i = 0; i < 30; i++) {
    assert.equal((await link.cancel(madeUp)).status, 404, `attempt ${i + 1}`);
  }
  assert.equal((await link.read(madeUp)).status, 429);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/portal-booking-cancel.test.js tests/booking-link-actions-rate-limit.test.js`
Expected: every new test FAILS on the dispatcher's answer for a route that does not exist. "cancel refuses a made-up code" also gets a 404 from the dispatcher, so it must fail on the **body** (not `{ error: "We can't find that booking" }`) - if the dispatcher's body happens to match, record it as a *guard* and rely on its mutation. The limiter test fails because the 31st call is not 429. The Task 3 tests still PASS.

- [ ] **Step 3: Implement.** In `server/server.js`, directly after `withBookingLock` (:2594):

```js
// The booking lock for every day a job touches (piece 12): its own day, the
// day it asked to move to, and `extraDates` (where it is moving now). The days
// are read before the lock, so the job is read again under it - FOR UPDATE, so
// nothing else writes it until this commits - and if it moved in between, the
// lock is taken again for its new days. fn(job) returns a { status, body }
// refusal or undefined; this returns that, or { gone: true } when the job no
// longer exists.
const JOB_MOVED = Symbol('job moved');
async function withJobBookingLock(jobId, extraDates, fn) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = await db.prepare('SELECT job_date, requested_job_date FROM workshop_jobs WHERE id = ?').get(jobId);
    if (!before) return { gone: true };
    const dates = [before.job_date, before.requested_job_date, ...extraDates].filter(Boolean);
    const out = await withBookingLock(dates, async () => {
      const job = await db.prepare('SELECT * FROM workshop_jobs WHERE id = ? FOR UPDATE').get(jobId);
      if (!job) return { gone: true };
      if (job.job_date !== before.job_date || job.requested_job_date !== before.requested_job_date) return JOB_MOVED;
      return fn(job);
    });
    if (out !== JOB_MOVED) return out;
  }
  throw new Error(`workshop job ${jobId} kept moving while its booking days were being locked`);
}

// A booking-state change on a job read FOR UPDATE under the lock: nothing can
// have moved it since, so a refusal here is a bug, not a race - it throws, and
// the whole write rolls back.
async function applyLocked(job, event) {
  const moved = await applyEvent({ jobId: job.id, machine: bookingRequest, event, expectedVersion: job.version });
  if (!moved.ok) throw new Error(`job ${job.id}: ${event} refused under the booking lock: ${moved.message}`);
  return moved.job;
}

// Clears a stored change request (piece 12).
const CLEAR_REQUEST = `requested_job_date = NULL, requested_mechanic_id = NULL, requested_start_time = NULL,
  requested_end_time = NULL, requested_at = NULL`;

// Why the customer may not change or cancel through the link, or null. The
// code is what a screen branches on; the words are the spec's.
const CUSTOMER_REFUSALS = {
  cancel: {
    inShop: 'Your bike is already with the shop - please contact them to cancel',
    other: "This booking can't be cancelled online",
  },
  change: {
    inShop: 'Your bike is already with the shop - please contact them to change it',
    other: "This booking can't be changed online",
  },
};
function customerActionRefusal(job, action) {
  if (job.custody_state !== 'expected') {
    return { status: 409, body: { error: CUSTOMER_REFUSALS[action].inShop, code: 'in_shop' } };
  }
  if (!CUSTOMER_ACTIONABLE.has(job.booking_state)) {
    return { status: 409, body: { error: CUSTOMER_REFUSALS[action].other, code: 'illegal' } };
  }
  return null;
}
```

`CUSTOMER_ACTIONABLE` is declared (Task 3) near `serializeWorkshopJob` at :2381, which is above :2577 - no ordering problem for a `const` read at request time.

Then directly after the booking-link GET route:

```js
// The customer cancels through their private link (piece 12, decision 1):
// allowed until the bike reaches the shop, immediate, and every hold of the
// job - its own and a requested one - goes at once.
// screens: cancel, cancelled
route('POST', '/api/portal/:shopSlug/booking-links/:code/cancel', async (req, res, params, query, shop) => {
  const found = await resolveBookingLink(req, res, params.code);
  if (!found) return;
  const out = await withJobBookingLock(found.id, [], async (job) => {
    const refused = customerActionRefusal(job, 'cancel');
    if (refused) return refused;
    await applyLocked(job, 'cancel');
    await db.prepare(
      `UPDATE workshop_jobs SET cancelled_by = 'customer', cancelled_at = now(), change_declined_at = NULL, ${CLEAR_REQUEST}
       WHERE id = ?`
    ).run(job.id);
    await syncJobHold(job.id);
    return undefined;
  });
  if (out?.gone) return sendJson(res, 404, { error: "We can't find that booking" });
  if (out) return sendJson(res, out.status, out.body);
  sendJson(res, 200, await bookingLinkView(found.id, shop));
});
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/portal-booking-cancel.test.js tests/booking-link-actions-rate-limit.test.js tests/portal-booking-link.test.js tests/workshop-holds-follow.test.js`
Expected: all PASS.

- [ ] **Step 5: Prove every test bites**

| Test | Mutation (server.js) | Expected failure |
|---|---|---|
| cancelling an unconfirmed booking frees its time and records the customer | in the cancel UPDATE, delete `cancelled_by = 'customer', ` | `null !== 'customer'` |
| cancelling a confirmed booking works the same | in the cancel route, before `customerActionRefusal`, add `if (job.booking_state !== 'pending') return { status: 409, body: { error: 'MUTATION' } };` | 409, not 200 |
| cancelling a booking with a change request lets both times go and forgets the request | delete `, ${CLEAR_REQUEST}` from the cancel UPDATE | `requested_job_date` is a date, not null |
| a bike already with the shop cannot be cancelled online | in `customerActionRefusal`, delete the `custody_state` block | 200, not 409 |
| a declined booking cannot be cancelled online | in `customerActionRefusal`, delete the `CUSTOMER_ACTIONABLE` block | 500 (`applyLocked` throws) or a different body, not the expected 409 |
| cancelling forgets a declined change | delete `change_declined_at = NULL, ` from the cancel UPDATE | `true !== false` |
| cancel refuses a made-up code | in the cancel route, delete `if (!found) return;` | 500 (`found.id` of null), not 404 |
| cancel refuses an expired link | in `resolveBookingLink`, delete the `isLinkExpired` block | 200, not 410 |
| a cancel waits while another booking write holds its day | in `withJobBookingLock`, `const dates = [...extraDates].filter(Boolean);` | "the cancel did not wait for the lock" |
| cancel attempts count against the same limit as reading the link | in the cancel route, before `resolveBookingLink`, add `bookingLinkLimiter.reset(clientIp(req));` | the read answers 404, not 429 |

- [ ] **Step 6: Commit**

```bash
git add tests/portal-booking-cancel.test.js tests/booking-link-actions-rate-limit.test.js server/server.js
git commit -m "feat: customers cancel through the private link (piece 12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: An unconfirmed booking moves at once

**Files:**
- Create: `tests/portal-booking-change.test.js`
- Modify: `server/server.js` - `loadCapacity` (:4686) gains `{ ignoreJobId }`; new `checkCustomerTime` above the booking POST (:4848); the booking POST's in-lock time checks (:4996-5043) call it; new `changeBookingTime` and the change route after the cancel route

**Interfaces:**
- Consumes: `withJobBookingLock`, `applyLocked`, `customerActionRefusal`, `resolveBookingLink`, `bookingLinkView` (Tasks 3-4); `checkJobSlot` with requested slots (Task 2).
- Produces (server.js):
  - `async function loadCapacity(start, end, { ignoreJobId = null } = {})` - leaves that job's own booking and its request out.
  - `async function checkCustomerTime({ jobDate, mechanicId, startTime, minutes, ignoreJobId = null }) -> { times: { startTime, endTime } } | { refusal: { status, body } }` - the booking route's checks, in its order.
  - `async function changeBookingTime(job, { jobDate, mechanicId, startTime })` - `fn` for `withJobBookingLock`; this task handles `pending`; Task 6 adds the request branch.
  - Route `POST /api/portal/:shopSlug/booking-links/:code/change`, body `{ jobDate, mechanicId, startTime? }` -> 200 with `bookingLinkView`.

Link calls in `tests/portal-booking-change.test.js`: 18.

- [ ] **Step 1: Write the failing tests** `tests/portal-booking-change.test.js`

```js
// An unconfirmed booking moves at once through its private link (piece 12,
// decision 4): it stays awaiting confirmation, its hold moves with it, and
// the new time passes every check a new booking's time passes - with the
// booking's own time never counted against itself.
// Link calls in this file must stay under 30 (the limiter is per server).
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer, TEST_CLOCK_PIN } from './helpers/liveServer.js';
import { shopToday } from '../server/clock.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import {
  linkActions, bookOnline, tryBooking, liveHolds, jobRow, setJob, dayMaker, holdBookingLock, stillWaiting,
} from './helpers/linkActions.js';

let server;
let owner;
let sam;
let alex;
let types;
let customer;
let link;
const nextDay = dayMaker();
const PINNED_TODAY = shopToday('Europe/London', new Date(TEST_CLOCK_PIN));
const TOO_SOON = "That's too soon for the shop - please choose a later time or day.";

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  link = linkActions(server.baseUrl, owner.shop.slug);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const book = (jobDate = nextDay(), startTime = '10:00') => bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
  mechanicId: sam, jobDate, startTime, serviceIds: [types.repair],
});
const shopId = () => owner.shop.id;

test('an unconfirmed booking moves at once and stays awaiting confirmation', async () => {
  const booked = await book();
  const to = nextDay();
  const res = await link.change(booked.code, { jobDate: to, mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.jobDate, to);
  assert.equal(res.body.startTime, '14:00');
  assert.equal(res.body.stage, 'awaiting_confirmation');
  assert.equal(res.body.requested, null);
  const row = await jobRow(shopId(), booked.id);
  assert.deepEqual({ d: row.job_date, s: row.start_time, e: row.end_time, b: row.booking_state }, { d: to, s: '14:00', e: '15:00', b: 'pending' });
  assert.deepEqual(await liveHolds(shopId(), booked.id), [{ job_date: to, start_time: '14:00', mechanic_id: sam, purpose: 'booking' }]);
});

test('an unconfirmed booking can move to another mechanic', async () => {
  const booked = await book();
  const res = await link.change(booked.code, { jobDate: booked.jobDate, mechanicId: alex, startTime: '10:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await jobRow(shopId(), booked.id)).mechanic_id, alex);
  assert.equal((await liveHolds(shopId(), booked.id))[0].mechanic_id, alex);
});

test('moving within its own time does not collide with itself', async () => {
  const booked = await book(); // 10:00-11:00
  const res = await link.change(booked.code, { jobDate: booked.jobDate, mechanicId: sam, startTime: '10:30' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
});

test("an unconfirmed booking cannot move into another booking's time", async () => {
  const day = nextDay();
  await book(day, '14:00');
  const mine = await book();
  const res = await link.change(mine.code, { jobDate: day, mechanicId: sam, startTime: '14:30' });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, {
    error: 'That mechanic is already booked over part of that window - please choose another time.', code: 'capacity',
  });
});

test("a day before the shop's today is refused", async () => {
  const booked = await book();
  const d = new Date(`${PINNED_TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const res = await link.change(booked.code, { jobDate: d.toISOString().slice(0, 10), mechanicId: sam, startTime: '10:00' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'That date has passed - please choose another day.' });
});

test("a time sooner than the shop's notice is refused", async () => {
  const booked = await book();
  // 07:00 on the pinned day plus 2h50 makes 09:50 the earliest start.
  const put = await staff('/api/workshop-settings', { method: 'PUT', body: { minNoticeMinutes: 170 } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  const res = await link.change(booked.code, { jobDate: PINNED_TODAY, mechanicId: sam, startTime: '09:30' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: TOO_SOON });
});

test("time the mechanic isn't available is refused", async () => {
  const booked = await book();
  const day = nextDay();
  const block = await staff('/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'dates', mechanicId: sam, startDate: day, endDate: day, startTime: '13:00', endTime: '15:00', reason: 'Dentist' },
  });
  assert.equal(block.status, 201, JSON.stringify(block.body));
  const res = await link.change(booked.code, { jobDate: day, mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'That mechanic is unavailable at that time - please choose another time or day.' });
});

test("a day without the mechanic's free minutes is refused", async () => {
  const booked = await book();
  const day = nextDay();
  // 09:00-18:00 is 540 minutes; 500 of them taken leaves 40, short of the hour.
  const big = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Rebuild', jobDate: day, mechanicId: sam, plannedMinutes: 500 } });
  assert.equal(big.status, 201, JSON.stringify(big.body));
  const res = await link.change(booked.code, { jobDate: day, mechanicId: sam, startTime: '10:00' });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, {
    error: 'That mechanic does not have enough free time that day - please choose another day, or a shorter job.', code: 'capacity',
  });
});

test("the booking's own minutes are not counted against its new time on the same day", async () => {
  const day = nextDay();
  const booked = await book(day, '10:00');
  // 540 - 60 (this booking) - 440 = 40 free with it counted; 100 without.
  const big = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Rebuild', jobDate: day, mechanicId: sam, plannedMinutes: 440 } });
  assert.equal(big.status, 201, JSON.stringify(big.body));
  const res = await link.change(booked.code, { jobDate: day, mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
});

test('a change needs a real date and a mechanic', async () => {
  const booked = await book();
  const noDate = await link.change(booked.code, { jobDate: '2026-02-30', mechanicId: sam, startTime: '10:00' });
  assert.deepEqual([noDate.status, noDate.body], [400, { error: 'A valid date is required' }]);
  const noMechanic = await link.change(booked.code, { jobDate: nextDay(), startTime: '10:00' });
  assert.deepEqual([noMechanic.status, noMechanic.body], [400, { error: 'Please choose a mechanic' }]);
});

test('change refuses a made-up code', async () => {
  const res = await link.change('0'.repeat(64), { jobDate: nextDay(), mechanicId: sam, startTime: '10:00' });
  assert.deepEqual([res.status, res.body], [404, { error: "We can't find that booking" }]);
});

test('change refuses an expired link', async () => {
  const booked = await book();
  const d = new Date(`${PINNED_TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 31);
  await setJob(shopId(), booked.id, 'job_date = ?', d.toISOString().slice(0, 10));
  const res = await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '10:00' });
  assert.deepEqual([res.status, res.body], [410, { error: 'This link has expired' }]);
});

test('a change waits while another booking write holds the new day', async () => {
  const booked = await book();
  const to = nextDay();
  const release = await holdBookingLock(shopId(), to);
  let pending;
  try {
    pending = link.change(booked.code, { jobDate: to, mechanicId: sam, startTime: '14:00' });
    assert.equal(await stillWaiting(pending), true, 'the change did not wait for the lock');
  } finally {
    await release();
  }
  assert.equal((await pending).status, 200);
});

test('a change and a new booking for overlapping times at once: exactly one gets it', async () => {
  const mine = await book();
  const day = nextDay();
  // 14:00-15:00 and 14:30-15:30 overlap but start apart, so only the lock and
  // the overlap check - never the hold index - can keep them apart.
  const [moved, booked] = await Promise.all([
    link.change(mine.code, { jobDate: day, mechanicId: sam, startTime: '14:00' }),
    tryBooking(server.baseUrl, customer.cookie, owner.shop.slug, { mechanicId: sam, jobDate: day, startTime: '14:30', serviceIds: [types.repair] }),
  ]);
  const won = [moved.status === 200, booked.status === 201].filter(Boolean).length;
  assert.equal(won, 1, JSON.stringify([moved, booked]));
  const loser = moved.status === 200 ? booked : moved;
  assert.equal(loser.status, 409, JSON.stringify(loser.body));
  assert.equal(loser.body.code, 'capacity');
});

// Last: moves a date far ahead to drop-off, so nothing else in this file meets it.
test('a drop-off day takes the day, not a time', async () => {
  const far = new Date(`${nextDay()}T00:00:00Z`);
  far.setUTCDate(far.getUTCDate() + 150);
  const dropDay = far.toISOString().slice(0, 10);
  const put = await staff('/api/workshop-settings', { method: 'PUT', body: { nextBookingMode: 'dropoff', nextBookingModeFrom: dropDay } });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  const booked = await book();
  const timed = await link.change(booked.code, { jobDate: dropDay, mechanicId: sam, startTime: '10:00' });
  assert.equal(timed.status, 400, JSON.stringify(timed.body));
  assert.deepEqual(timed.body, { error: 'This shop takes drop-offs on that day - choose the day, not a time.' });
  const day = await link.change(booked.code, { jobDate: dropDay, mechanicId: sam });
  assert.equal(day.status, 200, JSON.stringify(day.body));
  assert.equal(day.body.startTime, '');
});
```

Note for "a time sooner than the shop's notice": the shop's notice stays at 170 for the rest of the file; every other test uses days three weeks out, which it cannot affect. If `PUT /api/workshop-settings` refuses a body with only `minNoticeMinutes`, send `{ bookingMode: 'timed', minNoticeMinutes: 170 }` as `tests/portal-booking-request.test.js:407-409` does.

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/portal-booking-change.test.js`
Expected: every test FAILS with the dispatcher's 404 for the missing route (and on its body for "change refuses a made-up code").

- [ ] **Step 3: Give `loadCapacity` an `ignoreJobId`.** Change its signature to `async function loadCapacity(start, end, { ignoreJobId = null } = {})`, add `AND (?::int IS NULL OR id <> ?::int)` to both job queries (the live-jobs one and Task 2's requested one), passing `ignoreJobId, ignoreJobId` after `start, end`. Add to its comment: "`ignoreJobId` leaves one job's own booking and request out - a change is never counted against the booking it changes (piece 12)."

- [ ] **Step 4: Extract `checkCustomerTime`.** Directly above `route('POST', '/api/portal/:shopSlug/bookings', ...)` add the function below - its body is the booking route's in-lock checks (:4999-5043) moved verbatim, with `mechResolved.mechanicId` renamed `mechanicId`, `body.startTime` renamed `rawStart`, `loadCapacity(jobDate, jobDate)` given `{ ignoreJobId }` and `checkJobSlot` given `ignoreJobId`:

```js
// Every check a customer's chosen time passes, in the booking route's order,
// run inside the booking lock. Shared by a new booking and a change (piece
// 12), so a change passes exactly what a booking passes. `ignoreJobId` leaves
// the job's own booking and request out, so a change never collides with the
// booking it changes. Returns { times } or { refusal }, the { status, body } a
// route sends.
async function checkCustomerTime({ jobDate, mechanicId, startTime: rawStart, minutes, ignoreJobId = null }) {
  // The mode for this date decides what the customer chose: a day (drop-off)
  // or a time (timed). Read inside the lock, from the calculator.
  const capacity = await loadCapacity(jobDate, jobDate, { ignoreJobId });
  // Nothing in the past, and nothing sooner than the shop's minimum notice,
  // on the shop's own clock (piece 10) - the same rule availability applies.
  const moment = currentMoment();
  if (jobDate < shopToday(capacity.settings.timeZone, moment)) {
    return { refusal: refusal('That date has passed - please choose another day.') };
  }
  const earliest = earliestBookable(capacity.settings, moment);
  const mode = capacity.days[0].mode;
  const startTime = (rawStart || '').trim();
  let times;
  if (mode === 'dropoff') {
    if (startTime) return { refusal: refusal('This shop takes drop-offs on that day - choose the day, not a time.') };
    times = { startTime: '', endTime: '' };
  } else {
    times = resolveJobTimes(startTime, startTime ? addMinutesToTime(startTime, minutes) : '');
    if (!times.startTime) return { refusal: refusal('A start time is required') };
    if (times.error) return { refusal: refusal(times.error) };
  }
  const inTime = mode === 'dropoff'
    ? dropoffIsInTime(earliest, jobDate, capacity.settings.dropoffWindowEnd)
    : startIsInTime(earliest, jobDate, times.startTime);
  if (!inTime) return { refusal: refusal("That's too soon for the shop - please choose a later time or day.") };

  // Closed days, the day's own opening hours and mechanic overlap first - the
  // same rules the staff routes enforce, from the same place, so their
  // specific messages win.
  const slot = await checkJobSlot({ jobDate, startTime: times.startTime, endTime: times.endTime, mechanicId, ignoreJobId });
  if (slot) return { refusal: slot.taken ? capacityRefusal(slot.error) : refusal(slot.error) };

  // Blocks and the shop's hours are shop rules (400); minutes other bookings
  // have used are capacity (409). The reserve check subtracts the job being
  // booked (freeMinutes has the reserve taken off already). Staff routes
  // deliberately do NOT apply this - a shop may choose to work through its
  // own lunch; a customer may not choose it for them. A block's reason is
  // never given.
  const mech = capacity.days[0].mechanics.find((m) => m.mechanicId === mechanicId);
  if (!mech || !mech.working || (times.startTime && !fitsFreeTime(mech, times.startTime, times.endTime))) {
    return { refusal: refusal('That mechanic is unavailable at that time - please choose another time or day.') };
  }
  if (mech.freeMinutes < minutes) {
    return { refusal: capacityRefusal('That mechanic does not have enough free time that day - please choose another day, or a shorter job.') };
  }
  return { times };
}
```

In the booking route, replace everything from `// The mode for this date decides` (:4997) through the `freeMinutes` refusal (:5043) with:

```js
    const checked = await checkCustomerTime({ jobDate, mechanicId: mechResolved.mechanicId, startTime: body.startTime, minutes });
    if (checked.refusal) return checked.refusal;
    const { times } = checked;
```

Update the route's comment above `withBookingLock` (:4993-4995) to "Inside the lock: the time checks (checkCustomerTime), then the writes."

- [ ] **Step 5: Confirm the extraction changed nothing for bookings**

Run: `node --test tests/portal-booking-request.test.js tests/portal-dropoff-booking.test.js tests/portal-capacity-holds.test.js tests/portal-capacity-reserve.test.js tests/portal-booking-blocks.test.js tests/booking-lock.test.js tests/shop-today-boundary.test.js tests/portal-availability-capacity.test.js tests/portal-booking-multi.test.js`
Expected: all PASS.

- [ ] **Step 6: Add `changeBookingTime` and the route.** After the cancel route:

```js
// A change of day, mechanic or time through the link (piece 12). The new time
// passes checkCustomerTime with the booking's own job left out. An unconfirmed
// booking moves at once and stays unconfirmed (decision 4); its hold moves
// with it. (Task 6: a confirmed booking's change becomes a request.)
async function changeBookingTime(job, { jobDate, mechanicId, startTime }) {
  const refused = customerActionRefusal(job, 'change');
  if (refused) return refused;
  // Every online booking stores its services' total as planned_minutes; a
  // staff job with a link falls back to its times, then to the not-sure hour.
  const minutes = job.planned_minutes
    || (job.start_time ? Math.max(0, timeToMinutes(job.end_time) - timeToMinutes(job.start_time)) : 60);
  const checked = await checkCustomerTime({ jobDate, mechanicId, startTime, minutes, ignoreJobId: job.id });
  if (checked.refusal) return checked.refusal;
  const { times } = checked;
  await applyLocked(job, 'change_time');
  await db.prepare(
    `UPDATE workshop_jobs SET job_date = ?, mechanic_id = ?, start_time = ?, end_time = ?, change_declined_at = NULL, updated_at = now()
     WHERE id = ?`
  ).run(jobDate, mechanicId, times.startTime, times.endTime, job.id);
  await syncJobHold(job.id);
  return undefined;
}

// screens: reschedule, change-pending
route('POST', '/api/portal/:shopSlug/booking-links/:code/change', async (req, res, params, query, shop) => {
  const found = await resolveBookingLink(req, res, params.code);
  if (!found) return;
  const body = await readJsonBody(req);
  const jobDate = String(body.jobDate ?? '').trim();
  if (!isRealDate(jobDate)) return badRequest(res, 'A valid date is required');
  const mechResolved = await resolveJobMechanicId(body.mechanicId, null);
  if (!mechResolved.ok || !mechResolved.mechanicId) return badRequest(res, 'Please choose a mechanic');
  let out;
  try {
    out = await withJobBookingLock(found.id, [jobDate], (job) =>
      changeBookingTime(job, { jobDate, mechanicId: mechResolved.mechanicId, startTime: body.startTime }));
  } catch (err) {
    // The 024 index, behind the lock: another live hold took the exact slot.
    // Thrown out of the lock, so every write of this change rolled back.
    if (err.code !== '23505') throw err;
    out = capacityRefusal(SLOT_GONE);
  }
  if (out?.gone) return sendJson(res, 404, { error: "We can't find that booking" });
  if (out) return sendJson(res, out.status, out.body);
  sendJson(res, 200, await bookingLinkView(found.id, shop));
});
```

(`startTime` is passed raw; `checkCustomerTime` trims it as the booking route does. A non-string `startTime` crashes the same way it does on the booking route today - unchanged behaviour, not fixed here.)

- [ ] **Step 7: Run the tests**

Run: `node --test tests/portal-booking-change.test.js tests/portal-booking-cancel.test.js`
Expected: all PASS.

- [ ] **Step 8: Prove every test bites**

| Test | Mutation (server.js) | Expected failure |
|---|---|---|
| an unconfirmed booking moves at once and stays awaiting confirmation | in `changeBookingTime`, delete the `UPDATE workshop_jobs SET job_date ...` statement | `jobDate` is the old day |
| an unconfirmed booking can move to another mechanic | in that UPDATE, `mechanic_id = mechanic_id` in place of `mechanic_id = ?` (drop its argument) | `sam !== alex` |
| moving within its own time does not collide with itself | in `changeBookingTime`, `ignoreJobId: null` | 409 overlap, not 200 |
| an unconfirmed booking cannot move into another booking's time | in `checkCustomerTime`, delete the `checkJobSlot` call and its `if (slot)` | 200, not 409 |
| a day before the shop's today is refused | in `checkCustomerTime`, delete the past-date `if` | not the past-date body |
| a time sooner than the shop's notice is refused | in `checkCustomerTime`, `if (false && !inTime)` | 200 or a different body |
| time the mechanic isn't available is refused | in `checkCustomerTime`, delete `\|\| (times.startTime && !fitsFreeTime(...))` | 200, not 400 |
| a day without the mechanic's free minutes is refused | in `checkCustomerTime`, delete the `freeMinutes` `if` | 200, not 409 |
| the booking's own minutes are not counted against its new time on the same day | in `loadCapacity`, delete the `AND (?::int IS NULL OR id <> ?::int)` from the live-jobs query (and its two arguments) | 409 capacity, not 200 |
| a change needs a real date and a mechanic | in the change route, delete the `isRealDate` line | not `[400, { error: 'A valid date is required' }]` |
| change refuses a made-up code | in the change route, delete `if (!found) return;` | 500, not 404 |
| change refuses an expired link | in `resolveBookingLink`, delete the `isLinkExpired` block | 200, not 410 |
| a change waits while another booking write holds the new day | in the change route, pass `[]` instead of `[jobDate]` to `withJobBookingLock` | "the change did not wait for the lock" |
| a change and a new booking for overlapping times at once: exactly one gets it | in `withJobBookingLock`, call `withBookingLock([], ...)` | two winners. Timing-dependent: run the test up to 10 times under the mutation (`for i in $(seq 10); do node --test --test-name-pattern "exactly one gets it" tests/portal-booking-change.test.js \| grep -E '^# (pass\|fail)'; done`) and report how many runs failed. If none fail, say so - do not claim it bites. |
| a drop-off day takes the day, not a time | in `checkCustomerTime`, delete `if (startTime) return { refusal: ... drop-offs ... };` | 200, not 400 |

- [ ] **Step 9: Commit**

```bash
git add tests/portal-booking-change.test.js server/server.js
git commit -m "feat: an unconfirmed booking moves at once through its link (piece 12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: A confirmed booking's change is a request; the customer can withdraw it

**Files:**
- Create: `tests/portal-booking-change-request.test.js`
- Modify: `server/server.js` - `changeBookingTime` gains the request branch; new `withdrawRequest` and the withdraw route after the change route

**Interfaces:**
- Consumes: Task 5's `changeBookingTime`, `checkCustomerTime`; Task 2's `syncRequestedHold` (through `syncJobHold`).
- Produces (server.js): `async function withdrawRequest(job)` (applies `withdraw`, clears the request and `change_declined_at`, syncs holds). Route `POST /api/portal/:shopSlug/booking-links/:code/withdraw-change` -> 200 with `bookingLinkView`.

Link calls in `tests/portal-booking-change-request.test.js`: 21.

- [ ] **Step 1: Write the failing tests** `tests/portal-booking-change-request.test.js`

```js
// A confirmed booking's change is a request staff answer (piece 12, decisions
// 2 and 6): the booking keeps its time, the requested time is held too, a new
// request replaces the old, and the customer can withdraw it.
// Link calls in this file must stay under 30 (the limiter is per server).
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer, TEST_CLOCK_PIN } from './helpers/liveServer.js';
import { shopToday } from '../server/clock.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import {
  linkActions, bookOnline, liveHolds, jobRow, setJob, dayMaker, holdBookingLock, stillWaiting,
} from './helpers/linkActions.js';

let server;
let owner;
let sam;
let types;
let customer;
let link;
const nextDay = dayMaker();
const PINNED_TODAY = shopToday('Europe/London', new Date(TEST_CLOCK_PIN));

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  link = linkActions(server.baseUrl, owner.shop.slug);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const shopId = () => owner.shop.id;
// A confirmed booking at 10:00-11:00 with Sam.
async function confirmed(jobDate = nextDay()) {
  const booked = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate, startTime: '10:00', serviceIds: [types.repair],
  });
  const accepted = await staffRequest(server.baseUrl, owner.cookie, `/api/workshop-jobs/${booked.id}/accept`, { method: 'POST', body: { version: 1 } });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  return booked;
}
const own = (booked) => ({ job_date: booked.jobDate, start_time: '10:00', mechanic_id: sam, purpose: 'booking' });
const wantedHold = (jobDate, start = '14:00') => ({ job_date: jobDate, start_time: start, mechanic_id: sam, purpose: 'requested' });

test('asking to move a confirmed booking holds both times', async () => {
  const booked = await confirmed();
  const to = nextDay();
  const res = await link.change(booked.code, { jobDate: to, mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.stage, 'change_requested');
  assert.deepEqual(res.body.requested, { jobDate: to, startTime: '14:00', mechanicId: sam });
  assert.deepEqual(await liveHolds(shopId(), booked.id), [own(booked), wantedHold(to)]);
});

test('a request keeps the booking where it is until staff answer', async () => {
  const booked = await confirmed();
  const res = await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.jobDate, booked.jobDate);
  const row = await jobRow(shopId(), booked.id);
  assert.deepEqual({ d: row.job_date, s: row.start_time, b: row.booking_state }, { d: booked.jobDate, s: '10:00', b: 'reschedule_requested' });
  assert.ok(row.requested_at, 'requested_at is set');
});

test('a second request replaces the first and lets its time go', async () => {
  const booked = await confirmed();
  const first = nextDay();
  const second = nextDay();
  assert.equal((await link.change(booked.code, { jobDate: first, mechanicId: sam, startTime: '14:00' })).status, 200);
  const res = await link.change(booked.code, { jobDate: second, mechanicId: sam, startTime: '11:30' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.requested, { jobDate: second, startTime: '11:30', mechanicId: sam });
  assert.deepEqual(await liveHolds(shopId(), booked.id), [own(booked), wantedHold(second, '11:30')]);
});

test('asking for the time already booked withdraws the request', async () => {
  const booked = await confirmed();
  assert.equal((await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' })).status, 200);
  const res = await link.change(booked.code, { jobDate: booked.jobDate, mechanicId: sam, startTime: '10:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.stage, 'confirmed');
  assert.equal(res.body.requested, null);
  assert.deepEqual(await liveHolds(shopId(), booked.id), [own(booked)]);
});

test('a request passes the same time checks as a booking', async () => {
  const booked = await confirmed();
  const d = new Date(`${PINNED_TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const res = await link.change(booked.code, { jobDate: d.toISOString().slice(0, 10), mechanicId: sam, startTime: '10:00' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'That date has passed - please choose another day.' });
});

test('a request may overlap the booking it would replace', async () => {
  const booked = await confirmed(); // 10:00-11:00
  const res = await link.change(booked.code, { jobDate: booked.jobDate, mechanicId: sam, startTime: '10:30' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(await liveHolds(shopId(), booked.id), [own(booked), wantedHold(booked.jobDate, '10:30')]);
});

test('asking again forgets a declined change', async () => {
  const booked = await confirmed();
  await setJob(shopId(), booked.id, 'change_declined_at = now()');
  const res = await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.changeDeclined, false);
});

test('a bike already with the shop cannot be changed online', async () => {
  const booked = await confirmed();
  await setJob(shopId(), booked.id, "custody_state = 'in_shop'");
  const res = await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'Your bike is already with the shop - please contact them to change it', code: 'in_shop' });
});

test('a cancelled booking cannot be changed online', async () => {
  const booked = await confirmed();
  await setJob(shopId(), booked.id, "booking_state = 'cancelled'");
  const res = await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: "This booking can't be changed online", code: 'illegal' });
});

test('withdrawing a request returns to the booking as it was', async () => {
  const booked = await confirmed();
  assert.equal((await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' })).status, 200);
  const res = await link.withdraw(booked.code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.stage, 'confirmed');
  assert.equal(res.body.requested, null);
  const row = await jobRow(shopId(), booked.id);
  assert.deepEqual({ b: row.booking_state, r: row.requested_job_date }, { b: 'scheduled', r: null });
  assert.deepEqual(await liveHolds(shopId(), booked.id), [own(booked)]);
});

test('withdrawing when nothing was asked is refused', async () => {
  const booked = await confirmed();
  const res = await link.withdraw(booked.code);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: "There's no change request to withdraw", code: 'illegal' });
});

test('withdraw refuses a made-up code', async () => {
  const res = await link.withdraw('0'.repeat(64));
  assert.deepEqual([res.status, res.body], [404, { error: "We can't find that booking" }]);
});

test('withdraw refuses an expired link', async () => {
  const booked = await confirmed();
  assert.equal((await link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' })).status, 200);
  const d = new Date(`${PINNED_TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 31);
  await setJob(shopId(), booked.id, 'job_date = ?', d.toISOString().slice(0, 10));
  const res = await link.withdraw(booked.code);
  assert.deepEqual([res.status, res.body], [410, { error: 'This link has expired' }]);
});

test('replacing a request waits while another booking write holds the day first asked for', async () => {
  const booked = await confirmed();
  const first = nextDay();
  assert.equal((await link.change(booked.code, { jobDate: first, mechanicId: sam, startTime: '14:00' })).status, 200);
  const release = await holdBookingLock(shopId(), first);
  let pending;
  try {
    pending = link.change(booked.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' });
    assert.equal(await stillWaiting(pending), true, 'the new request did not wait for the lock on the old one');
  } finally {
    await release();
  }
  assert.equal((await pending).status, 200);
});

test('two customers asking for overlapping times at once: exactly one gets it', async () => {
  const a = await confirmed();
  const b = await confirmed();
  const day = nextDay();
  const [ra, rb] = await Promise.all([
    link.change(a.code, { jobDate: day, mechanicId: sam, startTime: '14:00' }),
    link.change(b.code, { jobDate: day, mechanicId: sam, startTime: '14:30' }),
  ]);
  const statuses = [ra.status, rb.status].sort();
  assert.deepEqual(statuses, [200, 409], JSON.stringify([ra.body, rb.body]));
  assert.equal((ra.status === 409 ? ra : rb).body.code, 'capacity');
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/portal-booking-change-request.test.js`
Expected: request tests FAIL because `changeBookingTime` calls `applyLocked(job, 'change_time')` on a `scheduled` job, which throws - 500; withdraw tests FAIL with the dispatcher's 404; "cannot be changed online" tests PASS already (*guards*, from Task 4's `customerActionRefusal`).

- [ ] **Step 3: Implement.** In `changeBookingTime`, after `if (refused) return refused;` and before the `minutes` line, add the same-slot rule; after `const { times } = checked;` branch on the state. The whole function becomes:

```js
// A change of day, mechanic or time through the link (piece 12). The new time
// passes checkCustomerTime with the booking's own job left out.
// - pending: moves at once and stays pending (decision 4); its hold moves.
// - scheduled: becomes a request (decision 2) - the booking keeps its time
//   and hold, the requested time is stored and held too (decision 6).
// - reschedule_requested: the new request replaces the stored one.
// A confirmed booking asking for the time it already has makes no request,
// and withdraws any it had (decision log D5).
async function changeBookingTime(job, { jobDate, mechanicId, startTime }) {
  const refused = customerActionRefusal(job, 'change');
  if (refused) return refused;
  const sameAsBooked = jobDate === job.job_date && mechanicId === job.mechanic_id
    && (startTime || '').trim() === (job.start_time || '');
  if (job.booking_state !== 'pending' && sameAsBooked) {
    if (job.booking_state === 'reschedule_requested') await withdrawRequest(job);
    return undefined;
  }
  // Every online booking stores its services' total as planned_minutes; a
  // staff job with a link falls back to its times, then to the not-sure hour.
  const minutes = job.planned_minutes
    || (job.start_time ? Math.max(0, timeToMinutes(job.end_time) - timeToMinutes(job.start_time)) : 60);
  const checked = await checkCustomerTime({ jobDate, mechanicId, startTime, minutes, ignoreJobId: job.id });
  if (checked.refusal) return checked.refusal;
  const { times } = checked;
  if (job.booking_state === 'pending') {
    await applyLocked(job, 'change_time');
    await db.prepare(
      `UPDATE workshop_jobs SET job_date = ?, mechanic_id = ?, start_time = ?, end_time = ?, change_declined_at = NULL, updated_at = now()
       WHERE id = ?`
    ).run(jobDate, mechanicId, times.startTime, times.endTime, job.id);
  } else {
    await applyLocked(job, job.booking_state === 'scheduled' ? 'request_reschedule' : 'change_time');
    await db.prepare(
      `UPDATE workshop_jobs SET requested_job_date = ?, requested_mechanic_id = ?, requested_start_time = ?,
         requested_end_time = ?, requested_at = now(), change_declined_at = NULL, updated_at = now()
       WHERE id = ?`
    ).run(jobDate, mechanicId, times.startTime, times.endTime, job.id);
  }
  // Places, moves or keeps the holds to match (syncRequestedHold runs first).
  await syncJobHold(job.id);
  return undefined;
}

// The customer takes their change request back: the booking returns to
// scheduled at the time it kept all along, and the requested time is let go.
async function withdrawRequest(job) {
  await applyLocked(job, 'withdraw');
  await db.prepare(`UPDATE workshop_jobs SET ${CLEAR_REQUEST}, change_declined_at = NULL, updated_at = now() WHERE id = ?`).run(job.id);
  await syncJobHold(job.id);
}
```

`withdrawRequest` is a function declaration, hoisted, so it may sit after `changeBookingTime`. After the change route add:

```js
// screens: change-pending
route('POST', '/api/portal/:shopSlug/booking-links/:code/withdraw-change', async (req, res, params, query, shop) => {
  const found = await resolveBookingLink(req, res, params.code);
  if (!found) return;
  const out = await withJobBookingLock(found.id, [], async (job) => {
    if (job.booking_state !== 'reschedule_requested') {
      return { status: 409, body: { error: "There's no change request to withdraw", code: 'illegal' } };
    }
    await withdrawRequest(job);
    return undefined;
  });
  if (out?.gone) return sendJson(res, 404, { error: "We can't find that booking" });
  if (out) return sendJson(res, out.status, out.body);
  sendJson(res, 200, await bookingLinkView(found.id, shop));
});
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/portal-booking-change-request.test.js tests/portal-booking-change.test.js tests/portal-booking-cancel.test.js tests/booking-requested-hold.test.js`
Expected: all PASS.

- [ ] **Step 5: Prove every test bites**

| Test | Mutation (server.js) | Expected failure |
|---|---|---|
| asking to move a confirmed booking holds both times | in `syncRequestedHold`, delete the `INSERT` block | one hold, not two |
| a request keeps the booking where it is until staff answer | change `if (job.booking_state === 'pending') {` to `if (true) {`, and in that branch change `applyLocked(job, 'change_time')` to `applyLocked(job, job.booking_state === 'scheduled' ? 'request_reschedule' : 'change_time')` so it does not throw | `job_date` is the new day |
| a second request replaces the first and lets its time go | in `syncRequestedHold`, `if (false && h !== keep)` | three live holds |
| asking for the time already booked withdraws the request | delete the `sameAsBooked` block | 409 "That time is no longer available..." (the hold index), not 200 |
| a request passes the same time checks as a booking | replace the `checkCustomerTime` line with `const checked = job.booking_state === 'pending' ? await checkCustomerTime({ jobDate, mechanicId, startTime, minutes, ignoreJobId: job.id }) : { times: { startTime: (startTime \|\| '').trim(), endTime: addMinutesToTime((startTime \|\| '').trim(), minutes) } };` | 200, not 400 |
| a request may overlap the booking it would replace | `ignoreJobId: job.booking_state === 'pending' ? job.id : null` | 409 overlap, not 200 |
| asking again forgets a declined change | delete `change_declined_at = NULL, ` from the request UPDATE | `true !== false` |
| a bike already with the shop cannot be changed online | in `changeBookingTime`, `customerActionRefusal(job, 'cancel')` | the cancel wording, not the change wording |
| a cancelled booking cannot be changed online | in `changeBookingTime`, delete the `customerActionRefusal` line | 500 or a different body |
| withdrawing a request returns to the booking as it was | in `withdrawRequest`, delete `await syncJobHold(job.id);` | two live holds, not one |
| withdrawing when nothing was asked is refused | delete the `booking_state !== 'reschedule_requested'` guard in the withdraw route | 500, not the 409 body |
| withdraw refuses a made-up code | in the withdraw route, delete `if (!found) return;` | 500, not 404 |
| withdraw refuses an expired link | in `resolveBookingLink`, delete the `isLinkExpired` block | 200, not 410 |
| replacing a request waits while another booking write holds the day first asked for | in `withJobBookingLock`, `const dates = [before.job_date, ...extraDates].filter(Boolean);` | "the new request did not wait..." |
| two customers asking for overlapping times at once: exactly one gets it | in `withJobBookingLock`, call `withBookingLock([], ...)` | `[200, 200]`. Timing-dependent: run up to 10 times under the mutation, as Task 5, and report the count. |

- [ ] **Step 6: Commit**

```bash
git add tests/portal-booking-change-request.test.js server/server.js
git commit -m "feat: a confirmed booking's change is a held request the customer can withdraw (piece 12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Staff accept or decline a change request

**Files:**
- Create: `tests/workshop-change-requests.test.js`
- Modify: `server/server.js` - `serializeWorkshopJob` (:2381-2413); `jobActionRoute` (:2999-3030); new routes after `jobActionRoute('expire', ...)` (:3128)

**Interfaces:**
- Consumes: `requestedOf`, `withJobBookingLock`, `applyLocked`, `CLEAR_REQUEST`, `checkJobSlot`, `syncJobHold`.
- Produces: staff job view fields `requested` (`{ jobDate, startTime, endTime, mechanicId } | null`), `cancelledBy`, `cancelledAt`, `cancellationSeenAt`, `changeDeclinedAt`. Routes `POST /api/workshop-jobs/:id/accept-change` and `/decline-change`, body `{ version }` -> 200 with `serializeWorkshopJob`. `jobActionRoute('cancel', ...)` records `cancelled_by = 'staff'`. `const staleRefusal` and `const VERSION_REQUIRED` (server.js).

Link calls in `tests/workshop-change-requests.test.js`: 12.

- [ ] **Step 1: Write the failing tests** `tests/workshop-change-requests.test.js`

```js
// Staff answer a customer's change request (piece 12): accept moves the
// booking to the requested time and leaves it one hold - the requested one;
// decline keeps the original time and tells the customer's link. Both need the
// version staff last read. The old accept/decline refuse a change request, and
// a staff cancellation is recorded as the shop's.
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import { seedWorkshopJob } from './helpers/workshopFixtures.js';
import {
  linkActions, bookOnline, tryBooking, liveHolds, dayMaker, holdBookingLock, stillWaiting,
} from './helpers/linkActions.js';

let server;
let owner;
let sam;
let types;
let customer;
let link;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  link = linkActions(server.baseUrl, owner.shop.slug);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const act = (id, action, body) => staff(`/api/workshop-jobs/${id}/${action}`, { method: 'POST', body });
const read = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body;
const shopId = () => owner.shop.id;

// A confirmed 10:00-11:00 booking with Sam whose customer asked for 14:00 on another day.
async function requested() {
  const booked = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.repair],
  });
  assert.equal((await act(booked.id, 'accept', { version: 1 })).status, 200);
  const to = nextDay();
  const res = await link.change(booked.code, { jobDate: to, mechanicId: sam, startTime: '14:00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { ...booked, to };
}

test('the staff job view shows the request', async () => {
  const job = await requested();
  const view = await read(job.id);
  assert.deepEqual(view.requested, { jobDate: job.to, startTime: '14:00', endTime: '15:00', mechanicId: sam });
  assert.equal(view.bookingState, 'reschedule_requested');
  assert.deepEqual(
    [view.cancelledBy, view.cancelledAt, view.cancellationSeenAt, view.changeDeclinedAt],
    [null, null, null, null]
  );
});

test('accepting a change moves the booking and leaves it one hold', async () => {
  const job = await requested();
  const res = await act(job.id, 'accept-change', { version: (await read(job.id)).version });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(
    { d: res.body.jobDate, s: res.body.startTime, e: res.body.endTime, b: res.body.bookingState, r: res.body.requested },
    { d: job.to, s: '14:00', e: '15:00', b: 'scheduled', r: null }
  );
  assert.deepEqual(await liveHolds(shopId(), job.id), [{ job_date: job.to, start_time: '14:00', mechanic_id: sam, purpose: 'booking' }]);
});

test('the requested hold becomes the booking hold', async () => {
  const job = await requested();
  const holdId = () => runWithShop(shopId(), () => prepare(
    "SELECT id FROM workshop_capacity_holds WHERE workshop_job_id = ? AND state IN ('held', 'confirmed') AND job_date = ?"
  ).get(job.id, job.to));
  const before = (await holdId()).id;
  assert.equal((await act(job.id, 'accept-change', { version: (await read(job.id)).version })).status, 200);
  assert.equal((await holdId()).id, before);
});

test('accepting when the requested time is no longer free is refused and changes nothing', async () => {
  const job = await requested();
  // A job written straight into the table, past every check, over the requested time.
  await seedWorkshopJob({ shopId: shopId(), customerId: null, mechanicId: sam, jobDate: job.to, startTime: '14:30', endTime: '15:30', legacyStatus: 'scheduled' });
  const res = await act(job.id, 'accept-change', { version: (await read(job.id)).version });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'The requested time is no longer free', code: 'capacity' });
  assert.equal((await read(job.id)).bookingState, 'reschedule_requested');
});

test('accepting with a stale version is refused', async () => {
  const job = await requested();
  const res = await act(job.id, 'accept-change', { version: 1 });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'This job changed while you were looking at it. Reload and try again.', code: 'stale' });
  assert.equal((await read(job.id)).bookingState, 'reschedule_requested');
});

test('accepting needs a version', async () => {
  const job = await requested();
  const res = await act(job.id, 'accept-change', {});
  assert.deepEqual([res.status, res.body], [400, { error: 'version is required - send the version you last read' }]);
});

test('there is nothing to accept on a booking with no request', async () => {
  const booked = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.repair],
  });
  const res = await act(booked.id, 'accept-change', { version: 1 });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: "There's no change request to accept", code: 'illegal' });
});

test('declining a change keeps the original time and tells the customer', async () => {
  const job = await requested();
  const res = await act(job.id, 'decline-change', { version: (await read(job.id)).version });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.jobDate, job.jobDate);
  assert.equal(res.body.bookingState, 'scheduled');
  assert.equal(res.body.requested, null);
  assert.ok(res.body.changeDeclinedAt, 'changeDeclinedAt is set');
  const onLink = await link.read(job.code);
  assert.equal(onLink.body.changeDeclined, true);
  assert.equal(onLink.body.stage, 'confirmed');
});

test('declining a change lets the requested time go', async () => {
  const job = await requested();
  assert.equal((await act(job.id, 'decline-change', { version: (await read(job.id)).version })).status, 200);
  // The exact slot: only a hold left behind could refuse it now.
  const other = await tryBooking(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: job.to, startTime: '14:00', serviceIds: [types.repair],
  });
  assert.equal(other.status, 201, JSON.stringify(other.body));
});

test('declining with a stale version is refused', async () => {
  const job = await requested();
  const res = await act(job.id, 'decline-change', { version: 1 });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'stale');
});

test('there is nothing to decline on a booking with no request', async () => {
  const booked = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.repair],
  });
  const res = await act(booked.id, 'decline-change', { version: 1 });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: "There's no change request to decline", code: 'illegal' });
});

test("the old accept and decline refuse a customer's change request", async () => {
  const job = await requested();
  const version = (await read(job.id)).version;
  for (const action of ['accept', 'decline']) {
    const res = await act(job.id, action, { version });
    assert.equal(res.status, 409, `${action}: ${JSON.stringify(res.body)}`);
    assert.deepEqual(res.body, {
      error: 'This booking has a change request from the customer - accept or decline the change instead', code: 'illegal',
    });
  }
});

test("a staff cancellation is recorded as the shop's", async () => {
  const booked = await bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.repair],
  });
  const res = await act(booked.id, 'cancel', { version: 1 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.cancelledBy, 'staff');
  assert.ok(res.body.cancelledAt, 'cancelledAt is set');
});

test('accepting a change waits while another booking write holds the requested day', async () => {
  const job = await requested();
  const version = (await read(job.id)).version;
  const release = await holdBookingLock(shopId(), job.to);
  let pending;
  try {
    pending = act(job.id, 'accept-change', { version });
    assert.equal(await stillWaiting(pending), true, 'accept-change did not wait for the lock');
  } finally {
    await release();
  }
  assert.equal((await pending).status, 200);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/workshop-change-requests.test.js`
Expected: "the staff job view shows the request" FAILS (`requested` undefined); the accept-change / decline-change tests FAIL with the dispatcher's 404; "the old accept and decline refuse" FAILS (200); "a staff cancellation is recorded" FAILS (`cancelledBy` undefined).

- [ ] **Step 3: Implement the staff job view.** In `serializeWorkshopJob`, after `questionAnswers` (:2404):

```js
    // Piece 12: the customer's change request while it waits, and who
    // cancelled (a customer's shows in "Waiting for you" until seen).
    requested: requestedOf(row),
    cancelledBy: row.cancelled_by ?? null,
    cancelledAt: row.cancelled_at ?? null,
    cancellationSeenAt: row.cancellation_seen_at ?? null,
    changeDeclinedAt: row.change_declined_at ?? null,
```

- [ ] **Step 4: Guard and record in `jobActionRoute`.** Directly above `function jobActionRoute` (:2999):

```js
const VERSION_REQUIRED = 'version is required - send the version you last read';
// The words applyEvent uses for a lost race (server/workshop/transitions.js).
const staleRefusal = {
  status: 409,
  body: { error: 'This job changed while you were looking at it. Reload and try again.', code: 'stale' },
};
```

Inside it, use `VERSION_REQUIRED` in the existing `badRequest` (same words). After the version check and before `applyEvent`:

```js
    // A customer's change request is answered with accept-change or
    // decline-change (piece 12): plain accept/decline would return the job to
    // scheduled without moving it or telling the customer.
    if (machine === bookingRequest && (event === 'accept' || event === 'decline')) {
      const current = await db.prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(id);
      if (current && requestedOf(current)) {
        return sendJson(res, 409, {
          error: 'This booking has a change request from the customer - accept or decline the change instead', code: 'illegal',
        });
      }
    }
```

After the `if (!result.ok) {...}` block and before `await syncJobHold(id);`:

```js
    // A staff cancellation never shows in "Waiting for you" (piece 12).
    if (machine === bookingRequest && event === 'cancel') {
      await db.prepare("UPDATE workshop_jobs SET cancelled_by = 'staff', cancelled_at = now() WHERE id = ?").run(id);
    }
```

- [ ] **Step 5: Add the two routes** after `jobActionRoute('expire', bookingRequest, 'expire');` (:3128):

```js
// Staff answer a customer's change request (piece 12). Under the booking lock
// for both days; the version is the one staff last read.
async function answerChangeRequest(req, res, id, answer) {
  const body = await readJsonBody(req);
  if (!Number.isInteger(body.version)) return badRequest(res, VERSION_REQUIRED);
  const requestedGone = { status: 409, body: { error: 'The requested time is no longer free', code: 'capacity' } };
  let out;
  try {
    out = await withJobBookingLock(id, [], async (job) => {
      if (job.version !== body.version) return staleRefusal;
      const requested = requestedOf(job);
      if (!requested) {
        return { status: 409, body: { error: `There's no change request to ${answer}`, code: 'illegal' } };
      }
      if (answer === 'accept') {
        // The shop's slot rules, the job itself left out; never the capacity
        // calculator - staff are never refused for capacity (decision log D14).
        const slotError = await checkJobSlot({
          jobDate: requested.jobDate, startTime: requested.startTime, endTime: requested.endTime,
          mechanicId: requested.mechanicId, ignoreJobId: id,
        });
        if (slotError) return requestedGone;
        await applyLocked(job, 'accept');
        await db.prepare(
          `UPDATE workshop_jobs SET job_date = ?, mechanic_id = ?, start_time = ?, end_time = ?, ${CLEAR_REQUEST}, updated_at = now()
           WHERE id = ?`
        ).run(requested.jobDate, requested.mechanicId, requested.startTime, requested.endTime, id);
        // The requested hold becomes the booking's own; the old one goes.
        await db.prepare(
          `UPDATE workshop_capacity_holds SET state = 'released'
           WHERE workshop_job_id = ? AND purpose = 'booking' AND state IN ('held', 'confirmed')`
        ).run(id);
        await db.prepare(
          `UPDATE workshop_capacity_holds SET purpose = 'booking'
           WHERE workshop_job_id = ? AND purpose = 'requested' AND state IN ('held', 'confirmed')`
        ).run(id);
      } else {
        await applyLocked(job, 'decline');
        await db.prepare(
          `UPDATE workshop_jobs SET ${CLEAR_REQUEST}, change_declined_at = now(), updated_at = now() WHERE id = ?`
        ).run(id);
      }
      await syncJobHold(id);
      const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
      return { status: 200, body: serializeWorkshopJob(row) };
    });
  } catch (err) {
    // The 024 index: another live hold sits on the requested slot.
    if (err.code !== '23505') throw err;
    out = requestedGone;
  }
  if (out?.gone) return notFound(res, 'Job not found');
  sendJson(res, out.status, out.body);
}

// screens: change-pending, diary
route('POST', '/api/workshop-jobs/:id/accept-change', async (req, res, params) =>
  answerChangeRequest(req, res, Number(params.id), 'accept'));
// screens: change-pending, diary
route('POST', '/api/workshop-jobs/:id/decline-change', async (req, res, params) =>
  answerChangeRequest(req, res, Number(params.id), 'decline'));
```

(`There's no change request to ${answer}` produces exactly the two planned sentences, "…to accept" and "…to decline".)

- [ ] **Step 6: Run the tests**

Run: `node --test tests/workshop-change-requests.test.js tests/workshop-booking-actions.test.js tests/workshop-holds-follow.test.js tests/workshop-custody-actions.test.js && node scripts/ci/assert-screen-trace.mjs`
Expected: all PASS; the screen trace exits 0.

- [ ] **Step 7: Prove every test bites**

| Test | Mutation (server.js) | Expected failure |
|---|---|---|
| the staff job view shows the request | delete `requested: requestedOf(row),` from `serializeWorkshopJob` | `undefined` vs the object |
| accepting a change moves the booking and leaves it one hold | delete the `SET state = 'released' ... purpose = 'booking'` UPDATE | two live holds, one at the old day |
| the requested hold becomes the booking hold | replace the `SET purpose = 'booking'` UPDATE with `UPDATE workshop_capacity_holds SET state = 'released' WHERE workshop_job_id = ? AND purpose = 'requested' AND state IN ('held', 'confirmed')` and delete the release of the booking hold (so `syncJobHold` moves the old booking hold instead) | a different hold id |
| accepting when the requested time is no longer free is refused and changes nothing | delete `if (slotError) return requestedGone;` | 200, not 409 |
| accepting with a stale version is refused | delete `if (job.version !== body.version) return staleRefusal;` | 200, not 409 |
| accepting needs a version | delete the `Number.isInteger(body.version)` line in `answerChangeRequest` | 409 stale, not 400 |
| there is nothing to accept on a booking with no request | delete the `if (!requested)` block | 500 (`requested.jobDate` of null) |
| declining a change keeps the original time and tells the customer | `change_declined_at = NULL` in the decline UPDATE | `changeDeclinedAt` null / `changeDeclined` false |
| declining a change lets the requested time go | in `syncRequestedHold`, `if (false && h !== keep)` (never let a requested hold go) | 409 "That time is no longer available..." (the hold index), not 201 |
| declining with a stale version is refused | delete `if (job.version !== body.version) return staleRefusal;` (the same line as the accept row; run this test by name) | 200, not 409 |
| there is nothing to decline on a booking with no request | in the `if (!requested)` block, write `There's no change request to accept` in place of the `${answer}` template | the accept wording, not the decline wording |
| the old accept and decline refuse a customer's change request | delete the `requestedOf(current)` guard in `jobActionRoute` | 200, not 409 |
| a staff cancellation is recorded as the shop's | delete the `cancelled_by = 'staff'` UPDATE in `jobActionRoute` | `null !== 'staff'` |
| accepting a change waits while another booking write holds the requested day | in `withJobBookingLock`, `const dates = [before.job_date, ...extraDates].filter(Boolean);` | "accept-change did not wait for the lock" |

- [ ] **Step 8: Commit**

```bash
git add tests/workshop-change-requests.test.js server/server.js
git commit -m "feat: staff accept or decline a customer's change request (piece 12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The "Waiting for you" list and "Seen"

**Files:**
- Create: `tests/workshop-waiting.test.js`
- Modify: `server/server.js` - the `cancellation-seen` route and `GET /api/workshop-waiting` after Task 7's routes

**Interfaces:**
- Consumes: `staleRefusal`, `VERSION_REQUIRED` (Task 7); the customer cancel and change routes.
- Produces: `POST /api/workshop-jobs/:id/cancellation-seen` `{ version }` -> 200 with `serializeWorkshopJob`. `GET /api/workshop-waiting` -> `{ count, items }` (shape in decision log D12), oldest first.

Link calls in `tests/workshop-waiting.test.js`: 5.

- [ ] **Step 1: Write the failing tests** `tests/workshop-waiting.test.js`

```js
// "Waiting for you" (piece 12, decisions 3 and 5): new online bookings, change
// requests and customer cancellations, oldest first, each with what the
// diary needs to show it; a cancellation stays until someone marks it seen.
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import { linkActions, bookOnline, setJob, dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let sam;
let alex;
let types;
let customer;
let link;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, { name: 'Wendy Waiting' });
  link = linkActions(server.baseUrl, owner.shop.slug);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const act = (id, action, body) => staff(`/api/workshop-jobs/${id}/${action}`, { method: 'POST', body });
const read = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body;
const waiting = async () => {
  const res = await staff('/api/workshop-waiting');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
};
const itemFor = async (id) => (await waiting()).items.find((i) => i.jobId === id);
const book = (serviceIds = [types.repair]) => bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
  mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds,
});

test('a new online booking is listed with what the diary needs', async () => {
  const booked = await book([types.repair, types.quick]);
  const list = await waiting();
  assert.equal(list.count, list.items.length);
  const item = list.items.find((i) => i.jobId === booked.id);
  assert.deepEqual(item, {
    kind: 'new_booking',
    jobId: booked.id,
    reference: booked.reference,
    jobDate: booked.jobDate,
    startTime: '10:00',
    endTime: '11:30',
    mechanicId: sam,
    mechanicName: 'Sam',
    customerName: 'Wendy Waiting',
    serviceNames: ['Test repair', 'Test quick'],
    arrivedAt: (await read(booked.id)).createdAt,
  });
});

test('a job staff made as pending is not listed', async () => {
  const made = await staff('/api/workshop-jobs', {
    method: 'POST', body: { title: 'Phoned in', jobDate: nextDay(), status: 'pending', mechanicId: sam, startTime: '12:00', endTime: '13:00' },
  });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.equal(await itemFor(made.body.id), undefined);
});

test('a change request is listed with where the booking is and where the customer wants it', async () => {
  const booked = await book();
  assert.equal((await act(booked.id, 'accept', { version: 1 })).status, 200);
  const to = nextDay();
  assert.equal((await link.change(booked.code, { jobDate: to, mechanicId: alex, startTime: '14:00' })).status, 200);
  const item = await itemFor(booked.id);
  assert.equal(item.kind, 'change_request');
  assert.deepEqual(item.from, { jobDate: booked.jobDate, startTime: '10:00', endTime: '11:00', mechanicId: sam, mechanicName: 'Sam' });
  assert.deepEqual(item.to, { jobDate: to, startTime: '14:00', endTime: '15:00', mechanicId: alex, mechanicName: 'Alex' });
  // It arrived when the customer asked, after the booking was made.
  assert.ok(Date.parse(item.arrivedAt) > Date.parse((await read(booked.id)).createdAt), JSON.stringify(item));
});

test("a customer's cancellation is listed until someone marks it seen", async () => {
  const booked = await book();
  assert.equal((await link.cancel(booked.code)).status, 200);
  const job = await read(booked.id);
  assert.equal(job.cancelledBy, 'customer');
  const item = await itemFor(booked.id);
  assert.equal(item.kind, 'customer_cancelled');
  assert.equal(item.arrivedAt, job.cancelledAt);
  const seen = await act(booked.id, 'cancellation-seen', { version: job.version });
  assert.equal(seen.status, 200, JSON.stringify(seen.body));
  assert.ok(seen.body.cancellationSeenAt, 'cancellationSeenAt is set');
  assert.equal(await itemFor(booked.id), undefined);
});

test('a staff cancellation is never listed', async () => {
  const booked = await book();
  assert.equal((await act(booked.id, 'cancel', { version: 1 })).status, 200);
  assert.equal(await itemFor(booked.id), undefined);
});

test('the oldest arrival comes first, whatever its kind', async () => {
  const fresh = await book();
  const moving = await book();
  assert.equal((await act(moving.id, 'accept', { version: 1 })).status, 200);
  assert.equal((await link.change(moving.code, { jobDate: nextDay(), mechanicId: sam, startTime: '14:00' })).status, 200);
  const gone = await book();
  assert.equal((await link.cancel(gone.code)).status, 200);
  // Arrival times set apart (all after the pinned 1 Sep): the cancellation
  // arrived first, then the change request, then the new booking.
  await setJob(owner.shop.id, gone.id, "cancelled_at = '2026-09-08T09:00:00Z'");
  await setJob(owner.shop.id, moving.id, "requested_at = '2026-09-09T09:00:00Z'");
  await setJob(owner.shop.id, fresh.id, "created_at = '2026-09-10T09:00:00Z'");
  const mine = (await waiting()).items.filter((i) => [fresh.id, moving.id, gone.id].includes(i.jobId)).map((i) => i.jobId);
  assert.deepEqual(mine, [gone.id, moving.id, fresh.id]);
});

test('Seen needs the version staff last read', async () => {
  const booked = await book();
  assert.equal((await link.cancel(booked.code)).status, 200);
  const res = await act(booked.id, 'cancellation-seen', { version: 1 });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: 'This job changed while you were looking at it. Reload and try again.', code: 'stale' });
});

test("Seen is only for a customer's cancellation", async () => {
  const booked = await book();
  const res = await act(booked.id, 'cancellation-seen', { version: 1 });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.deepEqual(res.body, { error: "Only a customer's cancellation can be marked as seen", code: 'illegal' });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/workshop-waiting.test.js`
Expected: every test FAILS - `/api/workshop-waiting` answers 404 (the `waiting()` helper's status assertion), and `cancellation-seen` answers the dispatcher's 404.

- [ ] **Step 3: Implement** after the `decline-change` route:

```js
// Staff saw a customer's cancellation (piece 12, decision 5): it leaves
// "Waiting for you". Keeps the first time it was seen; still needs the version.
// screens: cancelled, diary
route('POST', '/api/workshop-jobs/:id/cancellation-seen', async (req, res, params) => {
  const id = Number(params.id);
  const body = await readJsonBody(req);
  if (!Number.isInteger(body.version)) return badRequest(res, VERSION_REQUIRED);
  const job = await db.prepare('SELECT id, cancelled_by FROM workshop_jobs WHERE id = ?').get(id);
  if (!job) return notFound(res, 'Job not found');
  if (job.cancelled_by !== 'customer') {
    return sendJson(res, 409, { error: "Only a customer's cancellation can be marked as seen", code: 'illegal' });
  }
  const { changes } = await db.prepare(
    `UPDATE workshop_jobs SET cancellation_seen_at = COALESCE(cancellation_seen_at, now()), version = version + 1, updated_at = now()
     WHERE id = ? AND version = ?`
  ).run(id, body.version);
  if (changes === 0) return sendJson(res, staleRefusal.status, staleRefusal.body);
  const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(id);
  sendJson(res, 200, serializeWorkshopJob(row));
});

// One item of "Waiting for you" (decision log D12).
function waitingItem(row) {
  const kind = row.booking_state === 'pending' ? 'new_booking'
    : row.booking_state === 'reschedule_requested' ? 'change_request' : 'customer_cancelled';
  const slot = (jobDate, startTime, endTime, mechanicId, mechanicName) => ({
    jobDate, startTime: startTime || '', endTime: endTime || '', mechanicId, mechanicName: mechanicName ?? null,
  });
  const current = slot(row.job_date, row.start_time, row.end_time, row.mechanic_id, row.mechanic_name);
  return {
    kind,
    jobId: row.id,
    reference: row.reference,
    ...current,
    customerName: row.customer_name ?? null,
    serviceNames: row.service_names,
    arrivedAt: { new_booking: row.created_at, change_request: row.requested_at, customer_cancelled: row.cancelled_at }[kind],
    ...(kind === 'change_request'
      ? {
        from: current,
        to: slot(row.requested_job_date, row.requested_start_time, row.requested_end_time, row.requested_mechanic_id, row.requested_mechanic_name),
      }
      : {}),
  };
}

// "Waiting for you" (piece 12, decision 3): new online bookings (only the
// portal sets terms_accepted_at), customers' change requests and customers'
// cancellations not yet seen - oldest first by when each arrived.
// screens: requests, diary
route('GET', '/api/workshop-waiting', async (req, res) => {
  const rows = await db.prepare(
    `SELECT w.*, c.name AS customer_name, m.name AS mechanic_name, rm.name AS requested_mechanic_name,
            (SELECT coalesce(json_agg(s.name ORDER BY js.position), '[]'::json)
               FROM workshop_job_services js JOIN workshop_services s ON s.id = js.service_id
              WHERE js.workshop_job_id = w.id) AS service_names
     FROM workshop_jobs w
     LEFT JOIN customers c ON c.id = w.customer_id
     LEFT JOIN employees m ON m.id = w.mechanic_id
     LEFT JOIN employees rm ON rm.id = w.requested_mechanic_id
     WHERE (w.booking_state = 'pending' AND w.terms_accepted_at IS NOT NULL)
        OR (w.booking_state = 'reschedule_requested' AND w.requested_job_date IS NOT NULL)
        OR (w.booking_state = 'cancelled' AND w.cancelled_by = 'customer' AND w.cancellation_seen_at IS NULL)`
  ).all();
  const items = rows.map(waitingItem)
    .sort((a, b) => (new Date(a.arrivedAt) - new Date(b.arrivedAt)) || (a.jobId - b.jobId));
  sendJson(res, 200, { count: items.length, items });
});
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/workshop-waiting.test.js tests/workshop-change-requests.test.js && node scripts/ci/assert-screen-trace.mjs`
Expected: all PASS; exit 0.

- [ ] **Step 5: Prove every test bites**

| Test | Mutation (server.js) | Expected failure |
|---|---|---|
| a new online booking is listed with what the diary needs | `serviceNames: [],` in `waitingItem` | `[]` vs the two names |
| a job staff made as pending is not listed | delete `AND w.terms_accepted_at IS NOT NULL` | an item, not `undefined` |
| a change request is listed with where the booking is and where the customer wants it | delete the `to:` entry | `undefined` vs the `to` object |
| a customer's cancellation is listed until someone marks it seen | `cancellation_seen_at = cancellation_seen_at` in the Seen UPDATE | the item is still listed |
| a staff cancellation is never listed | replace `w.cancelled_by = 'customer'` with `w.cancelled_by IS NOT NULL` | an item, not `undefined` |
| the oldest arrival comes first, whatever its kind | `.sort((a, b) => (new Date(b.arrivedAt) - new Date(a.arrivedAt)) \|\| ...)` | reversed order |
| Seen needs the version staff last read | `WHERE id = ?` only (drop `AND version = ?` and its argument) | 200, not 409 |
| Seen is only for a customer's cancellation | delete the `cancelled_by !== 'customer'` block | 200, not 409 |

- [ ] **Step 6: Commit**

```bash
git add tests/workshop-waiting.test.js server/server.js
git commit -m "feat: the Waiting for you list and marking a cancellation seen (piece 12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Everything CI runs, the status file, the spec walk, the final review

**Files:**
- Modify: `.agents/STATUS.md`
- Modify: this plan - fill the "Spec walk" section below and append any decisions taken while executing to the decision log

- [ ] **Step 1: Run everything CI runs** (`.github/workflows/*.yml`), from a clean state, and keep each command's tail output for the report:

```bash
npm run docker:up
npm ci
npm run typecheck
npm run lint
npm run build
npm run registry:validate
node scripts/ci/check-registry-drift.mjs
python3 docs/design/release-1-journey/package.py
node docs/design/release-1-journey/check-static.mjs
node docs/design/release-1-journey/check-notes.mjs
git diff --exit-code -- docs/design/release-1-journey/Wheelhouse-Release-1-Journey-Atlas.html docs/design/release-1-journey/screen-index.json docs/design/release-1-journey/verification.json
node scripts/ci/assert-screen-trace.mjs
npm run migrate
node scripts/ci/assert-rls-coverage.mjs
npm test
npm run build && npm run test:browser
npm run migrate 2>&1 | tee /tmp/migrate-again.txt; ! grep -q 'Applied migration:' /tmp/migrate-again.txt
```

Expected: every command exits 0; `npm test` reports 0 failures (state the pass count); the second migrate applies nothing. **An absent check is not a passing one:** if a command did not run (missing Python, Playwright browser not installed), say so and install/run it - never report it green. If `npm ci` touches `package-lock.json`, stop and report; do not commit lockfile changes.

- [ ] **Step 2: Confirm scope.** `git diff --stat main...HEAD` lists only: this piece's files (Files section), the spec and this plan, and 1418dd2's three files (`docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md`, `src/screens/book/details-rules.ts`, `tests/customer/details-rules.test.js`). No other `src/` file, no CI, no dependency, no lockfile. `git status` shows `.claude/launch.json` still untracked and nothing else.

- [ ] **Step 3: Final review of the whole branch**, including 1418dd2 (the details summary shows "From £" only with two or more services, matching `pending`'s rule). Dispatch the review on the most capable model with `superpowers:requesting-code-review`, scope `main...HEAD`. Ask it to check in particular: every write in the three customer routes and two staff routes is inside one `withBookingLock` transaction and rolls back whole on a thrown 23505; no path leaves a live `requested` hold on a job that is not `reschedule_requested`; `checkCustomerTime` is byte-for-byte the booking route's old checks; the link view leaks nothing new that identifies the customer; 1418dd2's rule and its test. Fix what it finds test-first (a failing test first, then the fix, then its mutation), then re-run Step 1.

- [ ] **Step 4: Update `.agents/STATUS.md`.** Set `**Updated:** 2026-09-27`. In the long header paragraph, after the d5 sentence, add:

```markdown
**Server piece 12 (customer change and cancel) built on `feat/book-server-12-change-cancel`** (27 Sep; spec `docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md`, plan `docs/superpowers/plans/2026-09-27-book-server-12-change-cancel.md`, which carries the decision log and the spec walk; the branch also carries 1418dd2, the details summary's "From £" only with two or more services). Built: migration 035 (the stored change request, `cancelled_by`/`cancelled_at`, `cancellation_seen_at`, `change_declined_at`, and `workshop_capacity_holds.purpose` 'booking' | 'requested' - the 024 index guards requested slots unchanged); customer `POST /api/portal/:shopSlug/booking-links/:code/cancel|change|withdraw-change` (shared link limiter, 404/410 as the read route, the booking lock for every day involved); an unconfirmed booking moves at once, a confirmed one's change is a held request; the link view adds `requested`, `canChange`, `canCancel`, `changeDeclined`; staff `POST /api/workshop-jobs/:id/accept-change|decline-change|cancellation-seen` (version-checked), `GET /api/workshop-waiting` (`{count, items}`, oldest first); the old `accept`/`decline` refuse a customer's change request; staff cancel records `cancelled_by = 'staff'`. **Next:** the staff diary piece (the "Waiting for you" column, jump and highlight, Accept/Decline in the job), then **d6** (the customer's change and cancel screens). **Open for Jack:** the planned wording in the plan's Global Constraints (one customer sentence, four staff ones) and decision D5 (asking for the time already booked quietly withdraws a request).
```

Adjust the "Open for Jack" sentence to what is actually still open when this step runs.

- [ ] **Step 5: Write the spec walk** into the "Spec walk" section below: every line of the spec's "Customer actions", "Staff actions", "Data" and "Tests" sections, each marked **met** (with the test name that proves it), **dropped** (why), or **changed** (what it now means, and the decision log entry). Put the same walk in the task report.

- [ ] **Step 6: Commit**

```bash
git add .agents/STATUS.md docs/superpowers/plans/2026-09-27-book-server-12-change-cancel.md
git commit -m "docs: piece 12 status and spec walk

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Report status; do not declare the piece done - Jack decides that, and whether to open the PR.

## Spec walk

### Customer actions

- **All three routes take the link code as the read route does** (hashed lookup, shared rate limiter, 404 unknown, 410 expired), run inside `withBookingLock` for every date involved, return the updated link view. **Met.** `withJobBookingLock` (server.js) wraps all three; 404/410 tested per route: `tests/portal-booking-cancel.test.js:171,177`, `tests/portal-booking-change.test.js:155,162`, `tests/portal-booking-change-request.test.js:191,196`; shared limiter proven by `tests/booking-link-actions-rate-limit.test.js:26`.
- **Cancel: allowed when custody `expected` and state pending/scheduled/reschedule_requested; state becomes cancelled; every hold released; `cancelled_by='customer'`/`cancelled_at` recorded.** Met. `tests/portal-booking-cancel.test.js:107` (unconfirmed), `:120` (confirmed), `:129` (with a change request - both holds released, request forgotten).
- **Cancel refused once in-shop/collected: "Your bike is already with the shop - please contact them to cancel" (409).** Met. `tests/portal-booking-cancel.test.js:145`.
- **Cancel refused in any other state: "This booking can't be cancelled online" (409).** Met. `tests/portal-booking-cancel.test.js:154` (a declined booking).
- **Change: allowed in the same states; otherwise the cancel refusals with "changed" for "cancelled".** Met. In-shop: `tests/portal-booking-change-request.test.js:141`; other states: `:149` (a cancelled booking).
- **Change: the new time passes every check a new booking's time passes, own job excluded from its own conflicts, refusals reuse the booking route's messages/statuses.** Met - `checkCustomerTime` is the extracted, shared function (see Data section below), not a parallel copy; self-exclusion proven by `tests/portal-booking-change.test.js:76` (moving within its own time) and `:137` (own minutes not counted against its new time same day); full check set proven by `tests/portal-booking-change.test.js:82,93,102,112,124`.
- **Change, pending: job's date/mechanic/time change at once, stays pending, hold moves with it.** Met. `tests/portal-booking-change.test.js:54` (moves at once, stays awaiting confirmation), `:68` (to another mechanic).
- **Change, scheduled: requested day/mechanic/times stored, a hold placed on the requested slot, state becomes reschedule_requested, old slot stays held.** Met. `tests/portal-booking-change-request.test.js:57` (holds both times), `:67` (booking stays where it is until staff answer).
- **Change, reschedule_requested: new request replaces the stored one, previous requested hold released, new one placed.** Met. `tests/portal-booking-change-request.test.js:77` (replaces and lets the first time go), `:88` (a new request may overlap the one it replaces).
- **Withdraw: only in reschedule_requested; clears stored request, releases hold, returns to scheduled. Otherwise "There's no change request to withdraw" (409).** Met. `tests/portal-booking-change-request.test.js:157` (returns to the booking as it was), `:184` (refused when nothing was asked).
- **Link view gains `requested`, `canChange`, `canCancel`, `changeDeclined`.** Met. `tests/portal-booking-cancel.test.js:49` (unconfirmed offers both), `:59` (in-shop offers neither), `:75` (a change shows on the link), `:87` (a request no longer live is not shown), `:95` (changeDeclined after a decline).
- **Decision D5 (spec decision 2 approved by Jack): a confirmed booking asking for the time it already has makes no request; an open request is withdrawn - no refusal.** Changed from the plan's open question to Jack's ruling (progress.md, 27 Sep, item 2) that it's silent rather than a refusal. Met as ruled. `tests/portal-booking-change-request.test.js:97` (asking for the time already booked withdraws the request), `:107` (a confirmed booking asked for the time it already has makes no request).

### Staff actions

- **Accept/Decline of new online bookings: existing routes, unchanged.** Met - untouched; guarded against a change request by D8: `tests/workshop-change-requests.test.js:167` ("the old accept and decline refuse a customer's change request").
- **Accept a change request (`accept-change`, `{version}`): reschedule_requested only; under the lock for both dates; moves job to requested day/mechanic/time; requested hold becomes the job's hold, old one released; clears request; returns to scheduled; 409 capacity "The requested time is no longer free" if the slot became unavailable.** Met. `tests/workshop-change-requests.test.js:74` (moves and leaves one hold), `:85` (requested hold becomes the booking hold), `:95` (no-longer-free refused, changes nothing), `:119` (nothing to accept with no request).
- **Decline a change request (`decline-change`, `{version}`): releases the requested hold, clears the request, sets `change_declined_at`, returns to scheduled at the original time.** Met. `tests/workshop-change-requests.test.js:128` (keeps original time, tells the customer via `changeDeclined`), `:141` (lets the requested time go), `:158` (nothing to decline with no request).
- **"Seen" (`cancellation-seen`, `{version}`): sets `cancellation_seen_at` on a customer-cancelled job.** Met. `tests/workshop-waiting.test.js:95` (listed until seen), `:139` ("Seen is only for a customer's cancellation" - refuses a staff-cancelled/never-cancelled job).
- **Waiting list (`GET /api/workshop-waiting`): `{count, items}`, oldest first; `new_booking`/`change_request`/`customer_cancelled` kinds with the stated fields.** Met. `tests/workshop-waiting.test.js:54` (new booking fields), `:74` (a staff-made pending job is not listed - D10), `:82` (change request with from/to), `:95` (customer cancellation listed until seen), `:109` (staff cancellation never listed), `:115` (oldest arrival first, whatever its kind - D11 tie-break by arrivedAt), `:146` (another shop's items never appear).
- **Staff job view gains `requested`, `cancelledBy`, `cancelledAt`, `cancellationSeenAt`, `changeDeclinedAt`.** Met. `tests/workshop-change-requests.test.js:63` (the staff job view shows the request).
- **All staff routes use the existing optimistic `version` check.** Met. `tests/workshop-change-requests.test.js:105` (accept, stale version), `:113` (accept needs a version), `:151` (decline, stale version); `tests/workshop-waiting.test.js:131` (Seen needs the version staff last read).
- **Staff cancellations record `cancelled_by='staff'`, never appear in the waiting list.** Met. `tests/workshop-change-requests.test.js:179` ("a staff cancellation is recorded as the shop's"); `tests/workshop-waiting.test.js:109` (never listed).

### Data (migration 035, additive only)

- **`workshop_jobs` gains the eight named columns.** Met. `tests/migration-035.test.js:46` (all optional), `:66` (`cancelled_by` is customer or staff, nothing else - CHECK constraint).
- **A requested slot held in `workshop_capacity_holds`, marked so the table's existing live-slot unique index also protects it.** Met via the `purpose` column (plan decision D1, superseded by Jack's decision 4 in progress.md adding the one-live-requested-hold-per-job partial unique index): `tests/migration-035.test.js:75` (a hold is for a booking unless it says otherwise), `:85` (a requested hold cannot share a live slot with a booking hold - the 024 index unchanged), `:90` (one job can hold its own slot and a requested slot at once), `:100` (a job cannot hold two live requested holds at once - the new index, Jack's decision 4).
- **State machine gains `change_time` on `pending` (to `pending`).** Changed/extended per plan decision D3: also `change_time` as a self-loop on `reschedule_requested`, and a new `withdraw` event (reschedule_requested to scheduled) - `reschedule_requested` needed both to represent "replace a request" and "withdraw a request" without reusing the shop's own `decline`. Met as extended. `tests/workshop-states.test.js:95` (asking to move a confirmed booking keeps the original until the shop agrees), `:103` (an unconfirmed booking can move and stays unconfirmed), `:108` (a change request can be replaced and stays a request), `:112` (the customer can withdraw, back to the booking they had), `:116` (a confirmed booking cannot change time without asking).
- **Capacity counts a requested hold like any other live hold.** Met per plan decision D2 (the calculator counts jobs, not holds; a `reschedule_requested` job's requested slot is read as a live booking by both `loadCapacity` and `checkJobSlot`). `tests/booking-requested-hold.test.js:56` (a requested time keeps another customer out of it), `:70` (the calendar does not offer a requested time), `:89` (a job that stops being a request lets its requested time go and keeps its own), `:119` (a request that stands keeps the hold it has).

### Tests

- **Cancel in each allowed state, holds released, `cancelled_by`; refused after drop-off and in other states.** Met - see Customer actions/Cancel above.
- **Change: pending moves at once; scheduled creates a request holding both slots; a second request replaces the first; every new-booking time check applies; the booking's own slot doesn't conflict with itself.** Met - see Customer actions/Change above.
- **Withdraw; refused with no request.** Met - see Customer actions/Withdraw above.
- **A requested hold blocks other customers from that slot.** Met. `tests/booking-requested-hold.test.js:56`.
- **Staff accept-change (moves, one hold left) and decline-change (original time, `changeDeclined` on the link); version conflicts refused.** Met - see Staff actions above.
- **The waiting list's items, fields and order; "Seen" removes a cancellation; staff cancellations never listed.** Met - see Staff actions/Waiting list above.
- **Two actions at once on the same slot: only one succeeds (the lock).** Met, per the pre-flight ruling (scan 5) that the race tests hold the day's advisory lock from the test's own connection: `tests/portal-booking-change-request.test.js:206,221`, `tests/portal-booking-change.test.js:171,185`, `tests/workshop-change-requests.test.js:189`, `tests/portal-booking-cancel.test.js:189`.
- **The link view's new fields; unknown and expired codes refused on every new route.** Met - see Customer actions/link view above and the 404/410 tests cited under "All three routes" above.

### Not in this piece (spec's own scope note - carried forward, not built here)

- The staff diary screens (next piece) and the customer's screens (d6). Not built, as scoped.
- Messages to customers (email/SMS) about accept/decline. Not built, as scoped.
- Refunds, deposits, cancellation fees. Not built, as scoped.

### Changes beyond the spec text (all from the plan's own decision log or Jack's rulings, not silent drift)

- D1 superseded by Jack's decision (4): a partial unique index enforcing at most one live requested hold per job was added to migration 035, beyond what the spec's Data section named - `tests/migration-035.test.js:100`.
- D3: `change_time` self-loop on `reschedule_requested` and a new `withdraw` event, beyond the spec's single `change_time` on `pending` - needed for "replace a request" and "withdraw a request" to be distinct, legal moves.
- D6-D9: refusal codes (`in_shop`/`illegal`/`capacity`) and four staff-wording sentences the spec didn't give verbatim - all confirmed by Jack with the spec approval, 27 Sep.
- Pre-flight scan rulings 2-4 (legacy diary keeps a request on an ordinary save; a drag onto exactly the requested slot accepts the change; every path that ends a request clears every requested field) extend "Not in this piece" only in the sense that the legacy diary was already load-bearing and had to be made safe against a stored request - not new customer- or staff-facing functionality, no spec line changed.
