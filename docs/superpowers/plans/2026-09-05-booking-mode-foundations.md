# Booking Mode Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the capacity reserve so it actually reserves, and add the per-shop settings and the per-service online-visibility flag that every later part of the booking-mode work depends on.

**Architecture:** Three server-side changes. One is a defect fix on the portal booking route needing no schema change. The other two are a single forward-only migration adding six columns to `workshop_settings` and one to `workshop_services`, plus the serialisation and validation to read and write them. Nothing here changes what a customer sees; it puts the configuration and the correctness in place first.

**Tech Stack:** Node 24, plain `node:test`, Postgres via `pg`, hand-rolled migrations (`server/migrations/run-migrations.js`), no framework.

**Spec:** `docs/decisions/2026-09-04-booking-mode-and-downtime.md` (§2, §4.3 option 3, §7.5, §7.6, §8)

## Global Constraints

- **Never commit to `main`.** Work on a branch off `main`.
- **Migrations are forward-only.** There is no down step (`014_workshop_services.sql:34-37`). A migration file, once merged, is permanent.
- **Rules are only real if the server enforces them.** Every test here drives the HTTP API, not the browser — the standing convention in this repo (`tests/workshop-rules.test.js:1-6`).
- **Test-first.** Write the failing test, run it, watch it fail for the right reason, then implement.
- **`npm test` must be green before any commit.** Also `npm run lint` and `npm run typecheck`.
- **Booking mode values are exactly `'timed'` and `'dropoff'`.** No other string is valid.
- **Defaults must preserve today's behaviour.** `booking_mode` defaults to `'timed'`; an existing shop must behave identically after this migration.

### Deliberately out of scope

These are blocked on decisions still open in the spec, and must NOT be built here:

- The customer-facing service picker and anything reading `bookable_online` from the portal — blocked on §5.1.2 (derive durations from labour lines, or denormalise onto the job). This plan adds the flag and its API only.
- Drop-off mode behaviour itself — the day-picker, the staff list view, capacity from summed durations. Blocked on §6.1 and §6.2.
- Recurring unavailability blocks (§4.3 option 1).
- **Any staff UI.** The settings form in `public/app.js` needs these controls eventually, but UI and visual design changes need Jack's sign-off on appearance first. The API is the contract and is independently testable; the form is a separate piece of work.

---

### Task 1: Make the capacity reserve actually reserve

The gate asks whether free time is *already* below the threshold and never whether the booking in hand would consume it. A 540-minute day with a 120-minute threshold and 420 minutes booked has exactly 120 free; `120 < 120` is false, so a 120-minute service is accepted and the day ends with zero minutes for lunch. Spec §4.1.

No schema change. This is independent of Tasks 2 and 3 and can ship alone.

**Files:**
- Modify: `server/server.js:3528-3537`
- Test: `tests/portal-capacity-reserve.test.js` (create)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing other tasks rely on.

- [ ] **Step 1: Write the failing test**

Create `tests/portal-capacity-reserve.test.js`:

```javascript
// full_day_threshold_minutes is meant to hold back part of a mechanic's day
// for lunch, admin, and the parts of a shift not spent on a bike. It did not:
// the gate tested free time BEFORE the booking and never asked whether the
// booking would consume the reserve, so one job could take all of it.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { seedBookableShop, seedWorkshopJob, customerIdForLogin } from './helpers/workshopFixtures.js';
import { portalSignup, portalRequest } from './helpers/portal.js';

const WEDNESDAY = '2026-10-14';

let server;

before(async () => {
  server = await startLiveServer();
});

after(async () => {
  if (server) await server.stop();
  await pool.end();
});

// Shop day is 09:00-18:00 = 540 minutes; default threshold is 120.
async function shopWithBookedMinutes(endTime) {
  const shop = await createTestShop({ slug: `reserve-${Date.now()}-${Math.floor(Math.random() * 1e6)}` });
  const { mechanicId } = await seedBookableShop(shop.id, { mechanicName: 'Reserve Mechanic' });
  const signup = await portalSignup(server.baseUrl, shop.slug, {});
  const customerId = await customerIdForLogin(shop.id, signup.loginId);
  await seedWorkshopJob({
    shopId: shop.id, customerId, mechanicId, title: 'Existing work',
    jobDate: WEDNESDAY, startTime: '09:00', endTime, status: 'scheduled',
  });
  return { shop, mechanicId, cookie: signup.cookie };
}

function book(baseUrl, cookie, slug, { mechanicId, startTime, jobType }) {
  return portalRequest(baseUrl, cookie, `/api/portal/${slug}/bookings`, {
    method: 'POST',
    body: {
      mechanicId, jobDate: WEDNESDAY, startTime, jobType,
      description: 'Test booking', newBike: { make: 'Test', model: 'Bike' },
    },
  });
}

test('a booking that would consume the whole reserve is refused', async () => {
  // 420 booked, so exactly 120 free - the reserve and nothing more.
  const { shop, mechanicId, cookie } = await shopWithBookedMinutes('16:00');
  const res = await book(server.baseUrl, cookie, shop.slug, {
    mechanicId, startTime: '16:00', jobType: 'service', // 120 minutes
  });
  assert.equal(res.status, 400, `expected refusal, got ${res.status}: ${JSON.stringify(res.body)}`);

  const left = await runWithShop(shop.id, () =>
    prepare('SELECT COUNT(*)::int AS n FROM workshop_jobs WHERE mechanic_id = ? AND job_date = ?')
      .get(mechanicId, WEDNESDAY));
  assert.equal(left.n, 1, 'the refused booking must not have been written');
  await deleteTestShop(shop.id);
});

test('a booking that leaves the reserve intact is still accepted', async () => {
  // 360 booked, so 180 free. A 30-minute job leaves 150, above the 120 reserve.
  const { shop, mechanicId, cookie } = await shopWithBookedMinutes('15:00');
  const res = await book(server.baseUrl, cookie, shop.slug, {
    mechanicId, startTime: '15:00', jobType: 'quick', // 30 minutes
  });
  assert.equal(res.status, 201, `expected acceptance, got ${res.status}: ${JSON.stringify(res.body)}`);
  await deleteTestShop(shop.id);
});

test('the same day refuses a long job while accepting a short one', async () => {
  // 180 free: a 120-minute service would leave 60, below the reserve.
  const { shop, mechanicId, cookie } = await shopWithBookedMinutes('15:00');
  const res = await book(server.baseUrl, cookie, shop.slug, {
    mechanicId, startTime: '15:00', jobType: 'service',
  });
  assert.equal(res.status, 400, `expected refusal, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.match(res.body.error, /room|full/i, 'the refusal should say the day has no room left');
  await deleteTestShop(shop.id);
});
```

- [ ] **Step 2: Run the test and confirm it fails for the right reason**

```bash
node --test tests/portal-capacity-reserve.test.js
```

Expected: the first and third tests FAIL with `expected refusal, got 201`. The second PASSES already. If the first test fails for any other reason — a seeding error, a 401, a 404 — stop and fix the test before touching `server.js`; a test that fails for the wrong reason proves nothing.

- [ ] **Step 3: Make the gate test free time after the booking**

In `server/server.js`, replace the block at lines 3528-3537:

```javascript
  const settings = await db.prepare('SELECT * FROM workshop_settings LIMIT 1').get();

  // The shop holds back full_day_threshold_minutes of each mechanic's day for
  // lunch, admin, and the parts of a shift that are not spent on a bike. The
  // check subtracts the job being booked: testing only the free time already
  // left let one booking consume the entire reserve (540-minute day, 120-minute
  // threshold, 420 booked, `120 < 120` false, a 120-minute service accepted,
  // zero minutes left). Staff routes deliberately do NOT apply this - a shop
  // may choose to work through its own lunch; a customer may not choose it for
  // them.
  const freeMinutes = await mechanicFreeMinutes(mechResolved.mechanicId, jobDate, settings.opening_time, settings.closing_time);
  if (freeMinutes - jobType.minutes < settings.full_day_threshold_minutes) {
    return badRequest(res, 'That mechanic has no room left that day - please choose another day.');
  }
```

`jobType` is already in scope from line 3512 (`const jobType = PORTAL_JOB_TYPES[body.jobType]`), and the route has already returned 400 if it was missing.

- [ ] **Step 4: Run the test and confirm it passes**

```bash
node --test tests/portal-capacity-reserve.test.js
```

Expected: all three PASS.

- [ ] **Step 5: Prove the test bites**

A test that passes is worth nothing until you have watched it fail on purpose. Revert the gate to `if (freeMinutes < settings.full_day_threshold_minutes) {`, confirm the change actually landed with `grep -n "freeMinutes -" server/server.js` returning nothing, and re-run:

```bash
node --test tests/portal-capacity-reserve.test.js
```

Expected: tests 1 and 3 FAIL again. Then restore the fix and confirm they pass.

- [ ] **Step 6: Run the whole suite and commit**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: all green. Note that `tests/workshop-portal.test.js` and `tests/portal-guest-customer.test.js` also book through this route — if either now fails, a fixture is booking into a day too full under the corrected rule, and the fixture is what to change, not the gate.

```bash
git add tests/portal-capacity-reserve.test.js server/server.js
git commit -m "fix: the capacity reserve now actually reserves"
```

---

### Task 2: The per-shop settings migration

Six columns on `workshop_settings` in one migration, plus reading and writing them. Spec §2, §7.6, §8.

One file rather than four because migrations here are forward-only and each runs in its own transaction: split up, there is a real intermediate state where a shop has `booking_mode` but no drop-off window, which the application would have to handle. Together, a shop either has the whole set or none of it.

**Files:**
- Create: `server/migrations/015_booking_mode.sql`
- Modify: `server/server.js:2900-2908` (`serializeWorkshopSettings`)
- Modify: `server/server.js:2920-2943` (`PUT /api/workshop-settings`)
- Test: `tests/workshop-settings.test.js` (create — no test file covers these routes today)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `serializeWorkshopSettings(row)` gains `bookingMode` (`'timed'|'dropoff'`), `dropoffWindowStart` (`'HH:MM'`), `dropoffWindowEnd` (`'HH:MM'`), `timedLeadMinutes` (integer), `unspecifiedJobMinutes` (integer), `showPricesOnline` (boolean). `PUT /api/workshop-settings` accepts the same camelCase keys. Task 3 does not depend on these.

- [ ] **Step 1: Write the failing test**

Create `tests/workshop-settings.test.js`:

```javascript
// GET/PUT /api/workshop-settings had no HTTP coverage at all before this
// file. The settings added here are the per-shop configuration the
// booking-mode work depends on; every one of them has a default chosen so
// that an existing shop behaves exactly as it did before the migration.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;

before(async () => {
  server = await startLiveServer();
});

after(async () => {
  if (server) await server.stop();
  await pool.end();
});

test('a new shop defaults to timed booking, so nothing changes for existing shops', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const { status, body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings');
  assert.equal(status, 200);
  assert.equal(body.bookingMode, 'timed');
  assert.equal(body.unspecifiedJobMinutes, 60);
  assert.equal(body.timedLeadMinutes, 30);
  assert.equal(body.showPricesOnline, false);
  assert.equal(body.dropoffWindowStart, '09:00');
  assert.equal(body.dropoffWindowEnd, '10:00');
  await deleteTestShop(shop.id);
});

test('a shop can switch to drop-off mode and set its window', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const { status, body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
    method: 'PUT',
    body: { bookingMode: 'dropoff', dropoffWindowStart: '08:00', dropoffWindowEnd: '09:30' },
  });
  assert.equal(status, 200);
  assert.equal(body.bookingMode, 'dropoff');
  assert.equal(body.dropoffWindowStart, '08:00');
  assert.equal(body.dropoffWindowEnd, '09:30');
  await deleteTestShop(shop.id);
});

test('an unknown booking mode is refused', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const { status, body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
    method: 'PUT',
    body: { bookingMode: 'whenever' },
  });
  assert.equal(status, 400);
  assert.match(body.error, /timed|drop/i);
  await deleteTestShop(shop.id);
});

test('a drop-off window that ends before it starts is refused', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const { status, body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
    method: 'PUT',
    body: { dropoffWindowStart: '10:00', dropoffWindowEnd: '09:00' },
  });
  assert.equal(status, 400);
  assert.match(body.error, /after/i);
  await deleteTestShop(shop.id);
});

test('price visibility can be turned on, and comes back as a boolean', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const { body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
    method: 'PUT',
    body: { showPricesOnline: true },
  });
  assert.equal(body.showPricesOnline, true, 'must be a boolean, not 1 - the client renders it directly');
  await deleteTestShop(shop.id);
});

test('the not-sure duration must be a sensible number of minutes', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const { status, body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
    method: 'PUT',
    body: { unspecifiedJobMinutes: 0 },
  });
  assert.equal(status, 400);
  assert.match(body.error, /minutes/i);
  await deleteTestShop(shop.id);
});

test('settings not named in a PUT are left alone', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
    method: 'PUT', body: { bookingMode: 'dropoff' },
  });
  const { body } = await staffRequest(server.baseUrl, cookie, '/api/workshop-settings', {
    method: 'PUT', body: { showPricesOnline: true },
  });
  assert.equal(body.bookingMode, 'dropoff', 'a later PUT wiped an earlier setting');
  assert.equal(body.openingTime, '09:00', 'a later PUT wiped the opening time');
  await deleteTestShop(shop.id);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
node --test tests/workshop-settings.test.js
```

Expected: every test FAILS — the first on `body.bookingMode` being `undefined`, the rest because the PUT ignores keys it does not know and returns 200.

- [ ] **Step 3: Write the migration**

Create `server/migrations/015_booking_mode.sql`:

```sql
-- Per-shop configuration for the two ways bike shops take work in. See
-- docs/decisions/2026-09-04-booking-mode-and-downtime.md.
--
-- One file rather than four: migrations here are forward-only and each runs
-- in its own transaction, so splitting these would create a real state where
-- a shop has booking_mode but no drop-off window. Every default below is
-- chosen so an existing shop behaves exactly as it did before this ran.

-- 'timed'   - a customer books a start time (today's only behaviour)
-- 'dropoff' - a customer books a day; the bike is left and fitted in
ALTER TABLE workshop_settings
  ADD COLUMN booking_mode TEXT NOT NULL DEFAULT 'timed'
    CHECK (booking_mode IN ('timed', 'dropoff'));

-- Drop-off mode: when the bike should be brought in. Inert under 'timed'.
ALTER TABLE workshop_settings
  ADD COLUMN dropoff_window_start TEXT NOT NULL DEFAULT '09:00',
  ADD COLUMN dropoff_window_end   TEXT NOT NULL DEFAULT '10:00';

-- Timed mode: how far before their slot a customer is asked to arrive.
ALTER TABLE workshop_settings
  ADD COLUMN timed_lead_minutes INTEGER NOT NULL DEFAULT 30;

-- What "Not sure / something not listed" books. The mechanic sets the real
-- duration when they review the job; this is only what it reserves until then.
ALTER TABLE workshop_settings
  ADD COLUMN unspecified_job_minutes INTEGER NOT NULL DEFAULT 60;

-- Whether the customer-facing service list shows prices. Defaults to off:
-- publishing a shop's labour rates without being asked is the harder mistake
-- to undo.
ALTER TABLE workshop_settings
  ADD COLUMN show_prices_online INTEGER NOT NULL DEFAULT 0;

-- Which catalogue services a customer may book online. Defaults to off, so a
-- shop opts each one in rather than exposing the whole internal price list by
-- accident.
ALTER TABLE workshop_services
  ADD COLUMN bookable_online INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 4: Apply the migration and confirm it ran**

```bash
npm run migrate
```

Then confirm the columns exist rather than assuming:

```bash
node -e "import('./server/db.js').then(async ({ pool }) => {
  const { rows } = await pool.query(\"SELECT column_name FROM information_schema.columns WHERE table_name='workshop_settings' AND column_name IN ('booking_mode','dropoff_window_start','dropoff_window_end','timed_lead_minutes','unspecified_job_minutes','show_prices_online') ORDER BY column_name\");
  console.log(rows.map(r => r.column_name));
  await pool.end();
})"
```

Expected: all six names printed.

- [ ] **Step 5: Serialise the new settings**

In `server/server.js`, replace `serializeWorkshopSettings` at lines 2900-2908:

```javascript
function serializeWorkshopSettings(row) {
  return {
    openingTime: row.opening_time,
    closingTime: row.closing_time,
    openingDays: parseWorkingDays(row.opening_days),
    fullDayThresholdMinutes: row.full_day_threshold_minutes,
    bookingMode: row.booking_mode,
    dropoffWindowStart: row.dropoff_window_start,
    dropoffWindowEnd: row.dropoff_window_end,
    timedLeadMinutes: row.timed_lead_minutes,
    unspecifiedJobMinutes: row.unspecified_job_minutes,
    // INTEGER 0/1 in the column, boolean over the wire - the client renders
    // it directly, same shape serializeWorkshopService uses for `active`.
    showPricesOnline: row.show_prices_online === 1,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 6: Validate and persist them on PUT**

In `server/server.js`, inside `PUT /api/workshop-settings`, after the `fullDayThresholdMinutes` block (which ends at line 2937) and before the `UPDATE`, insert:

```javascript
  const bookingMode = body.bookingMode !== undefined ? String(body.bookingMode).trim() : existing.booking_mode;
  if (bookingMode !== 'timed' && bookingMode !== 'dropoff') {
    return badRequest(res, "Booking mode must be either 'timed' or 'dropoff'");
  }

  const dropoffWindowStart = body.dropoffWindowStart !== undefined
    ? String(body.dropoffWindowStart).trim() : existing.dropoff_window_start;
  const dropoffWindowEnd = body.dropoffWindowEnd !== undefined
    ? String(body.dropoffWindowEnd).trim() : existing.dropoff_window_end;
  if (!TIME_RE.test(dropoffWindowStart) || !TIME_RE.test(dropoffWindowEnd)) {
    return badRequest(res, 'Drop-off window times must look like 09:00');
  }
  if (dropoffWindowEnd <= dropoffWindowStart) {
    return badRequest(res, 'The drop-off window must end after it starts');
  }

  let timedLeadMinutes = existing.timed_lead_minutes;
  if (body.timedLeadMinutes !== undefined) {
    timedLeadMinutes = Number(body.timedLeadMinutes);
    if (!Number.isInteger(timedLeadMinutes) || timedLeadMinutes < 0 || timedLeadMinutes > 240) {
      return badRequest(res, 'The arrival lead time must be a whole number of minutes between 0 and 240');
    }
  }

  let unspecifiedJobMinutes = existing.unspecified_job_minutes;
  if (body.unspecifiedJobMinutes !== undefined) {
    unspecifiedJobMinutes = Number(body.unspecifiedJobMinutes);
    if (!Number.isInteger(unspecifiedJobMinutes) || unspecifiedJobMinutes <= 0 || unspecifiedJobMinutes > 480) {
      return badRequest(res, 'The not-sure duration must be a whole number of minutes between 1 and 480');
    }
  }

  const showPricesOnline = body.showPricesOnline === undefined
    ? existing.show_prices_online : (body.showPricesOnline ? 1 : 0);
```

Then replace the `UPDATE` statement and its `.run(...)`:

```javascript
  await db.prepare(
    `UPDATE workshop_settings SET opening_time = ?, closing_time = ?, opening_days = ?,
       full_day_threshold_minutes = ?, booking_mode = ?, dropoff_window_start = ?,
       dropoff_window_end = ?, timed_lead_minutes = ?, unspecified_job_minutes = ?,
       show_prices_online = ?, updated_at = ? WHERE id = ?`
  ).run(openingTime, closingTime, openingDays, fullDayThresholdMinutes, bookingMode,
        dropoffWindowStart, dropoffWindowEnd, timedLeadMinutes, unspecifiedJobMinutes,
        showPricesOnline, nowIso(), existing.id);
```

`TIME_RE` does not exist yet. Add it beside `HOUR_RE` at line 2910 — `HOUR_RE` only matches times on the hour, and a drop-off window of 09:30 is reasonable:

```javascript
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
```

- [ ] **Step 7: Run the test and confirm it passes**

```bash
node --test tests/workshop-settings.test.js
```

Expected: all seven PASS.

- [ ] **Step 8: Prove the tests bite**

Change the `bookingMode` guard to accept anything (`if (false) {`), confirm with `grep -n "if (false)" server/server.js`, and re-run. Expected: the unknown-mode test FAILS. Restore it.

Then delete the `showPricesOnline: row.show_prices_online === 1` line's `=== 1` so it returns the raw integer, re-run, and confirm the boolean test FAILS with `1 !== true`. Restore it.

- [ ] **Step 9: Run the whole suite and commit**

```bash
npm run lint && npm run typecheck && npm test
```

```bash
git add server/migrations/015_booking_mode.sql server/server.js tests/workshop-settings.test.js
git commit -m "feat: per-shop booking mode, drop-off window and price visibility settings"
```

---

### Task 3: The online-visibility flag on services

The column arrives with Task 2's migration; this task makes the API read and write it. Spec §7.1, §7.5.

Nothing consumes the flag yet — the customer-facing picker is blocked on spec §5.1.2 and is explicitly out of scope here.

**Files:**
- Modify: `server/server.js:2947-2955` (`serializeWorkshopService`)
- Modify: `server/server.js:2960-2971` (`readServiceBody`)
- Modify: `server/server.js:2987-2989` (the INSERT in `POST /api/workshop-services`)
- Modify: `server/server.js:3006-3009` (the UPDATE in `PUT /api/workshop-services/:id`)
- Test: `tests/workshopServicesApi.test.js` (extend)

**Interfaces:**
- Consumes: `bookable_online` on `workshop_services`, created by Task 2's migration. Task 2 must be applied first.
- Produces: `serializeWorkshopService(row)` gains `bookableOnline` (boolean). POST and PUT accept `bookableOnline`.

- [ ] **Step 1: Write the failing test**

Append to `tests/workshopServicesApi.test.js`:

```javascript
test('a new service is not bookable online until the shop says so', async () => {
  const res = await authedFetch('/api/workshop-services', {
    method: 'POST',
    body: JSON.stringify({ name: 'Bottom bracket service', price: 45, minutes: 60 }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.bookableOnline, false, 'the whole catalogue must not be exposed by default');
});

test('a shop can mark a service bookable online', async () => {
  const created = await (await authedFetch('/api/workshop-services', {
    method: 'POST',
    body: JSON.stringify({ name: 'Puncture repair', price: 12, minutes: 15, bookableOnline: true }),
  })).json();
  assert.equal(created.bookableOnline, true);

  const updated = await (await authedFetch(`/api/workshop-services/${created.id}`, {
    method: 'PUT',
    body: JSON.stringify({ name: 'Puncture repair', price: 12, minutes: 15, bookableOnline: false }),
  })).json();
  assert.equal(updated.bookableOnline, false, 'a shop must be able to withdraw a service from online booking');
});

test('leaving bookableOnline out of a PUT does not silently withdraw the service', async () => {
  const created = await (await authedFetch('/api/workshop-services', {
    method: 'POST',
    body: JSON.stringify({ name: 'Gear service', price: 30, minutes: 45, bookableOnline: true }),
  })).json();

  const updated = await (await authedFetch(`/api/workshop-services/${created.id}`, {
    method: 'PUT',
    body: JSON.stringify({ name: 'Gear service', price: 32, minutes: 45 }),
  })).json();
  assert.equal(updated.bookableOnline, true, 'a price edit must not remove a service from online booking');
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
node --test tests/workshopServicesApi.test.js
```

Expected: all three FAIL on `bookableOnline` being `undefined`.

- [ ] **Step 3: Serialise the flag**

In `server/server.js`, in `serializeWorkshopService`, add after the `active` line:

```javascript
    // Whether a customer may book this service themselves. The catalogue is
    // written in mechanic language and organised by work performed; only the
    // subset a shop ticks belongs in front of a customer. See
    // docs/decisions/2026-09-04-booking-mode-and-downtime.md §7.
    bookableOnline: row.bookable_online === 1,
```

- [ ] **Step 4: Accept the flag on write**

`readServiceBody` cannot own this one: it throws on absent fields, and PUT must distinguish "set it false" from "did not mention it" (Step 1's third test). Handle it in each route instead.

In `POST /api/workshop-services`, replace the INSERT:

```javascript
  const bookableOnline = body.bookableOnline ? 1 : 0;
  const info = await db.prepare(
    'INSERT INTO workshop_services (name, price, minutes, bookable_online) VALUES (?, ?, ?, ?)'
  ).run(fields.name, fields.price, fields.minutes, bookableOnline);
```

In `PUT /api/workshop-services/:id`, after the existing `active` line, add the same `undefined`-means-unchanged treatment, then replace the UPDATE:

```javascript
  const bookableOnline = body.bookableOnline === undefined
    ? existing.bookable_online : (body.bookableOnline ? 1 : 0);
  await db.prepare(
    'UPDATE workshop_services SET name = ?, price = ?, minutes = ?, active = ?, bookable_online = ?, updated_at = ? WHERE id = ?'
  ).run(fields.name, fields.price, fields.minutes, active, bookableOnline, nowIso(), id);
```

- [ ] **Step 5: Run the test and confirm it passes**

```bash
node --test tests/workshopServicesApi.test.js
```

Expected: every test in the file PASSES, the three new ones included.

- [ ] **Step 6: Prove the third test bites**

Change the PUT's `bookableOnline` line to `const bookableOnline = body.bookableOnline ? 1 : 0;` — the bug the third test exists to catch, where editing a price quietly withdraws the service from online booking. Confirm the edit landed with `grep -n "body.bookableOnline ? 1 : 0" server/server.js` returning two hits rather than one, re-run, and confirm the third test FAILS. Restore it.

- [ ] **Step 7: Run the whole suite and commit**

```bash
npm run lint && npm run typecheck && npm test
```

```bash
git add server/server.js tests/workshopServicesApi.test.js
git commit -m "feat: shops choose which services customers can book online"
```

---

## Done condition

All three of these, run from a clean tree on the branch:

```bash
npm run lint && npm run typecheck && npm test
```

- Every test green, including the three new files' worth.
- `npm run migrate` applies `015_booking_mode.sql` on a fresh database with no error.
- A shop created after this work reports `bookingMode: 'timed'` and behaves exactly as it did before — nothing customer-facing has changed.

## What this deliberately leaves undone

Named so the next session does not mistake absence for oversight:

- **No staff UI.** The settings form and the services list both need controls for what this adds. Jack signs off on UI appearance before it is built.
- **Nothing reads `bookable_online` yet.** The customer picker waits on spec §5.1.2.
- **Drop-off mode does nothing yet.** Setting `booking_mode = 'dropoff'` stores the value and changes no behaviour. The day-picker, the staff list view and capacity from summed durations wait on spec §6.1 and §6.2.
- **`timed_lead_minutes` and the drop-off window are not in the confirmation copy yet.** The copy lives in `public-portal/copy.js` and the panel that renders it exists; wiring the settings through is a small follow-up once the portal reads settings at all.
- **The availability grid and the booking gate no longer use the same predicate.** `GET /api/portal/:shopSlug/availability` marks a day full on `free < threshold`; the booking route refuses on `free - jobMinutes < threshold`. Before this work they were identical. So a day can be displayed as bookable and then refuse the booking. Deliberate for now - spec §4.2 already records that a full day is unexplained to the customer - but the two call sites should cross-reference each other, or `fullDays` should account for the longest bookable job.
- **`mechanicFreeMinutes` counts only jobs that have a start time** (`start_time IS NOT NULL AND start_time != ''`). Drop-off jobs will not have one. Whichever phase makes the gate mode-dependent must not reuse this function for drop-off capacity as-is: it would report a fully-booked drop-off day as completely free. Capacity there has to come from summed durations. Spec §5.1 and §6.2.
