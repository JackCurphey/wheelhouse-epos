# Release 2 Offline, Plan 1 — Server Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the server everything an offline-capable till needs: sites and registered tills, a till credential, a snapshot the till copies locally, staff PINs and check-ins, and one sync endpoint that records each till sale exactly once, in whole pence with VAT, never refusing a sale and never discarding one.

**Architecture:** New tables beside the legacy ones (migration 036); the legacy till (`public/app.js`, `POST /api/sales`) is untouched. Pure logic lives in `server/till/*.js`; routes are declared in `server/server.js` like every other route. Tills authenticate with a bearer token under a new `/api/till/:shopSlug/...` branch in the dispatcher, modelled on the `/api/portal/:shopSlug/...` branch. The till sends an ordered batch of items (customer, sale, check-in) to one sync endpoint; each item carries a till-made UUID and is recorded at most once.

**Tech Stack:** Node ≥22.5 (`node:test`, `node:crypto`), PostgreSQL 16 with row-level security, the repo's `prepare`/`runWithShop` db layer.

**Spec:** `docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md` (parent: `docs/superpowers/specs/2026-09-27-release-2-design.md`)

**This is plan 1 of 3.** Plan 2 is the till core in the browser (local store, queue, service worker; no screens). Plan 3 is the four screens (register a till, staff check-in, the offline banner, the manager's tills view), written after Jack approves their designs. Plan 2 is written once this plan has merged, against the names it actually produced.

## Global Constraints

- Money is whole pence (`INTEGER`) in every new table and every new API field (`...Pence`). Legacy `NUMERIC(10,2)` columns are converted at the boundary with `ROUND(x * 100)::int`, never stored twice.
- VAT is recorded on every sale line: the rate in basis points (`vat_rate_bp`, 2000 = 20%) and the VAT amount in pence. UK shop prices include VAT; VAT is extracted from the gross, never added on top.
- Stock never blocks a sale, online or offline. Stock may go below zero; each product that does is flagged.
- A sale the server cannot fully accept is never discarded: it is recorded, counts in takings, and gets a "needs attention" item with the reason.
- The price charged at the till stands, whatever the central price is now.
- Every new table with `shop_id` has RLS enabled and forced, with the standard isolation policy (CI's `assert-rls-coverage.mjs` fails otherwise).
- Every test is written first and watched to fail for the right reason before the code is written. Tests run against real Postgres (`npm run docker:up`, then `npm test`).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Decisions taken in this plan

| Decision | Why |
|---|---|
| New tables (`till_sales`, `till_sale_lines`, `till_sale_payments`) beside the legacy `sales` tables, not converting them in place | The spec left this to the plan. Converting `sales`/`products` money to pence touches the legacy till and the workshop quotes; the legacy till is being retired, not extended (Release 2 rule 1). New tables keep legacy working until piece 3 replaces it, and the import (Foundations) writes into the new ones. |
| `products.price` stays `NUMERIC`; the snapshot converts it to pence | Converting product storage belongs to the Foundations products/sites/variants part. This plan only adds `products.vat_rate_bp`. |
| Till credential never expires; it can be switched off centrally | Spec §5 wanted a credential that "renews itself while online so it never lapses mid-outage". A non-expiring, revocable 256-bit token meets "never lapses" with less machinery. **Flag to Jack as a change from the spec's wording.** |
| PIN hash is PBKDF2-SHA256, 100,000 iterations, per-staff salt | The browser must check PINs offline. PBKDF2 is in the browser's built-in WebCrypto; the server's existing scrypt is not. Task 3's test proves WebCrypto reproduces the server's hash. |
| Credit-account sales and loyalty points (spec default 3) are **not** in this plan | No credit account, credit limit or loyalty data exists anywhere in the schema (checked 27 Sep 2026: `server/migrations/001`–`035`). They arrive with piece 4 (customers), which must implement default 3. A payment method other than `cash` or `card` is recorded and flagged "needs attention", never refused. |
| Stock stays shop-wide; a sale records its site | Per-site stock is the Foundations products/sites part. |

---

## File structure

| File | Responsibility |
|---|---|
| `server/migrations/036_till_offline_core.sql` | Create: sites, tills, staff PINs, check-ins, till sales tables, attention list; `products.vat_rate_bp`; `customers.client_id` |
| `server/till/money.js` | Create: `vatFromGrossPence`, `receiptLabel` |
| `server/till/pin.js` | Create: `isValidPin`, `hashPin`, `verifyPin` (PBKDF2, WebCrypto-compatible) |
| `server/till/snapshot.js` | Create: `buildSnapshot(till)` |
| `server/till/sync.js` | Create: `processSyncItems(till, items)` — the exactly-once recorder |
| `server/till/attention.js` | Create: `flag(kind, fields)`, `listOpen()`, `resolve(id, loginId)` |
| `server/server.js` | Modify: manager routes (sites, tills, PINs, attention), the `/api/till/` dispatcher branch, till routes |
| `tests/migration-036.test.js` | Create |
| `tests/till-money.test.js`, `tests/till-pin.test.js` | Create (pure, no database) |
| `tests/till-registration-api.test.js`, `tests/till-snapshot-api.test.js`, `tests/till-sync-api.test.js`, `tests/till-attention-api.test.js` | Create |
| `tests/helpers/till.js` | Create: `registerTill`, `tillRequest`, `staffLogin` (non-owner), `seedProduct` |

---

### Task 1: Migration 036 — the offline core tables

**Files:**
- Create: `server/migrations/036_till_offline_core.sql`
- Test: `tests/migration-036.test.js`

**Interfaces:**
- Produces tables: `sites(id, shop_id, name, code)`; `tills(id, shop_id, site_id, code, name, token_hash, active, last_seen_at, last_pending_count, created_at)`; `staff_checkins(id, shop_id, employee_id, till_id, client_id, checked_in_at, received_at)`; `till_sales(id, shop_id, client_id, till_id, site_id, receipt_number, employee_id, customer_id, made_offline, till_clock_at, received_at, total_pence, vat_pence)`; `till_sale_lines(id, shop_id, till_sale_id, product_id, description, qty, unit_price_pence, line_total_pence, vat_rate_bp, vat_pence)`; `till_sale_payments(id, shop_id, till_sale_id, method, amount_pence)`; `till_attention(id, shop_id, kind, detail, till_sale_id, product_id, customer_id, created_at, resolved_at, resolved_by_login_id)`. New columns: `employees.pin_hash TEXT`, `products.vat_rate_bp INTEGER NOT NULL DEFAULT 2000`, `customers.client_id UUID`.

- [ ] **Step 1: Write the failing test**

```js
// tests/migration-036.test.js
// Migration 036 (Release 2 offline core): sites, registered tills, staff PINs
// and check-ins, till sales in whole pence with VAT per line, and the
// attention list. Spec:
// docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

let shopA;
let shopB;

before(async () => {
  shopA = await createTestShop();
  shopB = await createTestShop();
});

after(async () => {
  if (shopA) await deleteTestShop(shopA.id);
  if (shopB) await deleteTestShop(shopB.id);
  await pool.end();
});

const column = async (table, name) => (await pool.query(
  'SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
  [table, name]
)).rows[0];

test('new columns on existing tables', async () => {
  assert.equal((await column('employees', 'pin_hash')).data_type, 'text');
  const vat = await column('products', 'vat_rate_bp');
  assert.equal(vat.data_type, 'integer');
  assert.equal(vat.is_nullable, 'NO');
  assert.equal(vat.column_default, '2000');
  assert.equal((await column('customers', 'client_id')).data_type, 'uuid');
});

test('money columns on till tables are whole pence', async () => {
  for (const [table, name] of [
    ['till_sales', 'total_pence'], ['till_sales', 'vat_pence'],
    ['till_sale_lines', 'unit_price_pence'], ['till_sale_lines', 'line_total_pence'],
    ['till_sale_lines', 'vat_pence'], ['till_sale_payments', 'amount_pence'],
  ]) {
    assert.equal((await column(table, name)).data_type, 'integer', `${table}.${name}`);
  }
});

// One site 'B' per shop, reused, so a second till in the same shop fails (or
// not) on the tills table alone - never on a duplicate site.
async function seedTill(shopId, code = 'B1') {
  return runWithShop(shopId, async () => {
    const existing = await prepare("SELECT id FROM sites WHERE code = 'B'").get();
    const site = existing ? existing.id : (await prepare("INSERT INTO sites (name, code) VALUES ('Bolton', 'B')").run()).lastInsertRowid;
    const till = (await prepare(
      "INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, 'Till', ?)"
    ).run(site, code, randomUUID())).lastInsertRowid;
    return { site, till };
  });
}

test('a sale client_id is recorded once per shop', async () => {
  const { site, till } = await seedTill(shopA.id);
  const clientId = randomUUID();
  const insert = () => runWithShop(shopA.id, () => prepare(
    `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, total_pence, vat_pence)
     VALUES (?, ?, ?, 1, false, now(), 100, 17)`
  ).run(clientId, till, site));
  await insert();
  await assert.rejects(insert, /duplicate key/);
});

test('till codes are unique within a shop but not across shops', async () => {
  await seedTill(shopB.id, 'X1');
  await assert.rejects(() => seedTill(shopB.id, 'X1'), /duplicate key/);
  await seedTill(shopA.id, 'X1');
});

test('till tables are isolated per shop', async () => {
  await seedTill(shopA.id, 'Z9');
  const seen = await runWithShop(shopB.id, () => prepare("SELECT * FROM tills WHERE code = 'Z9'").all());
  assert.equal(seen.length, 0);
  for (const table of ['sites', 'tills', 'staff_checkins', 'till_sales', 'till_sale_lines', 'till_sale_payments', 'till_attention']) {
    const { rows: [r] } = await pool.query(
      'SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1', [table]
    );
    assert.deepEqual(r, { relrowsecurity: true, relforcerowsecurity: true }, table);
  }
});

test('attention kinds are a closed list', async () => {
  await assert.rejects(() => runWithShop(shopA.id, () => prepare(
    "INSERT INTO till_attention (kind, detail) VALUES ('made_up', 'x')"
  ).run()), /check constraint/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run docker:up && npm run migrate && node --test tests/migration-036.test.js`
Expected: FAIL — `pin_hash` column is `undefined` (`Cannot read properties of undefined (reading 'data_type')`).

- [ ] **Step 3: Write the migration**

```sql
-- Migration 036 (Release 2, offline core): sites and registered tills, staff
-- PINs and daily check-ins, till sales recorded exactly once in whole pence
-- with VAT per line, and the attention list ("check these" / "needs attention").
-- New tables sit beside the legacy sales tables, which the legacy till still
-- uses until piece 3 replaces it.
-- Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md

ALTER TABLE employees ADD COLUMN pin_hash TEXT;
-- UK standard rate. Basis points: 2000 = 20.00%, 500 = 5%, 0 = zero-rated.
ALTER TABLE products ADD COLUMN vat_rate_bp INTEGER NOT NULL DEFAULT 2000
  CHECK (vat_rate_bp BETWEEN 0 AND 10000);
-- Set when a till creates the customer offline, so a re-sent customer is
-- recognised rather than created twice.
ALTER TABLE customers ADD COLUMN client_id UUID;
CREATE UNIQUE INDEX idx_customers_client_id ON customers(shop_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE sites (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL CHECK (code ~ '^[A-Z]{1,3}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, code)
);

CREATE TABLE tills (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  site_id INTEGER NOT NULL REFERENCES sites(id),
  code TEXT NOT NULL CHECK (code ~ '^[A-Z]{1,3}[0-9]{1,2}$'),
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  last_pending_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, code)
);

CREATE TABLE staff_checkins (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  till_id INTEGER NOT NULL REFERENCES tills(id),
  client_id UUID NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, client_id)
);

CREATE TABLE till_sales (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  client_id UUID NOT NULL,
  till_id INTEGER NOT NULL REFERENCES tills(id),
  site_id INTEGER NOT NULL REFERENCES sites(id),
  receipt_number INTEGER NOT NULL CHECK (receipt_number > 0),
  employee_id INTEGER REFERENCES employees(id),
  customer_id INTEGER REFERENCES customers(id),
  made_offline BOOLEAN NOT NULL,
  till_clock_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_pence INTEGER NOT NULL,
  vat_pence INTEGER NOT NULL,
  UNIQUE (shop_id, client_id)
);
CREATE INDEX idx_till_sales_till_receipt ON till_sales(shop_id, till_id, receipt_number);

CREATE TABLE till_sale_lines (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  till_sale_id INTEGER NOT NULL REFERENCES till_sales(id) ON DELETE CASCADE,
  -- Null when the till sold a product the server no longer has.
  product_id INTEGER REFERENCES products(id),
  description TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price_pence INTEGER NOT NULL,
  line_total_pence INTEGER NOT NULL,
  vat_rate_bp INTEGER NOT NULL CHECK (vat_rate_bp BETWEEN 0 AND 10000),
  vat_pence INTEGER NOT NULL
);

CREATE TABLE till_sale_payments (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  till_sale_id INTEGER NOT NULL REFERENCES till_sales(id) ON DELETE CASCADE,
  -- Not constrained: a method the server does not know yet is recorded and
  -- flagged, never refused.
  method TEXT NOT NULL,
  amount_pence INTEGER NOT NULL
);

CREATE TABLE till_attention (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  kind TEXT NOT NULL CHECK (kind IN (
    'stock_below_zero', 'unknown_product', 'unknown_customer', 'unknown_employee',
    'payments_do_not_match', 'unsupported_payment_method', 'possible_duplicate_customer',
    'receipt_number_reused'
  )),
  detail TEXT NOT NULL,
  till_sale_id INTEGER REFERENCES till_sales(id),
  product_id INTEGER REFERENCES products(id),
  customer_id INTEGER REFERENCES customers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by_login_id INTEGER
);
-- One open "below zero" item per product, however many sales push it lower.
CREATE UNIQUE INDEX idx_till_attention_open_stock ON till_attention(shop_id, product_id)
  WHERE kind = 'stock_below_zero' AND resolved_at IS NULL;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sites', 'tills', 'staff_checkins', 'till_sales', 'till_sale_lines', 'till_sale_payments', 'till_attention'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (shop_id = current_setting(''app.current_shop_id'')::int) WITH CHECK (shop_id = current_setting(''app.current_shop_id'')::int)',
      t || '_shop_isolation', t
    );
  END LOOP;
END $$;
```

- [ ] **Step 4: Run the migration and the test**

Run: `npm run migrate && node --test tests/migration-036.test.js && node scripts/ci/assert-rls-coverage.mjs`
Expected: all tests PASS; the RLS coverage check passes.

- [ ] **Step 5: Break it on purpose** — comment out the `FORCE ROW LEVEL SECURITY` line inside the loop, drop and recreate the local database (`docker compose down -v && npm run docker:up && npm run migrate`), re-run the test, confirm `till tables are isolated per shop` FAILS on the `relforcerowsecurity` assertion, then restore the line and recreate again.

- [ ] **Step 6: Commit**

```bash
git add server/migrations/036_till_offline_core.sql tests/migration-036.test.js
git commit -m "feat: migration 036, the offline till core tables (Release 2 offline plan 1)"
```

---

### Task 2: Money helpers — VAT from a gross price, receipt labels

**Files:**
- Create: `server/till/money.js`
- Test: `tests/till-money.test.js`

**Interfaces:**
- Produces: `vatFromGrossPence(grossPence: number, rateBp: number) => number` (integer pence, half-up rounding); `receiptLabel(tillCode: string, receiptNumber: number) => string` (`'B1-1042'`, number zero-padded to 4 digits).

- [ ] **Step 1: Write the failing test**

```js
// tests/till-money.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { vatFromGrossPence, receiptLabel } from '../server/till/money.js';

test('VAT is extracted from a VAT-inclusive price', () => {
  assert.equal(vatFromGrossPence(1200, 2000), 200); // £12.00 at 20% → £2.00
  assert.equal(vatFromGrossPence(999, 2000), 167);  // 166.5 rounds half-up to 167
  assert.equal(vatFromGrossPence(1050, 500), 50);   // 5%
  assert.equal(vatFromGrossPence(1234, 0), 0);      // zero-rated
  assert.equal(vatFromGrossPence(0, 2000), 0);
});

test('VAT on a negative line (a discount line) is negative', () => {
  assert.equal(vatFromGrossPence(-1200, 2000), -200);
});

test('receipt labels are till code plus a padded number', () => {
  assert.equal(receiptLabel('B1', 42), 'B1-0042');
  assert.equal(receiptLabel('B1', 1042), 'B1-1042');
  assert.equal(receiptLabel('SAL2', 12345), 'SAL2-12345');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/till-money.test.js`
Expected: FAIL — `Cannot find module '.../server/till/money.js'`.

- [ ] **Step 3: Implement**

```js
// server/till/money.js
// Whole-pence money for the till. UK shop prices include VAT, so VAT is
// extracted from the gross: gross × rate / (1 + rate). Rates are basis points
// (2000 = 20%) so every sum stays in integers.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md

export function vatFromGrossPence(grossPence, rateBp) {
  const sign = grossPence < 0 ? -1 : 1;
  const abs = Math.abs(grossPence);
  // Integer maths, rounding half up: floor((2·a·r + (10000 + r)) / (2·(10000 + r))).
  const denominator = 10000 + rateBp;
  return sign * Math.floor((2 * abs * rateBp + denominator) / (2 * denominator));
}

export function receiptLabel(tillCode, receiptNumber) {
  return `${tillCode}-${String(receiptNumber).padStart(4, '0')}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/till-money.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Break it on purpose** — replace the return line with `return sign * Math.floor(abs * rateBp / denominator);` (rounding down, not half-up), confirm the `999 → 167` assertion FAILS with 166, then restore.

- [ ] **Step 6: Commit**

```bash
git add server/till/money.js tests/till-money.test.js
git commit -m "feat: whole-pence VAT and receipt labels for the till (Release 2 offline plan 1)"
```

---

### Task 3: Staff PINs the browser can check offline

**Files:**
- Create: `server/till/pin.js`
- Test: `tests/till-pin.test.js`

**Interfaces:**
- Produces: `isValidPin(pin: unknown) => boolean` (4–6 digits); `hashPin(pin: string) => string` in the format `pbkdf2-sha256$100000$<saltHex>$<hashHex>` (16-byte salt, 32-byte key); `verifyPin(pin: string, stored: string) => boolean`. Plan 2's browser code verifies the same format with WebCrypto `PBKDF2`/`SHA-256`, 256 bits.

- [ ] **Step 1: Write the failing test**

```js
// tests/till-pin.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidPin, hashPin, verifyPin } from '../server/till/pin.js';

test('a PIN is 4 to 6 digits', () => {
  for (const ok of ['1234', '00000', '987654']) assert.equal(isValidPin(ok), true, ok);
  for (const bad of ['123', '1234567', '12a4', '', null, 1234, ' 1234']) assert.equal(isValidPin(bad), false, String(bad));
});

test('a hashed PIN verifies, a wrong PIN does not', () => {
  const stored = hashPin('4821');
  assert.match(stored, /^pbkdf2-sha256\$100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  assert.equal(verifyPin('4821', stored), true);
  assert.equal(verifyPin('4822', stored), false);
  assert.equal(verifyPin('4821', 'garbage'), false);
});

test('two hashes of one PIN differ (salted)', () => {
  assert.notEqual(hashPin('4821'), hashPin('4821'));
});

// The till checks PINs offline in the browser, where only WebCrypto exists.
// Node ships the same WebCrypto, so this proves the browser can verify.
test('WebCrypto reproduces the stored hash', async () => {
  const stored = hashPin('4821');
  const [, iterations, saltHex, hashHex] = stored.split('$');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('4821'), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: Buffer.from(saltHex, 'hex'), iterations: Number(iterations) },
    key,
    256
  );
  assert.equal(Buffer.from(bits).toString('hex'), hashHex);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/till-pin.test.js`
Expected: FAIL — `Cannot find module '.../server/till/pin.js'`.

- [ ] **Step 3: Implement**

```js
// server/till/pin.js
// Staff PINs for checking in at the till. The till verifies them offline in
// the browser, so the hash is PBKDF2-SHA256 (built into WebCrypto) rather than
// the scrypt used for passwords in auth.js. A 4-6 digit PIN is a presence
// check, not strong security: anyone holding the till's copy could work it
// out. It protects nothing beyond the till.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §4
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const ITERATIONS = 100000;
const PREFIX = 'pbkdf2-sha256';

export function isValidPin(pin) {
  return typeof pin === 'string' && /^[0-9]{4,6}$/.test(pin);
}

export function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(pin, salt, ITERATIONS, 32, 'sha256');
  return `${PREFIX}$${ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPin(pin, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  if (parts.length !== 4 || parts[0] !== PREFIX) return false;
  const [, iterations, saltHex, hashHex] = parts;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = pbkdf2Sync(pin, Buffer.from(saltHex, 'hex'), Number(iterations), expected.length, 'sha256');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/till-pin.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Break it on purpose** — change `'sha256'` in `hashPin` to `'sha512'`, confirm `WebCrypto reproduces the stored hash` FAILS (hex mismatch), then restore.

- [ ] **Step 6: Commit**

```bash
git add server/till/pin.js tests/till-pin.test.js
git commit -m "feat: staff PINs hashed so the browser can check them offline (Release 2 offline plan 1)"
```

---

### Task 4: Sites, till registration and switching a till off

**Files:**
- Modify: `server/server.js` — add the routes below after the team routes (after the `POST /api/team/...` block near line 3890); add `import { hashLinkCode, newLinkCode ... }` is already imported (line 82) — reuse `newLinkCode` and `hashLinkCode` for till tokens.
- Create: `tests/helpers/till.js`
- Test: `tests/till-registration-api.test.js`

**Interfaces:**
- Consumes: `staffSignup`, `staffRequest` (`tests/helpers/staff.js`); `newLinkCode()`, `hashLinkCode(code)` (`server/booking-link.js`).
- Produces (cookie-authenticated, owner only for writes):
  - `POST /api/sites {name, code}` → `201 {id, name, code}`; `GET /api/sites` → `[{id, name, code}]`.
  - `POST /api/tills {siteId, number, name}` → `201 {till: {id, code, name, siteId, active}, token}`. `code` = site code + number (`'B' + 1 → 'B1'`). The token is shown once; only its hash is stored.
  - `GET /api/tills` → `[{id, code, name, siteId, active, lastSeenAt, pendingCount}]` (the manager view's data, spec §8).
  - `POST /api/tills/:id/deactivate` → `200 {id, active: false}`.
- Produces helpers: `registerTill(baseUrl, owner, {siteCode='B', number=1}) => {till, token, site}`; `staffLogin(shopId) => {cookie}` (a non-owner login).

- [ ] **Step 1: Write the helpers and the failing test**

```js
// tests/helpers/till.js
import { randomUUID } from 'node:crypto';
import { pool, runWithShop, prepare } from '../../server/db.js';
import { hashPassword, createSession, SESSION_COOKIE } from '../../server/auth.js';
import { staffRequest } from './staff.js';

// A non-owner login in the given shop, for 403 checks.
export async function staffLogin(shopId) {
  const email = `staff-${randomUUID().slice(0, 8)}@example.test`;
  const { rows: [login] } = await pool.query(
    `INSERT INTO logins (shop_id, name, email, password_hash, is_owner, active)
     VALUES ($1, 'Staff', $2, $3, false, true) RETURNING id`,
    [shopId, email, hashPassword('not-used-in-tests')]
  );
  const token = await createSession(login.id);
  return { cookie: `${SESSION_COOKIE}=${token}` };
}

export async function registerTill(baseUrl, owner, { siteCode = 'B', number = 1 } = {}) {
  const sites = (await staffRequest(baseUrl, owner.cookie, '/api/sites')).body;
  let site = sites.find((s) => s.code === siteCode);
  if (!site) {
    site = (await staffRequest(baseUrl, owner.cookie, '/api/sites', {
      method: 'POST', body: { name: `Site ${siteCode}`, code: siteCode },
    })).body;
  }
  const res = await staffRequest(baseUrl, owner.cookie, '/api/tills', {
    method: 'POST', body: { siteId: site.id, number, name: `Till ${number}` },
  });
  if (res.status !== 201) throw new Error(`registerTill: ${res.status} ${JSON.stringify(res.body)}`);
  return { ...res.body, site };
}

// A request as a till: bearer token, under /api/till/:shopSlug.
export async function tillRequest(baseUrl, shopSlug, token, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${baseUrl}/api/till/${shopSlug}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

export async function seedProduct(shopId, { name = 'Inner tube', price = '6.99', stock = 5, vatRateBp = 2000 } = {}) {
  return runWithShop(shopId, async () => (await prepare(
    'INSERT INTO products (sku, name, price, cost, stock_qty, vat_rate_bp) VALUES (?, ?, ?, 0, ?, ?)'
  ).run(`SKU-${randomUUID().slice(0, 8)}`, name, price, stock, vatRateBp)).lastInsertRowid);
}
```

Before writing `staffLogin`, confirm `server/auth.js` exports `hashPassword`, `createSession` and `SESSION_COOKIE` (`grep -n "^export" server/auth.js`); if `createSession` is not async, drop the `await`.

```js
// tests/till-registration-api.test.js
// Sites, till registration and switching a till off (Release 2 offline plan 1).
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §5, §8
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { hashLinkCode } from '../server/booking-link.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { staffLogin } from './helpers/till.js';

let server; let owner; let staff;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  staff = await staffLogin(owner.shop.id);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const as = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);

test('an owner adds a site; codes are one to three capital letters', async () => {
  const res = await as(owner, '/api/sites', { method: 'POST', body: { name: 'Bolton', code: 'B' } });
  assert.equal(res.status, 201);
  assert.deepEqual({ name: res.body.name, code: res.body.code }, { name: 'Bolton', code: 'B' });
  const bad = await as(owner, '/api/sites', { method: 'POST', body: { name: 'X', code: 'b1' } });
  assert.equal(bad.status, 400);
  const dup = await as(owner, '/api/sites', { method: 'POST', body: { name: 'Again', code: 'B' } });
  assert.equal(dup.status, 409);
});

test('only the owner can add a site or register a till', async () => {
  assert.equal((await as(staff, '/api/sites', { method: 'POST', body: { name: 'S', code: 'S' } })).status, 403);
  assert.equal((await as(staff, '/api/tills', { method: 'POST', body: { siteId: 1, number: 1, name: 'T' } })).status, 403);
});

test('registering a till returns its code and a one-time token; only the hash is stored', async () => {
  const site = (await as(owner, '/api/sites')).body.find((s) => s.code === 'B');
  const res = await as(owner, '/api/tills', { method: 'POST', body: { siteId: site.id, number: 1, name: 'Front counter' } });
  assert.equal(res.status, 201);
  assert.equal(res.body.till.code, 'B1');
  assert.equal(res.body.till.active, true);
  assert.match(res.body.token, /^[0-9a-f]{64}$/);
  const row = await runWithShop(owner.shop.id, () => prepare('SELECT token_hash FROM tills WHERE id = ?').get(res.body.till.id));
  assert.equal(row.token_hash, hashLinkCode(res.body.token));
  const again = await as(owner, '/api/tills', { method: 'POST', body: { siteId: site.id, number: 1, name: 'Dup' } });
  assert.equal(again.status, 409);
});

test('the tills list shows last seen and waiting count, and a till can be switched off', async () => {
  const list = (await as(owner, '/api/tills')).body;
  const b1 = list.find((t) => t.code === 'B1');
  assert.deepEqual(
    { active: b1.active, lastSeenAt: b1.lastSeenAt, pendingCount: b1.pendingCount },
    { active: true, lastSeenAt: null, pendingCount: 0 }
  );
  const off = await as(owner, `/api/tills/${b1.id}/deactivate`, { method: 'POST' });
  assert.deepEqual(off.body, { id: b1.id, active: false });
});

test('a till cannot be registered to another shop\'s site', async () => {
  const other = await staffSignup(server.baseUrl);
  try {
    const theirSite = (await staffRequest(server.baseUrl, other.cookie, '/api/sites', {
      method: 'POST', body: { name: 'Theirs', code: 'T' },
    })).body;
    const res = await as(owner, '/api/tills', { method: 'POST', body: { siteId: theirSite.id, number: 1, name: 'Sneaky' } });
    assert.equal(res.status, 400);
  } finally {
    await deleteTestShop(other.shop.id);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/till-registration-api.test.js`
Expected: FAIL — first test gets `404` (`Unknown API route`) instead of `201`.

- [ ] **Step 3: Implement the routes in `server/server.js`**

```js
// ---------- Sites and tills (Release 2 offline core) ----------
// A till is registered once by the owner and gets a token shown once; only
// its hash is stored (the same scheme as the booking link). The token never
// expires, so it cannot lapse in the middle of an outage; switching the till
// off is how it is withdrawn.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §5, §8

function serializeSite(row) {
  return { id: row.id, name: row.name, code: row.code };
}

function serializeTill(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    siteId: row.site_id,
    active: row.active,
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
    pendingCount: row.last_pending_count,
  };
}

route('GET', '/api/sites', async (req, res) => {
  sendJson(res, 200, (await db.prepare('SELECT * FROM sites ORDER BY code').all()).map(serializeSite));
});

route('POST', '/api/sites', async (req, res) => {
  const ctx = await currentSession(req);
  if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can add a site' });
  const { name, code } = await readJsonBody(req);
  if (typeof name !== 'string' || !name.trim()) return badRequest(res, 'A site needs a name');
  if (typeof code !== 'string' || !/^[A-Z]{1,3}$/.test(code)) return badRequest(res, 'A site code is one to three capital letters');
  if (await db.prepare('SELECT 1 FROM sites WHERE code = ?').get(code)) return sendJson(res, 409, { error: 'That site code is taken' });
  const { lastInsertRowid } = await db.prepare('INSERT INTO sites (name, code) VALUES (?, ?)').run(name.trim(), code);
  sendJson(res, 201, serializeSite(await db.prepare('SELECT * FROM sites WHERE id = ?').get(lastInsertRowid)));
});

route('GET', '/api/tills', async (req, res) => {
  sendJson(res, 200, (await db.prepare('SELECT * FROM tills ORDER BY code').all()).map(serializeTill));
});

route('POST', '/api/tills', async (req, res) => {
  const ctx = await currentSession(req);
  if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can register a till' });
  const { siteId, number, name } = await readJsonBody(req);
  // RLS hides other shops' sites, so a foreign siteId reads as missing.
  const site = Number.isInteger(siteId) ? await db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId) : null;
  if (!site) return badRequest(res, 'Choose one of your sites');
  if (!Number.isInteger(number) || number < 1 || number > 99) return badRequest(res, 'A till number is 1 to 99');
  if (typeof name !== 'string' || !name.trim()) return badRequest(res, 'A till needs a name');
  const code = `${site.code}${number}`;
  if (await db.prepare('SELECT 1 FROM tills WHERE code = ?').get(code)) return sendJson(res, 409, { error: `Till ${code} already exists` });
  const token = newLinkCode();
  const { lastInsertRowid } = await db.prepare(
    'INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, ?, ?)'
  ).run(site.id, code, name.trim(), hashLinkCode(token));
  const till = await db.prepare('SELECT * FROM tills WHERE id = ?').get(lastInsertRowid);
  sendJson(res, 201, { till: serializeTill(till), token });
});

route('POST', '/api/tills/:id/deactivate', async (req, res, params) => {
  const ctx = await currentSession(req);
  if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can switch a till off' });
  const { changes } = await db.prepare('UPDATE tills SET active = false WHERE id = ?').run(Number(params.id));
  if (!changes) return notFound(res, 'Till not found');
  sendJson(res, 200, { id: Number(params.id), active: false });
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/till-registration-api.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Break it on purpose** — remove the `if (!site) return badRequest(...)` line, confirm the foreign-site test FAILS (a 500 from the null site, not 400), then restore.

- [ ] **Step 6: Commit**

```bash
git add server/server.js tests/helpers/till.js tests/till-registration-api.test.js
git commit -m "feat: sites, till registration and switching a till off (Release 2 offline plan 1)"
```

---

### Task 5: Setting a staff PIN

**Files:**
- Modify: `server/server.js` — next to the team routes.
- Test: add to `tests/till-registration-api.test.js`

**Interfaces:**
- Consumes: `isValidPin`, `hashPin` (Task 3).
- Produces: `PUT /api/employees/:id/pin {pin}` → `204`. `:id` is an `employees.id`. Owner only. `400` for a malformed PIN, `404` for an unknown employee. The PIN is never returned.

- [ ] **Step 1: Write the failing test** (append to `tests/till-registration-api.test.js`)

```js
test('the owner sets a staff PIN; it is stored hashed and never returned', async () => {
  const { verifyPin } = await import('../server/till/pin.js');
  const empId = await runWithShop(owner.shop.id, async () =>
    (await prepare("INSERT INTO employees (name, is_cashier) VALUES ('Alex', 1)").run()).lastInsertRowid);
  assert.equal((await as(owner, `/api/employees/${empId}/pin`, { method: 'PUT', body: { pin: '12' } })).status, 400);
  assert.equal((await as(staff, `/api/employees/${empId}/pin`, { method: 'PUT', body: { pin: '4821' } })).status, 403);
  const res = await as(owner, `/api/employees/${empId}/pin`, { method: 'PUT', body: { pin: '4821' } });
  assert.equal(res.status, 204);
  const row = await runWithShop(owner.shop.id, () => prepare('SELECT pin_hash FROM employees WHERE id = ?').get(empId));
  assert.equal(verifyPin('4821', row.pin_hash), true);
  assert.equal((await as(owner, '/api/employees/999999/pin', { method: 'PUT', body: { pin: '4821' } })).status, 404);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/till-registration-api.test.js`
Expected: the new test FAILS — `404` (`Unknown API route`) where `400` was expected.

- [ ] **Step 3: Implement** — add the import `import { isValidPin, hashPin } from './till/pin.js';` beside the other imports at the top of `server/server.js`, then:

```js
route('PUT', '/api/employees/:id/pin', async (req, res, params) => {
  const ctx = await currentSession(req);
  if (!ctx.login.is_owner) return sendJson(res, 403, { error: 'Only the owner can set a PIN' });
  const { pin } = await readJsonBody(req);
  if (!isValidPin(pin)) return badRequest(res, 'A PIN is 4 to 6 digits');
  const { changes } = await db.prepare('UPDATE employees SET pin_hash = ?, updated_at = now() WHERE id = ?').run(hashPin(pin), Number(params.id));
  if (!changes) return notFound(res, 'Team member not found');
  res.writeHead(204).end();
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/till-registration-api.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Break it on purpose** — store `pin` instead of `hashPin(pin)`, confirm the `verifyPin` assertion FAILS, then restore.

- [ ] **Step 6: Commit**

```bash
git add server/server.js tests/till-registration-api.test.js
git commit -m "feat: owner sets a staff PIN for till check-in (Release 2 offline plan 1)"
```

---

### Task 6: The till's front door and its snapshot

**Files:**
- Create: `server/till/snapshot.js`
- Modify: `server/server.js` — a new dispatcher branch for `/api/till/` placed **before** the `/api/portal/` branch (around line 5969), and the snapshot route.
- Test: `tests/till-snapshot-api.test.js`

**Interfaces:**
- Consumes: `registerTill`, `tillRequest`, `seedProduct` (Task 4 helpers); `hashLinkCode`.
- Produces:
  - Till-authenticated handlers are declared with `route(method, '/api/till/:shopSlug/...', handler)` and receive `(req, res, params, query, till)` where `till` is the `tills` row. The branch answers `401 {error: 'Till not recognised'}` for a missing/wrong/switched-off token or a token from another shop, and rate-limits failures per IP (20 per minute).
  - `GET /api/till/:shopSlug/snapshot` → `{generatedAt, till: {id, code, name, siteId}, lastReceiptNumber, products: [{id, sku, barcode, name, category, pricePence, vatRateBp}], customers: [{id, name, email, phone}], staff: [{id, name, pinHash}]}`. Products and customers: active only. Staff: active cashiers with a PIN set. `lastReceiptNumber` is the highest receipt number the server holds for this till (0 if none), so a cleared or replaced till resumes above it.
  - `buildSnapshot(till) => Promise<object>` in `server/till/snapshot.js`, using `prepare` inside the request's shop scope.

- [ ] **Step 1: Write the failing test**

```js
// tests/till-snapshot-api.test.js
// The till's front door (bearer token) and the snapshot it copies locally.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §5
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { registerTill, tillRequest, seedProduct } from './helpers/till.js';
import { hashPin } from '../server/till/pin.js';

let server; let owner; let other; let b1; let otherTill;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  other = await staffSignup(server.baseUrl);
  b1 = await registerTill(server.baseUrl, owner);
  otherTill = await registerTill(server.baseUrl, other);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const snap = (token, slug = owner.shop.slug) => tillRequest(server.baseUrl, slug, token, '/snapshot');

test('no token, a wrong token, or another shop\'s token is refused', async () => {
  assert.equal((await snap(null)).status, 401);
  assert.equal((await snap('0'.repeat(64))).status, 401);
  assert.equal((await snap(otherTill.token)).status, 401);
});

test('a staff cookie does not open till routes', async () => {
  const res = await fetch(`${server.baseUrl}/api/till/${owner.shop.slug}/snapshot`, { headers: { Cookie: owner.cookie } });
  assert.equal(res.status, 401);
});

test('the snapshot carries prices in pence, VAT rates, and only what the till needs', async () => {
  await seedProduct(owner.shop.id, { name: 'Chain', price: '24.99', vatRateBp: 2000 });
  await seedProduct(owner.shop.id, { name: 'Kids helmet', price: '19.50', vatRateBp: 0 });
  await runWithShop(owner.shop.id, async () => {
    await prepare("INSERT INTO customers (name, email) VALUES ('Jo Rider', 'jo@example.test')").run();
    await prepare("INSERT INTO customers (name, active) VALUES ('Gone', 0)").run();
    await prepare("INSERT INTO employees (name, is_cashier, pin_hash) VALUES ('Alex', 1, ?)").run(hashPin('4821'));
    await prepare("INSERT INTO employees (name, is_cashier) VALUES ('No PIN', 1)").run();
  });
  const res = await snap(b1.token);
  assert.equal(res.status, 200);
  assert.equal(res.body.till.code, 'B1');
  assert.equal(res.body.lastReceiptNumber, 0);
  const chain = res.body.products.find((p) => p.name === 'Chain');
  assert.equal(chain.pricePence, 2499);
  assert.equal(chain.vatRateBp, 2000);
  assert.equal(res.body.products.find((p) => p.name === 'Kids helmet').vatRateBp, 0);
  assert.equal(res.body.products.some((p) => 'price' in p || 'cost' in p), false);
  assert.deepEqual(res.body.customers.map((c) => c.name), ['Jo Rider']);
  assert.deepEqual(res.body.staff.map((s) => s.name), ['Alex']);
  assert.match(res.body.staff[0].pinHash, /^pbkdf2-sha256\$/);
});

test('a switched-off till is refused', async () => {
  const b2 = await registerTill(server.baseUrl, owner, { number: 2 });
  await staffRequest(server.baseUrl, owner.cookie, `/api/tills/${b2.till.id}/deactivate`, { method: 'POST' });
  assert.equal((await snap(b2.token)).status, 401);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/till-snapshot-api.test.js`
Expected: FAIL — the first test gets `404` (`Unknown API route`: the `/api/` branch has no matching route yet) where it expects `401`.

- [ ] **Step 3: Write `server/till/snapshot.js`**

```js
// server/till/snapshot.js
// What a till copies locally so it can sell and find customers offline.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §5
import { prepare } from '../db.js';

export async function buildSnapshot(till) {
  const [products, customers, staff, last] = await Promise.all([
    prepare(
      `SELECT id, sku, barcode, name, category, ROUND(price * 100)::int AS price_pence, vat_rate_bp
       FROM products WHERE active = 1 ORDER BY name`
    ).all(),
    prepare('SELECT id, name, email, phone FROM customers WHERE active = 1 ORDER BY name').all(),
    prepare(
      'SELECT id, name, pin_hash FROM employees WHERE active = 1 AND is_cashier = 1 AND pin_hash IS NOT NULL ORDER BY name'
    ).all(),
    prepare('SELECT COALESCE(MAX(receipt_number), 0) AS n FROM till_sales WHERE till_id = ?').get(till.id),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    till: { id: till.id, code: till.code, name: till.name, siteId: till.site_id },
    lastReceiptNumber: Number(last.n),
    products: products.map((p) => ({
      id: p.id, sku: p.sku, barcode: p.barcode, name: p.name, category: p.category,
      pricePence: p.price_pence, vatRateBp: p.vat_rate_bp,
    })),
    customers: customers.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone })),
    staff: staff.map((s) => ({ id: s.id, name: s.name, pinHash: s.pin_hash })),
  };
}
```

Before relying on `Promise.all` over `prepare`, check `server/db.js` `prepare` for whether one scoped client can run queries concurrently; if it serialises on a single client, that is fine, but if it throws on concurrent use, run the four queries in sequence instead.

- [ ] **Step 4: Add the dispatcher branch and the route in `server/server.js`**

Import at the top: `import { buildSnapshot } from './till/snapshot.js';`. Add the limiter beside the others: `const tillAuthLimiter = makeRateLimiter(20, 60 * 1000);`. Insert this branch **before** `if (pathname.startsWith('/api/portal/'))`:

```js
  // Tills authenticate with a bearer token, not a cookie: a till is a
  // registered device that must keep working across an outage, so its
  // credential never expires (switching the till off withdraws it). The shop
  // comes from :shopSlug, as for portal routes; the token is then looked up
  // inside that shop's RLS scope, so another shop's token reads as unknown.
  if (pathname.startsWith('/api/till/')) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const match = r.regex.exec(pathname);
      if (!match) continue;
      const params = {};
      r.paramNames.forEach((name, i) => (params[name] = match[i + 1]));
      if (!idParamsWellFormed(params)) return notFound(res);

      const ip = clientIp(req);
      const refuse = () => sendJson(res, 401, { error: 'Till not recognised' });
      // Every attempt counts; a recognised till resets its address's count,
      // so only repeated failures from one address reach the limit.
      if (!tillAuthLimiter.check(ip)) return sendJson(res, 429, { error: 'Too many attempts - try again in a minute' });
      const header = req.headers.authorization || '';
      const token = /^Bearer ([0-9a-f]{64})$/.exec(header)?.[1];
      if (!token) return refuse();
      const { rows: [shop] } = await pool.query('SELECT * FROM shops WHERE slug = $1', [params.shopSlug]);
      if (!shop) return refuse();

      try {
        await runWithShop(shop.id, async () => {
          const till = await db.prepare('SELECT * FROM tills WHERE token_hash = ? AND active = true').get(hashLinkCode(token));
          if (!till) return refuse();
          tillAuthLimiter.reset(ip);
          await r.handler(req, res, params, url.searchParams, till);
        });
      } catch (err) {
        console.error(err);
        sendJson(res, 500, { error: err.message || 'Internal server error' });
      }
      return;
    }
    return notFound(res, 'Unknown till route');
  }
```

Note: a shop's tills usually share one public address, so the reset on success matters — a working till clears the count for its neighbours too. Twenty failed attempts in a minute from one address, with no success between, are refused.

And the route (with the other till routes, after Task 4's block):

```js
route('GET', '/api/till/:shopSlug/snapshot', async (req, res, params, query, till) => {
  sendJson(res, 200, await buildSnapshot(till));
});
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/till-snapshot-api.test.js tests/till-registration-api.test.js`
Expected: PASS (all).

- [ ] **Step 6: Break it on purpose** — remove `AND active = true` from the token lookup, confirm `a switched-off till is refused` FAILS with 200, then restore.

- [ ] **Step 7: Commit**

```bash
git add server/till/snapshot.js server/server.js tests/till-snapshot-api.test.js
git commit -m "feat: till bearer-token access and the offline snapshot (Release 2 offline plan 1)"
```

---

### Task 7: Recording a sale exactly once

**Files:**
- Create: `server/till/attention.js`, `server/till/sync.js`
- Modify: `server/server.js` — the sync route.
- Test: `tests/till-sync-api.test.js`

**Interfaces:**
- Consumes: `vatFromGrossPence`, `receiptLabel` (Task 2); the till branch (Task 6).
- Produces:
  - `POST /api/till/:shopSlug/sync {pendingCount, items: [Item]}` → `200 {results: [{clientId, status: 'recorded' | 'duplicate', attention: [kind]}]}`, one result per item, in order. `400` only when the body is not an object with an `items` array, or an item has no valid UUID `clientId` or an unknown `kind` — nothing in the batch is recorded then. An empty `items` is a heartbeat.
  - Every request sets `tills.last_seen_at = now()` and `tills.last_pending_count = pendingCount` (integer ≥ 0; anything else stores 0).
  - `Item` for a sale: `{kind: 'sale', clientId, receiptNumber, tillClockAt, madeOffline, employeeId, customerId?, customerClientId?, lines: [{productId, description, qty, unitPricePence, vatRateBp}], payments: [{method, amountPence}]}`.
  - `flag(kind, {detail, tillSaleId?, productId?, customerId?})` in `server/till/attention.js`; for `stock_below_zero` it does nothing if an open item exists for that product.
  - `processSyncItems(till, items) => Promise<results>` in `server/till/sync.js`. Each item is its own transaction (`BEGIN`/`COMMIT` via `dbExec`), so one bad item never loses the others.

- [ ] **Step 1: Write the failing test**

```js
// tests/till-sync-api.test.js
// The sync endpoint: a till's sales recorded exactly once, in pence with VAT,
// never refused and never discarded.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §3, §5, §8, §9
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { registerTill, tillRequest, seedProduct } from './helpers/till.js';

let server; let owner; let b1; let alex; let receipt = 0;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  b1 = await registerTill(server.baseUrl, owner);
  alex = await runWithShop(owner.shop.id, async () =>
    (await prepare("INSERT INTO employees (name, is_cashier) VALUES ('Alex', 1)").run()).lastInsertRowid);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const sync = (items, pendingCount = 0, token = b1.token) =>
  tillRequest(server.baseUrl, owner.shop.slug, token, '/sync', { method: 'POST', body: { pendingCount, items } });
const inShop = (fn) => runWithShop(owner.shop.id, fn);

function sale(productId, { qty = 1, unitPricePence = 699, vatRateBp = 2000, payments, ...rest } = {}) {
  const total = qty * unitPricePence;
  return {
    kind: 'sale', clientId: randomUUID(), receiptNumber: ++receipt, tillClockAt: '2026-09-01T09:30:00.000Z',
    madeOffline: true, employeeId: alex,
    lines: [{ productId, description: 'Inner tube', qty, unitPricePence, vatRateBp }],
    payments: payments || [{ method: 'cash', amountPence: total }],
    ...rest,
  };
}

test('a sale is recorded in pence with VAT per line, and stock goes down', async () => {
  const tube = await seedProduct(owner.shop.id, { stock: 5 });
  const item = sale(tube, { qty: 2 });
  const res = await sync([item]);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.results, [{ clientId: item.clientId, status: 'recorded', attention: [] }]);
  const row = await inShop(() => prepare('SELECT * FROM till_sales WHERE client_id = ?').get(item.clientId));
  assert.equal(row.total_pence, 1398);
  assert.equal(row.vat_pence, 233);
  assert.equal(row.made_offline, true);
  assert.equal(row.till_id, b1.till.id);
  const line = await inShop(() => prepare('SELECT * FROM till_sale_lines WHERE till_sale_id = ?').get(row.id));
  assert.deepEqual([line.qty, line.line_total_pence, line.vat_rate_bp, line.vat_pence], [2, 1398, 2000, 233]);
  const product = await inShop(() => prepare('SELECT stock_qty FROM products WHERE id = ?').get(tube));
  assert.equal(product.stock_qty, 3);
  const move = await inShop(() => prepare("SELECT * FROM stock_movements WHERE product_id = ? AND type = 'till_sale'").get(tube));
  assert.equal(move.change_qty, -2);
  assert.equal(move.note, `Till sale B1-${String(item.receiptNumber).padStart(4, '0')}`);
});

test('the same sale sent twice is recorded once', async () => {
  const tube = await seedProduct(owner.shop.id, { stock: 5 });
  const item = sale(tube);
  await sync([item]);
  const again = await sync([item]);
  assert.equal(again.body.results[0].status, 'duplicate');
  const { n } = await inShop(() => prepare('SELECT COUNT(*)::int AS n FROM till_sales WHERE client_id = ?').get(item.clientId));
  assert.equal(n, 1);
  assert.equal((await inShop(() => prepare('SELECT stock_qty FROM products WHERE id = ?').get(tube))).stock_qty, 4);
});

test('an empty batch is a heartbeat: last seen and waiting count are stored', async () => {
  await sync([], 14);
  const tills = (await staffRequest(server.baseUrl, owner.cookie, '/api/tills')).body;
  const t = tills.find((x) => x.code === 'B1');
  assert.equal(t.pendingCount, 14);
  assert.ok(t.lastSeenAt);
});

test('a malformed batch is refused whole', async () => {
  const tube = await seedProduct(owner.shop.id);
  const good = sale(tube);
  const res = await sync([good, { kind: 'sale', clientId: 'not-a-uuid' }]);
  assert.equal(res.status, 400);
  assert.equal(await inShop(() => prepare('SELECT 1 FROM till_sales WHERE client_id = ?').get(good.clientId)), undefined);
});
```

Before writing the `undefined` assertion, check what `prepare(...).get()` returns for no row in `server/db.js` (`undefined` or `null`) and assert that value.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/till-sync-api.test.js`
Expected: FAIL — `404 Unknown till route` instead of `200`.

- [ ] **Step 3: Write `server/till/attention.js`**

```js
// server/till/attention.js
// The attention list: "check these" (stock below zero) and "needs attention"
// (a sale the server could not fully accept). A sale is never discarded; it is
// recorded and flagged here with the reason.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §5, §8
import { prepare } from '../db.js';

export async function flag(kind, { detail, tillSaleId = null, productId = null, customerId = null }) {
  if (kind === 'stock_below_zero') {
    const open = await prepare(
      "SELECT 1 FROM till_attention WHERE kind = 'stock_below_zero' AND product_id = ? AND resolved_at IS NULL"
    ).get(productId);
    if (open) return;
  }
  await prepare(
    'INSERT INTO till_attention (kind, detail, till_sale_id, product_id, customer_id) VALUES (?, ?, ?, ?, ?)'
  ).run(kind, detail, tillSaleId, productId, customerId);
}

export async function listOpen() {
  return prepare('SELECT * FROM till_attention WHERE resolved_at IS NULL ORDER BY created_at, id').all();
}

export async function resolve(id, loginId) {
  const { changes } = await prepare(
    'UPDATE till_attention SET resolved_at = now(), resolved_by_login_id = ? WHERE id = ? AND resolved_at IS NULL'
  ).run(loginId, id);
  return changes > 0;
}
```

- [ ] **Step 4: Write `server/till/sync.js`**

```js
// server/till/sync.js
// Records what a till sends, exactly once. Each item carries a UUID made on
// the till; an item already held is acknowledged as a duplicate and ignored.
// Each item is its own transaction so one bad item never loses the rest. A
// sale is never refused or discarded: whatever cannot be matched is recorded
// as the till sent it and flagged. The price charged at the till stands.
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §3, §5, §8
import { prepare, dbExec } from '../db.js';
import { vatFromGrossPence, receiptLabel } from './money.js';
import { flag } from './attention.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = new Set(['sale']);
const KNOWN_PAYMENT_METHODS = new Set(['cash', 'card']);

// Shape checks only: a batch that fails these is refused whole (400). Anything
// that passes is recorded, however wrong its contents turn out to be.
export function batchProblem(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.items)) return 'Send { items: [...] }';
  for (const item of body.items) {
    if (!item || typeof item !== 'object') return 'Every item must be an object';
    if (typeof item.clientId !== 'string' || !UUID.test(item.clientId)) return 'Every item needs a UUID clientId';
    if (!KINDS.has(item.kind)) return `Unknown item kind: ${item.kind}`;
    if (item.kind === 'sale') {
      if (!Number.isInteger(item.receiptNumber) || item.receiptNumber < 1) return 'A sale needs a receiptNumber';
      if (Number.isNaN(Date.parse(item.tillClockAt))) return 'A sale needs tillClockAt';
      if (!Array.isArray(item.lines) || item.lines.length === 0) return 'A sale needs lines';
      if (!Array.isArray(item.payments)) return 'A sale needs payments';
      for (const l of item.lines) {
        if (!Number.isInteger(l.qty) || l.qty < 1) return 'A line needs a whole qty of at least 1';
        if (!Number.isInteger(l.unitPricePence)) return 'A line needs unitPricePence';
        if (!Number.isInteger(l.vatRateBp) || l.vatRateBp < 0 || l.vatRateBp > 10000) return 'A line needs vatRateBp';
        if (typeof l.description !== 'string') return 'A line needs a description';
      }
      for (const p of item.payments) {
        if (typeof p.method !== 'string' || !Number.isInteger(p.amountPence)) return 'A payment needs method and amountPence';
      }
    }
  }
  return null;
}

async function recordSale(till, item) {
  const held = await prepare('SELECT id FROM till_sales WHERE client_id = ?').get(item.clientId);
  if (held) return { status: 'duplicate', attention: [] };

  const attention = [];
  const raise = async (kind, fields) => { attention.push(kind); await flag(kind, fields); };
  const label = receiptLabel(till.code, item.receiptNumber);

  const lines = item.lines.map((l) => {
    const lineTotal = l.qty * l.unitPricePence;
    return { ...l, lineTotal, vat: vatFromGrossPence(lineTotal, l.vatRateBp) };
  });
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  const vat = lines.reduce((s, l) => s + l.vat, 0);

  const employee = Number.isInteger(item.employeeId)
    ? await prepare('SELECT id FROM employees WHERE id = ?').get(item.employeeId) : null;
  const customer = Number.isInteger(item.customerId)
    ? await prepare('SELECT id FROM customers WHERE id = ?').get(item.customerId) : null;

  const reused = await prepare('SELECT 1 FROM till_sales WHERE till_id = ? AND receipt_number = ?').get(till.id, item.receiptNumber);

  const { lastInsertRowid: saleId } = await prepare(
    `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, employee_id, customer_id, made_offline, till_clock_at, total_pence, vat_pence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(item.clientId, till.id, till.site_id, item.receiptNumber, employee?.id ?? null, customer?.id ?? null,
    item.madeOffline === true, new Date(item.tillClockAt).toISOString(), total, vat);

  if (reused) await raise('receipt_number_reused', { detail: `${label} was already used on this till`, tillSaleId: saleId });
  if (item.employeeId != null && !employee) await raise('unknown_employee', { detail: `${label}: staff member ${item.employeeId} not found`, tillSaleId: saleId });
  if (item.customerId != null && !customer) await raise('unknown_customer', { detail: `${label}: customer ${item.customerId} not found`, tillSaleId: saleId });

  for (const l of lines) {
    const product = Number.isInteger(l.productId)
      ? await prepare('SELECT id FROM products WHERE id = ?').get(l.productId) : null;
    await prepare(
      `INSERT INTO till_sale_lines (till_sale_id, product_id, description, qty, unit_price_pence, line_total_pence, vat_rate_bp, vat_pence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(saleId, product?.id ?? null, l.description, l.qty, l.unitPricePence, l.lineTotal, l.vatRateBp, l.vat);
    if (!product) {
      await raise('unknown_product', { detail: `${label}: "${l.description}" is not a product we hold`, tillSaleId: saleId });
      continue;
    }
    // Relative update, so two tills' sales both count however they interleave.
    const { stock_qty: after } = await prepare(
      'UPDATE products SET stock_qty = stock_qty - ?, updated_at = now() WHERE id = ? RETURNING stock_qty'
    ).get(l.qty, product.id);
    await prepare("INSERT INTO stock_movements (product_id, change_qty, type, note) VALUES (?, ?, 'till_sale', ?)")
      .run(product.id, -l.qty, `Till sale ${label}`);
    if (after < 0) await raise('stock_below_zero', { detail: `"${l.description}" is at ${after} after ${label}`, productId: product.id });
  }

  let paid = 0;
  for (const p of item.payments) {
    await prepare('INSERT INTO till_sale_payments (till_sale_id, method, amount_pence) VALUES (?, ?, ?)').run(saleId, p.method, p.amountPence);
    paid += p.amountPence;
    if (!KNOWN_PAYMENT_METHODS.has(p.method)) {
      await raise('unsupported_payment_method', { detail: `${label}: payment method "${p.method}" is not handled yet`, tillSaleId: saleId });
    }
  }
  if (paid !== total) await raise('payments_do_not_match', { detail: `${label}: paid ${paid}p against a total of ${total}p`, tillSaleId: saleId });

  return { status: 'recorded', attention };
}

export async function processSyncItems(till, items) {
  const results = [];
  for (const item of items) {
    await dbExec('BEGIN');
    try {
      const outcome = await recordSale(till, item);
      await dbExec('COMMIT');
      results.push({ clientId: item.clientId, ...outcome });
    } catch (err) {
      await dbExec('ROLLBACK');
      throw err;
    }
  }
  return results;
}
```

Check before writing: `prepare(sql).get()` on an `UPDATE ... RETURNING` — confirm in `server/db.js` that `.get()` returns the first row for any statement (not only `SELECT`). If it does not, use `.all()` and take `[0]`.

- [ ] **Step 5: Add the route in `server/server.js`**

Import: `import { batchProblem, processSyncItems } from './till/sync.js';`

```js
route('POST', '/api/till/:shopSlug/sync', async (req, res, params, query, till) => {
  const body = await readJsonBody(req);
  const problem = batchProblem(body);
  if (problem) return badRequest(res, problem);
  const pending = Number.isInteger(body.pendingCount) && body.pendingCount >= 0 ? body.pendingCount : 0;
  await db.prepare('UPDATE tills SET last_seen_at = now(), last_pending_count = ? WHERE id = ?').run(pending, till.id);
  sendJson(res, 200, { results: await processSyncItems(till, body.items) });
});
```

- [ ] **Step 6: Run to verify it passes**

Run: `node --test tests/till-sync-api.test.js`
Expected: PASS (4 tests).

- [ ] **Step 7: Break it on purpose** — delete the `if (held) return { status: 'duplicate', ... }` line, confirm `the same sale sent twice is recorded once` FAILS (a `duplicate key` 500 on the second send), then restore. Separately, change `stock_qty - ?` to `stock_qty + ?`, confirm the stock assertion FAILS with 7, then restore.

- [ ] **Step 8: Commit**

```bash
git add server/till/attention.js server/till/sync.js server/server.js tests/till-sync-api.test.js
git commit -m "feat: till sync records each sale exactly once in pence with VAT (Release 2 offline plan 1)"
```

---

### Task 8: Never refuse, never discard — below-zero stock, unknown products, mismatched payments

**Files:**
- Test: add to `tests/till-sync-api.test.js` (behaviour is already implemented in Task 7; these tests pin it)

**Interfaces:**
- Consumes: Task 7.

- [ ] **Step 1: Write the tests**

```js
test('stock is allowed below zero and flagged once per product', async () => {
  const tube = await seedProduct(owner.shop.id, { stock: 1 });
  const first = await sync([sale(tube, { qty: 2 })]);
  assert.deepEqual(first.body.results[0].attention, ['stock_below_zero']);
  await sync([sale(tube)]);
  const open = await inShop(() => prepare(
    "SELECT COUNT(*)::int AS n FROM till_attention WHERE kind = 'stock_below_zero' AND product_id = ? AND resolved_at IS NULL"
  ).get(tube));
  assert.equal(open.n, 1);
  assert.equal((await inShop(() => prepare('SELECT stock_qty FROM products WHERE id = ?').get(tube))).stock_qty, -2);
});

test('a sale of a product the server no longer has is recorded and flagged', async () => {
  const item = sale(2147483000);
  const res = await sync([item]);
  assert.equal(res.body.results[0].status, 'recorded');
  assert.deepEqual(res.body.results[0].attention, ['unknown_product']);
  const row = await inShop(() => prepare('SELECT total_pence FROM till_sales WHERE client_id = ?').get(item.clientId));
  assert.equal(row.total_pence, 699);
});

test('the price charged at the till stands', async () => {
  const tube = await seedProduct(owner.shop.id, { price: '9.99' });
  const item = sale(tube, { unitPricePence: 500 });
  await sync([item]);
  const row = await inShop(() => prepare('SELECT total_pence FROM till_sales WHERE client_id = ?').get(item.clientId));
  assert.equal(row.total_pence, 500);
});

test('payments that do not add up, or an unhandled method, are recorded and flagged', async () => {
  const tube = await seedProduct(owner.shop.id);
  const short = await sync([sale(tube, { payments: [{ method: 'cash', amountPence: 600 }] })]);
  assert.deepEqual(short.body.results[0].attention, ['payments_do_not_match']);
  const account = await sync([sale(tube, { payments: [{ method: 'account', amountPence: 699 }] })]);
  assert.deepEqual(account.body.results[0].attention, ['unsupported_payment_method']);
});

test('an unknown staff member or customer is recorded and flagged', async () => {
  const tube = await seedProduct(owner.shop.id);
  const res = await sync([sale(tube, { employeeId: 2147483000, customerId: 2147483000 })]);
  assert.deepEqual(res.body.results[0].attention.sort(), ['unknown_customer', 'unknown_employee']);
});
```

- [ ] **Step 2: Run them**

Run: `node --test tests/till-sync-api.test.js`
Expected: PASS. These pin Task 7's behaviour, so they are not watched failing first; Step 3 proves each one bites instead.

- [ ] **Step 3: Break it on purpose, one at a time, restoring after each**
  - Remove the `if (kind === 'stock_below_zero') {...}` early return in `attention.js` → the "flagged once" test FAILS on the unique index (500) or count 2.
  - Replace `l.qty * l.unitPricePence` with a lookup of the product's current price → "price stands" FAILS with 999.
  - Remove the `paid !== total` check → the mismatched-payments test FAILS.

- [ ] **Step 4: Commit**

```bash
git add tests/till-sync-api.test.js
git commit -m "test: till sync never refuses and never discards a sale (Release 2 offline plan 1)"
```

---

### Task 9: New customers offline, possible duplicates, and staff check-ins

**Files:**
- Modify: `server/till/sync.js` — add `customer` and `checkin` item kinds; resolve `customerClientId` on sales.
- Test: add to `tests/till-sync-api.test.js`

**Interfaces:**
- Produces:
  - `Item` for a customer: `{kind: 'customer', clientId, name, email?, phone?}`. Recorded once per `clientId` (stored in `customers.client_id`). If an active customer other than this one has the same email (case-insensitive) or the same phone (digits only), a `possible_duplicate_customer` item is flagged with the new customer's id. Nothing is merged.
  - A sale may carry `customerClientId` instead of `customerId`: it resolves to the customer with that `client_id`; if none, the sale is recorded without a customer and flagged `unknown_customer`.
  - `Item` for a check-in: `{kind: 'checkin', clientId, employeeId, checkedInAt}`. Recorded once per `clientId` into `staff_checkins`; an unknown employee is skipped with result `attention: ['unknown_employee']` (there is no sale to hang a flag on, so it is reported in the result only).

- [ ] **Step 1: Write the failing tests**

```js
test('a customer added offline is created once, and a sale can point at it', async () => {
  const tube = await seedProduct(owner.shop.id);
  const cust = { kind: 'customer', clientId: randomUUID(), name: 'Sam Spokes', email: 'sam@example.test', phone: '07700 900123' };
  const item = { ...sale(tube), customerClientId: cust.clientId };
  const res = await sync([cust, item]);
  assert.deepEqual(res.body.results.map((r) => r.status), ['recorded', 'recorded']);
  assert.equal((await sync([cust])).body.results[0].status, 'duplicate');
  const c = await inShop(() => prepare('SELECT id FROM customers WHERE client_id = ?').get(cust.clientId));
  const s = await inShop(() => prepare('SELECT customer_id FROM till_sales WHERE client_id = ?').get(item.clientId));
  assert.equal(s.customer_id, c.id);
});

test('a customer who may already exist is flagged, not merged', async () => {
  await inShop(() => prepare("INSERT INTO customers (name, email, phone) VALUES ('Sam S', 'SAM2@example.test', '07700 900999')").run());
  const byEmail = { kind: 'customer', clientId: randomUUID(), name: 'Sam', email: 'sam2@example.test' };
  const byPhone = { kind: 'customer', clientId: randomUUID(), name: 'Samuel', phone: '07700900999' };
  const res = await sync([byEmail, byPhone]);
  assert.deepEqual(res.body.results.map((r) => r.attention), [['possible_duplicate_customer'], ['possible_duplicate_customer']]);
  const n = await inShop(() => prepare("SELECT COUNT(*)::int AS n FROM customers WHERE name LIKE 'Sam%'").get());
  assert.equal(n.n, 4); // Sam Spokes, Sam S, Sam, Samuel — nothing merged
});

test('a sale pointing at a customer the server never received is recorded without one', async () => {
  const tube = await seedProduct(owner.shop.id);
  const res = await sync([{ ...sale(tube), customerClientId: randomUUID() }]);
  assert.deepEqual(res.body.results[0].attention, ['unknown_customer']);
});

test('a check-in is recorded once', async () => {
  const item = { kind: 'checkin', clientId: randomUUID(), employeeId: alex, checkedInAt: '2026-09-01T08:55:00.000Z' };
  assert.equal((await sync([item])).body.results[0].status, 'recorded');
  assert.equal((await sync([item])).body.results[0].status, 'duplicate');
  const rows = await inShop(() => prepare('SELECT till_id FROM staff_checkins WHERE client_id = ?').all(item.clientId));
  assert.deepEqual(rows.map((r) => r.till_id), [b1.till.id]);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/till-sync-api.test.js`
Expected: the four new tests FAIL with `400` (`Unknown item kind: customer` / `checkin`).

- [ ] **Step 3: Implement in `server/till/sync.js`**

Change `KINDS` to `new Set(['sale', 'customer', 'checkin'])` and add to `batchProblem`, inside the loop:

```js
    if (item.kind === 'customer' && (typeof item.name !== 'string' || !item.name.trim())) return 'A customer needs a name';
    if (item.kind === 'checkin') {
      if (!Number.isInteger(item.employeeId)) return 'A check-in needs employeeId';
      if (Number.isNaN(Date.parse(item.checkedInAt))) return 'A check-in needs checkedInAt';
    }
```

Add the two recorders:

```js
const digits = (s) => (typeof s === 'string' ? s.replace(/\D/g, '') : '');

async function recordCustomer(item) {
  const held = await prepare('SELECT id FROM customers WHERE client_id = ?').get(item.clientId);
  if (held) return { status: 'duplicate', attention: [] };
  const email = typeof item.email === 'string' && item.email.trim() ? item.email.trim() : null;
  const phone = typeof item.phone === 'string' && item.phone.trim() ? item.phone.trim() : null;
  const { lastInsertRowid: id } = await prepare(
    'INSERT INTO customers (name, email, phone, client_id) VALUES (?, ?, ?, ?)'
  ).run(item.name.trim(), email, phone, item.clientId);
  const phoneDigits = digits(phone);
  const match = await prepare(
    `SELECT id FROM customers WHERE active = 1 AND id <> ? AND (
       (? <> '' AND lower(email) = lower(?)) OR
       (? <> '' AND regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = ?)
     ) LIMIT 1`
  ).get(id, email || '', email || '', phoneDigits, phoneDigits);
  if (!match) return { status: 'recorded', attention: [] };
  await flag('possible_duplicate_customer', { detail: `"${item.name.trim()}" may be the same person as customer ${match.id}`, customerId: id });
  return { status: 'recorded', attention: ['possible_duplicate_customer'] };
}

async function recordCheckin(till, item) {
  const held = await prepare('SELECT id FROM staff_checkins WHERE client_id = ?').get(item.clientId);
  if (held) return { status: 'duplicate', attention: [] };
  const employee = await prepare('SELECT id FROM employees WHERE id = ?').get(item.employeeId);
  if (!employee) return { status: 'recorded', attention: ['unknown_employee'] };
  await prepare('INSERT INTO staff_checkins (employee_id, till_id, client_id, checked_in_at) VALUES (?, ?, ?, ?)')
    .run(employee.id, till.id, item.clientId, new Date(item.checkedInAt).toISOString());
  return { status: 'recorded', attention: [] };
}
```

Check the `'\\D'` escaping against how `prepare` rewrites `?` placeholders (it must not treat characters inside the SQL string literal as placeholders); run the test to confirm.

In `recordSale`, replace the `customer` lookup with:

```js
  let customer = null;
  if (Number.isInteger(item.customerId)) {
    customer = await prepare('SELECT id FROM customers WHERE id = ?').get(item.customerId);
  } else if (typeof item.customerClientId === 'string' && UUID.test(item.customerClientId)) {
    customer = await prepare('SELECT id FROM customers WHERE client_id = ?').get(item.customerClientId);
  }
  const askedForCustomer = item.customerId != null || item.customerClientId != null;
```

and the unknown-customer check with `if (askedForCustomer && !customer) await raise('unknown_customer', { detail: `${label}: customer not found`, tillSaleId: saleId });`.

In `processSyncItems`, dispatch on kind:

```js
      const outcome = item.kind === 'customer' ? await recordCustomer(item)
        : item.kind === 'checkin' ? await recordCheckin(till, item)
        : await recordSale(till, item);
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test tests/till-sync-api.test.js`
Expected: PASS (all).

- [ ] **Step 5: Break it on purpose** — remove the `if (held)` line in `recordCustomer`, confirm the "created once" test FAILS on the unique index; restore. Change `lower(email) = lower(?)` to `email = ?`, confirm the by-email duplicate test FAILS; restore.

- [ ] **Step 6: Commit**

```bash
git add server/till/sync.js tests/till-sync-api.test.js
git commit -m "feat: customers added offline, possible duplicates flagged, staff check-ins (Release 2 offline plan 1)"
```

---

### Task 10: Out of order, cut off half-way, and two tills

**Files:**
- Test: add to `tests/till-sync-api.test.js`

**Interfaces:**
- Consumes: Tasks 7 and 9.

- [ ] **Step 1: Write the tests**

```js
test('sales arriving out of order are all recorded with their own receipt numbers', async () => {
  const tube = await seedProduct(owner.shop.id, { stock: 10 });
  const s1 = sale(tube); const s2 = sale(tube); const s3 = sale(tube);
  await sync([s3, s1]);
  await sync([s2]);
  const rows = await inShop(() => prepare(
    'SELECT receipt_number FROM till_sales WHERE client_id IN (?, ?, ?) ORDER BY receipt_number'
  ).all(s1.clientId, s2.clientId, s3.clientId));
  assert.deepEqual(rows.map((r) => r.receipt_number), [s1.receiptNumber, s2.receiptNumber, s3.receiptNumber]);
  assert.equal((await inShop(() => prepare('SELECT stock_qty FROM products WHERE id = ?').get(tube))).stock_qty, 7);
});

// The till sent a batch, the server recorded it, and the reply was lost. The
// till re-sends the whole batch plus a new sale: nothing doubles, nothing is lost.
test('a batch re-sent after a lost reply neither doubles nor loses a sale', async () => {
  const tube = await seedProduct(owner.shop.id, { stock: 10 });
  const a = sale(tube); const b = sale(tube); const c = sale(tube);
  await sync([a, b]);
  const res = await sync([a, b, c]);
  assert.deepEqual(res.body.results.map((r) => r.status), ['duplicate', 'duplicate', 'recorded']);
  assert.equal((await inShop(() => prepare('SELECT stock_qty FROM products WHERE id = ?').get(tube))).stock_qty, 7);
});

test('two tills can use the same running number without clashing', async () => {
  const b2 = await registerTill(server.baseUrl, owner, { number: 2 });
  const tube = await seedProduct(owner.shop.id, { stock: 10 });
  const onB1 = { ...sale(tube), receiptNumber: 9001 };
  const onB2 = { ...sale(tube), receiptNumber: 9001 };
  await sync([onB1]);
  const res = await sync([onB2], 0, b2.token);
  assert.deepEqual(res.body.results[0].attention, []);
  const moves = await inShop(() => prepare(
    "SELECT note FROM stock_movements WHERE product_id = ? ORDER BY id"
  ).all(tube));
  assert.deepEqual(moves.map((m) => m.note), ['Till sale B1-9001', 'Till sale B2-9001']);
});

test('the same till reusing a receipt number is recorded and flagged', async () => {
  const tube = await seedProduct(owner.shop.id);
  await sync([{ ...sale(tube), receiptNumber: 8001 }]);
  const res = await sync([{ ...sale(tube), receiptNumber: 8001 }]);
  assert.deepEqual(res.body.results[0].attention, ['receipt_number_reused']);
});

test('the snapshot tells a replaced till where its numbers got to', async () => {
  const res = await tillRequest(server.baseUrl, owner.shop.slug, b1.token, '/snapshot');
  assert.equal(res.body.lastReceiptNumber, 9001);
});
```

- [ ] **Step 2: Run them**

Run: `node --test tests/till-sync-api.test.js`
Expected: PASS — these pin behaviour from Tasks 6, 7 and 9, so Step 3 proves they bite.

- [ ] **Step 3: Break it on purpose, restoring after each**
  - In `processSyncItems`, `throw` inside the loop when `results.length === 1` after committing → the re-sent-batch test FAILS (500).
  - Change the receipt-reuse lookup to ignore `till_id` (`WHERE receipt_number = ?`) → the two-tills test FAILS with `['receipt_number_reused']`.

- [ ] **Step 4: Commit**

```bash
git add tests/till-sync-api.test.js
git commit -m "test: till sync survives out-of-order and re-sent batches across tills (Release 2 offline plan 1)"
```

---

### Task 11: The attention list for managers

**Files:**
- Modify: `server/server.js`
- Test: `tests/till-attention-api.test.js`

**Interfaces:**
- Consumes: `listOpen`, `resolve` (`server/till/attention.js`).
- Produces (cookie-authenticated): `GET /api/till-attention` → `[{id, kind, detail, tillSaleId, productId, customerId, createdAt}]` (open items, oldest first); `POST /api/till-attention/:id/resolve` → `200 {id, resolved: true}`, `404` if unknown or already resolved. Any signed-in staff member may resolve (not owner-only): these are day-to-day shop-floor checks.

- [ ] **Step 1: Write the failing test**

```js
// tests/till-attention-api.test.js
// The manager's attention list: "check these" and "needs attention".
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §5, §8
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { registerTill, tillRequest, seedProduct } from './helpers/till.js';

let server; let owner; let other; let b1;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  other = await staffSignup(server.baseUrl);
  b1 = await registerTill(server.baseUrl, owner);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

test('below-zero stock appears on the list, and resolving clears it', async () => {
  const tube = await seedProduct(owner.shop.id, { stock: 0 });
  await tillRequest(server.baseUrl, owner.shop.slug, b1.token, '/sync', { method: 'POST', body: { pendingCount: 0, items: [{
    kind: 'sale', clientId: randomUUID(), receiptNumber: 1, tillClockAt: '2026-09-01T09:30:00.000Z', madeOffline: false,
    lines: [{ productId: tube, description: 'Inner tube', qty: 1, unitPricePence: 699, vatRateBp: 2000 }],
    payments: [{ method: 'card', amountPence: 699 }],
  }] } });
  const list = (await staffRequest(server.baseUrl, owner.cookie, '/api/till-attention')).body;
  const item = list.find((a) => a.kind === 'stock_below_zero' && a.productId === tube);
  assert.ok(item);
  assert.equal((await staffRequest(server.baseUrl, other.cookie, `/api/till-attention/${item.id}/resolve`, { method: 'POST' })).status, 404);
  const done = await staffRequest(server.baseUrl, owner.cookie, `/api/till-attention/${item.id}/resolve`, { method: 'POST' });
  assert.deepEqual(done.body, { id: item.id, resolved: true });
  const after = (await staffRequest(server.baseUrl, owner.cookie, '/api/till-attention')).body;
  assert.equal(after.some((a) => a.id === item.id), false);
  assert.equal((await staffRequest(server.baseUrl, owner.cookie, `/api/till-attention/${item.id}/resolve`, { method: 'POST' })).status, 404);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/till-attention-api.test.js`
Expected: FAIL — `GET /api/till-attention` returns `404`, so `list.find` throws on a non-array.

- [ ] **Step 3: Implement in `server/server.js`**

Import: `import { listOpen as listOpenAttention, resolve as resolveAttention } from './till/attention.js';`

```js
route('GET', '/api/till-attention', async (req, res) => {
  const rows = await listOpenAttention();
  sendJson(res, 200, rows.map((r) => ({
    id: r.id, kind: r.kind, detail: r.detail,
    tillSaleId: r.till_sale_id, productId: r.product_id, customerId: r.customer_id,
    createdAt: new Date(r.created_at).toISOString(),
  })));
});

route('POST', '/api/till-attention/:id/resolve', async (req, res, params) => {
  const ctx = await currentSession(req);
  if (!(await resolveAttention(Number(params.id), ctx.login.id))) return notFound(res, 'Nothing open with that id');
  sendJson(res, 200, { id: Number(params.id), resolved: true });
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/till-attention-api.test.js`
Expected: PASS.

- [ ] **Step 5: Break it on purpose** — drop `AND resolved_at IS NULL` from `resolve`'s `UPDATE`, confirm the second resolve no longer returns 404 (test FAILS), then restore.

- [ ] **Step 6: Commit**

```bash
git add server/server.js tests/till-attention-api.test.js
git commit -m "feat: the till attention list for managers (Release 2 offline plan 1)"
```

---

### Task 12: Full check, spec walk, status

**Files:**
- Modify: `.agents/STATUS.md` (a short Release 2 paragraph near the top: what plan 1 built, the branch, what plan 2 needs)
- Modify: `docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md` (status line; §11 note that credit-account/loyalty moved to piece 4 and the credential decision)

- [ ] **Step 1: Run everything CI runs that this plan touches**

```bash
npm run typecheck && npm run lint && npm run migrate && node scripts/ci/assert-rls-coverage.mjs && npm test && npm run migrate
```

Expected: every step exits 0; the final `migrate` applies nothing. Paste the tail of the `npm test` output (pass/fail counts) into the PR description.

- [ ] **Step 2: Walk the spec line by line** and write the result into the PR description as three lists — met, deferred (with where it went), changed:
  - Met in plan 1: §3 "when the connection returns" (server side), §4 PIN storage and check-in recording, §5 registration, credential, snapshot, exactly-once, receipt numbers, stock never blocks, §6 data changes, §7 default 1, §8 manager view data, never-discard, price stands, §9 tests 1, 2, 3, 6, 7 (server side).
  - Deferred to plan 2 (till core): the service worker and page loading offline, local storage, the queue, the four-hour banner rule, refusing sign-out with sales waiting, persistent storage, §9 tests 4 and 5 (PIN check and page load with no connection).
  - Deferred to plan 3 (screens): register a till, check-in, the banner, the manager's tills view and attention list.
  - Deferred to piece 4 (customers): §7 default 3 (credit accounts, loyalty) — no account or loyalty data exists yet.
  - Changed: the till credential never expires rather than renewing itself (see "Decisions taken in this plan").

- [ ] **Step 3: Update STATUS.md and the spec's status line, commit**

```bash
git add .agents/STATUS.md docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md
git commit -m "docs: Release 2 offline plan 1 status and spec walk"
```
