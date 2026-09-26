# Book server piece 7: several services per booking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A customer booking holds 1-10 services (or "Not sure" alone), stored one row per service with its frozen price, with summed length, per-service answers, and a reply listing each service's price plus a total.

**Architecture:** Migration 030 moves the per-job `service_id`/`booked_price` into a new `workshop_job_services` table (backfilled, then the old columns dropped). Task 1 does the storage change while the booking still names one service, so nothing else moves. Task 2 switches the request to `serviceIds`. Task 3 switches the replies to `services` + `totalPrice`.

**Tech Stack:** Node `http` server (`server/server.js`), Postgres 16 with row-level security, SQL migrations (`server/migrations/NNN_name.sql`, run by `run-migrations.js`), `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-26-book-server-7-multiple-services-design.md`

## Global Constraints

- Table `workshop_job_services`: `id SERIAL PRIMARY KEY`, `shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id)`, `workshop_job_id INTEGER NOT NULL REFERENCES workshop_jobs(id) ON DELETE CASCADE`, `service_id INTEGER NOT NULL REFERENCES workshop_services(id)`, `booked_price NUMERIC(10,2)` (nullable), `position INTEGER NOT NULL`; `UNIQUE (workshop_job_id, service_id)`; ENABLE + FORCE row-level security; policy `workshop_job_services_shop_isolation` with `USING`/`WITH CHECK (shop_id = current_setting('app.current_shop_id')::int)`, exactly as `server/migrations/023_capacity_blocks.sql:48-52`.
- Migration 030 backfills from `workshop_jobs.service_id`/`booked_price` (position 0, the job's `shop_id`), then drops both columns.
- Prices are copied in SQL (`(SELECT price FROM workshop_services WHERE id = ?)`) and totalled in SQL (`SUM`); never arithmetic in JavaScript.
- Request: `serviceIds` — an array of 1-10 distinct positive integers — or `notSure: true` alone. Errors, verbatim:
  - neither: `Please choose a service, or "not sure"`
  - both: `Choose services, or "not sure" - not both`
  - not an array / empty / non-positive-integer entry: `That service is not available to book`
  - more than 10: `Please choose up to 10 services`
  - a repeat: `Each service can be chosen only once`
  - total minutes over 720: `That's too much work for one visit - please book the jobs separately`
  - an answer for a service not chosen, or with no `serviceId`: `Those answers don't match the services chosen`
- A body with `serviceId` (singular) and no `serviceIds` gets `Please choose a service, or "not sure"`.
- Title: `Online booking: ${names.join(' + ')} - ${description}`, `.slice(0, 200)`.
- Replies (201 and `/booking-links/:code`): `services: [{ name, price }]` in chosen order and `totalPrice`; every price field `null` unless `show_prices_online = 1`; `price` null for an unpriced service; `totalPrice` null if any chosen service is unpriced or for "Not sure" (`services: []`). These replace `bookedPrice` (both replies) and `serviceName` (link).
- The customer bookings list (`serializePortalBooking`) and staff routes keep their shapes; staff `questionAnswers` items gain `serviceId`.
- Every new test is watched failing before the code; each has a named break step whose edit is confirmed landed (grep) before running. Existing tests that assumed one service are updated, never deleted.
- Compose Postgres up (port 5433). Commit on `feat/book-server-7-multi-service`, never main; messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Leave untracked `.claude/launch.json` alone.

## File map

| File | Task |
|---|---|
| `server/migrations/030_job_services.sql`, `tests/migration-030.test.js`, `server/server.js` (`createWorkshopJob`, booking POST's `createWorkshopJob` call and 201 price read, `/booking-links` query), `tests/migration-026.test.js` | 1 |
| `server/booking-request.js`, `tests/booking-request.test.js`, `server/server.js` (booking POST: service load, answers, minutes, title), `tests/portal-booking-multi.test.js` (new), existing booking tests sending `serviceId` | 2 |
| `server/server.js` (`customerBookedPrice` → service list + total; 201 body; `/booking-links`), `tests/portal-booked-price.test.js`, `tests/portal-booking-link.test.js`, `tests/portal-booking-request.test.js` | 3 |

Test helpers already in the repo: `tests/helpers/liveServer.js` (`startLiveServer`), `staff.js` (`staffSignup`, `staffRequest`, `seedMechanic`), `portal.js` (`portalSignup`, `portalRequest`), `http.js` (`jsonRequest`), `testShop.js` (`deleteTestShop`), `workshopFixtures.js` (`futureDate`), `bookable.js` (`BOOKING_CONTACT`). `tests/portal-booked-price.test.js` shows a signed-in `book()` helper and date stepping (`nextDate`) — copy that pattern; signed-in bookings avoid the guest limit of 5 an hour.

---

### Task 1: Store booked services in their own table

**Files:** create `server/migrations/030_job_services.sql`, `tests/migration-030.test.js`; modify `server/server.js`, `tests/migration-026.test.js`.

**Interfaces:**
- Produces: table `workshop_job_services` (Global Constraints); `createWorkshopJob({ ..., serviceIds })` (replaces `serviceId`; an array, may be empty/undefined) inserting one row per id in order inside its transaction.
- Transitional (Task 3 replaces): the POST's `bookedPrice` and the link's `serviceName`/`bookedPrice` read the job's position-0 service row.

- [ ] **Step 1: Write the failing migration test** — `tests/migration-030.test.js`

```js
// Migration 030: a booking's services live in their own table, one row per
// service with the price it was booked at; the per-job columns are gone.
// Spec: docs/superpowers/specs/2026-09-26-book-server-7-multiple-services-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
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
  await pool.end();
});

const column = async (table, name) => (await pool.query(
  `SELECT data_type, is_nullable, numeric_precision, numeric_scale
   FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`, [table, name]
)).rows[0];

test('workshop_job_services has the booked service, price to the penny, and order', async () => {
  for (const name of ['id', 'shop_id', 'workshop_job_id', 'service_id', 'position']) {
    const c = await column('workshop_job_services', name);
    assert.ok(c, `${name} missing`);
    assert.equal(c.is_nullable, 'NO', `${name} should be required`);
  }
  const price = await column('workshop_job_services', 'booked_price');
  assert.equal(price.data_type, 'numeric');
  assert.equal(price.numeric_precision, 10);
  assert.equal(price.numeric_scale, 2);
  assert.equal(price.is_nullable, 'YES');
});

test('the old per-job service columns are gone', async () => {
  assert.equal(await column('workshop_jobs', 'service_id'), undefined);
  assert.equal(await column('workshop_jobs', 'booked_price'), undefined);
});

test('row-level security is enabled and forced', async () => {
  const { rows: [t] } = await pool.query(
    "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'workshop_job_services'");
  assert.equal(t.relrowsecurity, true);
  assert.equal(t.relforcerowsecurity, true);
});

test('another shop cannot see a shop\'s booked services', async () => {
  const other = await staffSignup(server.baseUrl);
  try {
    const seen = await runWithShop(other.shop.id, () => prepare(
      'SELECT count(*)::int AS n FROM workshop_job_services WHERE shop_id = ?').get(owner.shop.id));
    assert.equal(seen.n, 0);
  } finally {
    await deleteTestShop(other.shop.id);
  }
});

test('a job cannot list the same service twice, and rows go with the job', async () => {
  await runWithShop(owner.shop.id, async () => {
    const svc = (await prepare("INSERT INTO workshop_services (name, price, minutes, updated_at) VALUES ('Once', 10, 30, now())").run()).lastInsertRowid;
    const job = (await prepare("INSERT INTO workshop_jobs (title, job_date, updated_at) VALUES ('x', '2030-01-01', now())").run()).lastInsertRowid;
    await prepare('INSERT INTO workshop_job_services (workshop_job_id, service_id, booked_price, position) VALUES (?, ?, 10, 0)').run(job, svc);
    await assert.rejects(prepare('INSERT INTO workshop_job_services (workshop_job_id, service_id, booked_price, position) VALUES (?, ?, 10, 1)').run(job, svc));
    await prepare('DELETE FROM workshop_jobs WHERE id = ?').run(job);
    const left = await prepare('SELECT count(*)::int AS n FROM workshop_job_services WHERE workshop_job_id = ?').get(job);
    assert.equal(left.n, 0);
  });
});
```

If `workshop_jobs` needs more non-null columns for the bare insert, copy what `tests/migration-026.test.js` inserts. The backfill itself is proved by the migration SQL review and by Task 1 Step 5 (an existing-booking read-back through the new table); a separate backfill test would need a pre-030 database, which the test runner cannot produce.

- [ ] **Step 2: Run and watch it fail** — `node --test tests/migration-030.test.js`: columns missing / old columns present.

- [ ] **Step 3: Write the migration** — `server/migrations/030_job_services.sql`

```sql
-- A booking's services, one row each, with the price each was booked at
-- (server piece 7). Replaces workshop_jobs.service_id / booked_price (026),
-- which held exactly one. Existing bookings are copied across first, then the
-- old columns go, so this table is the only source.
-- Spec: docs/superpowers/specs/2026-09-26-book-server-7-multiple-services-design.md
CREATE TABLE workshop_job_services (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  workshop_job_id INTEGER NOT NULL REFERENCES workshop_jobs(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES workshop_services(id),
  booked_price NUMERIC(10,2),
  position INTEGER NOT NULL,
  UNIQUE (workshop_job_id, service_id)
);
CREATE INDEX idx_workshop_job_services_job ON workshop_job_services(shop_id, workshop_job_id);
ALTER TABLE workshop_job_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_job_services FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_job_services_shop_isolation ON workshop_job_services
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- The migration runs as the table owner; FORCE applies RLS to the owner too, so
-- the backfill supplies shop_id explicitly and must be allowed to write every
-- shop's rows. Check how earlier migrations that INSERT under FORCE handle this
-- (e.g. grep for "set_config('app.current_shop_id'" or "BYPASSRLS" in
-- server/migrations) and follow the same pattern.
INSERT INTO workshop_job_services (shop_id, workshop_job_id, service_id, booked_price, position)
  SELECT shop_id, id, service_id, booked_price, 0 FROM workshop_jobs WHERE service_id IS NOT NULL;

ALTER TABLE workshop_jobs DROP COLUMN service_id, DROP COLUMN booked_price;
```

Before running: `grep -rn "current_shop_id\|BYPASSRLS\|row_security" server/migrations/*.sql server/migrations/run-migrations.js` to see whether migrations run with RLS bypassed. If a backfill under FORCE would be filtered to nothing, apply the pattern the repo already uses (e.g. insert before enabling FORCE: move the `INSERT` above the two `ALTER TABLE ... ROW LEVEL SECURITY` lines) and say which you chose. The goal is that every existing job's service lands in the new table.

- [ ] **Step 4: Move `createWorkshopJob` and the readers to the new table** (`server/server.js`)

1. `createWorkshopJob`: parameter `serviceIds` replaces `serviceId`; remove `service_id, booked_price` and the `(SELECT price ...)` value from the job INSERT; after the job INSERT and before `syncJobHold`, add:

```js
    // One row per booked service, in the order chosen, each price copied in SQL
    // so it never passes through a JavaScript number (piece 7).
    for (const [position, serviceId] of (serviceIds ?? []).entries()) {
      await db.prepare(
        `INSERT INTO workshop_job_services (workshop_job_id, service_id, booked_price, position)
         VALUES (?, ?, (SELECT price FROM workshop_services WHERE id = ?), ?)`
      ).run(info.lastInsertRowid, serviceId, serviceId, position);
    }
```

2. Booking POST: pass `serviceIds: chosen.id ? [chosen.id] : []` instead of `serviceId`. Where the 201 reads `row.booked_price` for `bookedPrice`, read the position-0 row instead: `(await db.prepare('SELECT booked_price FROM workshop_job_services WHERE workshop_job_id = ? ORDER BY position LIMIT 1').get(jobId))?.booked_price ?? null` — keep it before `saveBookingPhotos` (that must stay the last write).
3. `/booking-links/:code`: replace `w.booked_price` and the `LEFT JOIN workshop_services s ON s.id = w.service_id` with a lateral/subquery on the position-0 row: `(SELECT s.name FROM workshop_job_services js JOIN workshop_services s ON s.id = js.service_id WHERE js.workshop_job_id = w.id ORDER BY js.position LIMIT 1) AS service_name` and the same for `js.booked_price AS booked_price`.
4. `grep -n "service_id\|booked_price" server/*.js` — every remaining use must be of `workshop_job_services` or of sale items (`sale_items`, `sale_document_items` keep their own `service_id`).
5. `tests/migration-026.test.js` asserts the old columns exist; they no longer do. Replace its column tests with one test stating that 030 superseded them: `assert.equal(await column('workshop_jobs', 'service_id'), undefined)` is already in 030's test, so reduce 026's file to a comment pointing at 030 and a single passing check that `workshop_job_services.booked_price` is `numeric(10,2)` — or delete only its now-impossible assertions and keep the file. Do not delete the file.

- [ ] **Step 5: Run and see it pass**

Run: `npm run migrate && node --test tests/migration-030.test.js tests/migration-026.test.js tests/portal-booking-request.test.js tests/portal-booked-price.test.js tests/portal-booking-link.test.js tests/portal-booking-answers.test.js`
Expected: all pass. Existing booking tests pass unchanged apart from any that queried `workshop_jobs.service_id`/`booked_price` directly (e.g. `portal-booking-request.test.js`'s `priced()` helper) — point those at `workshop_job_services` (position 0) and say which you changed.

- [ ] **Step 6: Break step.** In the migration, change `WHERE service_id IS NOT NULL` to `WHERE false`; this cannot be re-run on an already-migrated DB, so instead break `createWorkshopJob`: change `for (const [position, serviceId] of (serviceIds ?? []).entries())` to `for (const [position, serviceId] of [].entries())`, confirm with grep, run `node --test tests/portal-booked-price.test.js`: price tests fail (no row, `bookedPrice` null). Restore; re-run: pass.

- [ ] **Step 7: Full suite, RLS check, second migrate, commit**

```bash
npm test && node scripts/ci/assert-rls-coverage.mjs && npm run migrate
```

The second `npm run migrate` must print no `Applied migration:` line.

```bash
git add server/migrations/030_job_services.sql server/server.js tests
git commit -m "feat: a booking's services live in their own table (migration 030)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Book several services

**Files:** modify `server/booking-request.js`, `tests/booking-request.test.js`, `server/server.js` (booking POST); create `tests/portal-booking-multi.test.js`; update existing tests that send `serviceId`.

**Interfaces:**
- Consumes: `createWorkshopJob({ serviceIds })` (Task 1).
- Produces: `parseBookingRequest` returns `value.serviceIds: number[]` (empty for not sure) instead of `serviceId`; the POST accepts `serviceIds` and answers `{ serviceId, questionId, ... }`.

- [ ] **Step 1: Write the failing tests**

`tests/booking-request.test.js` — replace the single-id cases with (keep the file's `parse` helper and existing channel/terms tests):

```js
test('a list of services is kept in order', () => {
  const r = parseBookingRequest({ serviceIds: [7, 3], email: 'a@example.com', updateChannel: 'email', termsAccepted: true }, '');
  assert.deepEqual(r.value.serviceIds, [7, 3]);
  assert.equal(r.value.notSure, false);
});

test('not sure has no services', () => {
  const r = parseBookingRequest({ notSure: true, email: 'a@example.com', updateChannel: 'email', termsAccepted: true }, '');
  assert.deepEqual(r.value.serviceIds, []);
  assert.equal(r.value.notSure, true);
});

test('service list refusals', () => {
  const base = { email: 'a@example.com', updateChannel: 'email', termsAccepted: true };
  const err = (extra) => parseBookingRequest({ ...base, ...extra }, '').error;
  assert.equal(err({}), 'Please choose a service, or "not sure"');
  assert.equal(err({ serviceId: 7 }), 'Please choose a service, or "not sure"');
  assert.equal(err({ serviceIds: [7], notSure: true }), 'Choose services, or "not sure" - not both');
  assert.equal(err({ serviceIds: [] }), 'That service is not available to book');
  assert.equal(err({ serviceIds: 7 }), 'That service is not available to book');
  assert.equal(err({ serviceIds: [7, 'x'] }), 'That service is not available to book');
  assert.equal(err({ serviceIds: [0] }), 'That service is not available to book');
  assert.equal(err({ serviceIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }), 'Please choose up to 10 services');
  assert.equal(err({ serviceIds: [4, 4] }), 'Each service can be chosen only once');
});
```

`tests/portal-booking-multi.test.js` (new; signed-in `book()` like `tests/portal-booked-price.test.js`, services created by direct insert under `runWithShop` with `bookable_online = 1, active = 1`):

```js
// Several services in one booking.
// Spec: docs/superpowers/specs/2026-09-26-book-server-7-multiple-services-design.md
// (setup as tests/portal-booked-price.test.js: live server, owner, mechanic
// `sam`, signed-in `customer`, `nextDate`, and a `book(body)` that POSTs with
// mechanicId, jobDate, startTime '09:00', description, newBike, BOOKING_CONTACT
// and returns the raw response.)

const svc = (name, price, minutes, questions = []) => runWithShop(owner.shop.id, async () =>
  (await prepare(
    "INSERT INTO workshop_services (name, price, minutes, questions, bookable_online, active, updated_at) VALUES (?, ?, ?, CAST(? AS jsonb), 1, 1, now())"
  ).run(name, price, minutes, JSON.stringify(questions))).lastInsertRowid);

const rows = (jobId) => runWithShop(owner.shop.id, () => prepare(
  'SELECT service_id, booked_price::text AS price, position FROM workshop_job_services WHERE workshop_job_id = ? ORDER BY position'
).all(jobId));
const job = (jobId) => runWithShop(owner.shop.id, () => prepare(
  'SELECT title, planned_minutes, start_time, end_time, question_answers FROM workshop_jobs WHERE id = ?').get(jobId));

test('two services: both saved in order with their prices, time summed, names in the title', async () => {
  const bleed = await svc('Brake bleed', '35.00', 45);
  const truing = await svc('Wheel true', '25.00', 30);
  const res = await book({ serviceIds: [bleed, truing] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(await rows(res.body.id), [
    { service_id: bleed, price: '35.00', position: 0 },
    { service_id: truing, price: '25.00', position: 1 },
  ]);
  const j = await job(res.body.id);
  assert.equal(j.planned_minutes, 75);
  assert.equal(j.end_time, '10:15');
  assert.match(j.title, /^Online booking: Brake bleed \+ Wheel true - /);
});

test('more than 12 hours of work is refused and nothing is saved', async () => {
  const long = await svc('Rebuild', '300.00', 400);
  const longer = await svc('Respray', '300.00', 400);
  const res = await book({ serviceIds: [long, longer] });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "That's too much work for one visit - please book the jobs separately");
});

test('a service that is not bookable anywhere in the list refuses the booking', async () => {
  const ok = await svc('Fine', '10.00', 30);
  const hidden = await runWithShop(owner.shop.id, async () => (await prepare(
    "INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES ('Staff only', 10, 30, 0, 1, now())").run()).lastInsertRowid);
  const res = await book({ serviceIds: [ok, hidden] });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'That service is not available to book');
});

test('each service\'s required questions are enforced, and answers carry their service', async () => {
  const q = (id, wording) => ({ id, wording, kind: 'text', required: true });
  const a = await svc('A', '10.00', 30, [q('q_aaaaaaaaaaaa', 'Which wheel?')]);
  const b = await svc('B', '10.00', 30, [q('q_bbbbbbbbbbbb', 'Which brake?')]);
  const missing = await book({ serviceIds: [a, b], answers: [{ serviceId: a, questionId: 'q_aaaaaaaaaaaa', text: 'Front' }] });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error, 'Please answer: Which brake?');
  const ok = await book({ serviceIds: [a, b], answers: [
    { serviceId: a, questionId: 'q_aaaaaaaaaaaa', text: 'Front' },
    { serviceId: b, questionId: 'q_bbbbbbbbbbbb', text: 'Rear' },
  ] });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  const saved = (await job(ok.body.id)).question_answers;
  assert.deepEqual(saved.map((x) => [x.serviceId, x.id, x.answer]), [[a, 'q_aaaaaaaaaaaa', 'Front'], [b, 'q_bbbbbbbbbbbb', 'Rear']]);
});

test('an answer for a service that was not chosen is refused', async () => {
  const a = await svc('Solo', '10.00', 30);
  const res = await book({ serviceIds: [a], answers: [{ serviceId: a + 99999, questionId: 'q_cccccccccccc', text: 'x' }] });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "Those answers don't match the services chosen");
});
```

Question ids must match `server/service-questions.js`'s format (`q_` + 12 hex); if the service table stores questions differently (normalised on save), create the services through the staff route `POST /api/workshop-services` instead, as `tests/portal-booking-answers.test.js` does, and read the ids back.

- [ ] **Step 2: Run and watch them fail** — `node --test tests/booking-request.test.js tests/portal-booking-multi.test.js`.

- [ ] **Step 3: Implement the parser** — in `server/booking-request.js` replace the service lines with:

```js
  const notSure = body.notSure === true;
  const hasServices = body.serviceIds !== undefined && body.serviceIds !== null;
  if (notSure && hasServices) return { error: 'Choose services, or "not sure" - not both' };
  if (!notSure && !hasServices) return { error: 'Please choose a service, or "not sure"' };
  if (hasServices) {
    const ids = body.serviceIds;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => Number.isInteger(id) && id > 0)) {
      return { error: 'That service is not available to book' };
    }
    if (ids.length > MAX_SERVICES) return { error: 'Please choose up to 10 services' };
    if (new Set(ids).size !== ids.length) return { error: 'Each service can be chosen only once' };
  }
```

with `export const MAX_SERVICES = 10;` near `UPDATE_CHANNELS`, and `serviceIds: hasServices ? [...body.serviceIds] : []` in the returned value (replacing `serviceId`). Update the file's header comment line to mention several services (piece 7 spec).

- [ ] **Step 4: Implement the route** (`server/server.js`, booking POST)

- Load all chosen services in one query, keeping the customer's order:

```js
  let chosen; // [{ id, name, minutes, questions }] in the order chosen
  if (request.notSure) {
    chosen = [];
  } else {
    const found = await db
      .prepare('SELECT id, name, minutes, questions FROM workshop_services WHERE id = ANY(?) AND active = 1 AND bookable_online = 1')
      .all(request.serviceIds);
    if (found.length !== request.serviceIds.length) return badRequest(res, 'That service is not available to book');
    const byId = new Map(found.map((s) => [s.id, s]));
    chosen = request.serviceIds.map((id) => byId.get(id));
  }
  const minutes = request.notSure ? 60 : chosen.reduce((sum, s) => sum + s.minutes, 0);
  if (minutes > 720) return badRequest(res, "That's too much work for one visit - please book the jobs separately");
  const serviceNames = request.notSure ? 'Not sure' : chosen.map((s) => s.name).join(' + ');
```

  (Check how `db.prepare(...).all` passes an array to Postgres — if `= ANY(?)` with a JS array isn't supported by the `?`→`$n` layer in `server/db.js`, build `IN (?, ?, ...)` from the list length instead.)
- Answers: keep the not-sure refusal as is. Otherwise:

```js
    const list = body.answers === undefined || body.answers === null ? [] : body.answers;
    if (!Array.isArray(list)) return badRequest(res, 'Answers must be a list');
    const chosenIds = new Set(chosen.map((s) => s.id));
    if (list.some((a) => !chosenIds.has(a?.serviceId))) {
      return badRequest(res, "Those answers don't match the services chosen");
    }
    questionAnswers = [];
    for (const s of chosen) {
      const mine = list.filter((a) => a.serviceId === s.id).map(({ serviceId: _drop, ...rest }) => rest);
      const checked = checkAnswers(s.questions ?? [], mine);
      if (checked.error) return badRequest(res, checked.error);
      questionAnswers.push(...checked.value.map((x) => ({ serviceId: s.id, ...x })));
    }
```

- Replace every `chosen.minutes` with `minutes`, `chosen.name` in the title with `serviceNames`, and the `createWorkshopJob` argument with `serviceIds: request.serviceIds`, `plannedMinutes: minutes`.
- Update the comment above the service load to say several services (piece 7 spec).

- [ ] **Step 5: Update existing tests that send `serviceId`.** `grep -rln "serviceId:" tests/*.test.js` — in booking POST bodies change `serviceId: X` to `serviceIds: [X]`, and in answer lists add `serviceId: <that service>` to each answer. Also `serviceId: undefined, notSure: true` becomes `notSure: true` (drop the key). Change no assertion's meaning; list every file touched in the report.

- [ ] **Step 6: Run and see them pass** — `node --test tests/booking-request.test.js tests/portal-booking-multi.test.js` then `npm test`.

- [ ] **Step 7: Break steps**
  1. Parser: delete the duplicate check line; confirm with grep; run `tests/booking-request.test.js`: the refusals test fails on `[4, 4]`. Restore.
  2. Route: change `if (minutes > 720)` to `if (minutes > 7200)`; confirm with grep; run `tests/portal-booking-multi.test.js`: the 12-hour test fails. Restore.
  3. Route: change `.map((x) => ({ serviceId: s.id, ...x }))` to `.map((x) => ({ ...x }))`; confirm with grep; run: the answers test fails. Restore; re-run: pass.

- [ ] **Step 8: Commit**

```bash
git add server tests
git commit -m "feat: a customer booking can hold several services

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Replies list each service's price and the total

**Files:** modify `server/server.js` (`customerBookedPrice`, booking POST 201, `/booking-links/:code`), `tests/portal-booked-price.test.js`, `tests/portal-booking-link.test.js`, `tests/portal-booking-request.test.js`, `tests/portal-booking-multi.test.js`.

**Interfaces:**
- Consumes: `workshop_job_services` rows (Task 1), multi-service bookings (Task 2).
- Produces: `async function bookedServices(jobId): Promise<{ services: { name: string; price: number | null }[]; totalPrice: number | null }>` in `server/server.js`, used by both replies; replaces `customerBookedPrice`.

- [ ] **Step 1: Write the failing tests**

In `tests/portal-booking-multi.test.js` add (uses the `setShowPrices` helper pattern from `tests/portal-booked-price.test.js` and `codeOf`/`read` for the link):

```js
test('the reply and the link list each service with its price, and the total', async () => {
  await setShowPrices(true);
  const bleed = await svc('Brake bleed', '35.00', 45);
  const truing = await svc('Wheel true', '25.50', 30);
  const booked = await book({ serviceIds: [bleed, truing] });
  const expected = { services: [{ name: 'Brake bleed', price: 35 }, { name: 'Wheel true', price: 25.5 }], totalPrice: 60.5 };
  assert.deepEqual({ services: booked.body.services, totalPrice: booked.body.totalPrice }, expected);
  const link = await read(codeOf(booked.body.privateLink));
  assert.deepEqual({ services: link.body.services, totalPrice: link.body.totalPrice }, expected);
  assert.equal('bookedPrice' in booked.body, false);
  assert.equal('serviceName' in link.body, false);
});

test('with prices hidden, names show and every price is null', async () => {
  await setShowPrices(false);
  const a = await svc('Hidden A', '10.00', 30);
  const booked = await book({ serviceIds: [a] });
  assert.deepEqual(booked.body.services, [{ name: 'Hidden A', price: null }]);
  assert.equal(booked.body.totalPrice, null);
});

test('an unpriced service means no total', async () => {
  await setShowPrices(true);
  const priced = await svc('Priced', '10.00', 30);
  const free = await svc('Ask us', null, 30);
  const booked = await book({ serviceIds: [priced, free] });
  assert.deepEqual(booked.body.services, [{ name: 'Priced', price: 10 }, { name: 'Ask us', price: null }]);
  assert.equal(booked.body.totalPrice, null);
});

test('not sure has no services and no total', async () => {
  await setShowPrices(true);
  const booked = await book({ notSure: true });
  assert.deepEqual(booked.body.services, []);
  assert.equal(booked.body.totalPrice, null);
});
```

(If `workshop_services.price` is NOT NULL, create the unpriced case by setting the row's price to NULL only if the column allows it; if it doesn't, delete that test and note in the report that an unpriced service cannot exist, so the rule is unreachable — the code still keeps it.)

- [ ] **Step 2: Run and watch them fail** — `node --test tests/portal-booking-multi.test.js`.

- [ ] **Step 3: Implement** — replace `customerBookedPrice` with:

```js
// The booked services as a customer may see them: names always; prices and the
// total only when the shop shows prices online (the /services rule). The total
// is summed in SQL, and left out when any service had no price - a total that
// ignored one job would mislead. Runs inside the request's shop context.
// Spec: docs/superpowers/specs/2026-09-26-book-server-7-multiple-services-design.md
async function bookedServices(jobId) {
  const settings = await db.prepare('SELECT show_prices_online FROM workshop_settings LIMIT 1').get();
  const showPrices = settings?.show_prices_online === 1;
  const rows = await db.prepare(
    `SELECT s.name, js.booked_price FROM workshop_job_services js
     JOIN workshop_services s ON s.id = js.service_id
     WHERE js.workshop_job_id = ? ORDER BY js.position`
  ).all(jobId);
  const total = await db.prepare(
    `SELECT CASE WHEN count(*) > 0 AND count(booked_price) = count(*) THEN sum(booked_price) END AS total
     FROM workshop_job_services WHERE workshop_job_id = ?`
  ).get(jobId);
  return {
    services: rows.map((r) => ({ name: r.name, price: showPrices ? r.booked_price ?? null : null })),
    totalPrice: showPrices ? total?.total ?? null : null,
  };
}
```

- Booking POST: compute `const booked = await bookedServices(jobId);` where `bookedPrice` was computed (before `saveBookingPhotos`), and spread `...booked` into the 201 body in place of `bookedPrice`.
- `/booking-links/:code`: select `w.id` in the query, drop the position-0 `service_name`/`booked_price` subqueries from Task 1, and replace `serviceName` and `bookedPrice` in the reply with `...(await bookedServices(row.id))` — do not put `id` in the reply. Update the route's comment (price line) to name this spec.

- [ ] **Step 4: Update the existing reply tests**
  - `tests/portal-booked-price.test.js`: its cases become: prices shown → `services[0].price` equals the service price and `totalPrice` equals it; hidden → nulls; not sure → `[]`/null; setting read at link-open time → still true via `services[0].price`. Keep each test's name meaning; rename where `bookedPrice` is in the name.
  - `tests/portal-booking-link.test.js`: the exact-shape `deepEqual` gets `services: [{ name: 'Test service', price: null }], totalPrice: null` instead of `serviceName` and `bookedPrice`; the forbidden-key filter allows `services`/`totalPrice` instead of `serviceName`/`bookedPrice` (`services` contains `name` inside — the filter checks top-level keys only; keep it that way and note why), and still refuses anything else matching price/name/phone/email/notes. The "not-sure booking has no service name" test becomes "has no services".
  - `tests/portal-booking-request.test.js`: the "with prices hidden, the booking response carries no price" test asserts `totalPrice` null, every `services[].price` null, no other key matching /price/i, and no value anywhere equal to the service's price (search the JSON text).

- [ ] **Step 5: Run and see them pass** — `node --test tests/portal-booking-multi.test.js tests/portal-booked-price.test.js tests/portal-booking-link.test.js tests/portal-booking-request.test.js`.

- [ ] **Step 6: Break steps**
  1. In `bookedServices` change `count(booked_price) = count(*)` to `true`; confirm with grep; run the multi test: "an unpriced service means no total" fails (or, if that test was removed as unreachable, the total for two priced services still passes — then break `sum(booked_price)` to `max(booked_price)` instead and see the first reply test fail). Restore.
  2. Change `price: showPrices ? r.booked_price ?? null : null` to `price: r.booked_price ?? null`; confirm with grep; run: the hidden-prices test fails. Restore; re-run: pass.

- [ ] **Step 7: Full checks and commit**

```bash
npm run typecheck && npm run lint && npm test && node scripts/ci/assert-rls-coverage.mjs && npm run build && npm run test:browser
git add server tests
git commit -m "feat: booking replies list each service's price and the total

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Report exact counts.
