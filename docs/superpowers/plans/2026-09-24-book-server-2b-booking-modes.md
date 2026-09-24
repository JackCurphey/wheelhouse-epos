# Book server piece 2b: booking in either mode - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers can book a drop-off day (no time) on dates the shop runs in drop-off mode, and a timed slot otherwise. Shops can schedule a mode change from a chosen date. Staff can put a walk-in into the shared queue. Every booking write runs one at a time per shop and date, so two customers can never both take the last of a day. When capacity has gone, the refusal carries `code: 'capacity'`.

**Architecture:** Builds on 2a's calculator (`server/capacity.js`, `loadCapacity` in `server/server.js`). A new `withBookingLock(dates, fn)` wraps check-then-write in one transaction holding a Postgres transaction-scoped advisory lock keyed `(shop, date)`. A new `syncJobHold(jobId)` keeps each live job's capacity hold matching the job after every write. The customer booking route reads the mode for the date from the calculator.

**Tech Stack:** Node 22 ESM, the plain `http` server in `server/server.js`, PostgreSQL 16 via `pg`, `node:test`; `src/lib/api/client.ts` (TypeScript, tested in Node).

**Spec:** `docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md`, section "2b" and the 2b lines of "Testing". Read it first. The 2a plan (`docs/superpowers/plans/2026-09-24-book-server-2a-availability.md`) and its decision log describe what 2b builds on.

**Branch:** `feat/book-server-2b-modes`, cut from `feat/book-server-2-modes` (2a, PR #65, not yet merged). Until #65 merges, 2b's pull request also shows 2a's commits.

## Global Constraints

- No new dependencies.
- **Staff are never refused because of capacity or blocks** (4 Sep decision §7.7). Staff are still refused for shop rules they were already held to: closed day, hours, mechanic day off, overlap with another live job.
- Customers never see a block's reason, other customers' jobs, or minute totals.
- Live jobs are those with `booking_state` in `pending`, `scheduled`, `reschedule_requested` (`LIVE_BOOKING_STATES` in `server/capacity.js`).
- **A 409 carries `code`.** Existing codes are `stale` and `illegal`; 2b adds `capacity`. The message is for people and may be reworded; the code may not.
- Messages the old booking page (`public-portal/portal.js`) shows are unchanged in wording.
- "Today" is the UTC date, the server's existing convention: `new Date().toISOString().slice(0, 10)`.
- Dates are `TEXT` `YYYY-MM-DD`; validate request dates with `isRealDate` from `server/capacity.js`.
- Every covered route keeps its `// screens:` comment directly above it.
- Tests that boot a server or touch the database start with `import '../server/load-env.js';`. Helpers: `startLiveServer`, `staffSignup`/`staffRequest`/`seedMechanic`, `jsonRequest`, `deleteTestShop`, `seedWorkshopJob`/`futureDate`, `portalSignup`/`portalRequest`. `pool`, `runWithShop` and `prepare` come from `server/db.js`.
- Customer booking tests use a **signed-in** customer (`portalSignup`). Guest bookings are rate-limited to 5 an hour per IP (`portalGuestBookingLimiter`, `server/server.js:400`).
- The database needs `npm run docker:up`, plus `npm run migrate` after a new migration. zsh: capture exit codes by redirecting output to a file and echoing `$?` on the next line.
- **Every new test is watched failing** against the break named in its step, for the named reason, not a crash. Confirm the break landed with `git diff` before running, and restore afterwards.

## Decision log (choices the spec leaves open, and why)

Record further decisions here as tasks run.

1. **Migration 024 narrows the 018 hold index to timed holds.** The spec says drop-off bookings take a hold with no start time, and that the 018 unique index "stays as a second guard". But that index keys on `(shop, date, start_time, mechanic)`, and every drop-off hold has `start_time = ''`. So a mechanic's second drop-off booking on a day would collide with the first. Narrowing it with `AND start_time <> ''` keeps the timed-slot guard and lets untimed holds coexist. The lock is the main guard for both. **Schema change, so it needs Jack's OK.**
2. **What counts as a `capacity` refusal (409).** The customer route returns 409 `capacity` when other bookings have used the time:
   - overlap with another live job
   - not enough free minutes left
   - the hold-index race

   It returns 400 when the shop's own rules forbid it: closed day, hours, a block or leave ("unavailable"), a time sent for a drop-off day, or bad input. So a screen can say "that time has just gone, pick another" only when that is true. **Two existing tests change their expected status from 400 to 409, with the message unchanged:** the reserve refusals in `tests/portal-capacity-reserve.test.js`. The spec mandates the 409; the old page shows the message whatever the status.
3. **Every live job keeps exactly one live hold** (`syncJobHold`), staff jobs included. A timed hold sits at its start time. An untimed hold records its `planned_minutes`, or 0 if it has none. A job that stops being live has its hold released. Holds are the durable record of claimed capacity; the calculator still reads jobs.
4. **A scheduled mode change is settled on read and write, with no timer.** When `next_booking_mode_from` has arrived, the settings serializer reports it as the current `bookingMode`, and the next settings PUT writes it into `booking_mode` and clears the schedule. `modeForDate` already gives the right mode per date in between.
5. **A scheduled change must start tomorrow or later (UTC), and must differ from the current mode.** Both nulls cancel it.
6. **The old booking page cannot book a drop-off day,** because it always sends a time. No shop runs drop-off mode today (nothing read the setting before 2a), and the new `/book` screens replace that page (J1). Recorded, not fixed.
7. **Drop-off booking length still comes from `PORTAL_JOB_TYPES`.** Piece 3 swaps it to the chosen service. Every new booking writes `planned_minutes` = the job type's minutes.
8. **Locks are keyed `pg_advisory_xact_lock(shop_id, yyyymmdd)`,** the two-integer form. The only other advisory lock in the app, the migration lock (`server/migrations/run-migrations.js:52`), uses the one-integer form, which is a separate key space.
9. **PUT `bookingMode` equal to a scheduled `nextBookingMode` clears the schedule.** Setting the mode straight to the mode already scheduled would otherwise leave `booking_mode` and `next_booking_mode` equal - a self-contradictory state, since the settled read already reports the scheduled mode once its date arrives. The PUT clears `nextBookingMode`/`nextBookingModeFrom` instead of leaving a dangling future date.
10. **An unassigned job's hold is untimed** (`start_time ''`), even when the job is timed: the shared queue is counted, never slotted. So the 024 index only ever sees assigned timed holds - two unassigned timed jobs on the same mechanic-day no longer collide on the hold index.
11. **A `23505` on a staff write** (possible only from holds left stale before 2b) rolls the write back and answers 409 `code: 'capacity'` instead of 500; staff routes otherwise have no capacity check.

---

### Task 1: Migration 024 - untimed holds do not collide

**Files:**
- Create: `server/migrations/024_untimed_holds.sql`
- Test: `tests/capacity-holds-index.test.js`

**Interfaces:**
- Produces: `idx_workshop_capacity_holds_live_slot` covering only live holds with a start time.

- [ ] **Step 1: Write the failing test**

`tests/capacity-holds-index.test.js`:

```js
// Migration 024: two untimed (drop-off) holds for one mechanic on one day
// coexist; two timed holds at the same start still collide.
// Plan: docs/superpowers/plans/2026-09-24-book-server-2b-booking-modes.md (decision 1)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
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
});

const hold = (startTime) => runWithShop(owner.shop.id, () => prepare(
  `INSERT INTO workshop_capacity_holds (job_date, start_time, mechanic_id, minutes, state)
   VALUES ('2030-01-07', ?, ?, 60, 'held')`
).run(startTime, sam));

test('two drop-off holds for one mechanic on one day coexist', async () => {
  await hold('');
  await hold('');
});

test('two timed holds at the same start still collide', async () => {
  await hold('10:00');
  await assert.rejects(hold('10:00'), (err) => err.code === '23505');
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm run docker:up > /tmp/up.log 2>&1; echo "up $?"
node --test tests/capacity-holds-index.test.js > /tmp/b1.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok|23505" /tmp/b1.log | head
```
Expected: exit 1. The first test fails with a `23505` duplicate key on the second `''` hold. The second test passes.

- [ ] **Step 3: Write the migration**

`server/migrations/024_untimed_holds.sql`:

```sql
-- Drop-off holds (piece 2b). A drop-off booking reserves minutes on a day
-- without holding a start time. The 018 index treated start_time = '' as one
-- slot, so a mechanic's second drop-off booking on a day collided with the
-- first. It now covers timed holds only: untimed holds are counted, never
-- slotted. The per-(shop, date) booking lock is the main guard for both.
-- Plan: docs/superpowers/plans/2026-09-24-book-server-2b-booking-modes.md
DROP INDEX idx_workshop_capacity_holds_live_slot;
CREATE UNIQUE INDEX idx_workshop_capacity_holds_live_slot
  ON workshop_capacity_holds (shop_id, job_date, start_time, COALESCE(mechanic_id, 0))
  WHERE state IN ('held', 'confirmed') AND start_time <> '';
```

- [ ] **Step 4: Apply and run**

```bash
npm run migrate > /tmp/migrate.log 2>&1; echo "migrate $?"; grep "024" /tmp/migrate.log
node --test tests/capacity-holds-index.test.js tests/portal-capacity-holds.test.js > /tmp/b1.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/b1.log
node scripts/ci/assert-rls-coverage.mjs > /dev/null 2>&1; echo "rls $?"
```
Expected: migrate 0 with 024 listed; exit 0, no `not ok`; rls 0.

- [ ] **Step 5: Check the migration from an empty database**

Use the same scratch-database procedure as the 2a plan's Task 1 Step 7: create a scratch database, run `npm run migrate` against it, then drop it. Check the compose service name and credentials in `docker-compose.yml` and `.env` first. Expected: every step exits 0.

- [ ] **Step 6: Commit**

```bash
git add server/migrations/024_untimed_holds.sql tests/capacity-holds-index.test.js
git commit -m "feat: migration 024 - the hold index covers timed holds only, so drop-off holds coexist"
```

---

### Task 2: Pure helpers - lock key, mode-change rules

**Files:**
- Modify: `server/capacity.js` (append)
- Test: `tests/capacity.test.js` (append)

**Interfaces:**
- Produces, exported from `server/capacity.js`:
  - `bookingLockKey(date) -> number` (`'2026-09-07'` -> `20260907`)
  - `settleModeChange(settings, today) -> { bookingMode, nextBookingMode, nextBookingModeFrom }` (settings is the calculator's settings shape)
  - `validateModeChange({ nextBookingMode, nextBookingModeFrom }, { today, bookingMode }) -> { nextBookingMode, nextBookingModeFrom } | { error }`

- [ ] **Step 1: Write the failing tests**

Add `bookingLockKey, settleModeChange, validateModeChange` to the import list at the top of `tests/capacity.test.js`, then append:

```js
test('a booking lock key is the date as a whole number', () => {
  assert.equal(bookingLockKey('2026-09-07'), 20260907);
});

test('a scheduled mode change settles once its date arrives, not before', () => {
  const s = settings({ nextBookingMode: 'dropoff', nextBookingModeFrom: '2026-11-01' });
  assert.deepEqual(settleModeChange(s, '2026-10-31'), { bookingMode: 'timed', nextBookingMode: 'dropoff', nextBookingModeFrom: '2026-11-01' });
  assert.deepEqual(settleModeChange(s, '2026-11-01'), { bookingMode: 'dropoff', nextBookingMode: null, nextBookingModeFrom: null });
});

test('a mode change needs both parts, a real future date, and a different mode', () => {
  const ctx = { today: '2026-09-24', bookingMode: 'timed' };
  assert.deepEqual(validateModeChange({ nextBookingMode: 'dropoff', nextBookingModeFrom: '2026-09-25' }, ctx), { nextBookingMode: 'dropoff', nextBookingModeFrom: '2026-09-25' });
  assert.deepEqual(validateModeChange({ nextBookingMode: null, nextBookingModeFrom: null }, ctx), { nextBookingMode: null, nextBookingModeFrom: null });
  assert.match(validateModeChange({ nextBookingMode: 'dropoff', nextBookingModeFrom: null }, ctx).error, /both/);
  assert.match(validateModeChange({ nextBookingMode: 'dropoff', nextBookingModeFrom: '2026-09-24' }, ctx).error, /tomorrow/);
  assert.match(validateModeChange({ nextBookingMode: 'dropoff', nextBookingModeFrom: '2026-02-30' }, ctx).error, /look like/);
  assert.match(validateModeChange({ nextBookingMode: 'weekly', nextBookingModeFrom: '2026-10-01' }, ctx).error, /timed' or 'dropoff/);
  assert.match(validateModeChange({ nextBookingMode: 'timed', nextBookingModeFrom: '2026-10-01' }, ctx).error, /already/);
});
```

- [ ] **Step 2: Run and watch them fail**

```bash
node --test tests/capacity.test.js > /tmp/b2.log 2>&1; echo "exit $?"; grep -E "does not provide|^# (pass|fail)" /tmp/b2.log | head -3
```
Expected: exit 1, `does not provide an export named 'bookingLockKey'`.

- [ ] **Step 3: Append the helpers to `server/capacity.js`**

```js
// ---- Booking modes over time, and the booking lock ----

// Advisory-lock key for one shop's bookings on one date: 2026-09-07 -> 20260907.
export function bookingLockKey(date) {
  return Number(date.replace(/-/g, ''));
}

// A scheduled mode change whose date has arrived is the shop's mode. Nothing
// runs at midnight: this settles it whenever settings are read or written.
export function settleModeChange(settings, today) {
  if (settings.nextBookingMode && settings.nextBookingModeFrom && settings.nextBookingModeFrom <= today) {
    return { bookingMode: settings.nextBookingMode, nextBookingMode: null, nextBookingModeFrom: null };
  }
  return {
    bookingMode: settings.bookingMode,
    nextBookingMode: settings.nextBookingMode ?? null,
    nextBookingModeFrom: settings.nextBookingModeFrom ?? null,
  };
}

// Scheduling a change: both parts or neither (neither cancels), from tomorrow
// on, and to a mode the shop does not already use.
export function validateModeChange(input, { today, bookingMode }) {
  const mode = input.nextBookingMode ?? null;
  const from = input.nextBookingModeFrom ?? null;
  if (mode === null && from === null) return { nextBookingMode: null, nextBookingModeFrom: null };
  if (mode === null || from === null) return { error: 'Give both the new mode and the date it starts, or neither to cancel' };
  if (mode !== 'timed' && mode !== 'dropoff') return { error: "The new mode must be 'timed' or 'dropoff'" };
  if (!isRealDate(from)) return { error: 'The start date must look like 2026-11-01' };
  if (from <= today) return { error: 'A mode change must start tomorrow or later' };
  if (mode === bookingMode) return { error: 'The shop already uses that mode' };
  return { nextBookingMode: mode, nextBookingModeFrom: from };
}
```

- [ ] **Step 4: Run and pass; watch one break**

```bash
node --test tests/capacity.test.js > /tmp/b2.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/b2.log
```
Expected: exit 0, no `not ok`. Then change `settings.nextBookingModeFrom <= today` to `<`. Confirm with `git diff`, and expect "settles once its date arrives" to fail on the `'2026-11-01'` case. Restore and re-run.

- [ ] **Step 5: Commit**

```bash
git add server/capacity.js tests/capacity.test.js
git commit -m "feat: booking lock key and scheduled mode-change rules in the calculator module"
```

---

### Task 3: Scheduled mode change in workshop settings

**Files:**
- Modify: `server/server.js`: `toCapacitySettings`, `serializeWorkshopSettings`, and `PUT /api/workshop-settings`
- Test: `tests/workshop-mode-change.test.js`

**Interfaces:**
- Consumes: `settleModeChange`, `validateModeChange` (Task 2); `toCapacitySettings` (2a).
- Produces: `utcToday() -> 'YYYY-MM-DD'` in `server/server.js`. The settings JSON gains `nextBookingMode` and `nextBookingModeFrom`. `bookingMode` is today's settled mode. PUT accepts `nextBookingMode` + `nextBookingModeFrom`.

- [ ] **Step 1: Write the failing test**

`tests/workshop-mode-change.test.js`:

```js
// Scheduling a booking-mode change from a date the shop chooses.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2b)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';

let server;
let owner;

before(async () => {
  server = await startLiveServer();
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

async function freshShop() {
  if (owner) await deleteTestShop(owner.shop.id);
  owner = await staffSignup(server.baseUrl);
}

const settings = (body) => staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings', body ? { method: 'PUT', body } : undefined);
const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

test('a shop schedules drop-off mode from a future date, and can cancel it', async () => {
  await freshShop();
  const from = futureDate(1);
  const put = await settings({ nextBookingMode: 'dropoff', nextBookingModeFrom: from });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal(put.body.bookingMode, 'timed');
  assert.equal(put.body.nextBookingMode, 'dropoff');
  assert.equal(put.body.nextBookingModeFrom, from);
  const cancelled = await settings({ nextBookingMode: null, nextBookingModeFrom: null });
  assert.equal(cancelled.body.nextBookingMode, null);
  assert.equal(cancelled.body.nextBookingModeFrom, null);
});

test('a change dated today, half a change, or the same mode is refused', async () => {
  await freshShop();
  assert.equal((await settings({ nextBookingMode: 'dropoff', nextBookingModeFrom: today() })).status, 400);
  assert.equal((await settings({ nextBookingMode: 'dropoff' })).status, 400);
  assert.equal((await settings({ nextBookingMode: 'timed', nextBookingModeFrom: futureDate(1) })).status, 400);
});

test('other settings saves keep a scheduled change', async () => {
  await freshShop();
  const from = futureDate(2);
  await settings({ nextBookingMode: 'dropoff', nextBookingModeFrom: from });
  const res = await settings({ showPricesOnline: true });
  assert.equal(res.body.nextBookingMode, 'dropoff');
  assert.equal(res.body.nextBookingModeFrom, from);
});

test('a change whose date has arrived becomes the mode, and a save settles it', async () => {
  await freshShop();
  await runWithShop(owner.shop.id, () => prepare(
    "UPDATE workshop_settings SET next_booking_mode = 'dropoff', next_booking_mode_from = ?"
  ).run(yesterday()));
  const read = await settings();
  assert.equal(read.body.bookingMode, 'dropoff');
  assert.equal(read.body.nextBookingMode, null);
  await settings({ showPricesOnline: false });
  const row = await runWithShop(owner.shop.id, () => prepare(
    'SELECT booking_mode, next_booking_mode, next_booking_mode_from FROM workshop_settings LIMIT 1'
  ).get());
  assert.deepEqual({ ...row }, { booking_mode: 'dropoff', next_booking_mode: null, next_booking_mode_from: null });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
node --test tests/workshop-mode-change.test.js > /tmp/b3.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/b3.log
```
Expected: exit 1. `nextBookingMode` is undefined, and the refusals return 200.

- [ ] **Step 3: Add `utcToday` and settle in the serializer**

Add `settleModeChange, validateModeChange` to the `./capacity.js` import list. Directly above `function toCapacitySettings(row) {` add:

```js
// The server's date convention: UTC, as job_date comparisons elsewhere.
function utcToday() {
  return new Date().toISOString().slice(0, 10);
}
```

In `serializeWorkshopSettings`, replace `bookingMode: row.booking_mode,` with:

```js
    // Today's mode: a scheduled change whose date has arrived counts as made,
    // even before a save writes it into booking_mode.
    ...settleModeChange(toCapacitySettings(row), utcToday()),
```

This spread supplies `bookingMode`, `nextBookingMode` and `nextBookingModeFrom`.

- [ ] **Step 4: Accept and settle on PUT**

In `PUT /api/workshop-settings`, replace the block from `const bookingMode = body.bookingMode !== undefined` through its `return badRequest(res, "Booking mode must be either 'timed' or 'dropoff'");` closing brace with:

```js
  // A scheduled change whose date has arrived is written into booking_mode
  // now, so the next schedule never overwrites a change that already happened.
  const settled = settleModeChange(toCapacitySettings(existing), utcToday());
  const bookingMode = body.bookingMode !== undefined ? String(body.bookingMode).trim() : settled.bookingMode;
  if (bookingMode !== 'timed' && bookingMode !== 'dropoff') {
    return badRequest(res, "Booking mode must be either 'timed' or 'dropoff'");
  }
  let nextMode = { nextBookingMode: settled.nextBookingMode, nextBookingModeFrom: settled.nextBookingModeFrom };
  if (body.nextBookingMode !== undefined || body.nextBookingModeFrom !== undefined) {
    nextMode = validateModeChange(
      { nextBookingMode: body.nextBookingMode ?? null, nextBookingModeFrom: body.nextBookingModeFrom ?? null },
      { today: utcToday(), bookingMode },
    );
    if (nextMode.error) return badRequest(res, nextMode.error);
  }
```

In the `UPDATE workshop_settings` statement add `next_booking_mode = ?, next_booking_mode_from = ?,` after `booking_mode = ?,`. In `.run(...)` add `nextMode.nextBookingMode, nextMode.nextBookingModeFrom,` after `bookingMode,`.

- [ ] **Step 5: Run it and the settings neighbours**

```bash
node --test tests/workshop-mode-change.test.js tests/workshop-settings.test.js tests/workshop-weekday-hours.test.js > /tmp/b3.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/b3.log
```
Expected: exit 0, no `not ok`.

- [ ] **Step 6: Watch the settle test catch its break**

Change `...settleModeChange(toCapacitySettings(row), utcToday()),` in the serializer to `bookingMode: row.booking_mode, nextBookingMode: row.next_booking_mode, nextBookingModeFrom: row.next_booking_mode_from,`. Confirm with `git diff`, and expect "a change whose date has arrived" to fail at `read.body.bookingMode`. Restore and re-run.

- [ ] **Step 7: Commit**

```bash
git add server/server.js tests/workshop-mode-change.test.js
git commit -m "feat: schedule a booking-mode change from a date; a due change settles on read and save"
```

---

### Task 4: Holds follow their job; the walk-in queue

**Files:**
- Modify: `server/server.js`: `createWorkshopJob`, `POST /api/workshop-jobs`, `PUT /api/workshop-jobs/:id`; add `syncJobHold` and `resolvePlannedMinutes` directly above `async function createWorkshopJob(`
- Test: `tests/workshop-holds-follow.test.js`

**Interfaces:**
- Consumes: `LIVE_BOOKING_STATES` (capacity.js); `timeToMinutes` (server.js); `GET /api/workshop-capacity` (2a) for the queue assertions.
- Produces:
  - `syncJobHold(jobId)` and `resolvePlannedMinutes(input, fallback) -> { value } | { error }` in `server/server.js`
  - `createWorkshopJob({ ..., plannedMinutes })`
  - staff POST and PUT accept `plannedMinutes` (whole minutes 1-720, or null)

- [ ] **Step 1: Write the failing test**

`tests/workshop-holds-follow.test.js`:

```js
// A job's capacity hold follows the job, and staff can queue a walk-in with a
// length and no mechanic or time. Staff are never refused for capacity.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2b)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';

let server;
let owner;
let sam;
let alex;
const MONDAY = futureDate(1);
const TUESDAY = futureDate(2);

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex' });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

const as = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const createJob = (body) => as('/api/workshop-jobs', { method: 'POST', body: { title: 'Job', jobDate: MONDAY, ...body } });
const liveHolds = (jobId) => runWithShop(owner.shop.id, () => prepare(
  `SELECT job_date, start_time, mechanic_id, minutes FROM workshop_capacity_holds
   WHERE workshop_job_id = ? AND state IN ('held', 'confirmed')`
).all(jobId));
const capacity = async (date) => (await as(`/api/workshop-capacity?start=${date}&end=${date}`)).body.days[0];

test('moving and resizing a job moves its hold', async () => {
  const job = (await createJob({ mechanicId: sam, startTime: '10:00', endTime: '11:00' })).body;
  const moved = await as(`/api/workshop-jobs/${job.id}`, { method: 'PUT', body: { jobDate: TUESDAY, startTime: '14:00', endTime: '15:30' } });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.deepEqual((await liveHolds(job.id)).map((h) => ({ ...h })), [{ job_date: TUESDAY, start_time: '14:00', mechanic_id: sam, minutes: 90 }]);
});

test('a walk-in joins the shared queue with its length, and its hold records it', async () => {
  const res = await createJob({ plannedMinutes: 60 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const row = await runWithShop(owner.shop.id, () => prepare('SELECT planned_minutes, mechanic_id FROM workshop_jobs WHERE id = ?').get(res.body.id));
  assert.deepEqual({ ...row }, { planned_minutes: 60, mechanic_id: null });
  assert.deepEqual((await liveHolds(res.body.id)).map((h) => ({ ...h })), [{ job_date: MONDAY, start_time: '', mechanic_id: null, minutes: 60 }]);
  assert.equal((await capacity(MONDAY)).queueMinutes, 60);
});

test('assigning a queued walk-in moves its whole length onto the mechanic', async () => {
  const date = futureDate(3);
  const job = (await createJob({ jobDate: date, plannedMinutes: 120 })).body;
  const before = await capacity(date);
  const samBefore = before.mechanics.find((m) => m.mechanicId === sam).freeMinutes;
  const assigned = await as(`/api/workshop-jobs/${job.id}`, { method: 'PUT', body: { mechanicId: sam } });
  assert.equal(assigned.status, 200, JSON.stringify(assigned.body));
  const after = await capacity(date);
  assert.equal(after.queueMinutes, 0);
  assert.equal(after.mechanics.find((m) => m.mechanicId === sam).freeMinutes, samBefore - 60, 'Sam had carried half the queue; now he carries all of it');
  assert.equal((await liveHolds(job.id))[0].mechanic_id, sam);
});

test('staff are never refused for capacity', async () => {
  const date = futureDate(4);
  await createJob({ jobDate: date, mechanicId: alex, startTime: '09:00', endTime: '18:00' });
  const res = await createJob({ jobDate: date, mechanicId: alex, plannedMinutes: 240 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
});

test('a planned length must be whole minutes between 1 and 720', async () => {
  assert.equal((await createJob({ plannedMinutes: 0 })).status, 400);
  assert.equal((await createJob({ plannedMinutes: 'an hour' })).status, 400);
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
node --test tests/workshop-holds-follow.test.js > /tmp/b4.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/b4.log
```
Expected: exit 1. The moved hold still shows the old date, the walk-in's `planned_minutes` is null, and the length checks return 201. If `POST /api/workshop-jobs` refuses a job with no mechanic, read `resolveJobMechanicId` and record what it needs. The spec requires a queue job with no mechanic to be accepted.

- [ ] **Step 3: Add `syncJobHold` and `resolvePlannedMinutes`**

Directly above `async function createWorkshopJob(`:

```js
// A job's capacity hold follows the job. One live hold per live job: timed at
// its start with its length, untimed (drop-off, a walk-in) with its planned
// minutes and no start. A job that stops being live has its hold released.
// Called inside the same transaction as every job write, so a hold never
// describes a job that has since moved.
async function syncJobHold(jobId) {
  const job = await db.prepare(
    'SELECT id, mechanic_id, job_date, start_time, end_time, planned_minutes, booking_state FROM workshop_jobs WHERE id = ?'
  ).get(jobId);
  if (!job || !LIVE_BOOKING_STATES.includes(job.booking_state)) {
    await db.prepare(
      `UPDATE workshop_capacity_holds SET state = 'released'
       WHERE workshop_job_id = ? AND state IN ('held', 'confirmed')`
    ).run(jobId);
    return;
  }
  const startTime = job.start_time || '';
  const minutes = startTime
    ? Math.max(0, timeToMinutes(job.end_time) - timeToMinutes(startTime))
    : (job.planned_minutes || 0);
  const hold = await db.prepare(
    `SELECT id FROM workshop_capacity_holds
     WHERE workshop_job_id = ? AND state IN ('held', 'confirmed') ORDER BY id LIMIT 1`
  ).get(jobId);
  if (hold) {
    await db.prepare(
      'UPDATE workshop_capacity_holds SET job_date = ?, start_time = ?, mechanic_id = ?, minutes = ? WHERE id = ?'
    ).run(job.job_date, startTime, job.mechanic_id, minutes, hold.id);
  } else {
    await db.prepare(
      `INSERT INTO workshop_capacity_holds (workshop_job_id, job_date, start_time, mechanic_id, minutes, state)
       VALUES (?, ?, ?, ?, ?, 'held')`
    ).run(jobId, job.job_date, startTime, job.mechanic_id, minutes);
  }
}

// A job's length when it has no times: whole minutes, 1 to 720, or null.
function resolvePlannedMinutes(input, fallback) {
  if (input === undefined) return { value: fallback ?? null };
  if (input === null || input === '') return { value: null };
  const n = Number(input);
  if (!Number.isInteger(n) || n < 1 || n > 720) {
    return { error: 'The planned length must be a whole number of minutes between 1 and 720' };
  }
  return { value: n };
}
```

- [ ] **Step 4: `createWorkshopJob` writes `planned_minutes` and syncs the hold**

- Add `plannedMinutes` to the destructured parameters, after `skipAutoOrder`.
- In its `INSERT INTO workshop_jobs`, add `planned_minutes` to the column list and one `?` to `VALUES`. In `.run(...)`, add after `notes`:

  ```js
  plannedMinutes ?? (startTime ? Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime)) : null),
  ```

- Replace the whole `if (startTime) { await db.prepare(\`INSERT INTO workshop_capacity_holds ...\`) ... }` block, keeping its comment about the partial unique index (the index still guards timed holds), with:

  ```js
      await syncJobHold(info.lastInsertRowid);
  ```

- [ ] **Step 5: Staff POST and PUT accept `plannedMinutes` and sync the hold**

In `POST /api/workshop-jobs`, after the `mechResolved` check:

```js
  // A walk-in for the shared queue carries a length and no mechanic or time.
  const planned = resolvePlannedMinutes(body.plannedMinutes, null);
  if (planned.error) return badRequest(res, planned.error);
```

Then pass `plannedMinutes: planned.value` to `createWorkshopJob`. A timed job with no `plannedMinutes` gets its length from its times, via Step 4.

In `PUT /api/workshop-jobs/:id`, after the `mechResolved` check:

```js
  const planned = resolvePlannedMinutes(body.plannedMinutes, existing.planned_minutes);
  if (planned.error) return badRequest(res, planned.error);
  // A timed job's length is its times; planned_minutes only speaks for untimed work.
  const plannedMinutes = times.startTime
    ? Math.max(0, timeToMinutes(times.endTime) - timeToMinutes(times.startTime))
    : planned.value;
```

Add `planned_minutes = ?,` to its `UPDATE workshop_jobs SET` list and `plannedMinutes,` to the matching position in `.run(...)`. Directly after that UPDATE, add `await syncJobHold(id);`.

- [ ] **Step 6: Run it and the neighbours**

```bash
node --test tests/workshop-holds-follow.test.js tests/portal-capacity-holds.test.js tests/workshop-rules.test.js tests/workshop-capacity-view.test.js > /tmp/b4.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/b4.log
```
Expected: exit 0, no `not ok`.

- [ ] **Step 7: Watch two tests catch their breaks**

1. Remove the `await syncJobHold(id);` line from the PUT route. Confirm with `git diff`. Expect "moving and resizing a job moves its hold" to fail on the hold's date. Restore.
2. In `syncJobHold`, change the UPDATE to leave `mechanic_id` out. Confirm with `git diff`. Expect "assigning a queued walk-in" to fail on the hold's `mechanic_id`. Restore.

Run again: all pass.

- [ ] **Step 8: Commit**

```bash
git add server/server.js tests/workshop-holds-follow.test.js
git commit -m "feat: a job's hold follows the job; staff queue walk-ins with a length and no mechanic"
```

---

### Task 5: One booking at a time per shop and date; 409 `capacity`

**Files:**
- Modify: `server/server.js`:
  - `checkJobSlot` returns `{ error, taken }` instead of a string, and all three callers change
  - add `withBookingLock` directly above `async function createWorkshopJob(`
  - wrap the customer booking POST, staff `POST /api/workshop-jobs` and staff `PUT /api/workshop-jobs/:id` check-and-write in it
- Modify: `tests/portal-capacity-reserve.test.js`: the two reserve refusals expect 409 `capacity` (decision 2)
- Test: `tests/booking-lock.test.js`

**Interfaces:**
- Consumes: `bookingLockKey` (Task 2), `syncJobHold` (Task 4), `loadCapacity`/`fitsFreeTime` (2a).
- Produces:
  - `withBookingLock(dates, fn) -> Promise<result of fn>`
  - `checkJobSlot(...) -> null | { error: string, taken: boolean }`, where `taken` is true only for overlap with another live job
  - the customer POST answers `409 { error, code: 'capacity' }` when other bookings have used the time (decision 2)

- [ ] **Step 1: Write the failing test**

`tests/booking-lock.test.js`:

```js
// Booking writes for one shop and date run one at a time, so two customers
// can never both take the last of a day; a refusal for used-up time says so
// with code 'capacity'.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2b)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';

let server;
let owner;
let sam;
let customer;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const book = (jobDate, startTime, jobType = 'repair') =>
  portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: { mechanicId: sam, jobDate, startTime, jobType, description: 'Test booking', newBike: { make: 'Test', model: 'Bike' } },
  });

test('a booking waits while another booking holds the same shop and date', async () => {
  const date = futureDate(1);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::int, $2::int)', [owner.shop.id, Number(date.replace(/-/g, ''))]);
    let settled = false;
    const pending = book(date, '10:00').then((r) => { settled = true; return r; });
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(settled, false, 'the booking did not wait for the lock');
    await client.query('COMMIT');
    assert.equal((await pending).status, 201);
  } finally {
    client.release();
  }
});

test('overlapping bookings sent at once: exactly one wins, the rest get capacity', async () => {
  const date = futureDate(2);
  const results = await Promise.all([
    // 14:00-16:00, 14:30-15:30, 15:00-16:00, 15:15-16:15: every pair overlaps,
    // so exactly one can ever be accepted, whichever arrives first.
    book(date, '14:00', 'service'),
    book(date, '14:30'),
    book(date, '15:00'),
    book(date, '15:15'),
  ]);
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 409, 409, 409], JSON.stringify(results.map((r) => r.body)));
  for (const r of results.filter((x) => x.status === 409)) assert.equal(r.body.code, 'capacity');
});

test('a booking into time another booking holds refuses with capacity', async () => {
  const date = futureDate(3);
  assert.equal((await book(date, '17:00')).status, 201);
  const res = await book(date, '17:00', 'quick');
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'capacity');
});
```

(The free-minutes refusal is covered by `tests/portal-capacity-reserve.test.js`, updated in Step 6.)

- [ ] **Step 2: Run and watch it fail**

```bash
node --test tests/booking-lock.test.js > /tmp/b5.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok|did not wait" /tmp/b5.log
```
Expected: exit 1.
- The lock test fails with "the booking did not wait for the lock".
- The race test fails: either more than one 201, or 400s with no `code`.
- The third test fails on 400 vs 409.

- [ ] **Step 3: `checkJobSlot` says whether the time was taken**

In `checkJobSlot`, change every `return '...';` to `return { error: '...', taken: false };`, except the overlap refusal ('That mechanic is already booked over part of that window'), which becomes `return { error: '...', taken: true };`. Update the function's comment: "Returns null when the slot is fine, or { error, taken } - taken means another live booking holds the time." In the staff POST and PUT, change `if (slotError) return badRequest(res, slotError);` to `if (slotError) return badRequest(res, slotError.error);`.

- [ ] **Step 4: Add `withBookingLock`**

Add `bookingLockKey` to the `./capacity.js` import list. Directly above `async function syncJobHold(`:

```js
// Booking writes for one shop and date run one at a time: check, then write,
// with nothing between them. A transaction-scoped advisory lock keyed (shop,
// date), released at COMMIT or ROLLBACK. Several dates (a move) are locked in
// date order, so two moves between the same days cannot deadlock. Nested
// BEGIN/COMMIT inside fn (createWorkshopJob) becomes a savepoint (server/db.js).
async function withBookingLock(dates, fn) {
  await db.exec('BEGIN');
  try {
    for (const date of [...new Set(dates)].sort()) {
      await db.prepare(
        "SELECT pg_advisory_xact_lock(current_setting('app.current_shop_id')::int, ?::int)"
      ).get(bookingLockKey(date));
    }
    const result = await fn();
    await db.exec('COMMIT');
    return result;
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

// A refusal because other bookings have used the time. The code is what a
// screen branches on; the words are what the old booking page shows.
const capacityRefusal = (error) => ({ status: 409, body: { error, code: 'capacity' } });
const refusal = (error) => ({ status: 400, body: { error } });
```

- [ ] **Step 5: Wrap the three routes**

**Customer booking POST.** Keep everything before the `checkJobSlot` call: session, guest, date, description, job type, times, mechanic. Replace from `const slotError = await checkJobSlot({` through the end of the route with:

```js
  const out = await withBookingLock([jobDate], async () => {
    const slot = await checkJobSlot({
      jobDate,
      startTime: times.startTime,
      endTime: times.endTime,
      mechanicId: mechResolved.mechanicId,
    });
    if (slot) return slot.taken ? capacityRefusal(slot.error) : refusal(slot.error);

    // The capacity calculator, inside the lock: the same answer the calendar
    // gave, now certain to include every booking committed before this one.
    // Blocks and the shop's hours are shop rules (400); minutes other bookings
    // have used are capacity (409). A block's reason is never given.
    const capacity = await loadCapacity(jobDate, jobDate);
    const mech = capacity.days[0].mechanics.find((m) => m.mechanicId === mechResolved.mechanicId);
    if (!mech || !mech.working || !fitsFreeTime(mech, times.startTime, times.endTime)) {
      return refusal('That mechanic is unavailable at that time - please choose another time or day.');
    }
    if (mech.freeMinutes < jobType.minutes) {
      return capacityRefusal('That mechanic does not have enough free time that day - please choose another day, or a shorter job.');
    }

    let bikeId = null;
    // (move the existing newBike / bikeId block here unchanged, except that
    //  each `return badRequest(res, msg)` becomes `return refusal(msg)`)

    let jobId;
    try {
      jobId = await createWorkshopJob({
        title: `Online booking: ${description}`.slice(0, 200),
        customerId,
        bikeId,
        mechanicId: mechResolved.mechanicId,
        jobDate,
        startTime: times.startTime,
        endTime: times.endTime,
        bookingState: 'pending',
        workState: 'not_started',
        custodyState: 'expected',
        notes: description,
        skipAutoOrder: false,
        plannedMinutes: jobType.minutes,
      });
    } catch (err) {
      // The 018 index, a second guard behind the lock.
      if (err.code === '23505') return capacityRefusal('That time is no longer available - please choose another.');
      throw err;
    }
    const row = await db.prepare(WORKSHOP_JOB_SELECT + ' WHERE w.id = ?').get(jobId);
    return { status: 201, body: serializePortalBooking(row) };
  });
  sendJson(res, out.status, out.body);
});
```

The bike block is the existing code between `// Either an existing bike of theirs` and the `createWorkshopJob` call. Move it in verbatim; only its two `return badRequest(res, ...)` lines change.

**Staff `POST /api/workshop-jobs`.** Wrap from `const slotError = await checkJobSlot({` through the `createWorkshopJob(...)` call and the response in `withBookingLock([jobDate], async () => { ... })`, using the same return-a-result shape (`refusal(slotError.error)` for the slot, `{ status: 201, body: ... }` on success, with the route's existing success body). Then `sendJson(res, out.status, out.body)`. Staff have no calculator check.

**Staff `PUT /api/workshop-jobs/:id`.** Wrap from `const slotError = await checkJobSlot({` through the `syncJobHold(id)` call and the response in `withBookingLock([existing.job_date, jobDate], async () => { ... })`, the same way. Both dates are locked: the day it leaves and the day it joins.

- [ ] **Step 6: The reserve refusals are now `capacity`**

In `tests/portal-capacity-reserve.test.js`:
- In "a booking that would consume the whole reserve is refused", change `assert.equal(res.status, 400, ...)` to `assert.equal(res.status, 409, ...)`, and add `assert.equal(res.body.code, 'capacity');`.
- In the long-job-refused test (the assertion at about line 91), make the same change. Its `/enough free time/i` message assertion stays.

Then:

```bash
grep -rn "already booked over part\|enough free time\|no longer available" tests/ | grep -v booking-lock
```

For each hit that asserts a customer booking's status, apply decision 2: overlap, minutes and race refusals are 409 `capacity`. Change only the status and add the code check; never the message. List every file you changed in the report. Staff route tests keep 400.

- [ ] **Step 7: Run it and every booking test**

```bash
node --test tests/booking-lock.test.js tests/portal-capacity-reserve.test.js tests/portal-capacity-holds.test.js tests/portal-booking-blocks.test.js tests/workshop-portal.test.js tests/workshop-rules.test.js tests/workshop-holds-follow.test.js > /tmp/b5.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/b5.log
```
Expected: exit 0, no `not ok`.

- [ ] **Step 8: Watch the lock test catch its break**

In `withBookingLock`, delete the `for (const date of ...)` loop. Confirm with `git diff`. Expect "a booking waits" to fail with "the booking did not wait for the lock". The race test may or may not fail, since without the lock the race is timing-dependent; report which happened. Restore and re-run: all pass.

- [ ] **Step 9: Commit**

```bash
git add server/server.js tests/booking-lock.test.js tests/portal-capacity-reserve.test.js
git commit -m "feat: booking writes run one at a time per shop and date; used-up time answers 409 capacity"
```

Add any other test files Step 6 changed to the `git add`.

---

### Task 6: Customer drop-off bookings

**Files:**
- Modify: `server/server.js`: the customer booking POST reads the mode for its date
- Test: `tests/portal-dropoff-booking.test.js`

**Interfaces:**
- Consumes: `withBookingLock`, `capacityRefusal`, `refusal` (Task 5); `loadCapacity`, `fitsDropoff` (2a); `isRealDate` (capacity.js).
- Produces: on a drop-off date the POST takes `mechanicId` and no `startTime`, and writes a job with no times, `planned_minutes` = the job type's minutes, and an untimed hold.

- [ ] **Step 1: Write the failing test**

`tests/portal-dropoff-booking.test.js`:

```js
// Drop-off days: the customer picks a day and a mechanic, never a time. A
// timed day still needs a time. A full drop-off day refuses with capacity.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2b)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';

let server;
let owner;
let sam;
let customer;
// The same day futureDate() counts from (today + 21, UTC).
const SWITCH = new Date(Date.now() + 86_400_000 * 21).toISOString().slice(0, 10);

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  // Drop-off from three weeks out; every futureDate() is on or after it.
  const res = await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings', {
    method: 'PUT', body: { nextBookingMode: 'dropoff', nextBookingModeFrom: SWITCH },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

const book = (body) => portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
  method: 'POST',
  body: { mechanicId: sam, jobType: 'repair', description: 'Test booking', newBike: { make: 'Test', model: 'Bike' }, ...body },
});
const job = (id) => runWithShop(owner.shop.id, () => prepare('SELECT start_time, end_time, planned_minutes FROM workshop_jobs WHERE id = ?').get(id));
const hold = (id) => runWithShop(owner.shop.id, () => prepare(
  "SELECT start_time, minutes FROM workshop_capacity_holds WHERE workshop_job_id = ? AND state = 'held'"
).get(id));

test('a drop-off day books with no time, and records the length', async () => {
  const res = await book({ jobDate: futureDate(1) });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual({ ...(await job(res.body.id)) }, { start_time: '', end_time: '', planned_minutes: 60 });
  assert.deepEqual({ ...(await hold(res.body.id)) }, { start_time: '', minutes: 60 });
});

test('a second drop-off for the same mechanic and day is also accepted', async () => {
  const date = futureDate(2);
  assert.equal((await book({ jobDate: date })).status, 201);
  assert.equal((await book({ jobDate: date })).status, 201);
});

test('a time sent for a drop-off day is refused, as a shop rule', async () => {
  const res = await book({ jobDate: futureDate(3), startTime: '10:00' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(res.body.code, undefined);
});

test('a day before the switch is still timed and needs a time', async () => {
  const beforeSwitch = new Date(Date.now() + 86_400_000 * 2).toISOString().slice(0, 10);
  const res = await book({ jobDate: beforeSwitch });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /start time is required/i);
});

test('a full drop-off day refuses with capacity', async () => {
  const date = futureDate(4);
  // 540-minute day, no reserve: nine 60-minute drop-offs fill it.
  for (let i = 0; i < 9; i += 1) assert.equal((await book({ jobDate: date })).status, 201);
  const res = await book({ jobDate: date });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'capacity');
});
```

`SWITCH` is today + 21 days, the day `futureDate()` counts from. So every `futureDate(n)` is a drop-off day, and today + 2 is a timed day.

- [ ] **Step 2: Run and watch it fail**

```bash
node --test tests/portal-dropoff-booking.test.js > /tmp/b6.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/b6.log
```
Expected: exit 1. Drop-off bookings are refused with "A start time is required".

- [ ] **Step 3: The POST reads the mode for its date**

In the customer booking POST:

1. Change the date check to `if (!isRealDate(jobDate)) return badRequest(res, 'A valid date is required');`.
2. **Remove** the lines computing `startTime`/`times` and the two start-time checks before the mechanic check. Times now depend on the mode, which is read inside the lock.
3. At the top of the `withBookingLock` callback, before the `checkJobSlot` call, add:

   ```js
    // The mode for this date decides what the customer chose: a day (drop-off)
    // or a time (timed). Read inside the lock, from the calculator.
    const capacity = await loadCapacity(jobDate, jobDate);
    const mode = capacity.days[0].mode;
    const startTime = (body.startTime || '').trim();
    let times;
    if (mode === 'dropoff') {
      if (startTime) return refusal('This shop takes drop-offs on that day - choose the day, not a time.');
      times = { startTime: '', endTime: '' };
    } else {
      times = resolveJobTimes(startTime, startTime ? addMinutesToTime(startTime, jobType.minutes) : '');
      if (!times.startTime) return refusal('A start time is required');
      if (times.error) return refusal(times.error);
    }
   ```

4. Delete the later `const capacity = await loadCapacity(jobDate, jobDate);` line (it now comes from step 3), and change the availability refusal to:

   ```js
    const mech = capacity.days[0].mechanics.find((m) => m.mechanicId === mechResolved.mechanicId);
    if (!mech || !mech.working || (times.startTime && !fitsFreeTime(mech, times.startTime, times.endTime))) {
      return refusal('That mechanic is unavailable at that time - please choose another time or day.');
    }
   ```

   `checkJobSlot` with no times checks the closed day and the mechanic's day off, then returns. That is right for a drop-off day. The minutes check that follows is unchanged, and covers both modes.

- [ ] **Step 4: Run it and every booking test**

```bash
node --test tests/portal-dropoff-booking.test.js tests/booking-lock.test.js tests/portal-capacity-reserve.test.js tests/portal-capacity-holds.test.js tests/portal-booking-blocks.test.js tests/workshop-portal.test.js > /tmp/b6.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/b6.log
```
Expected: exit 0, no `not ok`.

- [ ] **Step 5: Watch two tests catch their breaks**

1. Change `if (mode === 'dropoff')` to `if (false)`. Confirm with `git diff`. Expect "a drop-off day books with no time" to fail on "start time is required". Restore.
2. Change `mech.freeMinutes < jobType.minutes` to `false`. Confirm with `git diff`. Expect "a full drop-off day refuses" to fail on 201. Restore.

Run again: all pass.

- [ ] **Step 6: Commit**

```bash
git add server/server.js tests/portal-dropoff-booking.test.js
git commit -m "feat: customers book drop-off days with no time; the mode comes from the date"
```

---

### Task 7: The API client knows `capacity`

**Files:**
- Modify: `src/lib/api/types.ts` (the `code` union on the error body), `src/lib/api/client.ts` (`ApiErrorCode`, `classify`)
- Test: `tests/screens/api-client.test.js` (append)

**Interfaces:**
- Produces: `ApiError.code === 'capacity'` for a 409 with `code: 'capacity'`.

- [ ] **Step 1: Write the failing test**

Append to `tests/screens/api-client.test.js`:

```js
test('a 409 for used-up capacity is its own code, not stale', async () => {
  // The body server/server.js's capacityRefusal() sends.
  stubFetch(409, { error: 'That time is no longer available - please choose another.', code: 'capacity' });
  await assert.rejects(
    () => apiMutate('/api/portal/shop/bookings', 'POST', {}),
    (err) => err instanceof ApiError && err.status === 409 && err.code === 'capacity'
  );
});
```

Check `apiMutate`'s signature at the top of `src/lib/api/client.ts` and adjust the call if its arguments differ. The assertion is what matters.

- [ ] **Step 2: Run and watch it fail**

```bash
npm run pretest > /tmp/b7pre.log 2>&1; echo "pretest $?"
node --test tests/screens/api-client.test.js > /tmp/b7.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/b7.log
```
Expected: exit 1; `code` is `'unknown'`. If this test file loads `.ts` directly without the build step, skip `pretest`; the existing tests in the file show which applies.

- [ ] **Step 3: Teach the client the code**

- In `src/lib/api/types.ts`, change `code?: 'stale' | 'illegal';` to `code?: 'stale' | 'illegal' | 'capacity';`, and extend its comment: `capacity` means other bookings have used the time, so pick another.
- In `src/lib/api/client.ts`, add `| 'capacity'` to `ApiErrorCode` after `'illegal'`, and in `classify` change the 409 line to:

  ```ts
  if (status === 409) {
    return serverCode === 'stale' || serverCode === 'illegal' || serverCode === 'capacity' ? serverCode : 'unknown';
  }
  ```

  Add to the file's header comment list: "`capacity` means the time or day has been used up by other bookings - pick another; retrying the same one cannot help."

- [ ] **Step 4: Run, typecheck, commit**

```bash
node --test tests/screens/api-client.test.js > /tmp/b7.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/b7.log
npm run typecheck > /tmp/tc.log 2>&1; echo "typecheck $?"
git add src/lib/api/types.ts src/lib/api/client.ts tests/screens/api-client.test.js
git commit -m "feat: the API client classifies a 409 capacity refusal"
```

---

### Task 8: Every gate, and the docs

**Files:**
- Modify: `.agents/STATUS.md`; `docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md` (2b section, to match the build and this plan's decision log)

- [ ] **Step 1: Run every canonical command**

These are the 14 commands in STATUS's "Canonical commands" block. Redirect each to a file and echo its exit code. Expected: every exit 0, and a test count above 537 with `fail 0`.

- [ ] **Step 2: Walk the build against the spec**

For each 2b line of the spec and the 2b lines of "Testing", note whether it is met, changed (name the decision), or not done. Write this into the task report; it goes into the pull request body.

- [ ] **Step 3: Update the spec and STATUS, then commit**

- **Spec:** in "2b", note migration 024 (decision 1), the 409/400 split (decision 2), holds for every live job (decision 3), and settle-on-read-and-write (decision 4). Point at this plan's Decision log.
- **STATUS:** record piece 2b built on `feat/book-server-2b-modes`, the new test count, and that its pull request waits on #65. The next piece is 3 (the booking request). Stay under 8,000 bytes, and move older text to `ARCHIVE.md` if needed.

```bash
git add .agents/STATUS.md docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md docs/superpowers/plans/2026-09-24-book-server-2b-booking-modes.md
git commit -m "docs: piece 2b built - spec matches the build, STATUS"
```

The push and pull request come after the final whole-branch review.
