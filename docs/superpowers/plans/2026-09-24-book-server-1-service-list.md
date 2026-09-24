# Book server piece 1: public service list - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shops can sort their services into one level of categories and mark each one full or individual, and the customer booking page can fetch a shop's bookable services, grouped that way, from one public address.

**Architecture:** One migration adds a categories table and three columns on `workshop_services`. Staff routes in `server/server.js` gain category create/read/update/delete, and the existing service routes accept the new fields. A new anonymous portal route reads the list inside the shop's row-level security context. Every route names its atlas screens, and the screen-trace check is widened to enforce that.

**Tech Stack:** Node 22 ESM, the plain `http` server in `server/server.js`, PostgreSQL 16 through `pg` (the only runtime dependency), `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-24-book-server-1-service-list-design.md` (approved by Jack, 24 Sep). Read it before starting.

## Global Constraints

- No new dependencies. `pg` stays the only runtime dependency.
- Money is never totalled in JavaScript. Prices pass through as stored (`NUMERIC(10,2)`, which `server/db.js:37` parses to a JS number).
- Every shop-scoped table: `shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id)`, ENABLE and FORCE row-level security, and a `<table>_shop_isolation` policy (pattern: `server/migrations/018_capacity_holds.sql`).
- A foreign key check bypasses row-level security, so any id a request supplies for another table is looked up through the shop-scoped `db` first.
- Categories are one level deep. Full services carry no category (stored `NULL`).
- On PUT, an omitted field keeps its stored value.
- Every covered route has a `// screens: a, b` comment on the lines directly above it, with no blank line between.
- Tests that boot a server or touch the database start with `import '../server/load-env.js';`. Tests use `startLiveServer` (`tests/helpers/liveServer.js`), `staffSignup`/`staffRequest` (`tests/helpers/staff.js`), `jsonRequest` (`tests/helpers/http.js`) and `deleteTestShop` (`tests/helpers/testShop.js`).
- The local database needs `npm run docker:up`, and `npm run migrate` after a new migration file, before tests run.
- This shell is zsh, where `PIPESTATUS` is empty. Capture exit codes by redirecting output to a file and echoing `$?` on the next line.
- `npm run build` and `npm run test:browser` write hashed files into `public/dist`. The folder is gitignored and untracked, so they need no cleanup.
- The spec lists one test file. This plan splits it into three, one per task, so each task carries its own test cycle.

---

### Task 1: Migration and staff category routes

**Files:**
- Create: `server/migrations/022_service_categories.sql`
- Modify: `server/server.js`, adding a new section directly above the line `// ---------- Workshop services (the fixed-price labour catalogue) ----------`
- Test: `tests/workshop-service-categories.test.js`

**Interfaces:**
- Produces: table `workshop_service_categories(id, shop_id, name, position, created_at, updated_at)`; columns `workshop_services.kind`, `.category_id`, `.position`; routes `GET/POST /api/workshop-service-categories`, `PUT/DELETE /api/workshop-service-categories/:id`; JSON category shape `{ id: number, name: string, position: number }`.

- [ ] **Step 1: Write the migration**

`server/migrations/022_service_categories.sql`:

```sql
-- Shop-defined service categories, one level deep (Jack, 24 Sep): a category
-- holds individual services and never other categories. Full services (whole-
-- bike services a customer picks from a short list) carry no category.
-- Spec: docs/superpowers/specs/2026-09-24-book-server-1-service-list-design.md

CREATE TABLE workshop_service_categories (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workshop_service_categories_shop ON workshop_service_categories(shop_id, position);
ALTER TABLE workshop_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_service_categories FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_service_categories_shop_isolation ON workshop_service_categories
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Existing services become 'individual' with no category: the list a customer
-- sees is unchanged until the shop sorts it.
-- ON DELETE SET NULL: deleting a category moves its services to "Other"; it
-- never deletes a service, which job lines may still point at.
ALTER TABLE workshop_services
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'individual' CHECK (kind IN ('full', 'individual')),
  ADD COLUMN category_id INTEGER REFERENCES workshop_service_categories(id) ON DELETE SET NULL,
  ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Apply it locally and confirm it is recorded**

Run:
```bash
npm run docker:up > /tmp/up.log 2>&1; echo "up $?"
npm run migrate > /tmp/migrate.log 2>&1; echo "migrate $?"; grep "022" /tmp/migrate.log
npm run migrate > /tmp/migrate2.log 2>&1; echo "migrate2 $?"; grep -c "Applied migration" /tmp/migrate2.log
```
Expected: `up 0`, `migrate 0`, a line naming `022_service_categories.sql`, `migrate2 0`, and a count of `0`.

- [ ] **Step 3: Write the failing test**

`tests/workshop-service-categories.test.js`:

```js
// Staff CRUD for service categories. One level deep: a category holds
// individual services and never other categories (Jack, 24 Sep).
// Spec: docs/superpowers/specs/2026-09-24-book-server-1-service-list-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let shopA;
let shopB;

before(async () => {
  server = await startLiveServer();
  shopA = await staffSignup(server.baseUrl);
  shopB = await staffSignup(server.baseUrl);
});

after(async () => {
  if (shopA) await deleteTestShop(shopA.shop.id);
  if (shopB) await deleteTestShop(shopB.shop.id);
  if (server) await server.stop();
});

const as = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);

test('categories are created and listed by position, then name', async () => {
  // Positions deliberately contradict alphabetical order, so a sort by name
  // alone gives a different answer and the test can tell the two apart.
  for (const [name, position] of [['Wheels', 0], ['Gears', 1], ['Brakes', 1]]) {
    const res = await as(shopA, '/api/workshop-service-categories', { method: 'POST', body: { name, position } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body).sort(), ['id', 'name', 'position']);
  }
  const list = await as(shopA, '/api/workshop-service-categories');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((c) => c.name), ['Wheels', 'Brakes', 'Gears']);
});

test('a category needs a name', async () => {
  const res = await as(shopA, '/api/workshop-service-categories', { method: 'POST', body: { name: '   ' } });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /name/i);
});

test('a PUT that omits position keeps it', async () => {
  const made = await as(shopA, '/api/workshop-service-categories', { method: 'POST', body: { name: 'Susp', position: 7 } });
  const res = await as(shopA, `/api/workshop-service-categories/${made.body.id}`, { method: 'PUT', body: { name: 'Suspension' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, { id: made.body.id, name: 'Suspension', position: 7 });
});

test('one shop cannot see or change another shop\'s categories', async () => {
  const made = await as(shopA, '/api/workshop-service-categories', { method: 'POST', body: { name: 'Private to A' } });
  const listB = await as(shopB, '/api/workshop-service-categories');
  assert.equal(listB.status, 200);
  assert.ok(!listB.body.some((c) => c.id === made.body.id), 'shop B listed shop A\'s category');
  const put = await as(shopB, `/api/workshop-service-categories/${made.body.id}`, { method: 'PUT', body: { name: 'Taken' } });
  assert.equal(put.status, 404);
  const del = await as(shopB, `/api/workshop-service-categories/${made.body.id}`, { method: 'DELETE' });
  assert.equal(del.status, 404);
});

test('a deleted category is gone from the list', async () => {
  const made = await as(shopA, '/api/workshop-service-categories', { method: 'POST', body: { name: 'Temporary' } });
  const del = await as(shopA, `/api/workshop-service-categories/${made.body.id}`, { method: 'DELETE' });
  assert.equal(del.status, 200);
  const list = await as(shopA, '/api/workshop-service-categories');
  assert.ok(!list.body.some((c) => c.id === made.body.id));
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `node --test tests/workshop-service-categories.test.js > /tmp/t1.log 2>&1; echo "exit $?"; grep -E "^ℹ (pass|fail)" /tmp/t1.log`
Expected: `exit 1`, and every test fails with a 404 `Unknown API route`, because the routes do not exist yet.

- [ ] **Step 5: Write the routes**

In `server/server.js`, directly above `// ---------- Workshop services (the fixed-price labour catalogue) ----------`:

```js
// ---------- Workshop service categories ----------
// One level deep (Jack, 24 Sep): a category holds individual services, never
// other categories. Full services carry no category. Deleting a category moves
// its services to uncategorised (ON DELETE SET NULL in migration 022).
// Spec: docs/superpowers/specs/2026-09-24-book-server-1-service-list-design.md

function serializeServiceCategory(row) {
  return { id: row.id, name: row.name, position: row.position };
}

// Shared by POST and PUT; `existing` is null on POST. An omitted field keeps
// its stored value on PUT.
function readCategoryBody(body, existing) {
  const name = body.name !== undefined ? String(body.name).trim() : (existing ? existing.name : '');
  if (!name) throw new ValidationError('A category needs a name');
  let position = existing ? existing.position : 0;
  if (body.position !== undefined) {
    position = Number(body.position);
    if (!Number.isInteger(position)) throw new ValidationError('Position must be a whole number');
  }
  return { name, position };
}

// screens: services, service-edit
route('GET', '/api/workshop-service-categories', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM workshop_service_categories ORDER BY position, name').all();
  sendJson(res, 200, rows.map(serializeServiceCategory));
});

// screens: services, service-edit
route('POST', '/api/workshop-service-categories', async (req, res) => {
  const body = await readJsonBody(req);
  let fields;
  try {
    fields = readCategoryBody(body, null);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(res, err.message);
    throw err;
  }
  const info = await db.prepare('INSERT INTO workshop_service_categories (name, position) VALUES (?, ?)')
    .run(fields.name, fields.position);
  const row = await db.prepare('SELECT * FROM workshop_service_categories WHERE id = ?').get(info.lastInsertRowid);
  sendJson(res, 201, serializeServiceCategory(row));
});

// screens: services, service-edit
route('PUT', '/api/workshop-service-categories/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM workshop_service_categories WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Not found');
  const body = await readJsonBody(req);
  let fields;
  try {
    fields = readCategoryBody(body, existing);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(res, err.message);
    throw err;
  }
  await db.prepare('UPDATE workshop_service_categories SET name = ?, position = ?, updated_at = ? WHERE id = ?')
    .run(fields.name, fields.position, nowIso(), id);
  const row = await db.prepare('SELECT * FROM workshop_service_categories WHERE id = ?').get(id);
  sendJson(res, 200, serializeServiceCategory(row));
});

// screens: services, service-edit
route('DELETE', '/api/workshop-service-categories/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM workshop_service_categories WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Not found');
  await db.prepare('DELETE FROM workshop_service_categories WHERE id = ?').run(id);
  sendJson(res, 200, { ok: true });
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test tests/workshop-service-categories.test.js > /tmp/t1.log 2>&1; echo "exit $?"; grep -E "^ℹ (pass|fail)" /tmp/t1.log`
Expected: `exit 0`, `pass 5`, `fail 0`.

- [ ] **Step 7: Break it on purpose (ordering)**

Change `ORDER BY position, name` in the GET route to `ORDER BY name`. Check the edit landed: `grep -c "FROM workshop_service_categories ORDER BY name" server/server.js` prints `1`. Run the test.
Expected: `categories are created and listed by position, then name` fails, with `['Brakes', 'Gears', 'Wheels']` where `['Wheels', 'Brakes', 'Gears']` is expected. Restore the line, then run `grep -c "FROM workshop_service_categories ORDER BY position, name" server/server.js`, which should print `1`.

- [ ] **Step 8: Break it on purpose (row-level security)**

This protection lives in the database, so the break is made there:

```bash
docker compose exec -T postgres psql -U postgres -d epos -c "ALTER TABLE workshop_service_categories DISABLE ROW LEVEL SECURITY;"
docker compose exec -T postgres psql -U postgres -d epos -tAc "SELECT relrowsecurity FROM pg_class WHERE relname = 'workshop_service_categories';"
```
Expected: the second command prints `f`, showing the break landed. Run the test.
Expected: `one shop cannot see or change another shop's categories` fails. Restore:

```bash
docker compose exec -T postgres psql -U postgres -d epos -c "ALTER TABLE workshop_service_categories ENABLE ROW LEVEL SECURITY;"
docker compose exec -T postgres psql -U postgres -d epos -tAc "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'workshop_service_categories';"
```
Expected: `t|t`. Run the test again: `pass 5`.

- [ ] **Step 9: Run the row-level security coverage check**

Run: `node scripts/ci/assert-rls-coverage.mjs > /tmp/rls.log 2>&1; echo "rls $?"; tail -2 /tmp/rls.log`
Expected: `rls 0`, with the protected-table count one higher than before (31).

- [ ] **Step 10: Commit**

```bash
git add server/migrations/022_service_categories.sql server/server.js tests/workshop-service-categories.test.js
git commit -m "feat: service categories - migration 022 and staff CRUD, one level deep"
```

---

### Task 2: Services carry kind, category and position

**Files:**
- Modify: `server/server.js`, in the section `// ---------- Workshop services (the fixed-price labour catalogue) ----------`: `serializeWorkshopService`, the `POST` and `PUT /api/workshop-services` routes, and a new `readServicePlacement` beside `readServiceBody`
- Modify: `tests/workshopServices.test.js`, in the test `serializeWorkshopService converts a row to camelCase with active as a boolean`, which compares the exact field list
- Test: `tests/workshop-service-placement.test.js`

**Interfaces:**
- Consumes: the Task 1 table and routes.
- Produces: `serializeWorkshopService(row)` gains `kind: 'full'|'individual'`, `categoryId: number|null` and `position: number`. `POST/PUT /api/workshop-services` accept those three fields.

- [ ] **Step 1: Write the failing test**

`tests/workshop-service-placement.test.js`:

```js
// Where a service sits: full or individual, which category, what order.
// Spec: docs/superpowers/specs/2026-09-24-book-server-1-service-list-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let shopA;
let shopB;

before(async () => {
  server = await startLiveServer();
  shopA = await staffSignup(server.baseUrl);
  shopB = await staffSignup(server.baseUrl);
});

after(async () => {
  if (shopA) await deleteTestShop(shopA.shop.id);
  if (shopB) await deleteTestShop(shopB.shop.id);
  if (server) await server.stop();
});

const as = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const category = async (who, name) =>
  (await as(who, '/api/workshop-service-categories', { method: 'POST', body: { name } })).body;
const service = (who, body) =>
  as(who, '/api/workshop-services', { method: 'POST', body: { name: 'Svc', price: 10, ...body } });

test('a new service is individual, uncategorised and at position 0 unless told otherwise', async () => {
  const res = await service(shopA, {});
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.kind, 'individual');
  assert.equal(res.body.categoryId, null);
  assert.equal(res.body.position, 0);
});

test('an individual service can be filed under a category with a position', async () => {
  const brakes = await category(shopA, 'Brakes');
  const res = await service(shopA, { kind: 'individual', categoryId: brakes.id, position: 3 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.categoryId, brakes.id);
  assert.equal(res.body.position, 3);
});

test('a full service carries no category', async () => {
  const brakes = await category(shopA, 'Brakes 2');
  const res = await service(shopA, { kind: 'full', categoryId: brakes.id });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.kind, 'full');
  assert.equal(res.body.categoryId, null);
});

test('kind must be full or individual', async () => {
  const res = await service(shopA, { kind: 'premium' });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /full|individual/);
});

test('a service cannot be filed under another shop\'s category', async () => {
  const theirs = await category(shopB, 'B only');
  const res = await service(shopA, { categoryId: theirs.id });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /category/i);
});

test('a PUT that omits kind, categoryId and position keeps them', async () => {
  const gears = await category(shopA, 'Gears');
  const made = await service(shopA, { categoryId: gears.id, position: 5 });
  const res = await as(shopA, `/api/workshop-services/${made.body.id}`, {
    method: 'PUT',
    body: { name: 'Gear index', price: 15 },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.kind, 'individual');
  assert.equal(res.body.categoryId, gears.id);
  assert.equal(res.body.position, 5);
});

test('deleting a category leaves its services, uncategorised', async () => {
  const wheels = await category(shopA, 'Wheels');
  const made = await service(shopA, { categoryId: wheels.id });
  await as(shopA, `/api/workshop-service-categories/${wheels.id}`, { method: 'DELETE' });
  const list = await as(shopA, '/api/workshop-services');
  const after = list.body.find((s) => s.id === made.body.id);
  assert.ok(after, 'the service was deleted with its category');
  assert.equal(after.categoryId, null);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/workshop-service-placement.test.js > /tmp/t2.log 2>&1; echo "exit $?"; grep -E "^ℹ (pass|fail)|^✖" /tmp/t2.log`
Expected: `exit 1`. The tests fail on missing fields: `kind` is `undefined` where `'individual'` is expected, and the other-shop category POST answers 201 where 400 is expected.

- [ ] **Step 3: Implement**

In `serializeWorkshopService`, add after `bookableOnline`:

```js
    // Where the customer booking page lists it: 'full' services in a short
    // list of their own, 'individual' ones under their category (or "Other"
    // when uncategorised). One level deep; see migration 022.
    kind: row.kind,
    categoryId: row.category_id,
    position: row.position,
```

Directly below `readServiceBody`, add:

```js
// Where a service sits in the customer's list. `existing` is null on POST; on
// PUT an omitted field keeps its stored value, so a caller that predates these
// fields (the old staff app) cannot wipe them. A category id is looked up
// through the shop-scoped db first: the foreign key alone bypasses row-level
// security and would accept another shop's category.
async function readServicePlacement(body, existing) {
  const kind = body.kind !== undefined ? body.kind : (existing ? existing.kind : 'individual');
  if (kind !== 'full' && kind !== 'individual') {
    throw new ValidationError("A service's kind must be 'full' or 'individual'");
  }
  let categoryId = body.categoryId !== undefined ? body.categoryId : (existing ? existing.category_id : null);
  if (kind === 'full') {
    categoryId = null;
  } else if (categoryId !== null) {
    categoryId = Number(categoryId);
    const found = Number.isInteger(categoryId)
      ? await db.prepare('SELECT id FROM workshop_service_categories WHERE id = ?').get(categoryId)
      : null;
    if (!found) throw new ValidationError('That category does not exist');
  }
  let position = existing ? existing.position : 0;
  if (body.position !== undefined) {
    position = Number(body.position);
    if (!Number.isInteger(position)) throw new ValidationError('Position must be a whole number');
  }
  return { kind, categoryId, position };
}
```

In `POST /api/workshop-services`, replace the body from `let fields;` to the `sendJson` with:

```js
  let fields;
  let placement;
  try {
    fields = readServiceBody(body);
    placement = await readServicePlacement(body, null);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(res, err.message);
    throw err;
  }
  const bookableOnline = body.bookableOnline ? 1 : 0;
  const info = await db.prepare(
    'INSERT INTO workshop_services (name, price, minutes, bookable_online, kind, category_id, position) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(fields.name, fields.price, fields.minutes, bookableOnline, placement.kind, placement.categoryId, placement.position);
  const row = await db.prepare('SELECT * FROM workshop_services WHERE id = ?').get(info.lastInsertRowid);
  sendJson(res, 201, serializeWorkshopService(row));
```

In `PUT /api/workshop-services/:id`, replace the body from `let fields;` to the `sendJson` with:

```js
  let fields;
  let placement;
  try {
    fields = readServiceBody(body);
    placement = await readServicePlacement(body, existing);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(res, err.message);
    throw err;
  }
  const active = body.active === undefined ? existing.active : (body.active ? 1 : 0);
  const bookableOnline = body.bookableOnline === undefined
    ? existing.bookable_online : (body.bookableOnline ? 1 : 0);
  await db.prepare(
    'UPDATE workshop_services SET name = ?, price = ?, minutes = ?, active = ?, bookable_online = ?, kind = ?, category_id = ?, position = ?, updated_at = ? WHERE id = ?'
  ).run(fields.name, fields.price, fields.minutes, active, bookableOnline,
    placement.kind, placement.categoryId, placement.position, nowIso(), id);
  const row = await db.prepare('SELECT * FROM workshop_services WHERE id = ?').get(id);
  sendJson(res, 200, serializeWorkshopService(row));
```

- [ ] **Step 3b: Update the existing exact-shape serializer test**

In `tests/workshopServices.test.js`, the test `serializeWorkshopService converts a row to camelCase with active as a boolean` compares every field. Add the three columns to its `row` and its expected object:

```js
  const row = { id: 7, name: 'Puncture repair', price: '12.00', minutes: 15, active: 1, bookable_online: 1,
    kind: 'full', category_id: null, position: 2 };
  assert.deepEqual(serializeWorkshopService(row), {
    id: 7,
    name: 'Puncture repair',
    price: '12.00',
    minutes: 15,
    active: true,
    bookableOnline: true,
    kind: 'full',
    categoryId: null,
    position: 2,
  });
```

- [ ] **Step 4: Run the test to verify it passes, plus the existing service tests**

Run: `node --test tests/workshop-service-placement.test.js tests/workshopServicesApi.test.js tests/workshopServices.test.js > /tmp/t2.log 2>&1; echo "exit $?"; grep -E "^ℹ (pass|fail)" /tmp/t2.log`
Expected: `exit 0`, `fail 0`.

- [ ] **Step 5: Break it on purpose (cross-shop category)**

In `readServicePlacement`, change `if (!found) throw` to `if (false && !found) throw`. Check the edit landed: `grep -c "if (false && !found)" server/server.js` prints `1`. Run the placement test.
Expected: `a service cannot be filed under another shop's category` fails. The status is 201 or 500, not 400. Restore the line, and `grep -c "if (false && !found)" server/server.js` should print `0`.

- [ ] **Step 6: Break it on purpose (omitted fields kept)**

In `readServicePlacement`, change `(existing ? existing.category_id : null)` to `null`. Check the edit landed: `grep -c "existing.category_id" server/server.js` prints `0`. Run the placement test.
Expected: `a PUT that omits kind, categoryId and position keeps them` fails, with `categoryId` `null` where the category's id is expected. Restore the line, and the grep should print `1`.

- [ ] **Step 7: Commit**

```bash
git add server/server.js tests/workshop-service-placement.test.js tests/workshopServices.test.js
git commit -m "feat: services carry kind, category and position; category checked against the shop"
```

---

### Task 3: The public service list

**Files:**
- Modify: `server/server.js`, adding a new route directly below the `GET /api/portal/:shopSlug/mechanics` route
- Test: `tests/portal-service-list.test.js`

**Interfaces:**
- Consumes: the Task 1 and Task 2 columns and routes. The portal dispatcher resolves `:shopSlug`, answers 404 `Shop not found` for an unknown slug, and runs the handler inside `runWithShop`.
- Produces: `GET /api/portal/:shopSlug/services` returns `{ showPrices: boolean, full: PublicService[], categories: { id: number, name: string, services: PublicService[] }[], uncategorised: PublicService[] }`, where `PublicService = { id: number, name: string, price: number|null, minutes: number|null }`.

- [ ] **Step 1: Write the failing test**

`tests/portal-service-list.test.js`:

```js
// The customer booking page's service list: public, one shop only, grouped
// full / by category / uncategorised, prices only when the shop allows.
// Spec: docs/superpowers/specs/2026-09-24-book-server-1-service-list-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let shopA;
let shopB;

before(async () => {
  server = await startLiveServer();
  shopA = await staffSignup(server.baseUrl);
  shopB = await staffSignup(server.baseUrl);
});

after(async () => {
  if (shopA) await deleteTestShop(shopA.shop.id);
  if (shopB) await deleteTestShop(shopB.shop.id);
  if (server) await server.stop();
});

const as = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const publicList = (who) => jsonRequest(server.baseUrl, null, `/api/portal/${who.shop.slug}/services`);
const category = async (who, name, position = 0) =>
  (await as(who, '/api/workshop-service-categories', { method: 'POST', body: { name, position } })).body;
const service = async (who, body) =>
  (await as(who, '/api/workshop-services', {
    method: 'POST',
    body: { price: 10, minutes: 30, bookableOnline: true, ...body },
  })).body;
const setShowPrices = (who, on) =>
  as(who, '/api/workshop-settings', { method: 'PUT', body: { showPricesOnline: on } });
const allIds = (list) => [
  ...list.full, ...list.uncategorised, ...list.categories.flatMap((c) => c.services),
].map((s) => s.id);

test('an unknown shop answers 404', async () => {
  const res = await jsonRequest(server.baseUrl, null, '/api/portal/no-such-shop-anywhere/services');
  assert.equal(res.status, 404);
});

test('only this shop\'s active, bookable-online services are listed, with no sign-in', async () => {
  const shown = await service(shopA, { name: 'Shown' });
  const hidden = await service(shopA, { name: 'Not online', bookableOnline: false });
  const inactive = await service(shopA, { name: 'Retired' });
  await as(shopA, `/api/workshop-services/${inactive.id}`, { method: 'DELETE' });
  const other = await service(shopB, { name: 'Shop B only' });

  const res = await publicList(shopA);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const ids = allIds(res.body);
  assert.ok(ids.includes(shown.id), 'the bookable service is missing');
  for (const [s, why] of [[hidden, 'not bookable online'], [inactive, 'inactive'], [other, 'another shop\'s']]) {
    assert.ok(!ids.includes(s.id), `listed a service that is ${why}`);
  }
});

test('prices are null unless the shop shows prices online', async () => {
  await service(shopA, { name: 'Priced', price: 42.5 });
  await setShowPrices(shopA, false);
  let res = await publicList(shopA);
  assert.equal(res.body.showPrices, false);
  assert.ok(res.body.uncategorised.every((s) => s.price === null), 'a price leaked with the setting off');

  await setShowPrices(shopA, true);
  res = await publicList(shopA);
  assert.equal(res.body.showPrices, true);
  assert.equal(res.body.uncategorised.find((s) => s.name === 'Priced').price, 42.5);
});

test('full, categorised and uncategorised services are grouped and ordered', async () => {
  const shop = await staffSignup(server.baseUrl);
  try {
    // Every position contradicts alphabetical order, so the assertions below
    // fail if position is ignored.
    const wheels = await category(shop, 'Wheels', 1);
    const brakes = await category(shop, 'Brakes', 2);
    await service(shop, { name: 'Premium service', kind: 'full', position: 1 });
    await service(shop, { name: 'Basic service', kind: 'full', position: 2 });
    await service(shop, { name: 'Pad swap', categoryId: brakes.id, position: 1 });
    await service(shop, { name: 'Bleed', categoryId: brakes.id, position: 2 });
    await service(shop, { name: 'True wheel', categoryId: wheels.id });
    await service(shop, { name: 'Tubeless setup' });

    const res = await publicList(shop);
    assert.deepEqual(res.body.full.map((s) => s.name), ['Premium service', 'Basic service']);
    assert.deepEqual(res.body.categories.map((c) => c.name), ['Wheels', 'Brakes']);
    assert.deepEqual(res.body.categories[1].services.map((s) => s.name), ['Pad swap', 'Bleed']);
    assert.deepEqual(res.body.uncategorised.map((s) => s.name), ['Tubeless setup']);
    assert.deepEqual(Object.keys(res.body.full[0]).sort(), ['id', 'minutes', 'name', 'price']);
  } finally {
    await deleteTestShop(shop.shop.id);
  }
});

test('a category with no bookable service is left out', async () => {
  const empty = await category(shopA, 'Nothing online');
  await service(shopA, { name: 'Staff only', categoryId: empty.id, bookableOnline: false });
  const res = await publicList(shopA);
  assert.ok(!res.body.categories.some((c) => c.id === empty.id), 'an empty category was listed');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/portal-service-list.test.js > /tmp/t3.log 2>&1; echo "exit $?"; grep -E "^ℹ (pass|fail)|^✖" /tmp/t3.log`
Expected: `exit 1`. `an unknown shop answers 404` passes, because the dispatcher already answers 404. Every other test fails on a 404 `Unknown portal route`.

- [ ] **Step 3: Implement**

Directly below the `GET /api/portal/:shopSlug/mechanics` route:

```js
// The customer booking page's service list (book screens 01 and 02). Public,
// no sign-in, inside the shop's row-level security context like every portal
// route, so it can only ever read this shop's rows. Only services the shop has
// ticked bookable online, and prices only when the shop shows prices online
// (docs/decisions/2026-09-04-booking-mode-and-downtime.md §7). Prices pass
// through as stored - nothing is totalled here.
// screens: service, service-list
route('GET', '/api/portal/:shopSlug/services', async (req, res) => {
  const settings = await db.prepare('SELECT show_prices_online FROM workshop_settings LIMIT 1').get();
  const showPrices = settings?.show_prices_online === 1;
  const services = await db.prepare(
    `SELECT id, name, price, minutes, kind, category_id FROM workshop_services
     WHERE active = 1 AND bookable_online = 1 ORDER BY position, name`
  ).all();
  const categories = await db.prepare(
    'SELECT id, name FROM workshop_service_categories ORDER BY position, name'
  ).all();
  const toPublic = (s) => ({ id: s.id, name: s.name, price: showPrices ? s.price : null, minutes: s.minutes });
  const individual = services.filter((s) => s.kind === 'individual');
  sendJson(res, 200, {
    showPrices,
    full: services.filter((s) => s.kind === 'full').map(toPublic),
    categories: categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        services: individual.filter((s) => s.category_id === c.id).map(toPublic),
      }))
      .filter((c) => c.services.length > 0),
    uncategorised: individual.filter((s) => s.category_id === null).map(toPublic),
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/portal-service-list.test.js > /tmp/t3.log 2>&1; echo "exit $?"; grep -E "^ℹ (pass|fail)" /tmp/t3.log`
Expected: `exit 0`, `pass 5`, `fail 0`.

- [ ] **Step 5: Break it on purpose (four breaks, one at a time)**

For each break: make the edit, confirm it with the grep, run the test, see the named failure, restore, and confirm the restore with the grep.

1. Remove `AND bookable_online = 1`. Confirm with `grep -c "AND bookable_online = 1" server/server.js`, which prints `0`. Expected: `only this shop's active, bookable-online services are listed…` fails with "listed a service that is not bookable online".
2. Change `price: showPrices ? s.price : null` to `price: s.price`. Confirm with `grep -c "showPrices ? s.price" server/server.js`, which prints `0`. Expected: `prices are null unless…` fails with "a price leaked with the setting off".
3. Change both `ORDER BY position, name` in this route to `ORDER BY name`. Confirm with `grep -c "bookable_online = 1 ORDER BY name" server/server.js`, which prints `1`. Expected: `full, categorised and uncategorised services are grouped and ordered` fails, with `['Basic service', 'Premium service']`.
4. Delete the line `.filter((c) => c.services.length > 0),`. Confirm with `grep -c "c.services.length > 0" server/server.js`, which prints `0`. Expected: `a category with no bookable service is left out` fails.

- [ ] **Step 6: Commit**

```bash
git add server/server.js tests/portal-service-list.test.js
git commit -m "feat: public service list for the booking page - full, by category, uncategorised"
```

---

### Task 4: Screen trace covers the service routes

**Files:**
- Modify: `scripts/ci/assert-screen-trace.mjs`, the `COVERED` array
- Modify: `server/server.js`, adding `// screens: services, service-edit` directly above each of the four existing `/api/workshop-services` routes (`GET`, `POST`, `PUT /:id`, `DELETE /:id`), with no blank line between comment and route
- Test: `tests/screen-trace.test.js`

**Interfaces:**
- Consumes: the `// screens:` comments added in Tasks 1 and 3.

- [ ] **Step 1: Write the failing test**

Append to `tests/screen-trace.test.js`:

```js
test('the service catalogue and public service list routes must name their screens', () => {
  for (const line of [
    "route('GET', '/api/portal/:shopSlug/services', h);",
    "route('POST', '/api/workshop-services', h);",
    "route('PUT', '/api/workshop-service-categories/:id', h);",
  ]) {
    const result = checkSource(line, screenIds);
    assert.equal(result.ok, false, `${line} passed with no screens comment`);
    assert.match(result.problems.join('\n'), /names no screen/);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/screen-trace.test.js > /tmp/t4.log 2>&1; echo "exit $?"; grep -E "passed with no screens comment" /tmp/t4.log | head -1`
Expected: `exit 1`, with `route('GET', '/api/portal/:shopSlug/services', h); passed with no screens comment`.

- [ ] **Step 3: Widen `COVERED`**

```js
const COVERED = [
  /^\/api\/workshop-jobs\/:id\/[a-z-]+$/,
  /^\/api\/quotes\/:id(\/[a-z-]+)?$/,
  /^\/api\/portal\/:shopSlug\/quotes\//,
  /^\/api\/workshop-services(\/|$)/,
  /^\/api\/workshop-service-categories(\/|$)/,
  /^\/api\/portal\/:shopSlug\/services$/,
];
```

- [ ] **Step 4: Run the checker against the real server, and watch it catch the four routes that still lack a comment**

Run: `node scripts/ci/assert-screen-trace.mjs > /tmp/st.log 2>&1; echo "trace $?"; grep -c "workshop-services" /tmp/st.log`
Expected: `trace 1`, with 4 problem lines for `/api/workshop-services`. The category routes and the public route pass, because Tasks 1 and 3 gave them comments. This run is the check that the widened pattern is not vacuous.

- [ ] **Step 5: Add the four comments**

Directly above each existing `route(...'/api/workshop-services'...)` line (GET, POST, PUT `/:id`, DELETE `/:id`), add:

```js
// screens: services, service-edit
```

The DELETE route already has a two-line comment above it ("Deactivate rather than delete…"). Put the new line directly above the `route(` line, below that comment; `screensAbove` reads every attached comment line.

- [ ] **Step 6: Run both checks**

Run: `node --test tests/screen-trace.test.js > /tmp/t4.log 2>&1; echo "test $?"; node scripts/ci/assert-screen-trace.mjs > /tmp/st.log 2>&1; echo "trace $?"; tail -1 /tmp/st.log`
Expected: `test 0`, `trace 0`, and `Screen trace OK: …`.

- [ ] **Step 7: Break it on purpose**

Delete the `/^\/api\/portal\/:shopSlug\/services$/,` line from `COVERED`, and confirm with `grep -cF ':shopSlug\/services$/' scripts/ci/assert-screen-trace.mjs`, which prints `0`. Run `node --test tests/screen-trace.test.js`. Expected: the new test fails with `route('GET', '/api/portal/:shopSlug/services', h); passed with no screens comment`. Restore it, and the grep prints `1`.

- [ ] **Step 8: Commit**

```bash
git add scripts/ci/assert-screen-trace.mjs server/server.js tests/screen-trace.test.js
git commit -m "ci: screen trace covers the service catalogue and public service list routes"
```

---

### Task 5: Full gates and handoff

**Files:**
- Modify: `.agents/STATUS.md` (keep it under 8,000 bytes; check with `wc -c`)

- [ ] **Step 1: Run every gate, capturing each exit code**

```bash
: > /tmp/codes
npm test > /tmp/test.log 2>&1; echo "test $?" >> /tmp/codes
npm run typecheck > /tmp/tc.log 2>&1; echo "typecheck $?" >> /tmp/codes
npm run lint > /tmp/lint.log 2>&1; echo "lint $?" >> /tmp/codes
npm run build > /tmp/build.log 2>&1; echo "build $?" >> /tmp/codes
node scripts/ci/assert-rls-coverage.mjs > /tmp/rls.log 2>&1; echo "rls $?" >> /tmp/codes
node scripts/ci/assert-screen-trace.mjs > /tmp/st.log 2>&1; echo "trace $?" >> /tmp/codes
npm run registry:validate > /tmp/reg.log 2>&1; echo "registry $?" >> /tmp/codes
node scripts/ci/check-registry-drift.mjs > /tmp/drift.log 2>&1; echo "drift $?" >> /tmp/codes
npm run test:browser > /tmp/pw.log 2>&1; echo "browser $?" >> /tmp/codes
cat /tmp/codes; grep -E "^ℹ (tests|pass|fail)" /tmp/test.log
```
Expected: every line ends in `0`, and the test count is 448 plus this plan's new tests (5 + 7 + 5 + 1 = 18), so 466, with 0 failures.

- [ ] **Step 2: Update STATUS**

Record: piece 1 built on `feat/book-server-1-services` (migration 022, category routes, service placement, `GET /api/portal/:shopSlug/services`); the next piece is 2 (booking modes and capacity), which starts with its own brainstorm and spec. Commit:

```bash
git add .agents/STATUS.md
git commit -m "docs: STATUS - book server piece 1 built, next piece 2"
```

- [ ] **Step 3: Push, open the PR, and read CI on the PR's own head commit**

CI migrates a fresh database from empty and runs a second `npm run migrate`, which must apply nothing. That is the spec's "applies on an empty database" check. Confirm that CI ran against the pushed head, not an earlier commit.
