# Book server piece 8: what a full service includes - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full service stores an ordered list of the individual services it includes; the staff interface reads and writes it with the spec's rules, and the customer service list shows each full service's included services.

**Architecture:** A new shop-owned table `workshop_service_includes` (migration 031, row-level security like 030). `server/server.js` gains three small helpers beside the existing service helpers (`readIncludes`, `replaceIncludes`, `loadIncludes`) used by the `/api/workshop-services` routes, and one extra query in `GET /api/portal/:shopSlug/services`. No booking-route change.

**Tech Stack:** Node (plain `node:http` server, `server/server.js`), Postgres 16 via `pg` with the `prepare(...)` `?`-placeholder wrapper (`server/db.js`), tests with `node:test` against a real spawned server (`tests/helpers/liveServer.js`).

**Spec:** `docs/superpowers/specs/2026-09-26-book-server-8-service-includes-design.md`

## Global Constraints

- Branch `feat/book-server-8-service-includes`; never commit to `main`.
- Postgres must be running (compose, port 5433) or every server test hangs. Run one file with `node --test tests/<file>.test.js`; the whole suite is `npm test`.
- Create no files in the repo other than those this plan names. No scratch or debug files.
- Every new test is watched failing for the right reason before the code that passes it is written.
- Limits and wording, verbatim from the spec:
  - at most **50** included services per full service
  - "That service does not exist"
  - "<name> is not an individual service"
  - "A service can't be included twice"
  - "A full service can include at most 50 services"
  - "Only a full service can include other services"
  - "<name> is part of <full service name> - take it out of that first" (first such full service by name)
- Each new test file opens with a comment naming the spec, as neighbouring files do.
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No dependency, CI or screen changes.

## Files

- Create `server/migrations/031_service_includes.sql`: the table.
- Create `tests/migration-031.test.js`: the table's shape, isolation and checks.
- Modify `server/server.js`, "Workshop services" section (around lines 3950-4105): the serializer, the helpers and the four routes.
- Create `tests/service-includes-api.test.js`: the staff interface's rules.
- Modify `tests/workshopServices.test.js:60-75`: the serializer's expected shape gains `includes: []`.
- Modify `server/server.js`, `GET /api/portal/:shopSlug/services` (around lines 4472-4497).
- Modify `tests/portal-service-list.test.js`: added cases.
- Modify `tests/portal-booking-multi.test.js`: one added case.
- Modify `src/screens/book/services-query.ts`: the type.
- Modify `.agents/STATUS.md`: the piece 8 line.

---

### Task 1: Migration 031, the table

**Files:**
- Create: `server/migrations/031_service_includes.sql`
- Test: `tests/migration-031.test.js`

**Interfaces:**
- Produces: table `workshop_service_includes(id, shop_id, service_id, included_service_id, position)`. `service_id` is the full service and `included_service_id` the individual one. `UNIQUE(service_id, included_service_id)`, `CHECK (service_id <> included_service_id)`, both foreign keys `ON DELETE CASCADE`. Row-level security is enabled and forced. Migrations run automatically when the server starts (`server/migrations/run-migrations.js`), so starting the test server applies it.

- [ ] **Step 1: Write the failing test** `tests/migration-031.test.js`

```js
// Migration 031: which individual services a full service includes, one row
// per link, in the shop's order; each shop sees only its own links.
// Spec: docs/superpowers/specs/2026-09-26-book-server-8-service-includes-design.md
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

const column = async (name) => (await pool.query(
  `SELECT is_nullable FROM information_schema.columns
   WHERE table_name = 'workshop_service_includes' AND column_name = $1`, [name]
)).rows[0];

const svc = (name, kind) => prepare(
  'INSERT INTO workshop_services (name, price, minutes, kind, updated_at) VALUES (?, 10, 30, ?, now())'
).run(name, kind).then((r) => r.lastInsertRowid);
const link = (full, part, position = 0) => prepare(
  'INSERT INTO workshop_service_includes (service_id, included_service_id, position) VALUES (?, ?, ?)'
).run(full, part, position);

test('workshop_service_includes has the full service, the included one and the order, all required', async () => {
  for (const name of ['id', 'shop_id', 'service_id', 'included_service_id', 'position']) {
    const c = await column(name);
    assert.ok(c, `${name} missing`);
    assert.equal(c.is_nullable, 'NO', `${name} should be required`);
  }
});

test('row-level security is enabled and forced', async () => {
  const { rows: [t] } = await pool.query(
    "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'workshop_service_includes'");
  assert.equal(t.relrowsecurity, true);
  assert.equal(t.relforcerowsecurity, true);
});

test('another shop cannot see a shop\'s links', async () => {
  const other = await staffSignup(server.baseUrl);
  try {
    await runWithShop(owner.shop.id, async () => {
      await link(await svc('Iso full', 'full'), await svc('Iso part', 'individual'));
    });
    // A row must exist for the owner first - zero rows in an empty table
    // proves nothing about the policy.
    const own = await runWithShop(owner.shop.id, () => prepare(
      'SELECT count(*)::int AS n FROM workshop_service_includes WHERE shop_id = ?').get(owner.shop.id));
    assert.equal(own.n, 1);
    const seen = await runWithShop(other.shop.id, () => prepare(
      'SELECT count(*)::int AS n FROM workshop_service_includes WHERE shop_id = ?').get(owner.shop.id));
    assert.equal(seen.n, 0);
  } finally {
    await deleteTestShop(other.shop.id);
  }
});

test('a link to a service that does not exist is refused', async () => {
  await runWithShop(owner.shop.id, async () => {
    await assert.rejects(link(await svc('Fk full', 'full'), 2147483647), /foreign key/i);
  });
});

// Each expected refusal gets its own runWithShop: in 'transaction' scope mode
// a failed statement aborts the scope, and a second statement in it would
// fail for that reason instead of the one under test.
test('the same link twice, and a service including itself, are refused', async () => {
  const shop = (fn) => runWithShop(owner.shop.id, fn);
  const full = await shop(() => svc('Twice full', 'full'));
  const part = await shop(() => svc('Twice part', 'individual'));
  await shop(() => link(full, part, 0));
  await assert.rejects(shop(() => link(full, part, 1)), /unique|duplicate/i);
  await assert.rejects(shop(() => link(full, full, 2)), /check constraint/i);
});

test('links go when the service they belong to is deleted', async () => {
  await runWithShop(owner.shop.id, async () => {
    const full = await svc('Gone full', 'full');
    const part = await svc('Gone part', 'individual');
    await link(full, part);
    await prepare('DELETE FROM workshop_services WHERE id = ?').run(part);
    const left = await prepare('SELECT count(*)::int AS n FROM workshop_service_includes WHERE service_id = ?').get(full);
    assert.equal(left.n, 0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/migration-031.test.js`
Expected: FAIL. The first test fails with "id missing", and the others fail with `relation "workshop_service_includes" does not exist`.

- [ ] **Step 3: Write the migration** `server/migrations/031_service_includes.sql`

```sql
-- Which individual services a full service includes, in the shop's order
-- (server piece 8). The customer booking screen names them on the full
-- service's card and warns when both are ticked; booking both is still
-- allowed. No backfill: every shop starts with empty lists, and nothing is
-- dropped, so older code runs unchanged against this schema.
-- Spec: docs/superpowers/specs/2026-09-26-book-server-8-service-includes-design.md
CREATE TABLE workshop_service_includes (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  service_id INTEGER NOT NULL REFERENCES workshop_services(id) ON DELETE CASCADE,
  included_service_id INTEGER NOT NULL REFERENCES workshop_services(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  UNIQUE (service_id, included_service_id),
  CHECK (service_id <> included_service_id)
);
CREATE INDEX idx_workshop_service_includes_service ON workshop_service_includes(shop_id, service_id);
ALTER TABLE workshop_service_includes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_service_includes FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_service_includes_shop_isolation ON workshop_service_includes
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test tests/migration-031.test.js`
Expected: all 6 PASS.

Also run: `node scripts/ci/assert-rls-coverage.mjs`
Expected: exits 0 (the CI row-level-security check sees the new table as protected).

- [ ] **Step 5: Prove the isolation tests can fail.** Switch the protection off on the live test database, run the tests, then switch it back on:

```bash
node --input-type=module -e "import './server/load-env.js'; import {pool} from './server/db.js'; await pool.query('ALTER TABLE workshop_service_includes NO FORCE ROW LEVEL SECURITY'); await pool.query('ALTER TABLE workshop_service_includes DISABLE ROW LEVEL SECURITY'); console.log((await pool.query(\"SELECT relrowsecurity FROM pg_class WHERE relname='workshop_service_includes'\")).rows); await pool.end();"
node --test tests/migration-031.test.js
```

Expected: the printout shows `relrowsecurity: false`, which proves the mutation landed. "row-level security is enabled and forced" and "another shop cannot see" FAIL. Then restore it and re-run:

```bash
node --input-type=module -e "import './server/load-env.js'; import {pool} from './server/db.js'; await pool.query('ALTER TABLE workshop_service_includes ENABLE ROW LEVEL SECURITY'); await pool.query('ALTER TABLE workshop_service_includes FORCE ROW LEVEL SECURITY'); await pool.end();"
node --test tests/migration-031.test.js
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add server/migrations/031_service_includes.sql tests/migration-031.test.js
git commit -m "feat: migration 031 - a full service's included services

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The staff interface reads and writes `includes`

**Files:**
- Modify: `server/server.js`, the "Workshop services" section: `serializeWorkshopService` (~3953), after `readQuestionsOrKeep` (~4029), and the routes GET (~4037), POST (~4043), PUT (~4065)
- Modify: `tests/workshopServices.test.js:60-75`
- Test: `tests/service-includes-api.test.js`

**Interfaces:**
- Consumes: the table from Task 1.
- Produces:
  - `serializeWorkshopService(row, includes = [])`, which adds `includes: number[]` to the returned object
  - every `/api/workshop-services` reply carries `includes`
  - `POST` and `PUT` accept `includes: number[]`
  - Task 3 does not call these helpers; they are internal to the file.

- [ ] **Step 1: Write the failing test** `tests/service-includes-api.test.js`

```js
// What a full service includes, through the staff interface: kept in order,
// kept when a save leaves it out, and refused when it breaks a rule.
// Spec: docs/superpowers/specs/2026-09-26-book-server-8-service-includes-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  other = await staffSignup(server.baseUrl);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

const as = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const create = (body, who = owner) =>
  as(who, '/api/workshop-services', { method: 'POST', body: { price: 10, minutes: 30, ...body } });
const made = async (body, who = owner) => {
  const res = await create(body, who);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
};
const put = (id, body) => as(owner, `/api/workshop-services/${id}`, { method: 'PUT', body });
const listed = async (id) =>
  (await as(owner, '/api/workshop-services')).body.find((s) => s.id === id);

test('a full service keeps its included services in the order given', async () => {
  const brake = await made({ name: 'Brake service' });
  const gear = await made({ name: 'Gear service' });
  const full = await made({ name: 'General service', kind: 'full', includes: [gear.id, brake.id] });
  assert.deepEqual(full.includes, [gear.id, brake.id]);
  assert.deepEqual((await listed(full.id)).includes, [gear.id, brake.id]);
});

test('a service created without includes has an empty list, individual ones too', async () => {
  const full = await made({ name: 'Plain full', kind: 'full' });
  const part = await made({ name: 'Plain part' });
  assert.deepEqual(full.includes, []);
  assert.deepEqual(part.includes, []);
  assert.deepEqual((await listed(part.id)).includes, []);
});

test('a save that leaves includes out keeps the list; one that sends it replaces it', async () => {
  const a = await made({ name: 'Keep A' });
  const b = await made({ name: 'Keep B' });
  const full = await made({ name: 'Keep full', kind: 'full', includes: [a.id] });
  let res = await put(full.id, { name: 'Keep full renamed', price: 12 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.includes, [a.id]);
  res = await put(full.id, { name: 'Keep full renamed', price: 12, includes: [b.id, a.id] });
  assert.deepEqual(res.body.includes, [b.id, a.id]);
  res = await put(full.id, { name: 'Keep full renamed', price: 12, includes: [] });
  assert.deepEqual(res.body.includes, []);
});

test('each broken rule is refused with its message and nothing changes', async () => {
  const part = await made({ name: 'Rule part' });
  const otherFull = await made({ name: 'Rule other full', kind: 'full' });
  const foreign = await made({ name: 'Other shop part' }, other);
  const full = await made({ name: 'Rule full', kind: 'full', includes: [part.id] });
  const many = [];
  for (let i = 0; i < 51; i++) many.push((await made({ name: `Many ${i}` })).id);
  const cases = [
    [{ includes: 'nope' }, 'That service does not exist'],
    [{ includes: [1.5] }, 'That service does not exist'],
    [{ includes: [2147483647] }, 'That service does not exist'],
    [{ includes: [foreign.id] }, 'That service does not exist'],
    [{ includes: [otherFull.id] }, 'Rule other full is not an individual service'],
    [{ includes: [full.id] }, 'Rule full is not an individual service'],
    [{ includes: [part.id, part.id] }, "A service can't be included twice"],
    [{ includes: many }, 'A full service can include at most 50 services'],
  ];
  for (const [body, message] of cases) {
    const res = await put(full.id, { name: 'Rule full', price: 10, ...body });
    assert.equal(res.status, 400, `${JSON.stringify(body).slice(0, 60)} -> ${res.status}`);
    assert.equal(res.body.error, message);
  }
  assert.deepEqual((await listed(full.id)).includes, [part.id]);
  const onCreate = await create({ name: 'Bad new', kind: 'full', includes: [otherFull.id] });
  assert.equal(onCreate.status, 400);
  assert.equal(onCreate.body.error, 'Rule other full is not an individual service');
});

test('exactly 50 is allowed', async () => {
  const fifty = [];
  for (let i = 0; i < 50; i++) fifty.push((await made({ name: `Fifty ${i}` })).id);
  const full = await made({ name: 'Fifty full', kind: 'full', includes: fifty });
  assert.equal(full.includes.length, 50);
});

test('an individual service cannot include anything', async () => {
  const part = await made({ name: 'Solo part' });
  const res = await create({ name: 'Solo individual', includes: [part.id] });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Only a full service can include other services');
});

test('changing a full service to individual clears its list', async () => {
  const part = await made({ name: 'Demote part' });
  const full = await made({ name: 'Demote full', kind: 'full', includes: [part.id] });
  const res = await put(full.id, { name: 'Demote full', price: 10, kind: 'individual' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.includes, []);
  const back = await put(full.id, { name: 'Demote full', price: 10, kind: 'full' });
  assert.deepEqual(back.body.includes, [], 'the old list came back');
});

test('an individual service that is included cannot become full until taken out', async () => {
  const part = await made({ name: 'Brake check' });
  await made({ name: 'Zeta service', kind: 'full', includes: [part.id] });
  const alpha = await made({ name: 'Alpha service', kind: 'full', includes: [part.id] });
  let res = await put(part.id, { name: 'Brake check', price: 10, kind: 'full' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Brake check is part of Alpha service - take it out of that first');
  assert.equal((await listed(part.id)).kind, 'individual');
  await put(alpha.id, { name: 'Alpha service', price: 10, includes: [] });
  res = await put(part.id, { name: 'Brake check', price: 10, kind: 'full' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Brake check is part of Zeta service - take it out of that first');
});

test('a removed service stays in the staff list', async () => {
  const part = await made({ name: 'Retired part' });
  const full = await made({ name: 'Retired full', kind: 'full', includes: [part.id] });
  await as(owner, `/api/workshop-services/${part.id}`, { method: 'DELETE' });
  assert.deepEqual((await listed(full.id)).includes, [part.id]);
});
```

- [ ] **Step 2: Update the serializer's unit test** in `tests/workshopServices.test.js`. In the expected object of `'serializeWorkshopService converts a row to camelCase with active as a boolean'`, add `includes: []` after `questions: []`. Then add a second assertion right after the first:

```js
  assert.deepEqual(serializeWorkshopService(row, [3, 1]).includes, [3, 1]);
```

- [ ] **Step 3: Run both and watch them fail**

Run: `node --test tests/service-includes-api.test.js tests/workshopServices.test.js`
Expected: FAIL. Replies have no `includes` field, so `deepEqual` fails with `undefined` vs `[]`. The refusal cases get 201/200 instead of 400. The serializer test fails on the missing `includes`.

- [ ] **Step 4: Implement.** In `server/server.js`:

(a) `serializeWorkshopService`: change the signature to `export function serializeWorkshopService(row, includes = [])` and add after `questions`:

```js
    // Ordered ids of the individual services a full service includes,
    // removed ones too (a future staff screen marks them). Always [] for an
    // individual service. See migration 031.
    includes,
```

(b) After `readQuestionsOrKeep`, add:

```js
const MAX_INCLUDES = 50;

// A full service's included services, saved as one whole ordered list.
// `kind` is the service's kind after this save; `stored` the saved ids (null
// on POST). Omitted keeps the stored list, as questions and placement do, so
// a caller that predates the field cannot wipe it - except that an
// individual service never includes anything. Each id is looked up through
// the shop-scoped db: the foreign key alone bypasses row-level security and
// would accept another shop's service.
async function readIncludes(body, kind, stored) {
  if (body.includes === undefined) return kind === 'full' ? (stored ?? []) : [];
  const ids = body.includes;
  if (!Array.isArray(ids)) throw new ValidationError('That service does not exist');
  if (kind !== 'full') {
    if (ids.length > 0) throw new ValidationError('Only a full service can include other services');
    return [];
  }
  if (ids.length > MAX_INCLUDES) throw new ValidationError(`A full service can include at most ${MAX_INCLUDES} services`);
  if (new Set(ids).size !== ids.length) throw new ValidationError("A service can't be included twice");
  for (const id of ids) {
    const found = Number.isInteger(id) && id >= 1 && id <= MAX_SERIAL
      ? await db.prepare('SELECT name, kind FROM workshop_services WHERE id = ?').get(id)
      : null;
    if (!found) throw new ValidationError('That service does not exist');
    if (found.kind !== 'individual') throw new ValidationError(`${found.name} is not an individual service`);
  }
  return ids;
}

// Replaces a service's list whole. Callers run it inside their transaction.
async function replaceIncludes(serviceId, ids) {
  await db.prepare('DELETE FROM workshop_service_includes WHERE service_id = ?').run(serviceId);
  for (const [position, id] of ids.entries()) {
    await db.prepare(
      'INSERT INTO workshop_service_includes (service_id, included_service_id, position) VALUES (?, ?, ?)'
    ).run(serviceId, id, position);
  }
}

// Ordered included ids for every service that has any, as Map<serviceId, id[]>.
async function loadIncludes() {
  const rows = await db.prepare(
    'SELECT service_id, included_service_id FROM workshop_service_includes ORDER BY service_id, position'
  ).all();
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.service_id)) map.set(r.service_id, []);
    map.get(r.service_id).push(r.included_service_id);
  }
  return map;
}
```

(c) GET route: replace the `sendJson` line with

```js
  const includes = await loadIncludes();
  sendJson(res, 200, rows.map((r) => serializeWorkshopService(r, includes.get(r.id) ?? [])));
```

(d) POST route: inside the existing `try`, after `questions = ...`, add `includes = await readIncludes(body, placement.kind, null);` and declare `let includes;` with the others. Wrap the INSERT and the list write in a transaction, and reply with the list:

```js
  await db.exec('BEGIN');
  let info;
  try {
    info = await db.prepare(
      'INSERT INTO workshop_services (name, price, minutes, bookable_online, kind, category_id, position, questions) VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb))'
    ).run(fields.name, fields.price, fields.minutes, bookableOnline, placement.kind, placement.categoryId, placement.position, JSON.stringify(questions));
    await replaceIncludes(info.lastInsertRowid, includes);
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
  const row = await db.prepare('SELECT * FROM workshop_services WHERE id = ?').get(info.lastInsertRowid);
  sendJson(res, 201, serializeWorkshopService(row, includes));
```

(e) PUT route: declare `let includes;`. Inside the existing `try`, after `questions = ...`, add:

```js
    const stored = (await loadIncludes()).get(id) ?? [];
    includes = await readIncludes(body, placement.kind, stored);
    if (existing.kind === 'individual' && placement.kind === 'full') {
      const holder = await db.prepare(
        `SELECT f.name FROM workshop_service_includes i JOIN workshop_services f ON f.id = i.service_id
         WHERE i.included_service_id = ? ORDER BY f.name LIMIT 1`
      ).get(id);
      if (holder) throw new ValidationError(`${fields.name} is part of ${holder.name} - take it out of that first`);
    }
```

Then wrap the existing UPDATE plus `await replaceIncludes(id, includes);` in the same `BEGIN` / `COMMIT` / `ROLLBACK`-and-rethrow block as POST. End with `sendJson(res, 200, serializeWorkshopService(row, includes));`.

- [ ] **Step 5: Run and watch them pass**

Run: `node --test tests/service-includes-api.test.js tests/workshopServices.test.js tests/workshopServicesApi.test.js tests/workshop-service-placement.test.js tests/service-questions-api.test.js`
Expected: all PASS. The last three are the existing service tests, which must not break.

- [ ] **Step 6: Prove two tests bite.**
  1. Change `if (body.includes === undefined) return kind === 'full' ? (stored ?? []) : [];` to `return []` for the undefined case. "a save that leaves includes out keeps the list" must FAIL.
  2. Delete the `holder` refusal block. "cannot become full until taken out" must FAIL.

  Confirm each mutation shows in `git diff` before running, restore each, and re-run to PASS.

- [ ] **Step 7: Commit**

```bash
git add server/server.js tests/service-includes-api.test.js tests/workshopServices.test.js
git commit -m "feat: staff interface saves what a full service includes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The customer service list shows what each full service includes

**Files:**
- Modify: `server/server.js`, `GET /api/portal/:shopSlug/services` (~4472-4497)
- Modify: `src/screens/book/services-query.ts`
- Test: `tests/portal-service-list.test.js` (append), `tests/portal-booking-multi.test.js` (append)

**Interfaces:**
- Consumes: the table (Task 1) and `includes` on `POST /api/workshop-services` (Task 2), used to set up tests.
- Produces:
  - each item of `full` in the customer reply gains `includes: { id: number; name: string }[]` (active included services only, whether bookable online or not, in order)
  - `categories[].services` and `uncategorised` items do not gain the field
  - `PortalFullService` in `services-query.ts`, used by d2

- [ ] **Step 1: Write the failing tests.** Append to `tests/portal-service-list.test.js`, which already has `as`, `service`, `publicList`:

```js
test('a full service lists what it includes, in order, including ones not bookable online on their own', async () => {
  const brake = await service(shopA, { name: 'Inc brake' });
  const headset = await service(shopA, { name: 'Inc headset', bookableOnline: false });
  const gone = await service(shopA, { name: 'Inc retired' });
  const full = await service(shopA, { name: 'Inc general', kind: 'full', includes: [headset.id, gone.id, brake.id] });
  assert.deepEqual(full.includes, [headset.id, gone.id, brake.id], JSON.stringify(full));
  await as(shopA, `/api/workshop-services/${gone.id}`, { method: 'DELETE' });

  const res = await publicList(shopA);
  const listed = res.body.full.find((s) => s.id === full.id);
  assert.deepEqual(listed.includes, [
    { id: headset.id, name: 'Inc headset' },
    { id: brake.id, name: 'Inc brake' },
  ]);
});

test('every full service carries includes; individual services do not', async () => {
  await service(shopA, { name: 'Bare full', kind: 'full' });
  const res = await publicList(shopA);
  assert.ok(res.body.full.every((s) => Array.isArray(s.includes)), 'a full service has no includes list');
  const individual = [...res.body.uncategorised, ...res.body.categories.flatMap((c) => c.services)];
  assert.ok(individual.length > 0);
  assert.ok(individual.every((s) => !('includes' in s)), 'an individual service carries includes');
});
```

Append to `tests/portal-booking-multi.test.js`, which already has `svc`, `book`, `rows`, `runWithShop`, `prepare`:

```js
test('a full service and a service it includes can still be booked together', async () => {
  const part = await svc('Included brake', '25.00', 30);
  const full = await runWithShop(owner.shop.id, async () => (await prepare(
    "INSERT INTO workshop_services (name, price, minutes, kind, bookable_online, active, updated_at) VALUES ('Full with brake', '80.00', 90, 'full', 1, 1, now())"
  ).run()).lastInsertRowid);
  await runWithShop(owner.shop.id, () => prepare(
    'INSERT INTO workshop_service_includes (service_id, included_service_id, position) VALUES (?, ?, 0)'
  ).run(full, part));
  const res = await book({ serviceIds: [full, part] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual((await rows(res.body.id)).map((r) => r.service_id), [full, part]);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/portal-service-list.test.js tests/portal-booking-multi.test.js`
Expected: the two service-list tests FAIL because `listed.includes` is `undefined`. The booking test PASSES straight away. It guards the spec's rule that booking gains no new rule, so there is no code for it to fail against. To prove it bites, temporarily add a refusal to the booking route in `server/server.js`, right after the line `chosen = request.serviceIds.map((id) => byId.get(id));` (~4678):

```js
    if (await db.prepare('SELECT 1 FROM workshop_service_includes WHERE service_id = ANY(?::int[]) AND included_service_id = ANY(?::int[])').get(request.serviceIds, request.serviceIds)) return badRequest(res, 'MUTATION');
```

Confirm it shows in `git diff`. Run `node --test tests/portal-booking-multi.test.js`: the new test must FAIL with 400 "MUTATION". Delete the line, then confirm `git diff server/server.js` is empty again.

- [ ] **Step 3: Implement.** In the customer route, after the `categories` query:

```js
  // What each full service includes, for its card and for d2's "already part
  // of your <full service>" warning: services still in use, bookable online
  // or not (piece 8 decision 4), in the shop's order.
  const links = await db.prepare(
    `SELECT i.service_id, s.id, s.name FROM workshop_service_includes i
     JOIN workshop_services s ON s.id = i.included_service_id
     WHERE s.active = 1 ORDER BY i.service_id, i.position`
  ).all();
  const includesOf = (id) => links.filter((l) => l.service_id === id).map((l) => ({ id: l.id, name: l.name }));
```

and change the `full:` line to

```js
    full: services.filter((s) => s.kind === 'full').map((s) => ({ ...toPublic(s), includes: includesOf(s.id) })),
```

Add `// Piece 8: docs/superpowers/specs/2026-09-26-book-server-8-service-includes-design.md` to the route's comment block.

In `src/screens/book/services-query.ts`, add after `PortalService`:

```ts
/** A full service also names the services it includes (server piece 8). */
export type PortalFullService = PortalService & { includes: { id: number; name: string }[] };
```

and change `full: PortalService[];` to `full: PortalFullService[];`.

- [ ] **Step 4: Run and watch them pass**

Run: `node --test tests/portal-service-list.test.js tests/portal-booking-multi.test.js`
Expected: all PASS.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Prove the service-list test bites.** Remove `WHERE s.active = 1` and confirm the first new test FAILS on the retired service. Restore it and re-run to PASS.

- [ ] **Step 6: Commit**

```bash
git add server/server.js src/screens/book/services-query.ts tests/portal-service-list.test.js tests/portal-booking-multi.test.js
git commit -m "feat: customer service list shows what each full service includes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Whole-suite check and STATUS

**Files:**
- Modify: `.agents/STATUS.md`

- [ ] **Step 1: Run everything CI runs locally**

Run: `npm test`
Expected: every test passes; report the pass/fail counts.

Run: `npm run typecheck`, `npm run lint`, `npm run build`, `node scripts/ci/assert-rls-coverage.mjs` and `node scripts/ci/assert-screen-trace.mjs`
Expected: each exits 0.

- [ ] **Step 2: Update STATUS.** Replace the piece 8 sentence in the book-journey paragraph with:
  - piece 8's state: the branch name and PR number once opened
  - the contract, in one line: the staff `includes: number[]` (omitted on PUT keeps), and the customer `full[].includes: [{id, name}]` (active only)
  - "no staff screen sets it yet; screens 65-66 are a later piece"
  - for d2: use `PortalFullService.includes` for the "Includes …" line and the warning with its "Remove <name>" link

- [ ] **Step 3: Commit**

```bash
git add .agents/STATUS.md
git commit -m "docs: STATUS - piece 8

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
