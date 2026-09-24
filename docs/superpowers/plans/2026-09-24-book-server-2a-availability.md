# Book server piece 2a: when a mechanic is available - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shop can set different opening hours per weekday, and add lunch-style repeating blocks, mechanic leave and shop closed dates. One capacity calculator then decides what customers can book, and the customer calendar, the customer booking check and a new staff capacity view all use it.

**Architecture:** A new pure module `server/capacity.js` does all the arithmetic and touches no database, so it is unit-tested without Postgres. `server/server.js` loads the rows (settings, mechanics, blocks, live jobs), hands them to the calculator, and shapes the answer per route. One migration adds per-weekday hours and the scheduled-mode columns to `workshop_settings`, and a new `workshop_unavailability` table for blocks.

**Tech Stack:** Node 22 ESM, the plain `http` server in `server/server.js`, PostgreSQL 16 through `pg` (the only runtime dependency), `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md` (approved by Jack, 24 Sep), sections "2a" and "Testing". Read it before starting. 2b (booking in either mode) is a separate plan.

## Global Constraints

- No new dependencies. `pg` stays the only runtime dependency.
- Every shop-scoped table: `shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id)`, ENABLE and FORCE row-level security, and a `<table>_shop_isolation` policy (pattern: `server/migrations/018_workshop_capacity_holds.sql`).
- A foreign key check bypasses row-level security, so any id a request supplies for another table is looked up through the shop-scoped `db` first.
- Dates are `TEXT` `YYYY-MM-DD` and times `TEXT` `HH:MM`, as `workshop_jobs.job_date`/`start_time` already are. Weekdays are 0-6, 0 = Sunday, from `getUTCDay()`.
- **Customers never see a block's reason**, other customers' jobs, or minute totals. Only staff routes return reasons.
- **Staff are never refused because of blocks or capacity** (4 Sep decision §7.7). Blocks affect customers only; staff see clashes.
- Live jobs are those with `booking_state` in `pending`, `scheduled`, `reschedule_requested`. `declined`, `expired` and `cancelled` use no capacity.
- On PUT, an omitted field keeps its stored value.
- Every covered route has a `// screens: a, b` comment on the lines directly above it, with no blank line between.
- Tests that boot a server or touch the database start with `import '../server/load-env.js';`. Helpers: `startLiveServer` (`tests/helpers/liveServer.js`), `staffSignup`/`staffRequest`/`seedMechanic` (`tests/helpers/staff.js`), `jsonRequest` (`tests/helpers/http.js`), `deleteTestShop`/`createTestShop` (`tests/helpers/testShop.js`), `seedWorkshopJob`/`seedBookableShop` (`tests/helpers/workshopFixtures.js`), `portalSignup`/`portalRequest` (`tests/helpers/portal.js`).
- The local database needs `npm run docker:up`, and `npm run migrate` after a new migration file, before tests run. `npm test` hangs silently without Postgres.
- A worktree needs its own `.env` (gitignored). Without it every server-booting test fails with `ECONNREFUSED`.
- This shell is zsh, where `PIPESTATUS` is empty. Capture exit codes by redirecting output to a file and echoing `$?` on the next line.
- **Every new test is watched failing** against the break named in its step, and the break is confirmed to have landed (for example `git diff` shows it) before restoring.

## Decision log (changes from the spec's wording, and why)

Record further decisions here as tasks run.

1. **Per-weekday hours are one column, not a table.** The spec said a `workshop_opening_hours` table, backfilled. Every new shop (`createShop`, `server/auth.js:115`) and every test shop (`seedBookableShop`) gets its settings row from column defaults. A table would need seven rows written at every shop creation, or every read path would break for shops without them. Instead: `workshop_settings.weekday_hours TEXT` JSON holds **only the days whose hours differ** from `opening_time`/`closing_time`, and `opening_days` still says which days are open. Customers see the same result. No backfill is needed, because an empty `{}` means "every open day uses the usual hours", which is today's behaviour. **Needs Jack's OK, since it changes the approved schema.**
2. **The old settings page does not wipe Saturday's hours.** The spec said a legacy save "rewrites every open weekday with those hours". The old page (`public/app.js:4148`) sends opening time on every save, including a save that only changes the reserve. So under that rule, changing anything would silently delete Saturday's shorter hours. With decision 1, a legacy save changes the usual hours, and a day with its own hours keeps them.
3. **The reserve defaults to 0 in `createShop`, not via `ALTER ... SET DEFAULT`.** Test shops built by `seedBookableShop` rely on the column default of 120 (`tests/workshop-availability.test.js:9`, `tests/portal-capacity-reserve.test.js`). Real new shops all come through `createShop`, so this gives them 0 without changing what existing tests check.
4. **Dates in the new columns are `TEXT` with a format check, not `DATE`.** This matches `job_date`, and `pg` would otherwise hand back JavaScript `Date` objects that compare wrongly against `'YYYY-MM-DD'` strings.
5. **The customer booking POST uses the calculator in 2a** (Task 6), not only in 2b. Without it, 2a would show lunch as unavailable on the calendar while the booking route still accepted a 13:00 booking. The spec says "the server's booking check is the authority". 2b still owns drop-off bookings, the lock, and the `capacity` code.
6. **Timed jobs with no mechanic join the shared queue's minutes.** The spec names only unassigned *untimed* jobs. A timed unassigned staff job is equally work nobody has been given yet, and leaving it out would count it nowhere.
7. **The old page's "full days" list covers only a mechanic's normal working days**, i.e. an open weekday the mechanic works. Closed weekdays and days off were never in that list; the old page greys them itself from `openingDays`/`workingDays`. A day counts as full when free minutes, after the reserve, are 0 or less. That matches the old rule (`free < threshold`) everywhere except exactly `free == threshold`, where nothing could have been booked anyway.

---

### Task 1: Migration 023, and new shops start with no reserve

**Files:**
- Create: `server/migrations/023_capacity_blocks.sql`
- Modify: `server/auth.js:115`
- Test: `tests/capacity-schema.test.js`

**Interfaces:**
- Produces: columns `workshop_settings.weekday_hours TEXT NOT NULL DEFAULT '{}'`, `.next_booking_mode`, `.next_booking_mode_from`; table `workshop_unavailability(id, shop_id, employee_id, kind, weekdays, start_date, end_date, start_time, end_time, reason, created_at, updated_at)`.

- [ ] **Step 1: Write the failing test**

`tests/capacity-schema.test.js`:

```js
// Migration 023 and the new-shop reserve default.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2a, Schema)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

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

test('a new shop starts with no reserve, since blocks now carry lunch', async () => {
  const res = await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings');
  assert.equal(res.status, 200);
  assert.equal(res.body.fullDayThresholdMinutes, 0);
});

test('a new shop has no per-weekday hours and no scheduled mode change', async () => {
  const row = await runWithShop(owner.shop.id, () =>
    prepare('SELECT weekday_hours, next_booking_mode, next_booking_mode_from FROM workshop_settings LIMIT 1').get());
  assert.equal(row.weekday_hours, '{}');
  assert.equal(row.next_booking_mode, null);
  assert.equal(row.next_booking_mode_from, null);
});

test('the database refuses a weekly block with no mechanic', async () => {
  await assert.rejects(
    runWithShop(owner.shop.id, () => prepare(
      `INSERT INTO workshop_unavailability (employee_id, kind, weekdays, start_time, end_time)
       VALUES (NULL, 'weekly', '[1]', '13:00', '13:30')`
    ).run()),
    /check constraint/i,
  );
});

test('the database refuses a shop-wide closure with times', async () => {
  await assert.rejects(
    runWithShop(owner.shop.id, () => prepare(
      `INSERT INTO workshop_unavailability (employee_id, kind, start_date, end_date, start_time, end_time)
       VALUES (NULL, 'dates', '2026-12-25', '2026-12-26', '09:00', '12:00')`
    ).run()),
    /check constraint/i,
  );
});

test('a mode change needs both a mode and a date, or neither', async () => {
  await assert.rejects(
    runWithShop(owner.shop.id, () => prepare(
      "UPDATE workshop_settings SET next_booking_mode = 'dropoff', next_booking_mode_from = NULL"
    ).run()),
    /check constraint/i,
  );
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm run docker:up > /tmp/up.log 2>&1; echo "up $?"
node --test tests/capacity-schema.test.js > /tmp/t1.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/t1.log
```
Expected: exit 1. The reserve test fails with `120 !== 0`. The others fail with `column "weekday_hours" does not exist` / `relation "workshop_unavailability" does not exist`.

- [ ] **Step 3: Write the migration**

`server/migrations/023_capacity_blocks.sql`:

```sql
-- When a mechanic is available: per-weekday opening hours, and blocks (lunch,
-- leave, shop closures). Plus the two columns 2b uses to schedule a booking-mode
-- change from a date, so piece 2 is one migration.
-- Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md

-- Only the days whose hours differ from opening_time/closing_time, as a JSON
-- object keyed by weekday (0 = Sunday): {"6": {"open": "09:00", "close": "17:00"}}.
-- '{}' is today's behaviour - every open day uses the usual hours - so no
-- backfill is needed. opening_days still says which days are open.
ALTER TABLE workshop_settings
  ADD COLUMN weekday_hours TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN next_booking_mode TEXT CHECK (next_booking_mode IN ('timed', 'dropoff')),
  ADD COLUMN next_booking_mode_from TEXT CHECK (next_booking_mode_from ~ '^\d{4}-\d{2}-\d{2}$'),
  ADD CONSTRAINT workshop_settings_next_mode_pair
    CHECK ((next_booking_mode IS NULL) = (next_booking_mode_from IS NULL));

-- Three kinds of block in one table:
--   weekly, one mechanic  - lunch, routine admin (weekdays + times)
--   dates,  one mechanic  - leave, an appointment (date range, all day or times)
--   dates,  no mechanic   - the shop is closed (date range, always all day)
-- Times NULL = all day. The reason is for staff only; customers see
-- "unavailable" and nothing else.
CREATE TABLE workshop_unavailability (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  -- CASCADE: a deleted mechanic's lunch and leave go with them.
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('weekly', 'dates')),
  weekdays TEXT,
  start_date TEXT CHECK (start_date ~ '^\d{4}-\d{2}-\d{2}$'),
  end_date TEXT CHECK (end_date ~ '^\d{4}-\d{2}-\d{2}$'),
  start_time TEXT CHECK (start_time ~ '^\d{2}:\d{2}$'),
  end_time TEXT CHECK (end_time ~ '^\d{2}:\d{2}$'),
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workshop_unavailability_times_pair CHECK ((start_time IS NULL) = (end_time IS NULL)),
  CONSTRAINT workshop_unavailability_times_order CHECK (start_time IS NULL OR end_time > start_time),
  CONSTRAINT workshop_unavailability_weekly_shape CHECK (kind <> 'weekly' OR (
    employee_id IS NOT NULL AND weekdays IS NOT NULL AND start_time IS NOT NULL
    AND start_date IS NULL AND end_date IS NULL)),
  CONSTRAINT workshop_unavailability_dates_shape CHECK (kind <> 'dates' OR (
    start_date IS NOT NULL AND end_date IS NOT NULL AND end_date >= start_date AND weekdays IS NULL)),
  CONSTRAINT workshop_unavailability_shop_all_day CHECK (
    employee_id IS NOT NULL OR (kind = 'dates' AND start_time IS NULL))
);
CREATE INDEX idx_workshop_unavailability_shop ON workshop_unavailability(shop_id, employee_id);
ALTER TABLE workshop_unavailability ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_unavailability FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_unavailability_shop_isolation ON workshop_unavailability
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
```

- [ ] **Step 4: New shops start with no reserve**

In `server/auth.js`, replace:
```js
    await client.query('INSERT INTO workshop_settings (shop_id) VALUES ($1)', [shop.id]);
```
with:
```js
    // No reserve for a new shop: lunch and admin are blocks now (migration 023),
    // and a reserve on top would charge for them twice. The column default stays
    // 120 so existing shops, and the test fixtures that rely on it, are unchanged.
    await client.query('INSERT INTO workshop_settings (shop_id, full_day_threshold_minutes) VALUES ($1, 0)', [shop.id]);
```

- [ ] **Step 5: Apply, run, and check row-level security**

```bash
npm run migrate > /tmp/migrate.log 2>&1; echo "migrate $?"; grep "023" /tmp/migrate.log
node --test tests/capacity-schema.test.js > /tmp/t1.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)" /tmp/t1.log
node scripts/ci/assert-rls-coverage.mjs > /tmp/rls.log 2>&1; echo "rls $?"
```
Expected: migrate 0 with 023 listed; exit 0, 5 pass; rls 0.

- [ ] **Step 6: Watch the reserve test catch its break**

Temporarily change `server/auth.js` back to `VALUES ($1)` without the 0. Confirm with `git diff server/auth.js` that the edit landed, run the file, and expect the reserve test to fail with `120 !== 0`. Restore the change and re-run: expect 5 pass.

- [ ] **Step 7: Check the migration from an empty database**

```bash
docker compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS wh_scratch" -c "CREATE DATABASE wh_scratch" > /tmp/scratch.log 2>&1; echo "create $?"
DATABASE_URL=postgres://postgres:postgres@localhost:5433/wh_scratch npm run migrate > /tmp/scratch-migrate.log 2>&1; echo "scratch migrate $?"; tail -3 /tmp/scratch-migrate.log
docker compose exec -T db psql -U postgres -c "DROP DATABASE wh_scratch" > /dev/null 2>&1; echo "drop $?"
```
Expected: every step exit 0. Before running, check the compose service name, user and password in `docker-compose.yml` and `.env`, and use those if they differ from `db`/`postgres`.

- [ ] **Step 8: Commit**

```bash
git add server/migrations/023_capacity_blocks.sql server/auth.js tests/capacity-schema.test.js
git commit -m "feat: migration 023 - per-weekday hours, blocks table, scheduled mode columns; new shops start with no reserve"
```

---

### Task 2: The capacity calculator (pure, no database)

**Files:**
- Create: `server/capacity.js`
- Test: `tests/capacity.test.js`

**Interfaces:**
- Consumes: nothing from the database. Every input is passed in.
- Produces, all named exports of `server/capacity.js`:
  - `DATE_RE`, `TIME_RE`, `HOUR_RE`, `SLOT_STEP_MINUTES = 30`, `MAX_RANGE_DAYS = 62`, `LIVE_BOOKING_STATES`
  - `toMinutes(hhmm) -> number`, `toHHMM(minutes) -> string`, `weekdayOf(date) -> 0-6`, `dayCount(start, end) -> number` (inclusive), `datesBetween(start, end) -> string[]`
  - `parseWeekdayHours(raw) -> { [weekday]: {open, close} }`
  - `effectiveHours(settings, weekday) -> {open, close} | null`, `widestHours(settings) -> {open, close}`, `openingHoursFor(settings) -> [{weekday, open, close}]`, `resolveOpeningHours(input, {openingTime, closingTime}) -> {openingDays, weekdayHours} | {error}`
  - `modeForDate(settings, date) -> 'timed' | 'dropoff'`
  - `validateBlock(input) -> {block} | {error}`, `blockApplies(block, date, weekday) -> boolean`, `blockClashes(block, jobs) -> job[]`
  - `subtractIntervals(windows, cuts) -> [start, end][]`
  - `computeCapacity({settings, mechanics, blocks, jobs, dates}) -> Day[]`
  - `startTimesFor(mech, minutes) -> string[]`, `fitsDropoff(mech, minutes) -> boolean`, `fitsFreeTime(mech, startTime, endTime) -> boolean`
  - `legacyView(day, settings, jobs) -> {busy, fullDays}`
- Shapes:
  - **settings:** `{ openingTime, closingTime, openingDays: number[], weekdayHours, reserveMinutes, bookingMode, nextBookingMode, nextBookingModeFrom, dropoffWindowStart, dropoffWindowEnd }`
  - **mechanic:** `{ id, workingDays: number[] }`
  - **block:** `{ id, mechanicId: number|null, kind, weekdays: number[]|null, startDate, endDate, startTime, endTime, reason }`
  - **job:** `{ id, mechanicId: number|null, jobDate, startTime ('' when untimed), endTime, plannedMinutes: number|null }`
  - **Day:** `{ date, weekday, mode, shopClosed, shopBlocks: block[], queueMinutes, mechanics: Mech[] }`
  - **Mech:** `{ mechanicId, scheduled, working, availableWindows, freeWindows, freeMinutes, blocks: block[] }`. Windows are `[startMinute, endMinute)` pairs. `scheduled` means the shop is open that weekday and the mechanic works it. `working` means some time is left once blocks are removed. `availableWindows` has blocks removed but not jobs. `freeWindows` has both removed. `freeMinutes` has jobs, the queue share and the reserve removed, and may be negative or fractional.

- [ ] **Step 1: Write the failing tests**

`tests/capacity.test.js`:

```js
// The capacity calculator: pure arithmetic, no database.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2a, The calculator)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveHours, widestHours, resolveOpeningHours, parseWeekdayHours, modeForDate,
  subtractIntervals, computeCapacity, startTimesFor, fitsDropoff, fitsFreeTime,
  legacyView, blockClashes, validateBlock, dayCount, datesBetween,
} from '../server/capacity.js';

const MONDAY = '2026-09-07';
const SATURDAY = '2026-09-12';
const SUNDAY = '2026-09-13';

const settings = (over = {}) => ({
  openingTime: '09:00', closingTime: '18:00', openingDays: [1, 2, 3, 4, 5, 6],
  weekdayHours: { 6: { open: '09:00', close: '17:00' } }, reserveMinutes: 0,
  bookingMode: 'timed', nextBookingMode: null, nextBookingModeFrom: null,
  dropoffWindowStart: '09:00', dropoffWindowEnd: '10:00', ...over,
});
const SAM = { id: 1, workingDays: [1, 2, 3, 4, 5, 6] };
const ALEX = { id: 2, workingDays: [1, 2, 3, 4, 5] };
const lunch = { id: 10, mechanicId: 1, kind: 'weekly', weekdays: [1, 2, 3, 4, 5], startDate: null, endDate: null, startTime: '13:00', endTime: '13:30', reason: 'Lunch' };
const job = (over) => ({ id: 100, mechanicId: 1, jobDate: MONDAY, startTime: '', endTime: '', plannedMinutes: null, ...over });
const day = (input) => computeCapacity({ settings: settings(), mechanics: [SAM, ALEX], blocks: [], jobs: [], dates: [MONDAY], ...input })[0];
const mech = (d, id) => d.mechanics.find((m) => m.mechanicId === id);

test('a weekday uses its own hours, else the usual ones; a closed day has none', () => {
  assert.deepEqual(effectiveHours(settings(), 6), { open: '09:00', close: '17:00' });
  assert.deepEqual(effectiveHours(settings(), 1), { open: '09:00', close: '18:00' });
  assert.equal(effectiveHours(settings(), 0), null);
});

test('the widest hours span the earliest open and the latest close', () => {
  assert.deepEqual(widestHours(settings({ weekdayHours: { 6: { open: '08:00', close: '17:00' } } })), { open: '08:00', close: '18:00' });
});

test('opening hours keep only the days that differ from the usual hours', () => {
  const r = resolveOpeningHours(
    [{ weekday: 1, open: '09:00', close: '18:00' }, { weekday: 6, open: '09:00', close: '17:00' }],
    { openingTime: '09:00', closingTime: '18:00' });
  assert.deepEqual(r, { openingDays: [1, 6], weekdayHours: { 6: { open: '09:00', close: '17:00' } } });
  assert.match(resolveOpeningHours([{ weekday: 1, open: '18:00', close: '09:00' }], { openingTime: '09:00', closingTime: '18:00' }).error, /after/);
  assert.match(resolveOpeningHours([{ weekday: 1, open: '09:00', close: '18:00' }, { weekday: 1, open: '09:00', close: '18:00' }], { openingTime: '09:00', closingTime: '18:00' }).error, /once/);
});

test('stored weekday hours that are malformed are ignored, not trusted', () => {
  assert.deepEqual(parseWeekdayHours('{"6":{"open":"09:00","close":"17:00"},"9":{"open":"x"}}'), { 6: { open: '09:00', close: '17:00' } });
  assert.deepEqual(parseWeekdayHours('not json'), {});
});

test('a scheduled mode change applies from its date on, not before', () => {
  const s = settings({ nextBookingMode: 'dropoff', nextBookingModeFrom: '2026-11-01' });
  assert.equal(modeForDate(s, '2026-10-31'), 'timed');
  assert.equal(modeForDate(s, '2026-11-01'), 'dropoff');
});

test('subtracting intervals splits and trims windows', () => {
  assert.deepEqual(subtractIntervals([[540, 1080]], [[780, 810]]), [[540, 780], [810, 1080]]);
  assert.deepEqual(subtractIntervals([[540, 1080]], [[500, 600], [1000, 1200]]), [[600, 1000]]);
});

test('lunch removes its half hour from the mechanic\'s day and their start times', () => {
  const sam = mech(day({ blocks: [lunch] }), 1);
  assert.deepEqual(sam.availableWindows, [[540, 780], [810, 1080]]);
  assert.equal(sam.freeMinutes, 510);
  const starts = startTimesFor(sam, 60);
  assert.ok(starts.includes('12:00'));
  assert.ok(!starts.includes('12:30'), 'a 60-minute job at 12:30 would run into lunch');
  assert.ok(!starts.includes('13:00'));
  assert.ok(starts.includes('13:30'));
});

test('Saturday\'s shorter day ends the start times earlier', () => {
  const sam = mech(day({ dates: [SATURDAY] }), 1);
  const starts = startTimesFor(sam, 60);
  assert.equal(starts.at(-1), '16:00');
});

test('a shop closure removes the day for everyone; leave removes it for one', () => {
  const closed = { id: 11, mechanicId: null, kind: 'dates', weekdays: null, startDate: MONDAY, endDate: MONDAY, startTime: null, endTime: null, reason: 'Training' };
  const leave = { ...closed, id: 12, mechanicId: 2, reason: 'Holiday' };
  const d1 = day({ blocks: [closed] });
  assert.equal(d1.shopClosed, true);
  assert.ok(d1.mechanics.every((m) => !m.working && m.freeMinutes === 0));
  const d2 = day({ blocks: [leave] });
  assert.equal(mech(d2, 1).working, true);
  assert.equal(mech(d2, 2).working, false);
});

test('a day off and a closed weekday are not scheduled', () => {
  assert.equal(mech(day({ dates: [SATURDAY] }), 2).scheduled, false, 'Alex does not work Saturdays');
  assert.equal(mech(day({ dates: [SUNDAY] }), 1).scheduled, false, 'the shop is closed Sundays');
});

test('timed jobs cut their time out; untimed jobs take their minutes; the reserve comes off last', () => {
  const sam = mech(day({
    settings: settings({ reserveMinutes: 60 }),
    jobs: [job({ startTime: '10:00', endTime: '11:00' }), job({ id: 101, plannedMinutes: 45 })],
  }), 1);
  assert.deepEqual(sam.freeWindows, [[540, 600], [660, 1080]]);
  assert.equal(sam.freeMinutes, 540 - 60 - 45 - 60);
});

test('overlapping timed jobs are counted once, not twice', () => {
  const sam = mech(day({ jobs: [job({ startTime: '10:00', endTime: '14:00' }), job({ id: 101, startTime: '12:00', endTime: '16:00' })] }), 1);
  assert.equal(sam.freeMinutes, 180);
});

test('an unassigned walk-in is split across the mechanics working that day', () => {
  const d = day({ jobs: [job({ mechanicId: null, plannedMinutes: 60 })] });
  assert.equal(d.queueMinutes, 60);
  assert.equal(mech(d, 1).freeMinutes, 540 - 30);
  assert.equal(mech(d, 2).freeMinutes, 540 - 30);
});

test('a mechanic on leave takes no share of the walk-in queue', () => {
  const leave = { id: 12, mechanicId: 2, kind: 'dates', weekdays: null, startDate: MONDAY, endDate: MONDAY, startTime: null, endTime: null, reason: '' };
  const d = day({ blocks: [leave], jobs: [job({ mechanicId: null, plannedMinutes: 60 })] });
  assert.equal(mech(d, 1).freeMinutes, 540 - 60);
});

test('a drop-off day fits a job only while free minutes remain', () => {
  const sam = mech(day({ jobs: [job({ plannedMinutes: 480 })] }), 1);
  assert.equal(fitsDropoff(sam, 60), true);
  assert.equal(fitsDropoff(sam, 61), false);
});

test('start times need the free minutes as well as the gap', () => {
  const sam = mech(day({ settings: settings({ reserveMinutes: 480 }) }), 1);
  assert.deepEqual(startTimesFor(sam, 90), [], 'only 60 minutes are bookable once the reserve is held back');
});

test('fitsFreeTime refuses a time inside a block', () => {
  const sam = mech(day({ blocks: [lunch] }), 1);
  assert.equal(fitsFreeTime(sam, '12:00', '13:00'), true);
  assert.equal(fitsFreeTime(sam, '12:30', '13:30'), false);
});

test('the old booking page sees blocks and short days as busy, with no reason', () => {
  const s = settings();
  const monday = day({ blocks: [lunch], jobs: [job({ startTime: '10:00', endTime: '11:00' })] });
  const { busy } = legacyView(monday, s, [job({ startTime: '10:00', endTime: '11:00' })]);
  assert.deepEqual(busy.filter((b) => b.mechanicId === 1), [
    { mechanicId: 1, jobDate: MONDAY, startTime: '10:00', endTime: '11:00' },
    { mechanicId: 1, jobDate: MONDAY, startTime: '13:00', endTime: '13:30' },
  ]);
  assert.ok(!JSON.stringify(busy).includes('Lunch'));
  const saturday = computeCapacity({ settings: s, mechanics: [SAM], blocks: [], jobs: [], dates: [SATURDAY] })[0];
  assert.deepEqual(legacyView(saturday, s, []).busy, [{ mechanicId: 1, jobDate: SATURDAY, startTime: '17:00', endTime: '18:00' }]);
});

test('the old booking page sees a day as full once nothing more fits', () => {
  const s = settings({ reserveMinutes: 120 });
  const full = computeCapacity({ settings: s, mechanics: [SAM], blocks: [], jobs: [job({ startTime: '09:00', endTime: '17:30' })], dates: [MONDAY] })[0];
  assert.deepEqual(legacyView(full, s, []).fullDays, [{ mechanicId: 1, jobDate: MONDAY }]);
  const sunday = computeCapacity({ settings: s, mechanics: [SAM], blocks: [], jobs: [], dates: [SUNDAY] })[0];
  assert.deepEqual(legacyView(sunday, s, []).fullDays, [], 'a closed weekday is the old page\'s to grey, not a full day');
});

test('a block clashes with the live jobs it overlaps', () => {
  const jobs = [
    job({ id: 1, startTime: '12:30', endTime: '13:15' }),
    job({ id: 2, startTime: '14:00', endTime: '15:00' }),
    job({ id: 3, plannedMinutes: 60 }),
    job({ id: 4, mechanicId: 2, startTime: '13:00', endTime: '14:00' }),
  ];
  assert.deepEqual(blockClashes(lunch, jobs).map((j) => j.id), [1]);
  const leave = { ...lunch, kind: 'dates', weekdays: null, startDate: MONDAY, endDate: MONDAY, startTime: null, endTime: null };
  assert.deepEqual(blockClashes(leave, jobs).map((j) => j.id), [1, 2, 3]);
});

test('blocks are validated before they are stored', () => {
  assert.ok(validateBlock({ kind: 'weekly', mechanicId: 1, weekdays: [1, 5, 1], startTime: '13:00', endTime: '13:30' }).block);
  assert.deepEqual(validateBlock({ kind: 'weekly', mechanicId: 1, weekdays: [5, 1], startTime: '13:00', endTime: '13:30' }).block.weekdays, [1, 5]);
  assert.match(validateBlock({ kind: 'weekly', mechanicId: null, weekdays: [1], startTime: '13:00', endTime: '13:30' }).error, /needs a mechanic/);
  assert.match(validateBlock({ kind: 'weekly', mechanicId: 1, weekdays: [1], startTime: '14:00', endTime: '13:30' }).error, /after the start/);
  assert.match(validateBlock({ kind: 'dates', mechanicId: null, startDate: '2026-12-25', endDate: '2026-12-26', startTime: '09:00', endTime: '12:00' }).error, /whole days/);
  assert.match(validateBlock({ kind: 'dates', mechanicId: 1, startDate: '2026-12-26', endDate: '2026-12-25' }).error, /on or after/);
  assert.match(validateBlock({ kind: 'monthly' }).error, /kind/);
});

test('date ranges are counted without building them first', () => {
  assert.equal(dayCount('2026-09-07', '2026-09-13'), 7);
  assert.deepEqual(datesBetween('2026-09-30', '2026-10-01'), ['2026-09-30', '2026-10-01']);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test tests/capacity.test.js > /tmp/t2.log 2>&1; echo "exit $?"; grep -E "Cannot find module|^# (pass|fail)" /tmp/t2.log | head -3
```
Expected: exit 1, `Cannot find module '.../server/capacity.js'`.

- [ ] **Step 3: Write the module**

`server/capacity.js`:

```js
// The capacity calculator: one answer to "how much of this mechanic's day is
// free, and when". The customer calendar, the customer booking check and the
// staff capacity view all ask it, so the rule lives in one place.
//
// Pure - no database. server.js loads the rows and passes them in; this file
// only does arithmetic, which is why it is unit-tested without Postgres.
// Windows are [startMinute, endMinute) pairs within one day.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const HOUR_RE = /^([01]\d|2[0-3]):00$/;
export const SLOT_STEP_MINUTES = 30;
export const MAX_RANGE_DAYS = 62;
export const LIVE_BOOKING_STATES = ['pending', 'scheduled', 'reschedule_requested'];
const DAY_MINUTES = 24 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function toHHMM(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

// getUTCDay, as checkJobSlot: job_date is a bare calendar date, and a local
// parse would shift the weekday for a server west of UTC.
export function weekdayOf(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function dayCount(start, end) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS) + 1;
}

export function datesBetween(start, end) {
  const out = [];
  const last = Date.parse(`${end}T00:00:00Z`);
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= last; t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

// ---- Opening hours ----

// workshop_settings.weekday_hours holds only the days that differ from the
// usual hours. Anything malformed is dropped rather than trusted.
export function parseWeekdayHours(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) { return {}; }
  const out = {};
  if (!parsed || typeof parsed !== 'object') return out;
  for (const [key, value] of Object.entries(parsed)) {
    const w = Number(key);
    if (!Number.isInteger(w) || w < 0 || w > 6) continue;
    if (!value || !TIME_RE.test(value.open || '') || !TIME_RE.test(value.close || '')) continue;
    if (value.close <= value.open) continue;
    out[w] = { open: value.open, close: value.close };
  }
  return out;
}

export function effectiveHours(settings, weekday) {
  if (!settings.openingDays.includes(weekday)) return null;
  const own = settings.weekdayHours[weekday];
  return own ? { open: own.open, close: own.close } : { open: settings.openingTime, close: settings.closingTime };
}

// What the old booking page's grid spans: earliest open to latest close.
export function widestHours(settings) {
  const days = settings.openingDays.map((w) => effectiveHours(settings, w));
  if (!days.length) return { open: settings.openingTime, close: settings.closingTime };
  return { open: days.map((d) => d.open).sort()[0], close: days.map((d) => d.close).sort().at(-1) };
}

export function openingHoursFor(settings) {
  return settings.openingDays.map((weekday) => ({ weekday, ...effectiveHours(settings, weekday) }));
}

// A staff PUT of openingHours: the listed days are open, and only days whose
// hours differ from the usual ones are stored as their own.
export function resolveOpeningHours(input, { openingTime, closingTime }) {
  if (!Array.isArray(input)) return { error: 'openingHours must be a list of { weekday, open, close }' };
  const seen = new Set();
  const weekdayHours = {};
  for (const entry of input) {
    const w = Number(entry?.weekday);
    if (!Number.isInteger(w) || w < 0 || w > 6 || seen.has(w)) {
      return { error: 'Each weekday (0-6, 0 is Sunday) may appear once' };
    }
    if (!HOUR_RE.test(entry.open || '') || !HOUR_RE.test(entry.close || '')) {
      return { error: 'Opening hours must be on the hour (e.g. 09:00)' };
    }
    if (entry.close <= entry.open) return { error: 'Closing time must be after opening time' };
    seen.add(w);
    if (entry.open !== openingTime || entry.close !== closingTime) weekdayHours[w] = { open: entry.open, close: entry.close };
  }
  return { openingDays: [...seen].sort((a, b) => a - b), weekdayHours };
}

// ---- Booking mode ----

export function modeForDate(settings, date) {
  if (settings.nextBookingMode && settings.nextBookingModeFrom && date >= settings.nextBookingModeFrom) {
    return settings.nextBookingMode;
  }
  return settings.bookingMode;
}

// ---- Blocks ----

export function validateBlock(input) {
  const { kind } = input;
  if (kind !== 'weekly' && kind !== 'dates') return { error: "kind must be 'weekly' or 'dates'" };
  const mechanicId = input.mechanicId === null || input.mechanicId === undefined ? null : Number(input.mechanicId);
  if (mechanicId !== null && !Number.isInteger(mechanicId)) {
    return { error: 'mechanicId must be a whole number, or null for the whole shop' };
  }
  const startTime = input.startTime || null;
  const endTime = input.endTime || null;
  if ((startTime === null) !== (endTime === null)) {
    return { error: 'Give both a start and an end time, or neither for all day' };
  }
  if (startTime && (!TIME_RE.test(startTime) || !TIME_RE.test(endTime))) return { error: 'Times must look like 13:00' };
  if (startTime && endTime <= startTime) return { error: 'The end time must be after the start time' };
  const reason = String(input.reason ?? '').trim();
  if (reason.length > 200) return { error: 'Keep the reason under 200 characters' };

  if (kind === 'weekly') {
    if (mechanicId === null) return { error: 'A weekly block needs a mechanic' };
    if (!startTime) return { error: 'A weekly block needs a start and end time' };
    const weekdays = Array.isArray(input.weekdays)
      ? [...new Set(input.weekdays.map(Number))].sort((a, b) => a - b) : [];
    if (!weekdays.length || weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      return { error: 'weekdays must be day numbers 0-6 (0 is Sunday)' };
    }
    return { block: { mechanicId, kind, weekdays, startDate: null, endDate: null, startTime, endTime, reason } };
  }
  if (!DATE_RE.test(input.startDate || '') || !DATE_RE.test(input.endDate || '')) {
    return { error: 'startDate and endDate must look like 2026-12-25' };
  }
  if (input.endDate < input.startDate) return { error: 'The end date must be on or after the start date' };
  if (mechanicId === null && startTime) return { error: 'A shop closure covers whole days - leave the times out' };
  return {
    block: { mechanicId, kind, weekdays: null, startDate: input.startDate, endDate: input.endDate, startTime, endTime, reason },
  };
}

export function blockApplies(block, date, weekday) {
  if (block.kind === 'weekly') return block.weekdays.includes(weekday);
  return date >= block.startDate && date <= block.endDate;
}

function blockInterval(block) {
  return block.startTime ? [toMinutes(block.startTime), toMinutes(block.endTime)] : [0, DAY_MINUTES];
}

function isTimed(job) {
  return !!job.startTime;
}

function jobMinutes(job) {
  return isTimed(job) ? toMinutes(job.endTime) - toMinutes(job.startTime) : (job.plannedMinutes || 0);
}

// Live jobs a block overlaps. An all-day block clashes with every job that
// day; a timed block only with timed jobs that overlap it - an untimed job has
// no time to overlap. A shop-wide block clashes with every mechanic's jobs.
export function blockClashes(block, jobs) {
  return jobs.filter((j) => {
    if (block.mechanicId !== null && j.mechanicId !== block.mechanicId) return false;
    if (!blockApplies(block, j.jobDate, weekdayOf(j.jobDate))) return false;
    if (!block.startTime) return true;
    if (!isTimed(j)) return false;
    const [bs, be] = blockInterval(block);
    return toMinutes(j.startTime) < be && toMinutes(j.endTime) > bs;
  });
}

// ---- The calculator ----

export function subtractIntervals(windows, cuts) {
  let out = windows.map((w) => [...w]);
  for (const [cs, ce] of cuts) {
    const next = [];
    for (const [ws, we] of out) {
      if (ce <= ws || cs >= we) { next.push([ws, we]); continue; }
      if (cs > ws) next.push([ws, cs]);
      if (ce < we) next.push([ce, we]);
    }
    out = next;
  }
  return out.sort((a, b) => a[0] - b[0]);
}

const total = (windows) => windows.reduce((n, [s, e]) => n + (e - s), 0);

// `jobs` must already be live jobs only (LIVE_BOOKING_STATES). `mechanics` must
// be every active mechanic, even when a caller wants one: the walk-in queue is
// split across everyone working, so leaving one out changes the others' share.
export function computeCapacity({ settings, mechanics, blocks, jobs, dates }) {
  return dates.map((date) => {
    const weekday = weekdayOf(date);
    const hours = effectiveHours(settings, weekday);
    const shopBlocks = blocks.filter((b) => b.mechanicId === null && blockApplies(b, date, weekday));
    const shopClosed = shopBlocks.length > 0;
    const dayJobs = jobs.filter((j) => j.jobDate === date);
    const queueMinutes = dayJobs.filter((j) => j.mechanicId === null).reduce((n, j) => n + jobMinutes(j), 0);

    const rows = mechanics.map((m) => {
      const scheduled = !!hours && m.workingDays.includes(weekday);
      const ownBlocks = blocks.filter((b) => b.mechanicId === m.id && blockApplies(b, date, weekday));
      const open = scheduled && !shopClosed ? [[toMinutes(hours.open), toMinutes(hours.close)]] : [];
      return { m, scheduled, ownBlocks, availableWindows: subtractIntervals(open, ownBlocks.map(blockInterval)) };
    });
    const workingCount = rows.filter((r) => total(r.availableWindows) > 0).length;
    const queueShare = workingCount ? queueMinutes / workingCount : 0;

    return {
      date,
      weekday,
      mode: modeForDate(settings, date),
      shopClosed,
      shopBlocks,
      queueMinutes,
      mechanics: rows.map(({ m, scheduled, ownBlocks, availableWindows }) => {
        const mine = dayJobs.filter((j) => j.mechanicId === m.id);
        const timed = mine.filter(isTimed).map((j) => [toMinutes(j.startTime), toMinutes(j.endTime)]);
        const untimedMinutes = mine.filter((j) => !isTimed(j)).reduce((n, j) => n + jobMinutes(j), 0);
        const freeWindows = subtractIntervals(availableWindows, timed);
        const working = total(availableWindows) > 0;
        const freeMinutes = working
          ? total(freeWindows) - untimedMinutes - queueShare - settings.reserveMinutes
          : 0;
        return { mechanicId: m.id, scheduled, working, availableWindows, freeWindows, freeMinutes, blocks: ownBlocks };
      }),
    };
  });
}

// Timed mode: every 30-minute start where the whole job fits one free window,
// provided the day still has the minutes for it.
export function startTimesFor(mech, minutes) {
  if (!mech.working || mech.freeMinutes < minutes) return [];
  const out = [];
  for (const [s, e] of mech.freeWindows) {
    const first = Math.ceil(s / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
    for (let t = first; t + minutes <= e; t += SLOT_STEP_MINUTES) out.push(toHHMM(t));
  }
  return out;
}

export function fitsDropoff(mech, minutes) {
  return mech.working && mech.freeMinutes >= minutes;
}

// Whether [start, end) sits inside time the mechanic is available - blocks and
// the shop's hours removed. Job overlap is checkJobSlot's, in server.js.
export function fitsFreeTime(mech, startTime, endTime) {
  const s = toMinutes(startTime);
  const e = toMinutes(endTime);
  return mech.availableWindows.some(([ws, we]) => s >= ws && e <= we);
}

// What the old booking page reads (public-portal/portal.js:263): busy
// intervals and full mechanic-days. Busy is live timed jobs, plus every part of
// the widest-hours grid the mechanic cannot be booked in - blocks, closures, a
// shorter day - with no reason attached. Only a mechanic's normal working days
// appear; the old page greys closed weekdays and days off itself.
export function legacyView(day, settings, jobs) {
  const widest = widestHours(settings);
  const grid = [[toMinutes(widest.open), toMinutes(widest.close)]];
  const busy = [];
  const fullDays = [];
  for (const m of day.mechanics) {
    if (!m.scheduled) continue;
    const timed = jobs
      .filter((j) => j.mechanicId === m.mechanicId && j.jobDate === day.date && isTimed(j))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (const j of timed) busy.push({ mechanicId: m.mechanicId, jobDate: day.date, startTime: j.startTime, endTime: j.endTime });
    for (const [s, e] of subtractIntervals(grid, m.availableWindows)) {
      busy.push({ mechanicId: m.mechanicId, jobDate: day.date, startTime: toHHMM(s), endTime: toHHMM(e) });
    }
    if (m.freeMinutes <= 0) fullDays.push({ mechanicId: m.mechanicId, jobDate: day.date });
  }
  return { busy, fullDays };
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
node --test tests/capacity.test.js > /tmp/t2.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/t2.log
```
Expected: exit 0, 22 pass.

- [ ] **Step 5: Watch three tests catch their breaks**

Make each break, confirm it with `git diff server/capacity.js`, run, see the named test fail, then restore:
1. In `computeCapacity`, change `subtractIntervals(open, ownBlocks.map(blockInterval))` to `open`. Expect "lunch removes its half hour" to fail.
2. Change `const queueShare = workingCount ? queueMinutes / workingCount : 0;` to `const queueShare = 0;`. Expect "an unassigned walk-in is split" to fail.
3. In `legacyView`, delete the `for (const [s, e] of subtractIntervals(grid, ...` loop. Expect "the old booking page sees blocks" to fail.

After restoring, run again: 22 pass.

- [ ] **Step 6: Commit**

```bash
git add server/capacity.js tests/capacity.test.js
git commit -m "feat: the capacity calculator - hours, blocks, jobs, walk-in queue, reserve, one module"
```

---

### Task 3: Opening hours per weekday in settings, and the slot check using them

**Files:**
- Modify: `server/server.js`. The settings section starts at `// ---------- Workshop settings ----------`. `checkJobSlot` is at the line `async function checkJobSlot(`, and `GET /api/portal/:shopSlug/mechanics` at `route('GET', '/api/portal/:shopSlug/mechanics'`.
- Modify: `scripts/ci/assert-screen-trace.mjs` (`COVERED`)
- Test: `tests/workshop-weekday-hours.test.js`

**Interfaces:**
- Consumes: `effectiveHours`, `widestHours`, `openingHoursFor`, `resolveOpeningHours`, `parseWeekdayHours` (Task 2).
- Produces: `toCapacitySettings(row)` in `server/server.js`, turning a `workshop_settings` row into Task 2's settings shape. `GET/PUT /api/workshop-settings` now carry `openingHours: [{weekday, open, close}]`.

- [ ] **Step 1: Write the failing test**

`tests/workshop-weekday-hours.test.js`:

```js
// Opening hours per weekday: settings round-trip, the old fields still work,
// and every slot check uses the day's own hours.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2a, Staff endpoints)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';

const SATURDAY = '2026-09-12';
const WEEK = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, open: '09:00', close: '18:00' }));
const SHORT_SATURDAY = [...WEEK, { weekday: 6, open: '09:00', close: '17:00' }];

let server;
let owner;
const as = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const settings = (body) => as('/api/workshop-settings', body ? { method: 'PUT', body } : undefined);

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

test('a new shop reports every open day at the usual hours', async () => {
  await freshShop();
  const res = await settings();
  assert.equal(res.body.openingHours.length, 7);
  assert.ok(res.body.openingHours.every((d) => d.open === '09:00' && d.close === '18:00'));
});

test('a shorter Saturday and a closed Sunday round-trip', async () => {
  await freshShop();
  const put = await settings({ openingHours: SHORT_SATURDAY });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.deepEqual(put.body.openingDays, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(put.body.openingHours.find((d) => d.weekday === 6), { weekday: 6, open: '09:00', close: '17:00' });
  assert.deepEqual(put.body.openingHours.find((d) => d.weekday === 1), { weekday: 1, open: '09:00', close: '18:00' });
});

test('saving the old fields moves the usual hours and keeps Saturday\'s own', async () => {
  await freshShop();
  await settings({ openingHours: SHORT_SATURDAY });
  const res = await settings({ openingTime: '08:00', fullDayThresholdMinutes: 30 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.openingHours.find((d) => d.weekday === 1), { weekday: 1, open: '08:00', close: '18:00' });
  assert.deepEqual(res.body.openingHours.find((d) => d.weekday === 6), { weekday: 6, open: '09:00', close: '17:00' });
});

test('closing a day drops its own hours, so re-opening starts from the usual ones', async () => {
  await freshShop();
  await settings({ openingHours: SHORT_SATURDAY });
  await settings({ openingDays: [1, 2, 3, 4, 5] });
  const res = await settings({ openingDays: [1, 2, 3, 4, 5, 6] });
  assert.deepEqual(res.body.openingHours.find((d) => d.weekday === 6), { weekday: 6, open: '09:00', close: '18:00' });
});

test('hours that close before they open, or both day lists at once, are refused', async () => {
  await freshShop();
  assert.equal((await settings({ openingHours: [{ weekday: 1, open: '18:00', close: '09:00' }] })).status, 400);
  assert.equal((await settings({ openingHours: WEEK, openingDays: [1] })).status, 400);
});

test('a staff job past Saturday\'s closing time is refused with Saturday\'s hours', async () => {
  await freshShop();
  await settings({ openingHours: SHORT_SATURDAY });
  const mechanicId = await seedMechanic(owner.shop.id);
  const res = await as('/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'Late one', jobDate: SATURDAY, startTime: '16:30', endTime: '17:30', mechanicId },
  });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /09:00.17:00/);
});

test('the old booking page\'s grid spans the widest day', async () => {
  await freshShop();
  await settings({ openingHours: SHORT_SATURDAY });
  const res = await jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/mechanics`);
  assert.equal(res.body.openingTime, '09:00');
  assert.equal(res.body.closingTime, '18:00');
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test tests/workshop-weekday-hours.test.js > /tmp/t3.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/t3.log
```
Expected: exit 1. `openingHours` is undefined in the first tests, and the Saturday job is accepted (201), so the last-but-one test fails.

- [ ] **Step 3: Import the calculator helpers**

At the top of `server/server.js`, beside the other `./` imports:

```js
import {
  DATE_RE, MAX_RANGE_DAYS, LIVE_BOOKING_STATES, dayCount, datesBetween, parseWeekdayHours,
  effectiveHours, widestHours, openingHoursFor, resolveOpeningHours, validateBlock, blockClashes,
  computeCapacity, startTimesFor, fitsDropoff, fitsFreeTime, legacyView,
} from './capacity.js';
```

- [ ] **Step 4: Add `toCapacitySettings` and serve `openingHours`**

Directly above `function serializeWorkshopSettings(row) {`:

```js
// A workshop_settings row in the capacity calculator's shape (server/capacity.js).
function toCapacitySettings(row) {
  return {
    openingTime: row.opening_time,
    closingTime: row.closing_time,
    openingDays: parseWorkingDays(row.opening_days),
    weekdayHours: parseWeekdayHours(row.weekday_hours),
    reserveMinutes: row.full_day_threshold_minutes,
    bookingMode: row.booking_mode,
    nextBookingMode: row.next_booking_mode ?? null,
    nextBookingModeFrom: row.next_booking_mode_from ?? null,
    dropoffWindowStart: row.dropoff_window_start,
    dropoffWindowEnd: row.dropoff_window_end,
  };
}
```

In `serializeWorkshopSettings`, after `openingDays: parseWorkingDays(row.opening_days),` add:

```js
    // Every open day with its hours - its own where the shop set them, else
    // the usual opening/closing time above.
    openingHours: openingHoursFor(toCapacitySettings(row)),
```

- [ ] **Step 5: Accept `openingHours` on PUT**

In `PUT /api/workshop-settings`, directly after the line `if (openingDays === null) return badRequest(res, 'openingDays must be an array of day numbers (0-6)');` add:

```js
  // openingHours sets which days are open and each day's hours at once. The
  // old fields still work: openingTime/closingTime move the usual hours, and a
  // day with its own hours keeps them, so the old settings page (which sends
  // openingTime on every save) never wipes a shorter Saturday.
  let openingDaysJson = openingDays;
  let weekdayHours = parseWeekdayHours(existing.weekday_hours);
  if (body.openingHours !== undefined) {
    if (body.openingDays !== undefined) return badRequest(res, 'Send openingHours or openingDays, not both');
    const resolved = resolveOpeningHours(body.openingHours, { openingTime, closingTime });
    if (resolved.error) return badRequest(res, resolved.error);
    openingDaysJson = JSON.stringify(resolved.openingDays);
    weekdayHours = resolved.weekdayHours;
  }
  // A closed day keeps no hours of its own, so re-opening it starts from the usual ones.
  const openNow = JSON.parse(openingDaysJson);
  weekdayHours = Object.fromEntries(Object.entries(weekdayHours).filter(([w]) => openNow.includes(Number(w))));
```

In the `UPDATE workshop_settings` statement, change `opening_days = ?,` to `opening_days = ?, weekday_hours = ?,`. In the `.run(...)` arguments, replace `openingDays,` with `openingDaysJson, JSON.stringify(weekdayHours),`.

Put `// screens: booking-settings, hours` directly above both `route('GET', '/api/workshop-settings'` and `route('PUT', '/api/workshop-settings'`. Move the existing comment block above the GET route so the `screens:` line is the last line before it, with no blank line.

- [ ] **Step 6: The slot check uses the day's own hours**

In `checkJobSlot`, replace:

```js
  if (startTime < settings.opening_time || endTime > settings.closing_time) {
    return `That job doesn't fit in the shop's opening hours (${settings.opening_time}–${settings.closing_time}) - please choose an earlier time or a shorter job type.`;
  }
```

with:

```js
  // The day's own hours - Saturday may close earlier than the week.
  const hours = effectiveHours(toCapacitySettings(settings), dayOfWeek);
  if (startTime < hours.open || endTime > hours.close) {
    return `That job doesn't fit in the shop's opening hours (${hours.open}–${hours.close}) - please choose an earlier time or a shorter job type.`;
  }
```

`hours` is never null here: the opening-days check above has already returned for a closed day.

- [ ] **Step 7: The old page's grid spans the widest day**

In `GET /api/portal/:shopSlug/mechanics`, replace:

```js
    openingTime: settings.opening_time,
    closingTime: settings.closing_time,
```

with:

```js
    // The widest day, so the old booking page's grid covers every open hour;
    // a shorter day comes back from /availability as busy time.
    openingTime: widestHours(toCapacitySettings(settings)).open,
    closingTime: widestHours(toCapacitySettings(settings)).close,
```

- [ ] **Step 8: Cover the settings route in the screen trace**

In `scripts/ci/assert-screen-trace.mjs`, add to `COVERED`:

```js
  /^\/api\/workshop-settings$/,
```

- [ ] **Step 9: Run it, and the neighbours**

```bash
node --test tests/workshop-weekday-hours.test.js tests/workshop-settings.test.js tests/workshop-rules.test.js tests/workshop-portal.test.js > /tmp/t3.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/t3.log
node scripts/ci/assert-screen-trace.mjs > /tmp/trace.log 2>&1; echo "trace $?"
```
Expected: exit 0, no `not ok`; trace 0.

- [ ] **Step 10: Watch the slot test catch its break**

Change `effectiveHours(toCapacitySettings(settings), dayOfWeek)` in `checkJobSlot` to `{ open: settings.opening_time, close: settings.closing_time }`. Confirm with `git diff`, run `tests/workshop-weekday-hours.test.js`, and expect "a staff job past Saturday's closing time" to fail with status 201. Restore and re-run: 7 pass.

- [ ] **Step 11: Commit**

```bash
git add server/server.js scripts/ci/assert-screen-trace.mjs tests/workshop-weekday-hours.test.js
git commit -m "feat: opening hours per weekday - settings round-trip, slot check and old grid use them"
```

---

### Task 4: Blocks - staff create, read, update, delete, with clashes

**Files:**
- Modify: `server/server.js`, adding a section directly after the `PUT /api/workshop-settings` route: `// ---------- Workshop unavailability (lunch, leave, closures) ----------`
- Modify: `scripts/ci/assert-screen-trace.mjs` (`COVERED`)
- Modify: `tests/helpers/workshopFixtures.js` (`plannedMinutes` on `seedWorkshopJob`; `futureDate`)
- Test: `tests/workshop-unavailability.test.js`

**Interfaces:**
- Consumes: `validateBlock`, `blockClashes`, `LIVE_BOOKING_STATES` (Task 2).
- Produces:
  - `toBlock(row)` and `toCapacityJob(row)` in `server/server.js`
  - routes `GET /api/workshop-unavailability[?start&end]`, `POST /api/workshop-unavailability`, `PUT /api/workshop-unavailability/:id`, `DELETE /api/workshop-unavailability/:id`
  - the block JSON shape is Task 2's block shape; POST/PUT answer `{ block, clashes: [{ id, reference, title, mechanicId, jobDate, startTime, endTime }] }`
  - `seedWorkshopJob({ ..., plannedMinutes })` and `futureDate(weekday)` in the fixtures

- [ ] **Step 1: Extend the fixtures**

In `tests/helpers/workshopFixtures.js`, add `plannedMinutes = null,` to `seedWorkshopJob`'s parameters after `orderTotal = 0,`. Add `planned_minutes` to its `INSERT INTO workshop_jobs` column list, one more `?` to `VALUES`, and `plannedMinutes` to the `.run(...)` arguments after `notes`. Then append:

```js
// A date at least three weeks out on the given weekday (0 = Sunday), for tests
// of anything that only looks from today forward, such as block clashes.
export function futureDate(weekday) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 21);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Write the failing test**

`tests/workshop-unavailability.test.js`:

```js
// Blocks: lunch, leave and closures, managed by staff, reported against the
// bookings they clash with. Staff are never refused by a block.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2a, Staff endpoints)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedWorkshopJob, futureDate } from './helpers/workshopFixtures.js';

let server;
let shopA;
let shopB;
let sam;
let otherShopMechanic;

before(async () => {
  server = await startLiveServer();
  shopA = await staffSignup(server.baseUrl);
  shopB = await staffSignup(server.baseUrl);
  sam = await seedMechanic(shopA.shop.id, { name: 'Sam' });
  otherShopMechanic = await seedMechanic(shopB.shop.id, { name: 'Elsewhere' });
});

after(async () => {
  if (shopA) await deleteTestShop(shopA.shop.id);
  if (shopB) await deleteTestShop(shopB.shop.id);
  if (server) await server.stop();
});

const as = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const LUNCH = () => ({ kind: 'weekly', mechanicId: sam, weekdays: [1, 2, 3, 4, 5], startTime: '13:00', endTime: '13:30', reason: 'Lunch' });

test('a weekly lunch block round-trips', async () => {
  const created = await as(shopA, '/api/workshop-unavailability', { method: 'POST', body: LUNCH() });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.block.reason, 'Lunch');
  assert.deepEqual(created.body.block.weekdays, [1, 2, 3, 4, 5]);
  const list = await as(shopA, '/api/workshop-unavailability');
  assert.ok(list.body.blocks.some((b) => b.id === created.body.block.id));
});

test('adding a block reports the bookings it clashes with, and does not move them', async () => {
  const monday = futureDate(1);
  const { jobId } = await seedWorkshopJob({ shopId: shopA.shop.id, customerId: null, mechanicId: sam, jobDate: monday, startTime: '12:45', endTime: '13:45' });
  const { jobId: clear } = await seedWorkshopJob({ shopId: shopA.shop.id, customerId: null, mechanicId: sam, jobDate: monday, startTime: '15:00', endTime: '16:00' });
  const res = await as(shopA, '/api/workshop-unavailability', { method: 'POST', body: { ...LUNCH(), reason: 'Second lunch' } });
  assert.equal(res.status, 201);
  const ids = res.body.clashes.map((c) => c.id);
  assert.ok(ids.includes(jobId));
  assert.ok(!ids.includes(clear));
  const still = await runWithShop(shopA.shop.id, () => prepare('SELECT start_time FROM workshop_jobs WHERE id = ?').get(jobId));
  assert.equal(still.start_time, '12:45', 'a block must never move or cancel a booking');
});

test('a cancelled booking is not a clash', async () => {
  const friday = futureDate(5);
  const { jobId } = await seedWorkshopJob({ shopId: shopA.shop.id, customerId: null, mechanicId: sam, jobDate: friday, startTime: '10:00', endTime: '11:00' });
  await runWithShop(shopA.shop.id, () => prepare("UPDATE workshop_jobs SET booking_state = 'cancelled' WHERE id = ?").run(jobId));
  const res = await as(shopA, '/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'dates', mechanicId: sam, startDate: friday, endDate: friday, reason: 'Dentist' },
  });
  assert.ok(!res.body.clashes.some((c) => c.id === jobId));
});

test('a shop closure covers whole days and clashes with everyone\'s jobs', async () => {
  const wednesday = futureDate(3);
  const { jobId } = await seedWorkshopJob({ shopId: shopA.shop.id, customerId: null, mechanicId: null, jobDate: wednesday, startTime: '', endTime: '', plannedMinutes: 60 });
  const res = await as(shopA, '/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'dates', mechanicId: null, startDate: wednesday, endDate: wednesday, reason: 'Stocktake' },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.ok(res.body.clashes.some((c) => c.id === jobId));
  const withTimes = await as(shopA, '/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'dates', mechanicId: null, startDate: wednesday, endDate: wednesday, startTime: '09:00', endTime: '12:00' },
  });
  assert.equal(withTimes.status, 400);
});

test('an update keeps omitted fields, and delete removes the block', async () => {
  const created = (await as(shopA, '/api/workshop-unavailability', { method: 'POST', body: LUNCH() })).body.block;
  const updated = await as(shopA, `/api/workshop-unavailability/${created.id}`, { method: 'PUT', body: { endTime: '14:00' } });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.block.endTime, '14:00');
  assert.equal(updated.body.block.reason, 'Lunch');
  assert.equal((await as(shopA, `/api/workshop-unavailability/${created.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await as(shopA, `/api/workshop-unavailability/${created.id}`, { method: 'DELETE' })).status, 404);
});

test('another shop\'s mechanic and another shop\'s block are not found', async () => {
  const foreign = await as(shopA, '/api/workshop-unavailability', { method: 'POST', body: { ...LUNCH(), mechanicId: otherShopMechanic } });
  assert.equal(foreign.status, 404);
  const mine = (await as(shopA, '/api/workshop-unavailability', { method: 'POST', body: LUNCH() })).body.block;
  assert.equal((await as(shopB, `/api/workshop-unavailability/${mine.id}`, { method: 'PUT', body: { reason: 'x' } })).status, 404);
  assert.ok(!(await as(shopB, '/api/workshop-unavailability')).body.blocks.some((b) => b.id === mine.id));
});

test('a date-range list includes weekly blocks and overlapping date blocks only', async () => {
  const early = { kind: 'dates', mechanicId: sam, startDate: '2030-01-01', endDate: '2030-01-02' };
  const late = { kind: 'dates', mechanicId: sam, startDate: '2030-03-01', endDate: '2030-03-02' };
  const a = (await as(shopA, '/api/workshop-unavailability', { method: 'POST', body: early })).body.block;
  const b = (await as(shopA, '/api/workshop-unavailability', { method: 'POST', body: late })).body.block;
  const list = (await as(shopA, '/api/workshop-unavailability?start=2030-01-02&end=2030-01-31')).body.blocks;
  assert.ok(list.some((x) => x.id === a.id));
  assert.ok(!list.some((x) => x.id === b.id));
  assert.ok(list.some((x) => x.kind === 'weekly'));
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
node --test tests/workshop-unavailability.test.js > /tmp/t4.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/t4.log
```
Expected: exit 1; every test fails with status 404 (no such route).

- [ ] **Step 4: Write the routes**

Directly after the `PUT /api/workshop-settings` route in `server/server.js`:

```js
// ---------- Workshop unavailability (lunch, leave, closures) ----------
// Blocks take time away from what customers can book. They never refuse or
// move a staff booking (4 Sep decision §7.7): adding one reports the live
// bookings it clashes with, and staff decide what to do.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md

const LIVE_STATES_SQL = LIVE_BOOKING_STATES.map((s) => `'${s}'`).join(', ');

function toBlock(row) {
  return {
    id: row.id,
    mechanicId: row.employee_id ?? null,
    kind: row.kind,
    weekdays: row.weekdays ? JSON.parse(row.weekdays) : null,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    reason: row.reason,
  };
}

function toCapacityJob(row) {
  return {
    id: row.id,
    mechanicId: row.mechanic_id ?? null,
    jobDate: row.job_date,
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    plannedMinutes: row.planned_minutes ?? null,
  };
}

// Live bookings a block overlaps, from today on - a block's past is history.
async function clashesFor(block) {
  const today = new Date().toISOString().slice(0, 10);
  const from = block.kind === 'dates' && block.startDate > today ? block.startDate : today;
  let sql = `SELECT id, reference, title, mechanic_id, job_date, start_time, end_time, planned_minutes
    FROM workshop_jobs WHERE job_date >= ? AND booking_state IN (${LIVE_STATES_SQL})`;
  const args = [from];
  if (block.kind === 'dates') {
    sql += ' AND job_date <= ?';
    args.push(block.endDate);
  }
  const rows = await db.prepare(`${sql} ORDER BY job_date, start_time`).all(...args);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return blockClashes(block, rows.map(toCapacityJob)).map((j) => ({
    id: j.id,
    reference: byId.get(j.id).reference,
    title: byId.get(j.id).title,
    mechanicId: j.mechanicId,
    jobDate: j.jobDate,
    startTime: j.startTime,
    endTime: j.endTime,
  }));
}

// Through the shop-scoped db: a foreign key check bypasses row-level security,
// so another shop's mechanic id must be refused here, not by the constraint.
async function blockMechanicExists(mechanicId) {
  if (mechanicId === null) return true;
  return !!(await db.prepare('SELECT id FROM employees WHERE id = ? AND is_mechanic = 1').get(mechanicId));
}

// screens: hours, diary, week, month
route('GET', '/api/workshop-unavailability', async (req, res, params, query) => {
  const start = query.get('start');
  const end = query.get('end');
  let rows;
  if (start || end) {
    if (!DATE_RE.test(start || '') || !DATE_RE.test(end || '')) return badRequest(res, 'Give both start and end dates, or neither');
    rows = await db.prepare(
      `SELECT * FROM workshop_unavailability
       WHERE kind = 'weekly' OR (start_date <= ? AND end_date >= ?) ORDER BY id`
    ).all(end, start);
  } else {
    rows = await db.prepare('SELECT * FROM workshop_unavailability ORDER BY id').all();
  }
  sendJson(res, 200, { blocks: rows.map(toBlock) });
});

// screens: hours
route('POST', '/api/workshop-unavailability', async (req, res) => {
  const checked = validateBlock(await readJsonBody(req));
  if (checked.error) return badRequest(res, checked.error);
  const b = checked.block;
  if (!(await blockMechanicExists(b.mechanicId))) return notFound(res, 'Mechanic not found');
  const { lastInsertRowid } = await db.prepare(
    `INSERT INTO workshop_unavailability (employee_id, kind, weekdays, start_date, end_date, start_time, end_time, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(b.mechanicId, b.kind, b.weekdays ? JSON.stringify(b.weekdays) : null,
        b.startDate, b.endDate, b.startTime, b.endTime, b.reason);
  const block = toBlock(await db.prepare('SELECT * FROM workshop_unavailability WHERE id = ?').get(lastInsertRowid));
  sendJson(res, 201, { block, clashes: await clashesFor(block) });
});

// screens: hours
route('PUT', '/api/workshop-unavailability/:id', async (req, res, params) => {
  const row = await db.prepare('SELECT * FROM workshop_unavailability WHERE id = ?').get(Number(params.id));
  if (!row) return notFound(res, 'Block not found');
  const body = await readJsonBody(req);
  const checked = validateBlock({ ...toBlock(row), ...body });
  if (checked.error) return badRequest(res, checked.error);
  const b = checked.block;
  if (!(await blockMechanicExists(b.mechanicId))) return notFound(res, 'Mechanic not found');
  await db.prepare(
    `UPDATE workshop_unavailability SET employee_id = ?, kind = ?, weekdays = ?, start_date = ?, end_date = ?,
       start_time = ?, end_time = ?, reason = ?, updated_at = now() WHERE id = ?`
  ).run(b.mechanicId, b.kind, b.weekdays ? JSON.stringify(b.weekdays) : null,
        b.startDate, b.endDate, b.startTime, b.endTime, b.reason, row.id);
  const block = toBlock(await db.prepare('SELECT * FROM workshop_unavailability WHERE id = ?').get(row.id));
  sendJson(res, 200, { block, clashes: await clashesFor(block) });
});

// screens: hours
route('DELETE', '/api/workshop-unavailability/:id', async (req, res, params) => {
  const row = await db.prepare('SELECT id FROM workshop_unavailability WHERE id = ?').get(Number(params.id));
  if (!row) return notFound(res, 'Block not found');
  await db.prepare('DELETE FROM workshop_unavailability WHERE id = ?').run(row.id);
  sendJson(res, 200, { ok: true });
});
```

If `Number(params.id)` of a non-numeric id reaches Postgres as `NaN` and errors, follow the malformed-id 404 pattern #63 added to the other `:id` routes. Find it with `grep -n "malformed" server/server.js`.

- [ ] **Step 5: Cover the routes in the screen trace**

In `scripts/ci/assert-screen-trace.mjs`, add to `COVERED`:

```js
  /^\/api\/workshop-unavailability(\/|$)/,
```

- [ ] **Step 6: Run it**

```bash
npm run migrate > /dev/null 2>&1
node --test tests/workshop-unavailability.test.js > /tmp/t4.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/t4.log
node scripts/ci/assert-screen-trace.mjs > /tmp/trace.log 2>&1; echo "trace $?"
```
Expected: exit 0, 7 pass; trace 0.

- [ ] **Step 7: Watch two tests catch their breaks**

1. In `blockMechanicExists`, change the body to `return true;`. Confirm with `git diff`. Expect "another shop's mechanic" to fail: the insert then either succeeds (201) or errors on the foreign key (500), not 404. Restore.
2. In `clashesFor`, replace `booking_state IN (${LIVE_STATES_SQL})` with `1 = 1`. Confirm with `git diff`. Expect "a cancelled booking is not a clash" to fail. Restore.

Run again: 7 pass.

- [ ] **Step 8: Commit**

```bash
git add server/server.js scripts/ci/assert-screen-trace.mjs tests/helpers/workshopFixtures.js tests/workshop-unavailability.test.js
git commit -m "feat: staff blocks for lunch, leave and closures, reporting the bookings they clash with"
```

---

### Task 5: The customer calendar uses the calculator

**Files:**
- Modify: `server/server.js`, replacing the whole `GET /api/portal/:shopSlug/availability` route, and adding `loadCapacity` directly above it
- Modify: `scripts/ci/assert-screen-trace.mjs` (`COVERED`)
- Test: `tests/portal-availability-capacity.test.js`; `tests/workshop-availability.test.js` must pass unchanged

**Interfaces:**
- Consumes: `toCapacitySettings` (Task 3); `toBlock`, `toCapacityJob`, `LIVE_STATES_SQL` (Task 4); `computeCapacity`, `legacyView`, `startTimesFor`, `fitsDropoff`, `datesBetween`, `dayCount`, `MAX_RANGE_DAYS`, `DATE_RE` (Task 2).
- Produces: `loadCapacity(start, end) -> Promise<{ settings, blocks, jobs, days }>` in `server/server.js`. The availability response keeps `{ busy, fullDays }`, and adds `days: [{ date, mode, dropoffWindow?, mechanics: [{ mechanicId, startTimes } | { mechanicId, bookable }] }]` when `minutes` is given.

- [ ] **Step 1: Write the failing test**

`tests/portal-availability-capacity.test.js`:

```js
// The customer calendar, answered by the capacity calculator: blocks, closed
// dates, per-weekday hours and the booking mode, never a reason.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2a, Customer calendar)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedWorkshopJob } from './helpers/workshopFixtures.js';

const MONDAY = '2026-09-07';
const SATURDAY = '2026-09-12';

let server;
let owner;
let sam;
let alex;

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
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex' });
}

const as = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const block = (body) => as('/api/workshop-unavailability', { method: 'POST', body });
const availability = (query) =>
  jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/availability?${new URLSearchParams(query)}`);
const mechOn = (body, date, id) => body.days.find((d) => d.date === date).mechanics.find((m) => m.mechanicId === id);

test('lunch takes its start times away, and shows as busy with no reason', async () => {
  await freshShop();
  await block({ kind: 'weekly', mechanicId: sam, weekdays: [1], startTime: '13:00', endTime: '13:30', reason: 'Lunch with the dentist' });
  const { status, body } = await availability({ start: MONDAY, end: MONDAY, minutes: '60' });
  assert.equal(status, 200, JSON.stringify(body));
  const starts = mechOn(body, MONDAY, sam).startTimes;
  assert.ok(starts.includes('12:00'));
  assert.ok(!starts.includes('12:30'));
  assert.ok(!starts.includes('13:00'));
  assert.ok(mechOn(body, MONDAY, alex).startTimes.includes('13:00'), 'Alex has no lunch block');
  assert.ok(body.busy.some((b) => b.mechanicId === sam && b.startTime === '13:00' && b.endTime === '13:30'));
  assert.ok(!JSON.stringify(body).includes('dentist'), 'a block reason reached a customer');
});

test('a shop closure empties the day and marks it full for every mechanic', async () => {
  await freshShop();
  await block({ kind: 'dates', mechanicId: null, startDate: MONDAY, endDate: MONDAY, reason: 'Staff training' });
  const { body } = await availability({ start: MONDAY, end: MONDAY, minutes: '30' });
  assert.deepEqual(mechOn(body, MONDAY, sam).startTimes, []);
  assert.deepEqual(body.fullDays.map((f) => f.mechanicId).sort(), [sam, alex].sort());
  assert.ok(!JSON.stringify(body).includes('training'));
});

test('Saturday\'s shorter hours end its start times earlier', async () => {
  await freshShop();
  await as('/api/workshop-settings', {
    method: 'PUT',
    body: { openingHours: [0, 1, 2, 3, 4, 5].map((weekday) => ({ weekday, open: '09:00', close: '18:00' })).concat({ weekday: 6, open: '09:00', close: '17:00' }) },
  });
  const { body } = await availability({ start: SATURDAY, end: SATURDAY, minutes: '60' });
  assert.equal(mechOn(body, SATURDAY, sam).startTimes.at(-1), '16:00');
  assert.ok(body.busy.some((b) => b.mechanicId === sam && b.startTime === '17:00' && b.endTime === '18:00'));
});

test('a cancelled booking frees its time', async () => {
  await freshShop();
  const { jobId } = await seedWorkshopJob({ shopId: owner.shop.id, customerId: null, mechanicId: sam, jobDate: MONDAY, startTime: '10:00', endTime: '11:00' });
  await runWithShop(owner.shop.id, () => prepare("UPDATE workshop_jobs SET booking_state = 'cancelled' WHERE id = ?").run(jobId));
  const { body } = await availability({ start: MONDAY, end: MONDAY, minutes: '60' });
  assert.ok(mechOn(body, MONDAY, sam).startTimes.includes('10:00'));
  assert.ok(!body.busy.some((b) => b.startTime === '10:00'));
});

test('an unassigned walk-in takes a share of each working mechanic\'s drop-off day', async () => {
  await freshShop();
  await runWithShop(owner.shop.id, () => prepare("UPDATE workshop_settings SET booking_mode = 'dropoff'").run());
  // Two working mechanics, a 540-minute day each, no reserve: 1000 queued = 500 each.
  await seedWorkshopJob({ shopId: owner.shop.id, customerId: null, mechanicId: null, jobDate: MONDAY, startTime: '', endTime: '', plannedMinutes: 1000 });
  const { body } = await availability({ start: MONDAY, end: MONDAY, minutes: '40' });
  const day = body.days.find((d) => d.date === MONDAY);
  assert.equal(day.mode, 'dropoff');
  assert.deepEqual(day.dropoffWindow, { start: '09:00', end: '10:00' });
  assert.equal(mechOn(body, MONDAY, sam).bookable, true);
  const tooLong = await availability({ start: MONDAY, end: MONDAY, minutes: '41' });
  assert.equal(mechOn(tooLong.body, MONDAY, sam).bookable, false);
  assert.ok(!('freeMinutes' in mechOn(body, MONDAY, sam)), 'minute totals are staff-only');
});

test('a scheduled mode change applies from its date', async () => {
  await freshShop();
  await runWithShop(owner.shop.id, () => prepare(
    "UPDATE workshop_settings SET next_booking_mode = 'dropoff', next_booking_mode_from = '2026-09-08'"
  ).run());
  const { body } = await availability({ start: MONDAY, end: '2026-09-08', minutes: '60' });
  assert.equal(body.days[0].mode, 'timed');
  assert.equal(body.days[1].mode, 'dropoff');
});

test('the mechanic filter narrows the answer but not the queue split', async () => {
  await freshShop();
  await runWithShop(owner.shop.id, () => prepare("UPDATE workshop_settings SET booking_mode = 'dropoff'").run());
  await seedWorkshopJob({ shopId: owner.shop.id, customerId: null, mechanicId: null, jobDate: MONDAY, startTime: '', endTime: '', plannedMinutes: 1000 });
  const { body } = await availability({ start: MONDAY, end: MONDAY, minutes: '40', mechanicId: String(sam) });
  assert.deepEqual(body.days[0].mechanics.map((m) => m.mechanicId), [sam]);
  assert.equal(body.days[0].mechanics[0].bookable, true, 'the queue was split over one mechanic instead of two');
});

test('a range over 62 days, or a bad minutes value, is refused', async () => {
  await freshShop();
  assert.equal((await availability({ start: '2026-09-01', end: '2026-11-02' })).status, 400);
  assert.equal((await availability({ start: MONDAY, end: MONDAY, minutes: 'lots' })).status, 400);
  assert.equal((await availability({ start: '2026-09-01', end: '2026-11-01' })).status, 200);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test tests/portal-availability-capacity.test.js > /tmp/t5.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/t5.log
```
Expected: exit 1. `body.days` is undefined; the 62-day range is accepted.

- [ ] **Step 3: Write `loadCapacity` and replace the route**

Replace the whole `GET /api/portal/:shopSlug/availability` route, including its comment block, with:

```js
// Everything the capacity calculator needs for a date range, read inside the
// request's shop context. Every active mechanic, even when a caller wants one:
// the walk-in queue is split across everyone working.
async function loadCapacity(start, end) {
  const settings = toCapacitySettings(await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get());
  const mechanics = (await db.prepare(
    'SELECT id, working_days FROM employees WHERE is_mechanic = 1 AND active = 1 ORDER BY name'
  ).all()).map((m) => ({ id: m.id, workingDays: parseWorkingDays(m.working_days) }));
  const blocks = (await db.prepare(
    `SELECT * FROM workshop_unavailability WHERE kind = 'weekly' OR (start_date <= ? AND end_date >= ?)`
  ).all(end, start)).map(toBlock);
  const jobs = (await db.prepare(
    `SELECT id, mechanic_id, job_date, start_time, end_time, planned_minutes FROM workshop_jobs
     WHERE job_date >= ? AND job_date <= ? AND booking_state IN (${LIVE_STATES_SQL})`
  ).all(start, end)).map(toCapacityJob);
  const days = computeCapacity({ settings, mechanics, blocks, jobs, dates: datesBetween(start, end) });
  return { settings, blocks, jobs, days };
}

// Public: the customer calendar. `busy` and `fullDays` keep the shape the old
// booking page reads (public-portal/portal.js:263) - blocks, closures and a
// shorter day come back as busy time with no reason. With `minutes`, `days`
// adds what the new screens need: the mode per date, and per mechanic the
// start times (timed) or whether the job fits (drop-off). Never returned: a
// block's reason, other customers' jobs, minute totals.
// screens: date, appointment, full
route('GET', '/api/portal/:shopSlug/availability', async (req, res, params, query) => {
  const start = query.get('start');
  const end = query.get('end');
  if (!DATE_RE.test(start || '') || !DATE_RE.test(end || '')) {
    return badRequest(res, 'Valid start and end dates are required');
  }
  if (dayCount(start, end) > MAX_RANGE_DAYS) {
    return badRequest(res, `Ask for at most ${MAX_RANGE_DAYS} days at a time`);
  }
  let minutes = null;
  if (query.get('minutes') !== null) {
    minutes = Number(query.get('minutes'));
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 720) {
      return badRequest(res, 'minutes must be a whole number between 1 and 720');
    }
  }
  const mechanicFilter = query.get('mechanicId') ? Number(query.get('mechanicId')) : null;
  const keep = (x) => mechanicFilter === null || x.mechanicId === mechanicFilter;

  const { settings, jobs, days } = await loadCapacity(start, end);
  const busy = [];
  const fullDays = [];
  for (const day of days) {
    const view = legacyView(day, settings, jobs);
    busy.push(...view.busy);
    fullDays.push(...view.fullDays);
  }
  const body = { busy: busy.filter(keep), fullDays: fullDays.filter(keep) };
  if (minutes !== null) {
    body.days = days.map((day) => ({
      date: day.date,
      mode: day.mode,
      ...(day.mode === 'dropoff'
        ? { dropoffWindow: { start: settings.dropoffWindowStart, end: settings.dropoffWindowEnd } } : {}),
      mechanics: day.mechanics.filter(keep).map((m) => (day.mode === 'timed'
        ? { mechanicId: m.mechanicId, startTimes: startTimesFor(m, minutes) }
        : { mechanicId: m.mechanicId, bookable: fitsDropoff(m, minutes) })),
    }));
  }
  sendJson(res, 200, body);
});
```

- [ ] **Step 4: Cover the route in the screen trace**

In `scripts/ci/assert-screen-trace.mjs`, add to `COVERED`:

```js
  /^\/api\/portal\/:shopSlug\/availability$/,
```

- [ ] **Step 5: Run it, and the old calendar's tests unchanged**

```bash
node --test tests/portal-availability-capacity.test.js tests/workshop-availability.test.js tests/workshop-portal.test.js > /tmp/t5.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/t5.log
node scripts/ci/assert-screen-trace.mjs > /tmp/trace.log 2>&1; echo "trace $?"
git diff --stat tests/workshop-availability.test.js
```
Expected: exit 0, no `not ok`; trace 0; no diff to `tests/workshop-availability.test.js`.

- [ ] **Step 6: Watch two tests catch their breaks**

1. In `loadCapacity`, change the blocks query to `SELECT * FROM workshop_unavailability WHERE false`. Confirm with `git diff`. Expect "lunch takes its start times away" and "a shop closure" to fail. Restore.
2. In `loadCapacity`, after the mechanics `.map(...)`, temporarily add `.slice(0, 1)` so only one mechanic is loaded, as a caller filtering early would. Confirm with `git diff`. Expect "an unassigned walk-in takes a share" to fail, because the whole queue lands on one mechanic. Restore.
3. Change `if (dayCount(start, end) > MAX_RANGE_DAYS)` to `if (false)`. Confirm with `git diff`. Expect "a range over 62 days" to fail. Restore.

Run again: all pass.

- [ ] **Step 7: Commit**

```bash
git add server/server.js scripts/ci/assert-screen-trace.mjs tests/portal-availability-capacity.test.js
git commit -m "feat: customer calendar answered by the capacity calculator - blocks, closures, weekday hours, mode per date"
```

---

### Task 6: The customer booking check uses the calculator

**Files:**
- Modify: `server/server.js`, in `POST /api/portal/:shopSlug/bookings`, the block from `const settings = await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get();` through `if (slotError) return badRequest(res, slotError);`. Delete `mechanicFreeMinutes` once nothing calls it.
- Test: `tests/portal-booking-blocks.test.js`; `tests/portal-capacity-reserve.test.js`, `tests/portal-capacity-holds.test.js` and `tests/workshop-portal.test.js` must pass unchanged

**Interfaces:**
- Consumes: `loadCapacity` (Task 5), `fitsFreeTime` (Task 2), `checkJobSlot` (existing).
- Produces: no new names. Refusals stay 400 with a message. The 409 `capacity` code is 2b's.

- [ ] **Step 1: Write the failing test**

`tests/portal-booking-blocks.test.js`:

```js
// A customer cannot book into a block, a closure or past a shorter day's
// close - the server refuses it whatever the page showed.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2a; plan decision 5)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';

let server;
let owner;
let sam;
let customer;
const MONDAY = futureDate(1);

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'weekly', mechanicId: sam, weekdays: [1], startTime: '13:00', endTime: '13:30', reason: 'Lunch' },
  });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

const book = (body) => portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
  method: 'POST',
  body: { mechanicId: sam, jobDate: MONDAY, jobType: 'repair', description: 'Test booking', newBike: { make: 'Test', model: 'Bike' }, ...body },
});

test('a booking that runs into lunch is refused, and the reason is not given', async () => {
  const res = await book({ startTime: '12:30' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /unavailable/i);
  assert.ok(!/lunch/i.test(res.body.error));
});

test('a booking clear of lunch is accepted', async () => {
  const res = await book({ startTime: '11:00' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
});

test('a booking on a mechanic\'s leave is refused', async () => {
  const tuesday = futureDate(2);
  await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'dates', mechanicId: sam, startDate: tuesday, endDate: tuesday, reason: 'Holiday' },
  });
  const res = await book({ jobDate: tuesday, startTime: '10:00' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /unavailable/i);
});

test('a booking on a shop closure is refused', async () => {
  const wednesday = futureDate(3);
  await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'dates', mechanicId: null, startDate: wednesday, endDate: wednesday, reason: 'Stocktake' },
  });
  const res = await book({ jobDate: wednesday, startTime: '10:00' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test tests/portal-booking-blocks.test.js > /tmp/t6.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/t6.log
```
Expected: exit 1. The lunch, leave and closure bookings are accepted (201).

- [ ] **Step 3: Replace the reserve check with the calculator**

Replace, in `POST /api/portal/:shopSlug/bookings`, from `const settings = await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get();` through `if (slotError) return badRequest(res, slotError);` with:

```js
  // Closed days, the day's own opening hours and mechanic overlap first - the
  // same rules the staff routes enforce, from the same place, so their
  // specific messages win.
  const slotError = await checkJobSlot({
    jobDate,
    startTime: times.startTime,
    endTime: times.endTime,
    mechanicId: mechResolved.mechanicId,
  });
  if (slotError) return badRequest(res, slotError);

  // Then the capacity calculator: blocks, closures, the walk-in queue and the
  // reserve, the same answer the calendar gave. The reserve check subtracts the
  // job being booked (freeMinutes has the reserve taken off already): testing
  // only the free time already left let one booking consume the entire
  // reserve. Staff routes deliberately do NOT apply this - a shop may choose to
  // work through its own lunch; a customer may not choose it for them. A
  // block's reason is never given to the customer.
  const capacity = await loadCapacity(jobDate, jobDate);
  const mech = capacity.days[0].mechanics.find((m) => m.mechanicId === mechResolved.mechanicId);
  if (!mech || !mech.working || !fitsFreeTime(mech, times.startTime, times.endTime)) {
    return badRequest(res, 'That mechanic is unavailable at that time - please choose another time or day.');
  }
  if (mech.freeMinutes < jobType.minutes) {
    return badRequest(res, 'That mechanic does not have enough free time that day - please choose another day, or a shorter job.');
  }
```

Then run `grep -n "mechanicFreeMinutes\|\bsettings\b" server/server.js` over this route. If nothing else in the route used `settings`, nothing more is needed. If `mechanicFreeMinutes` has no remaining caller, delete the function and its comment.

- [ ] **Step 4: Run it, and the existing booking tests unchanged**

```bash
node --test tests/portal-booking-blocks.test.js tests/portal-capacity-reserve.test.js tests/portal-capacity-holds.test.js tests/workshop-portal.test.js > /tmp/t6.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/t6.log
git diff --stat tests/portal-capacity-reserve.test.js tests/portal-capacity-holds.test.js tests/workshop-portal.test.js
```
Expected: exit 0, no `not ok`, no diff to the three existing files.

- [ ] **Step 5: Watch the lunch test catch its break**

Change `!fitsFreeTime(mech, times.startTime, times.endTime)` to `false`. Confirm with `git diff`, run `tests/portal-booking-blocks.test.js`, and expect "runs into lunch" to fail with 201. Restore and re-run: 4 pass.

- [ ] **Step 6: Commit**

```bash
git add server/server.js tests/portal-booking-blocks.test.js
git commit -m "feat: customer bookings refused into lunch, leave and closures - the calculator is the authority"
```

---

### Task 7: The staff capacity view

**Files:**
- Modify: `server/server.js`, adding the route directly after the `DELETE /api/workshop-unavailability/:id` route
- Modify: `scripts/ci/assert-screen-trace.mjs` (`COVERED`)
- Test: `tests/workshop-capacity-view.test.js`

**Interfaces:**
- Consumes: `loadCapacity` (Task 5), `blockClashes`, `dayCount`, `MAX_RANGE_DAYS`, `DATE_RE` (Task 2).
- Produces: `GET /api/workshop-capacity?start&end` returning `{ days: [{ date, mode, shopClosed, closures: block[], queueMinutes, clashes: [{ jobId, blockId }], mechanics: [{ mechanicId, working, freeMinutes, freeWindows: [{ start, end }], blocks: block[] }] }] }`. `freeMinutes` is a whole number, never below 0.

- [ ] **Step 1: Write the failing test**

`tests/workshop-capacity-view.test.js`:

```js
// The staff capacity view: the calculator's full answer, reasons and clashes
// included - what the diary, week, month and hours screens will read.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2a, Staff endpoints)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedWorkshopJob } from './helpers/workshopFixtures.js';

const MONDAY = '2026-09-07';

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

const as = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);

test('staff see free minutes, windows, block reasons and clashes', async () => {
  const lunch = (await as('/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'weekly', mechanicId: sam, weekdays: [1], startTime: '13:00', endTime: '13:30', reason: 'Lunch' },
  })).body.block;
  const { jobId } = await seedWorkshopJob({ shopId: owner.shop.id, customerId: null, mechanicId: sam, jobDate: MONDAY, startTime: '12:45', endTime: '13:15' });
  const res = await as(`/api/workshop-capacity?start=${MONDAY}&end=${MONDAY}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const day = res.body.days[0];
  const m = day.mechanics.find((x) => x.mechanicId === sam);
  assert.equal(m.working, true);
  assert.equal(m.blocks[0].reason, 'Lunch');
  assert.deepEqual(m.freeWindows[0], { start: '09:00', end: '12:45' });
  assert.equal(m.freeMinutes, 540 - 30 - 15);
  assert.deepEqual(day.clashes, [{ jobId, blockId: lunch.id }]);
});

test('a shop closure shows as closed, with its reason', async () => {
  await as('/api/workshop-unavailability', {
    method: 'POST', body: { kind: 'dates', mechanicId: null, startDate: '2026-09-08', endDate: '2026-09-08', reason: 'Training' },
  });
  const day = (await as('/api/workshop-capacity?start=2026-09-08&end=2026-09-08')).body.days[0];
  assert.equal(day.shopClosed, true);
  assert.equal(day.closures[0].reason, 'Training');
  assert.ok(day.mechanics.every((m) => m.freeMinutes === 0));
});

test('the view is staff-only and range-limited', async () => {
  assert.equal((await jsonRequest(server.baseUrl, null, `/api/workshop-capacity?start=${MONDAY}&end=${MONDAY}`)).status, 401);
  assert.equal((await as('/api/workshop-capacity?start=2026-09-01&end=2026-11-02')).status, 400);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node --test tests/workshop-capacity-view.test.js > /tmp/t7.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/t7.log
```
Expected: exit 1; 404 for the capacity route. The unauthenticated check may already pass, which is fine: staff routes reject a missing session before routing. Confirm by reading the log.

- [ ] **Step 3: Write the route**

Directly after the `DELETE /api/workshop-unavailability/:id` route:

```js
// The calculator's full answer for staff: reasons, clashes and minutes
// included. Read by the diary, queue, week, month and hours screens.
// screens: diary, queue, week, month, hours
route('GET', '/api/workshop-capacity', async (req, res, params, query) => {
  const start = query.get('start');
  const end = query.get('end');
  if (!DATE_RE.test(start || '') || !DATE_RE.test(end || '')) {
    return badRequest(res, 'Valid start and end dates are required');
  }
  if (dayCount(start, end) > MAX_RANGE_DAYS) {
    return badRequest(res, `Ask for at most ${MAX_RANGE_DAYS} days at a time`);
  }
  const { blocks, jobs, days } = await loadCapacity(start, end);
  const range = ([s, e]) => ({ start: toHHMM(s), end: toHHMM(e) });
  sendJson(res, 200, {
    days: days.map((day) => {
      const dayJobs = jobs.filter((j) => j.jobDate === day.date);
      const clashes = blocks.flatMap((b) => blockClashes(b, dayJobs).map((j) => ({ jobId: j.id, blockId: b.id })));
      return {
        date: day.date,
        mode: day.mode,
        shopClosed: day.shopClosed,
        closures: day.shopBlocks,
        queueMinutes: day.queueMinutes,
        clashes,
        mechanics: day.mechanics.map((m) => ({
          mechanicId: m.mechanicId,
          working: m.working,
          freeMinutes: Math.max(0, Math.floor(m.freeMinutes)),
          freeWindows: m.freeWindows.map(range),
          blocks: m.blocks,
        })),
      };
    }),
  });
});
```

Add `toHHMM` to the `./capacity.js` import list from Task 3.

- [ ] **Step 4: Cover it in the screen trace**

In `scripts/ci/assert-screen-trace.mjs`, add to `COVERED`:

```js
  /^\/api\/workshop-capacity$/,
```

- [ ] **Step 5: Run it**

```bash
node --test tests/workshop-capacity-view.test.js > /tmp/t7.log 2>&1; echo "exit $?"; grep -E "^# (pass|fail)|not ok" /tmp/t7.log
node scripts/ci/assert-screen-trace.mjs > /tmp/trace.log 2>&1; echo "trace $?"
```
Expected: exit 0, 3 pass; trace 0.

- [ ] **Step 6: Watch the clash test catch its break**

Change `const clashes = blocks.flatMap(...)` to `const clashes = [];`. Confirm with `git diff`, run, and expect the first test to fail on `day.clashes`. Restore and re-run: 3 pass.

- [ ] **Step 7: Commit**

```bash
git add server/server.js scripts/ci/assert-screen-trace.mjs tests/workshop-capacity-view.test.js
git commit -m "feat: staff capacity view - free time, blocks, closures and clashes per mechanic-day"
```

---

### Task 8: Every gate, STATUS, and the pull request

**Files:**
- Modify: `.agents/STATUS.md`
- Modify: `docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md`: apply this plan's decision log to the 2a schema section, so the spec matches what was built

- [ ] **Step 1: Run every canonical command**

```bash
npm run docker:up > /tmp/g0.log 2>&1; echo "up $?"
npm run migrate > /tmp/g1.log 2>&1; echo "migrate $?"
npm test > /tmp/g2.log 2>&1; echo "test $?"; grep -E "^# (tests|pass|fail)" /tmp/g2.log
npm run typecheck > /tmp/g3.log 2>&1; echo "typecheck $?"
npm run lint > /tmp/g4.log 2>&1; echo "lint $?"
npm run build > /tmp/g5.log 2>&1; echo "build $?"
node scripts/ci/assert-rls-coverage.mjs > /tmp/g6.log 2>&1; echo "rls $?"
node scripts/ci/assert-screen-trace.mjs > /tmp/g7.log 2>&1; echo "trace $?"
npm run registry:validate > /tmp/g8.log 2>&1; echo "registry $?"
node scripts/ci/check-registry-drift.mjs > /tmp/g9.log 2>&1; echo "drift $?"
python3 docs/design/release-1-journey/package.py > /tmp/g10.log 2>&1; echo "package $?"
node docs/design/release-1-journey/check-static.mjs > /tmp/g11.log 2>&1; echo "static $?"
node docs/design/release-1-journey/check-notes.mjs > /tmp/g12.log 2>&1; echo "notes $?"
npm run test:browser > /tmp/g13.log 2>&1; echo "browser $?"
git status -s
```
Expected: every exit 0; tests `pass` equals `tests`, `fail 0`, up from 471. `git status -s` shows nothing unexpected. If `package.py` regenerated the atlas HTML, there should be no diff, because nothing here touches the atlas.

- [ ] **Step 2: Walk the build against the spec**

For each line of the spec's "2a" section and the 2a lines of "Testing", note whether it is met, changed (point at the decision log entry), or left to 2b. Put that list in the pull request body.

- [ ] **Step 3: Update the spec and STATUS**

- **Spec:** in the 2a "Schema" section, replace the `workshop_opening_hours` bullet with the `weekday_hours` column (decision 1). Replace the reserve's `ALTER ... SET DEFAULT` with `createShop` (decision 3). Change `DATE` to `TEXT` (decision 4).
- **STATUS:** piece 2a built and its test count. Keep it under 8,000 bytes, and check `wc -c .agents/STATUS.md` before committing.

```bash
git add .agents/STATUS.md docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md docs/superpowers/plans/2026-09-24-book-server-2a-availability.md
git commit -m "docs: piece 2a built - spec matches the build, STATUS"
```

- [ ] **Step 4: Push and open the pull request**

Push `feat/book-server-2-modes` and open a pull request against `main`. The body leads with why: customers can no longer book into lunch, leave or closures, and each day uses its own hours. Then the spec walk from Step 2, and what was tested. CI must be green against the pull request's own head SHA before the result is reported.
