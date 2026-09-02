# Workshop Service Catalogue and Labour Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a bike shop bill for its own labour, by giving it a saved service catalogue and real labour lines on a job's order.

**Architecture:** A new `workshop_services` table holds each shop's named services with a price and a duration. `sale_document_items` and `sale_items` gain `line_type`, `service_id` and `minutes`, so a labour line is an existing line row with `product_id NULL`, `qty = 1` and a typed `unit_price`. The three duplicated product-loading guards on the server collapse into one shared `loadDocumentLine`, which is where the labour branch lives; `createSale` and the refund path learn to skip stock for labour.

**Tech Stack:** Node 20+ with `node:http` (no Express), PostgreSQL via `pg` (the only runtime dependency), plain SQL forward-only migrations, vanilla JS front end in `public/app.js`, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-31-workshop-service-catalogue-design.md`

**Branch:** `design/workshop-service-catalogue`

## Global Constraints

Every task's requirements implicitly include this section.

- **Zero new runtime dependencies.** `pg` is the only one. Do not add a package.
- **Never write `WHERE shop_id = ?`.** Row Level Security does it. Every shop-scoped table has `shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id)`, `ENABLE` + `FORCE ROW LEVEL SECURITY`, and a `<table>_shop_isolation` policy with both `USING` and `WITH CHECK`. Inserts never name `shop_id`.
- **Migrations are forward-only.** `NNN_snake_case.sql`, applied in filename order, no down-migrations. The next number is `014`.
- **Booleans are `INTEGER` 0/1** on these tables (`products.active`, `employees.is_mechanic`), because the surrounding SQL compares with `= 1`. `workshop_services.active` follows suit.
- **DB access is `db.prepare(sql).get/all/run(...)`** from `server/db.js`, with `?` placeholders. Bare `INSERT INTO` gets `RETURNING id` auto-appended, so `.run()` returns `.lastInsertRowid`.
- **Transactions are explicit:** `await db.exec('BEGIN')` in a try, `COMMIT` at the end, `ROLLBACK` in the catch. No network I/O inside an open transaction.
- **Validation is inline and imperative** at the top of each handler. Trim strings, coerce with `Number()`/`Math.trunc()`, and `return badRequest(res, 'A human sentence')` on failure. Shared code throws `ValidationError` and callers translate it.
- **Serialisation is explicit:** DB `snake_case` → API `camelCase` in a `serializeX(row)` function. A field not added there is invisible to the client.
- **Comment the why, not the what.** The codebase has a strong house style of a short explanatory comment above any non-obvious decision. Match it.
- **Tests need a live Postgres.** `npm run docker:up` first. `DATABASE_URL` must point at the non-superuser `epos_app` role — a superuser bypasses RLS and would silently void every isolation assertion.
- **Prices are VAT-inclusive at 20%,** computed client-side for display only (`public/app.js:95`). There is no server-side VAT. Labour inherits this; do not add tax handling.

---

### Task 1: Make the test helper able to clean up an order

`deleteTestShop` deletes `sale_documents` but never `sale_document_items`, so the first test that creates an order fails teardown on a foreign key. Nothing else in this plan can be tested until this is fixed. It also misses `sales`, `sale_items`, `stock_movements`, `workshop_settings` and `workshop_job_attachments`.

**Files:**
- Modify: `tests/helpers/testShop.js`
- Test: `tests/saleDocuments.test.js` (create)

**Interfaces:**
- Consumes: `createTestShop()`, `deleteTestShop(shopId)` from `tests/helpers/testShop.js`; `pool`, `runWithShop` from `server/db.js`
- Produces: a `deleteTestShop` that tears down orders, sales, stock movements and workshop rows. Every later task depends on this.

- [ ] **Step 1: Write the failing test**

Create `tests/saleDocuments.test.js`:

```js
// tests/saleDocuments.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

// The helper has to survive a shop that owns an order with lines. Until it
// deletes sale_document_items, deleting sale_documents trips a foreign key.
test('deleteTestShop removes a shop that owns an order with lines', async () => {
  const shop = await createTestShop();
  await runWithShop(shop.id, async () => {
    const product = await prepare(
      `INSERT INTO products (sku, name, price, cost, stock_qty, active)
       VALUES ('SKU-1', 'Chain', 24.99, 10.00, 5, 1)`
    ).run();
    const doc = await prepare(
      `INSERT INTO sale_documents (kind, subtotal, discount, total)
       VALUES ('order', 24.99, 0, 24.99)`
    ).run();
    await prepare(
      `INSERT INTO sale_document_items (document_id, product_id, name, sku, unit_price, qty, line_total)
       VALUES (?, ?, 'Chain', 'SKU-1', 24.99, 1, 24.99)`
    ).run(doc.lastInsertRowid, product.lastInsertRowid);
  });

  // The assertion is that this does not throw.
  await deleteTestShop(shop.id);
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
npm run docker:up
npm test -- --test-name-pattern="deleteTestShop removes a shop that owns an order"
```

Expected: FAIL with a Postgres foreign key violation naming `sale_document_items_document_id_fkey`. If it passes, stop — the helper is not what this plan assumes and the rest of the plan needs rechecking.

- [ ] **Step 3: Fix the teardown order**

In `tests/helpers/testShop.js`, replace the two lines that delete `sale_documents` and `workshop_jobs` with the block below. Order matters: children before parents, and `sale_documents` before `sales` because `sale_documents.converted_sale_id` references `sales(id)`.

```js
    // Children before parents. sale_documents must go before sales because
    // converted_sale_id points at it, and before workshop_jobs because
    // workshop_job_id does.
    await client.query('DELETE FROM sale_document_items WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM sale_documents WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM sale_items WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM sales WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM stock_movements WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM workshop_job_attachments WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM workshop_jobs WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM workshop_settings WHERE shop_id = $1', [shopId]);
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npm test -- --test-name-pattern="deleteTestShop removes a shop that owns an order"
```

Expected: PASS.

- [ ] **Step 5: Prove the test is real**

Comment out the `DELETE FROM sale_document_items` line, re-run, and confirm the test goes red with the same foreign key error. Confirm the edit actually landed (`git diff` shows the line commented) before restoring it — a no-op edit makes the test look sound while proving nothing.

- [ ] **Step 6: Run the whole suite**

```bash
npm test
```

Expected: 90 passing (89 existing plus the new one). If any previously-passing test now fails, the delete order is wrong.

- [ ] **Step 7: Commit**

```bash
git add tests/helpers/testShop.js tests/saleDocuments.test.js
git commit -m "test: let deleteTestShop tear down orders, sales and stock movements"
```

---

### Task 2: Migration 014 — services table and line-type columns

One forward-only migration carrying the whole schema change: the new table, the three columns on both line tables, and the constraints.

**Files:**
- Create: `server/migrations/014_workshop_services.sql`
- Modify: `tests/helpers/testShop.js`
- Test: `tests/workshopServices.test.js` (create)

**Interfaces:**
- Produces: table `workshop_services(id, shop_id, name, price, minutes, active, created_at, updated_at)`; columns `line_type`, `service_id`, `minutes` on both `sale_document_items` and `sale_items`.

- [ ] **Step 1: Write the failing test**

Create `tests/workshopServices.test.js`:

```js
// tests/workshopServices.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

test('a service row stores a name, price and duration', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const info = await prepare(
        `INSERT INTO workshop_services (name, price, minutes) VALUES ('Standard service', 55.00, 60)`
      ).run();
      const row = await prepare('SELECT * FROM workshop_services WHERE id = ?').get(info.lastInsertRowid);
      assert.equal(row.name, 'Standard service');
      assert.equal(Number(row.price), 55);
      assert.equal(row.minutes, 60);
      assert.equal(row.active, 1);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a labour line cannot carry a product, and a product line must have one', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const product = await prepare(
        `INSERT INTO products (sku, name, price, cost, stock_qty, active)
         VALUES ('SKU-1', 'Chain', 24.99, 10.00, 5, 1)`
      ).run();
      const doc = await prepare(
        `INSERT INTO sale_documents (kind, subtotal, discount, total) VALUES ('order', 0, 0, 0)`
      ).run();

      await assert.rejects(
        prepare(
          `INSERT INTO sale_document_items (document_id, product_id, name, unit_price, qty, line_total, line_type)
           VALUES (?, ?, 'Bad', 10, 1, 10, 'labour')`
        ).run(doc.lastInsertRowid, product.lastInsertRowid),
        /sale_document_items_labour_has_no_product/
      );

      await assert.rejects(
        prepare(
          `INSERT INTO sale_document_items (document_id, name, unit_price, qty, line_total, line_type)
           VALUES (?, 'Bad', 10, 1, 10, 'product')`
        ).run(doc.lastInsertRowid),
        /sale_document_items_product_has_product/
      );
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});
```

- [ ] **Step 2: Run the tests and watch them fail**

```bash
npm test -- --test-name-pattern="a service row stores|a labour line cannot carry"
```

Expected: FAIL with `relation "workshop_services" does not exist` and `column "line_type" ... does not exist`.

- [ ] **Step 3: Write the migration**

Create `server/migrations/014_workshop_services.sql`:

```sql
-- A shop's own named services: what it charges for its time, and how long a
-- job of that kind takes. Replaces the category = 'Services' product fake for
-- new work; existing Services products keep working untouched.
CREATE TABLE workshop_services (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  minutes INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workshop_services_shop ON workshop_services(shop_id, active);
ALTER TABLE workshop_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_services FORCE ROW LEVEL SECURITY;
CREATE POLICY workshop_services_shop_isolation ON workshop_services
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Both line tables carry the same three columns: the editable order line and
-- the immutable receipt line written at tender. A labour line is product_id
-- NULL, qty 1, and a typed unit_price.
ALTER TABLE sale_document_items
  ADD COLUMN line_type  TEXT NOT NULL DEFAULT 'product',
  ADD COLUMN service_id INTEGER REFERENCES workshop_services(id),
  ADD COLUMN minutes    INTEGER;

ALTER TABLE sale_items
  ADD COLUMN line_type  TEXT NOT NULL DEFAULT 'product',
  ADD COLUMN service_id INTEGER REFERENCES workshop_services(id),
  ADD COLUMN minutes    INTEGER;

-- NOT VALID on the two product_id rules is deliberate. product_id has been
-- nullable since 001 with nothing enforcing it, and migrations here are
-- forward-only with no way back, so a single legacy null row would abort this
-- migration permanently. NOT VALID enforces the rule on every new and updated
-- row while leaving history unscanned. A later migration can VALIDATE
-- CONSTRAINT once the existing rows have been checked in place.
ALTER TABLE sale_document_items
  ADD CONSTRAINT sale_document_items_line_type_valid
    CHECK (line_type IN ('product','labour')),
  ADD CONSTRAINT sale_document_items_labour_has_no_product
    CHECK (line_type <> 'labour' OR product_id IS NULL) NOT VALID,
  ADD CONSTRAINT sale_document_items_product_has_product
    CHECK (line_type <> 'product' OR product_id IS NOT NULL) NOT VALID;

ALTER TABLE sale_items
  ADD CONSTRAINT sale_items_line_type_valid
    CHECK (line_type IN ('product','labour')),
  ADD CONSTRAINT sale_items_labour_has_no_product
    CHECK (line_type <> 'labour' OR product_id IS NULL) NOT VALID,
  ADD CONSTRAINT sale_items_product_has_product
    CHECK (line_type <> 'product' OR product_id IS NOT NULL) NOT VALID;
```

- [ ] **Step 4: Add the new table to the test teardown**

In `tests/helpers/testShop.js`, add this line immediately after the `DELETE FROM sale_items` line — services must go after the line tables that reference them:

```js
    await client.query('DELETE FROM workshop_services WHERE shop_id = $1', [shopId]);
```

- [ ] **Step 5: Run the migration and the tests**

```bash
npm run migrate
npm test -- --test-name-pattern="a service row stores|a labour line cannot carry"
```

Expected: PASS.

- [ ] **Step 6: Prove the constraints are real**

Change `line_type <> 'labour' OR product_id IS NULL` to `true` in the migration, drop and recreate the database (`npm run docker:down && npm run docker:up && npm run migrate`), and confirm the constraint test goes red. Restore, recreate again, confirm green.

- [ ] **Step 7: Commit**

```bash
git add server/migrations/014_workshop_services.sql tests/helpers/testShop.js tests/workshopServices.test.js
git commit -m "feat: add workshop_services table and line-type columns"
```

---

### Task 3: The services API

**Files:**
- Modify: `server/server.js` (add near the other workshop routes, around `:2706`)
- Test: `tests/workshopServices.test.js`

**Interfaces:**
- Consumes: `route`, `db`, `badRequest`, `notFound`, `sendJson`, `readJsonBody`, `nowIso` — all already in `server/server.js`
- Produces: `serializeWorkshopService(row)` returning `{ id, name, price, minutes, active }`; routes `GET/POST/PUT /api/workshop-services` and `DELETE /api/workshop-services/:id`

- [ ] **Step 1: Write the failing tests**

Append to `tests/workshopServices.test.js`:

```js
import { serializeWorkshopService } from '../server/server.js';

test('serializeWorkshopService converts a row to camelCase with active as a boolean', () => {
  const row = { id: 7, name: 'Puncture repair', price: '12.00', minutes: 15, active: 1 };
  assert.deepEqual(serializeWorkshopService(row), {
    id: 7,
    name: 'Puncture repair',
    price: '12.00',
    minutes: 15,
    active: true,
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
npm test -- --test-name-pattern="serializeWorkshopService"
```

Expected: FAIL — `serializeWorkshopService` is not exported.

- [ ] **Step 3: Write the serializer and routes**

Add to `server/server.js` next to the other workshop routes:

```js
export function serializeWorkshopService(row) {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    minutes: row.minutes,
    // active is INTEGER 0/1 on this table, matching products.active.
    active: row.active === 1,
  };
}

// Shared by POST and PUT. Throws ValidationError so both callers translate it
// the same way.
function readServiceBody(body) {
  const name = String(body.name || '').trim();
  if (!name) throw new ValidationError('A service needs a name');
  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) throw new ValidationError('A service needs a price of zero or more');
  let minutes = null;
  if (body.minutes !== undefined && body.minutes !== null && body.minutes !== '') {
    minutes = Math.trunc(Number(body.minutes));
    if (!Number.isFinite(minutes) || minutes <= 0) throw new ValidationError('Duration must be a positive number of minutes');
  }
  return { name, price, minutes };
}

route('GET', '/api/workshop-services', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM workshop_services ORDER BY active DESC, name').all();
  sendJson(res, 200, rows.map(serializeWorkshopService));
});

route('POST', '/api/workshop-services', async (req, res) => {
  const body = await readJsonBody(req);
  let fields;
  try {
    fields = readServiceBody(body);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(res, err.message);
    throw err;
  }
  const info = await db.prepare(
    'INSERT INTO workshop_services (name, price, minutes) VALUES (?, ?, ?)'
  ).run(fields.name, fields.price, fields.minutes);
  const row = await db.prepare('SELECT * FROM workshop_services WHERE id = ?').get(info.lastInsertRowid);
  sendJson(res, 201, serializeWorkshopService(row));
});

route('PUT', '/api/workshop-services/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM workshop_services WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Not found');
  const body = await readJsonBody(req);
  let fields;
  try {
    fields = readServiceBody(body);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(res, err.message);
    throw err;
  }
  const active = body.active === undefined ? existing.active : (body.active ? 1 : 0);
  await db.prepare(
    'UPDATE workshop_services SET name = ?, price = ?, minutes = ?, active = ?, updated_at = ? WHERE id = ?'
  ).run(fields.name, fields.price, fields.minutes, active, nowIso(), id);
  const row = await db.prepare('SELECT * FROM workshop_services WHERE id = ?').get(id);
  sendJson(res, 200, serializeWorkshopService(row));
});

// Deactivate rather than delete: a job line keeps its service_id, and that
// link must not dangle.
route('DELETE', '/api/workshop-services/:id', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM workshop_services WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Not found');
  await db.prepare('UPDATE workshop_services SET active = 0, updated_at = ? WHERE id = ?').run(nowIso(), id);
  sendJson(res, 200, { ok: true });
});
```

- [ ] **Step 4: Run and watch it pass**

```bash
npm test -- --test-name-pattern="serializeWorkshopService"
```

Expected: PASS.

- [ ] **Step 5: Add an isolation test**

Append to `tests/workshopServices.test.js`:

```js
test('a shop cannot see another shop\'s services', async () => {
  const shopA = await createTestShop();
  const shopB = await createTestShop();
  try {
    await runWithShop(shopA.id, async () => {
      await prepare(`INSERT INTO workshop_services (name, price, minutes) VALUES ('A only', 10, 30)`).run();
    });
    await runWithShop(shopB.id, async () => {
      const rows = await prepare('SELECT * FROM workshop_services').all();
      assert.equal(rows.length, 0, 'shop B must not see shop A services');
    });
  } finally {
    await deleteTestShop(shopA.id);
    await deleteTestShop(shopB.id);
  }
});
```

- [ ] **Step 6: Run it, then prove it is real**

```bash
npm test -- --test-name-pattern="cannot see another shop"
```

Expected: PASS. Then confirm `DATABASE_URL` is the `epos_app` role, not a superuser — a superuser bypasses RLS and this test would pass while asserting nothing. Check with:

```bash
node -e "console.log(process.env.DATABASE_URL)" && psql "$DATABASE_URL" -c "SELECT current_user, usesuper FROM pg_user WHERE usename = current_user"
```

Expected: `usesuper` is `f`.

- [ ] **Step 7: Cover deactivation**

The spec requires that deactivating a service stops it being offered but leaves
an existing job line working. Append to `tests/workshopServices.test.js`:

```js
test('a deactivated service drops out of selection but its line keeps working', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const svc = await prepare(
        `INSERT INTO workshop_services (name, price, minutes) VALUES ('Gear index', 20.00, 20)`
      ).run();
      const doc = await prepare(
        `INSERT INTO sale_documents (kind, subtotal, discount, total) VALUES ('order', 20, 0, 20)`
      ).run();
      await prepare(
        `INSERT INTO sale_document_items (document_id, name, unit_price, qty, line_total, line_type, service_id, minutes)
         VALUES (?, 'Gear index', 20.00, 1, 20.00, 'labour', ?, 20)`
      ).run(doc.lastInsertRowid, svc.lastInsertRowid);

      await prepare('UPDATE workshop_services SET active = 0 WHERE id = ?').run(svc.lastInsertRowid);

      const selectable = await prepare('SELECT * FROM workshop_services WHERE active = 1').all();
      assert.equal(selectable.length, 0, 'a deactivated service is not selectable');

      const line = await prepare('SELECT * FROM sale_document_items WHERE document_id = ?').get(doc.lastInsertRowid);
      assert.equal(line.service_id, svc.lastInsertRowid, 'the link must not dangle');
      assert.equal(Number(line.unit_price), 20, 'the snapshotted price is untouched');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});
```

Run it. It should pass against the schema from Task 2 — it is a guard on the
deactivate-not-delete decision, proving a later change cannot quietly switch
`DELETE /api/workshop-services/:id` to a real delete without going red.

- [ ] **Step 8: Prove it is real**

Change the `DELETE` route to `DELETE FROM workshop_services WHERE id = ?` and
confirm this test goes red with a foreign key violation. Restore and confirm
green.

- [ ] **Step 9: Commit**

```bash
git add server/server.js tests/workshopServices.test.js
git commit -m "feat: add the workshop services API"
```

---

### Task 4: Collapse the three product guards into one loader

A behaviour-preserving refactor, done before the labour branch exists so that the branch is written once rather than three times. `server/server.js:1457` (`createSale`), `:1760` (`POST /api/sale-documents`) and `:1865` (`PUT /api/sale-documents/:id/items`) hold near-identical blocks.

**Files:**
- Modify: `server/server.js:1455-1470`, `:1758-1774`, `:1860-1877`
- Test: `tests/saleDocuments.test.js`

**Interfaces:**
- Produces: `loadDocumentLine(it, { checkStock })` → `{ lineType, product, serviceId, name, sku, qty, unitPrice, minutes, lineTotal }`, throwing `ValidationError`. Tasks 5 and 6 both consume it.

- [ ] **Step 1: Write the failing test**

Append to `tests/saleDocuments.test.js`:

```js
import { loadDocumentLine } from '../server/server.js';
import { runWithShop, prepare } from '../server/db.js';

test('loadDocumentLine rejects a product line with no productId', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await assert.rejects(
        () => loadDocumentLine({ qty: 1 }, { checkStock: false }),
        /needs a valid productId and positive qty/
      );
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('loadDocumentLine snapshots name, sku and price from the product', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const info = await prepare(
        `INSERT INTO products (sku, name, price, cost, stock_qty, active)
         VALUES ('SKU-1', 'Chain', 24.99, 10.00, 5, 1)`
      ).run();
      const line = await loadDocumentLine({ productId: info.lastInsertRowid, qty: 2 }, { checkStock: false });
      assert.equal(line.lineType, 'product');
      assert.equal(line.name, 'Chain');
      assert.equal(line.sku, 'SKU-1');
      assert.equal(Number(line.unitPrice), 24.99);
      assert.equal(line.qty, 2);
      assert.equal(Number(line.lineTotal), 49.98);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
npm test -- --test-name-pattern="loadDocumentLine"
```

Expected: FAIL — `loadDocumentLine` is not exported.

- [ ] **Step 3: Write the loader**

Add to `server/server.js` above `createSale`:

```js
// The one place a request line becomes a stored line. Extracted from the three
// near-identical blocks in createSale, POST /api/sale-documents and PUT
// /api/sale-documents/:id/items, so the rules cannot drift between them.
// checkStock is true only at tender - a quote or an open order may reference
// something that is currently out of stock.
export async function loadDocumentLine(it, { checkStock }) {
  const productId = Number(it.productId);
  const qty = Math.trunc(Number(it.qty));
  if (!productId || !Number.isFinite(qty) || qty <= 0) {
    throw new ValidationError('Each item needs a valid productId and positive qty');
  }
  const product = await db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
  if (!product) throw new ValidationError(`Product ${productId} not found or inactive`);
  if (checkStock && product.stock_qty < qty) {
    throw new ValidationError(`Not enough stock for "${product.name}" (have ${product.stock_qty}, need ${qty})`);
  }
  let unitPrice = product.price;
  if (it.unitPrice !== undefined && it.unitPrice !== null && it.unitPrice !== '') {
    const overridden = Number(it.unitPrice);
    if (!Number.isFinite(overridden) || overridden < 0) {
      throw new ValidationError(`Invalid price for "${product.name}"`);
    }
    unitPrice = overridden;
  }
  return {
    lineType: 'product',
    product,
    serviceId: null,
    name: product.name,
    sku: product.sku,
    qty,
    unitPrice,
    minutes: null,
    lineTotal: unitPrice * qty,
  };
}
```

- [ ] **Step 4: Replace the three call sites**

In each of the three handlers, replace the inline block with a call. The two route handlers translate `ValidationError` to `badRequest`; `createSale` lets it propagate, as it does today.

In `POST /api/sale-documents` (was `:1758-1774`) and `PUT /api/sale-documents/:id/items` (was `:1860-1877`):

```js
  const loaded = [];
  for (const it of items) {
    try {
      loaded.push(await loadDocumentLine(it, { checkStock: false }));
    } catch (err) {
      if (err instanceof ValidationError) return badRequest(res, err.message);
      throw err;
    }
  }

  const subtotal = loaded.reduce((sum, line) => sum + line.lineTotal, 0);
  const total = Math.max(0, subtotal - discount);
```

Update the INSERT loops in both to read from the line object rather than destructuring `{ product, qty, unitPrice }`:

```js
    for (const line of loaded) {
      await db.prepare(
        `INSERT INTO sale_document_items (document_id, product_id, name, sku, unit_price, qty, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(docId, line.product.id, line.name, line.sku, line.unitPrice, line.qty, line.lineTotal);
    }
```

In `createSale` (was `:1455-1470`), use `{ checkStock: true }` and keep the surrounding stock and `stock_movements` code reading `line.product`.

- [ ] **Step 5: Run the whole suite**

```bash
npm test
```

Expected: all green. This is a refactor — no behaviour changed, so nothing that passed before may fail now.

- [ ] **Step 6: Prove the extraction is load-bearing**

Change `qty <= 0` to `qty < 0` in `loadDocumentLine`, run `npm test`, and confirm the "rejects a product line with no productId" test goes red. Restore and confirm green.

- [ ] **Step 7: Commit**

```bash
git add server/server.js tests/saleDocuments.test.js
git commit -m "refactor: one loadDocumentLine shared by the three line paths"
```

---

### Task 5: Accept labour lines on an order

**Files:**
- Modify: `server/server.js` (`loadDocumentLine`, `serializeSaleDocument` at `:1676`, both INSERT loops)
- Test: `tests/saleDocuments.test.js`

**Interfaces:**
- Consumes: `loadDocumentLine` from Task 4, `workshop_services` from Task 2
- Produces: `loadDocumentLine` accepting `{ lineType: 'labour', name, unitPrice, minutes, serviceId }`; serialised lines carrying `lineType`, `serviceId`, `minutes`

- [ ] **Step 1: Write the failing tests**

Append to `tests/saleDocuments.test.js`:

```js
test('loadDocumentLine accepts a labour line with a typed price', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const line = await loadDocumentLine(
        { lineType: 'labour', name: 'Rear hub service', unitPrice: 45, minutes: 45 },
        { checkStock: true }
      );
      assert.equal(line.lineType, 'labour');
      assert.equal(line.product, null);
      assert.equal(line.name, 'Rear hub service');
      assert.equal(Number(line.unitPrice), 45);
      assert.equal(line.qty, 1);
      assert.equal(Number(line.lineTotal), 45);
      assert.equal(line.minutes, 45);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a labour line snapshots its service, and repricing the service later does not change it', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const svc = await prepare(
        `INSERT INTO workshop_services (name, price, minutes) VALUES ('Standard service', 55.00, 60)`
      ).run();
      const line = await loadDocumentLine(
        { lineType: 'labour', serviceId: svc.lastInsertRowid },
        { checkStock: true }
      );
      assert.equal(line.name, 'Standard service');
      assert.equal(Number(line.unitPrice), 55);
      assert.equal(line.minutes, 60);

      await prepare('UPDATE workshop_services SET price = 65.00 WHERE id = ?').run(svc.lastInsertRowid);
      // The already-loaded line keeps the price it was created with.
      assert.equal(Number(line.unitPrice), 55);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a labour line needs a description and rejects a negative price', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await assert.rejects(
        () => loadDocumentLine({ lineType: 'labour', unitPrice: 10 }, { checkStock: true }),
        /needs a description/
      );
      await assert.rejects(
        () => loadDocumentLine({ lineType: 'labour', name: 'X', unitPrice: -1 }, { checkStock: true }),
        /price of zero or more/
      );
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});
```

- [ ] **Step 2: Run and watch them fail**

```bash
npm test -- --test-name-pattern="labour line"
```

Expected: FAIL — `loadDocumentLine` rejects them with "needs a valid productId".

- [ ] **Step 3: Add the labour branch**

At the top of `loadDocumentLine`, before the product handling:

```js
  // A labour line is a typed price with an optional recorded duration. It
  // carries no product, so nothing downstream may treat it as stock.
  if (it.lineType === 'labour') {
    let name = String(it.name || '').trim();
    let unitPrice = it.unitPrice;
    let minutes = it.minutes;
    let serviceId = null;

    // Picking a saved service snapshots its name, price and duration onto the
    // line. Repricing the service later must never rewrite a past job, which
    // is why these are copied rather than read through service_id.
    if (it.serviceId !== undefined && it.serviceId !== null && it.serviceId !== '') {
      serviceId = Number(it.serviceId);
      const service = await db.prepare('SELECT * FROM workshop_services WHERE id = ? AND active = 1').get(serviceId);
      if (!service) throw new ValidationError(`Service ${serviceId} not found or inactive`);
      if (!name) name = service.name;
      if (unitPrice === undefined || unitPrice === null || unitPrice === '') unitPrice = service.price;
      if (minutes === undefined || minutes === null || minutes === '') minutes = service.minutes;
    }

    if (!name) throw new ValidationError('A labour line needs a description');
    const price = Number(unitPrice);
    if (!Number.isFinite(price) || price < 0) {
      throw new ValidationError('A labour line needs a price of zero or more');
    }
    let mins = null;
    if (minutes !== undefined && minutes !== null && minutes !== '') {
      mins = Math.trunc(Number(minutes));
      if (!Number.isFinite(mins) || mins <= 0) {
        throw new ValidationError('Duration must be a positive number of minutes');
      }
    }
    return {
      lineType: 'labour',
      product: null,
      serviceId,
      name,
      sku: null,
      qty: 1,
      unitPrice: price,
      minutes: mins,
      lineTotal: price,
    };
  }
```

- [ ] **Step 4: Store and serialise the new columns**

Update both INSERT loops (`POST /api/sale-documents` and `PUT /api/sale-documents/:id/items`) to write the three new columns. `line.product` is null for labour, so read the id defensively:

```js
    for (const line of loaded) {
      await db.prepare(
        `INSERT INTO sale_document_items (document_id, product_id, name, sku, unit_price, qty, line_total, line_type, service_id, minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        docId,
        line.product ? line.product.id : null,
        line.name,
        line.sku,
        line.unitPrice,
        line.qty,
        line.lineTotal,
        line.lineType,
        line.serviceId,
        line.minutes
      );
    }
```

In `serializeSaleDocument` (`server/server.js:1676`), add three fields to the item mapping:

```js
          lineTotal: it.line_total,
          lineType: it.line_type,
          serviceId: it.service_id,
          minutes: it.minutes,
```

- [ ] **Step 5: Run and watch them pass**

```bash
npm test
```

Expected: all green.

- [ ] **Step 6: Prove the snapshot test is real**

Change the labour branch to read the service price through `service_id` at serialisation time instead of copying it. Confirm the snapshot test goes red. Restore and confirm green.

- [ ] **Step 7: Cover isolation**

The spec requires that shop B can neither read nor modify shop A's labour lines.
Append to `tests/saleDocuments.test.js`:

```js
test('a shop cannot see another shop\'s labour lines', async () => {
  const shopA = await createTestShop();
  const shopB = await createTestShop();
  try {
    await runWithShop(shopA.id, async () => {
      const doc = await prepare(
        `INSERT INTO sale_documents (kind, subtotal, discount, total) VALUES ('order', 45, 0, 45)`
      ).run();
      await prepare(
        `INSERT INTO sale_document_items (document_id, name, unit_price, qty, line_total, line_type, minutes)
         VALUES (?, 'A only labour', 45.00, 1, 45.00, 'labour', 45)`
      ).run(doc.lastInsertRowid);
    });
    await runWithShop(shopB.id, async () => {
      const rows = await prepare("SELECT * FROM sale_document_items WHERE line_type = 'labour'").all();
      assert.equal(rows.length, 0, 'shop B must not see shop A labour lines');
    });
  } finally {
    await deleteTestShop(shopA.id);
    await deleteTestShop(shopB.id);
  }
});
```

Run it, and confirm `DATABASE_URL` points at the non-superuser `epos_app` role
before trusting the result — a superuser bypasses RLS and this test would pass
while asserting nothing.

- [ ] **Step 8: Commit**

```bash
git add server/server.js tests/saleDocuments.test.js
git commit -m "feat: accept labour lines on an order"
```

---

### Task 6: Labour lines must not move stock

The load-bearing guard. `stock_movements.product_id` is `NOT NULL`, so a labour line reaching that loop is a constraint violation, not a soft bug.

**Files:**
- Modify: `server/server.js:1461`, `:1528-1533`, and the `sale_items` INSERT at `:1524`
- Test: `tests/saleDocuments.test.js`

**Interfaces:**
- Consumes: `loadDocumentLine` with `checkStock: true` from Task 5

- [ ] **Step 1: Write the failing test**

Append to `tests/saleDocuments.test.js`:

```js
test('tendering an order with a labour line moves no stock and writes no movement', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const product = await prepare(
        `INSERT INTO products (sku, name, price, cost, stock_qty, active)
         VALUES ('SKU-1', 'Chain', 24.99, 10.00, 5, 1)`
      ).run();
      const sale = await createSale({
        items: [
          { productId: product.lastInsertRowid, qty: 1 },
          { lineType: 'labour', name: 'Fit chain', unitPrice: 15, minutes: 20 },
        ],
        paymentMethod: 'cash',
        cashAmount: 39.99,
        cashTendered: 40,
      });

      const after = await prepare('SELECT stock_qty FROM products WHERE id = ?').get(product.lastInsertRowid);
      assert.equal(after.stock_qty, 4, 'the part moves stock');

      const movements = await prepare('SELECT * FROM stock_movements').all();
      assert.equal(movements.length, 1, 'only the part writes a movement, never the labour');
      assert.equal(movements[0].product_id, product.lastInsertRowid);

      const lines = await prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id').all(sale.id);
      assert.equal(lines.length, 2);
      assert.equal(lines[1].line_type, 'labour');
      assert.equal(lines[1].product_id, null);
      assert.equal(lines[1].minutes, 20);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});
```

`createSale` is **not exported** today (`server/server.js:1451` declares it as
a bare `async function`). Add `export` to that declaration as part of this step,
then import it at the top of the test file. Nothing else changes about it.

- [ ] **Step 2: Run and watch it fail**

```bash
npm test -- --test-name-pattern="moves no stock"
```

Expected: FAIL with a `null value in column "product_id" of relation "stock_movements" violates not-null constraint`. That failure is the bug this task fixes — confirm you see it before continuing.

- [ ] **Step 3: Guard the stock block**

In `createSale`, wrap the stock work so labour lines skip it, and write the new columns to `sale_items`:

```js
      await db.prepare(
        `INSERT INTO sale_items (sale_id, product_id, name, sku, unit_price, qty, line_total, line_type, service_id, minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        saleId,
        line.product ? line.product.id : null,
        line.name,
        line.sku,
        line.unitPrice,
        line.qty,
        line.lineTotal,
        line.lineType,
        line.serviceId,
        line.minutes
      );

      // Labour is not stock. stock_movements.product_id is NOT NULL, so a
      // labour line reaching this block is a constraint violation, not a
      // cosmetic bug.
      if (line.lineType === 'product') {
        const newQty = line.product.stock_qty - line.qty;
        await db.prepare('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?').run(newQty, nowIso(), line.product.id);
        await db.prepare(
          `INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES (?, ?, 'sale', ?)`
        ).run(line.product.id, -line.qty, `Sale #${saleId}`);
        if (line.product.shopify_inventory_item_id) {
          shopifyPushes.push({ product: line.product, newQty });
        }
      }
```

- [ ] **Step 4: Run and watch it pass**

```bash
npm test
```

Expected: all green.

- [ ] **Step 5: Prove the guard is load-bearing**

Remove the `if (line.lineType === 'product')` wrapper, run `npm test`, and confirm the stock test goes red with the `NOT NULL` violation. Restore and confirm green. This is the single most important mutation check in the plan.

- [ ] **Step 6: Commit**

```bash
git add server/server.js tests/saleDocuments.test.js
git commit -m "feat: labour lines never move stock at tender"
```

**There is deliberately no refund work in this task.** The repo has no till
refund: the only routes on sales are `GET /api/sales`, `GET /api/sales/:id` and
`POST /api/sales`, and the feature catalogue lists TILL-09 Refunds as None. The
code near `server/server.js:1611` is `processShopifyRefundWebhook`, which
restocks from Shopify's own line items via `matchRefundLineItemsToProducts()`
and never reads our `sale_items`, so a labour line cannot reach it. When TILL-09
is built it must skip labour lines, and that belongs in TILL-09's own plan.

---

### Task 7: The services management screen

**Files:**
- Modify: `public/app.js` (settings area)

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /api/workshop-services` from Task 3

- [ ] **Step 1: Read the surrounding pattern**

Open the existing workshop settings screen in `public/app.js` and follow its structure exactly — template-literal `innerHTML` rendering with `data-*` attribute event delegation. Do not introduce a new rendering approach, and do not build this in the React scaffold under `src/`, which has nothing in it and is not what the staff app serves.

- [ ] **Step 2: Add the screen**

A list of services showing name, price and duration, with add, edit and deactivate. Deactivated services stay visible but marked, since deactivation is not deletion. Match the existing settings screens for markup and styling; this task adds no new visual design.

- [ ] **Step 3: Check it against a real shop**

```bash
npm run docker:up && npm start
```

Create a service, edit its price, deactivate it, and confirm it survives a reload. There is no automated coverage of `public/app.js` in this repo, so this walkthrough is the evidence — record what you did and what you saw.

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat: add the services management screen"
```

---

### Task 8: Add labour to a job

**Files:**
- Modify: `public/app.js:6138-6220` (`renderWjItemsList`, `saveWjItems`), `:5923-5933` (the items markup)

**Interfaces:**
- Consumes: the services API from Task 3; labour lines accepted by `PUT /api/sale-documents/:id/items` from Task 5

- [ ] **Step 1: Add the control**

An *Add labour* control beside the existing add-part control in the job modal. Picking a saved service fills the description, price and duration; a one-off line is typed freehand. `wjItems` entries for labour carry `{ lineType: 'labour', name, unitPrice, minutes, serviceId }`.

- [ ] **Step 2: Render labour lines distinctly**

In `renderWjItemsList`, a labour line shows its description, price and — where set — its duration, with no SKU and no quantity stepper. It must be visually distinguishable from a part, but use the existing styles: this task introduces no new visual design. If a new visual treatment seems necessary, stop and ask rather than inventing one.

- [ ] **Step 3: Confirm the save round-trip**

`saveWjItems()` already PUTs the whole list to `/api/sale-documents/:id/items`. Confirm labour entries survive a save and reload with their price, duration and `serviceId` intact.

- [ ] **Step 4: Check it against a real shop**

Create a job, add a part and a labour line, save, reload the page, and confirm both come back correctly. Record what you saw.

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat: add labour lines to the job modal"
```

---

### Task 9: Stop the till destroying labour lines

The riskiest change in the plan. `loadOrderIntoCart()` rebuilds each cart line from a product lookup that returns `undefined` for labour, and the cart is re-serialised as only `{ productId, qty, unitPrice }` at three further sites. Without this task, a job order loaded into the till and tendered silently turns its labour into a broken product line.

**Files:**
- Modify: `public/app.js:1228-1250` (`loadOrderIntoCart`), `:1253-1265` (`changeQty`), `:1036`, `:1324`, `:1379` (the three re-serialisation sites)
- Test: `tests/saleDocuments.test.js`

**Interfaces:**
- Consumes: serialised `lineType`, `serviceId`, `minutes` from Task 5

- [ ] **Step 1: Write the server-side round-trip test**

This is the closest automated proof available, since `public/app.js` has no test harness. It asserts the shape the client must preserve:

```js
test('a labour line survives an order being tendered unchanged', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const svc = await prepare(
        `INSERT INTO workshop_services (name, price, minutes) VALUES ('Standard service', 55.00, 60)`
      ).run();
      const sale = await createSale({
        items: [{ lineType: 'labour', serviceId: svc.lastInsertRowid }],
        paymentMethod: 'cash',
        cashAmount: 55,
        cashTendered: 55,
      });
      const lines = await prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
      assert.equal(lines.length, 1);
      assert.equal(lines[0].line_type, 'labour');
      assert.equal(lines[0].name, 'Standard service');
      assert.equal(Number(lines[0].unit_price), 55);
      assert.equal(lines[0].minutes, 60);
      assert.equal(lines[0].service_id, svc.lastInsertRowid);
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});
```

- [ ] **Step 2: Run it**

```bash
npm test -- --test-name-pattern="survives an order being tendered"
```

Expected: PASS, because Tasks 5 and 6 already made the server correct. This test guards the server contract the client depends on; the client work is what follows.

- [ ] **Step 3: Carry the fields through `loadOrderIntoCart`**

At `public/app.js:1228`, the product lookup returns `undefined` for a labour line. Branch on `it.lineType` and build the cart entry from the line itself rather than from a product, carrying `lineType`, `name`, `unitPrice`, `minutes` and `serviceId`.

- [ ] **Step 4: Carry the fields through all three re-serialisation sites**

At `:1036`, `:1324` and `:1379` the cart is rebuilt as `{ productId, qty, unitPrice }`. Each must also send `lineType`, `name`, `serviceId` and `minutes` for a labour line. Miss one and the labour is destroyed only on that path — which is exactly the kind of bug that reaches production.

- [ ] **Step 5: Stop the stock cap applying to labour**

`changeQty()` at `:1253` falls back to `it.qty` as the stock ceiling for a line with no product, which silently pins a labour line's quantity. A labour line's quantity is not editable at the till; its price is edited on the job.

- [ ] **Step 6: Walk the whole path in a real shop**

The evidence for this task. Create a job, add a part and a labour line, send the job order to the till, tender it as cash, then check the database directly:

```sql
SELECT line_type, product_id, name, unit_price, qty, minutes, service_id FROM sale_items ORDER BY id DESC LIMIT 5;
SELECT * FROM stock_movements ORDER BY id DESC LIMIT 5;
```

Expected: the labour line present with `line_type = 'labour'`, `product_id NULL`, its price and duration intact, and no `stock_movements` row for it. Record the actual output.

- [ ] **Step 7: Run the whole suite**

```bash
npm test
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add public/app.js tests/saleDocuments.test.js
git commit -m "fix: carry labour lines through the till round-trip"
```

---

## Not in this plan

From the spec, each needing its own spec and plan:

- **C** — service duration sizes the diary slot
- **D** — the service list drives the public booking page, closing BOOK-04
- **E** — importing existing `category = 'Services'` products
- **Issue #17** — Services-category products move stock they do not have. Not closed here.
- **Issue #18** — nothing stops two orders linking to the same workshop job.
