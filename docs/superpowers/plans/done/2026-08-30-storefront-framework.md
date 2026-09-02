# Storefront Framework Implementation Plan

> # ⚠️ ALREADY IMPLEMENTED — DO NOT EXECUTE THIS PLAN
>
> This plan was executed and merged in August 2026. Every code step below is
> built, shipped and covered by tests. The unchecked `- [ ]` boxes were
> never ticked as the work landed — they record nothing about what is
> outstanding.
>
> **If you are an agent: do not implement this. The code already exists.**
> Re-running it would duplicate or clobber `server/storefront.js`, migrations `010`/`011` and `public-storefront/`.
>
> Delivered by: `8624f92`, `b2e2191`, `7503614`, `aec77cd`, `926164e`, `8ee6553`, `9f88409`
>
> The only item from this plan that is genuinely outstanding is tracked
> separately in issue #5 (wildcard DNS and TLS for storefront subdomains).
> Everything else is done. Kept for historical context only.


> **For agentic workers:** This plan is historical. It has already been executed — see the banner above. Do not implement it.

**Goal:** Give each bike shop a public storefront at `<slug>.wheelhouseepos.com` (or `/store/:slug` locally) showing branding, a curated product catalog, and a link to the existing workshop-booking portal — with the data model and settings screen shop owners will use later to connect Shopify checkout (built in a separate, follow-on plan).

**Architecture:** New business logic (tenant resolution, settings CRUD, catalog read model) lives in a new `server/storefront.js` module with plain exported async functions — testable directly via Node's built-in test runner without needing an HTTP harness. `server/server.js` stays thin: it wires these functions into the existing hand-rolled route table and into a new branch at the top of the request dispatcher for host/path-based tenant resolution. The public frontend is a new static bundle (`public-storefront/`) mirroring the existing `public-portal/` (booking portal) pattern: vanilla JS, no build step, no framework.

**Tech Stack:** Node.js (>=22.5), `pg` (already the only dependency — no new dependencies added by this plan), Postgres with row-level security, Node's built-in `node:test`/`node:assert` (newly introduced — no test framework exists in this repo yet).

**Spec:** [docs/superpowers/specs/2026-08-30-shop-storefronts-design.md](../specs/2026-08-30-shop-storefronts-design.md)

## Global Constraints

- Keep the existing SQLite-style `?` placeholders when using `db.prepare(sql)` / `prepare(sql)` — the shim in `server/db.js` translates them to Postgres `$1,$2,...` internally. Do not write `$1`-style placeholders directly.
- Every new shop-scoped table must follow the existing pattern exactly: a surrogate `id SERIAL PRIMARY KEY`, a separate `shop_id INTEGER NOT NULL UNIQUE DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id)`, `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`, and one `CREATE POLICY ..._shop_isolation` using `current_setting('app.current_shop_id')::int`.
- New migrations go in `server/migrations/`, numbered sequentially starting at `010_` (the last existing migration is `009_shop_theme.sql`).
- No new runtime dependencies. Use Node's built-in global `fetch` if any outbound HTTP is ever needed (none is, in this plan) and `node:crypto` for anything crypto-related, matching the project's one-dependency (`pg`) ethos.
- No `multipart/form-data` — file uploads follow the existing pattern: base64 inside a JSON body, size-capped, stored under `UPLOADS_DIR` with a `randomBytes(24).toString('hex')` filename, never the original filename.
- Tests run against the same Postgres instance as local dev (`DATABASE_URL`, from `docker-compose.yml`) — there is no separate test database. Every test creates its own uniquely-slugged shop and cleans it up afterward so runs never collide with real data or each other.

---

## Task 1: Migration — storefront settings table and product columns

**Files:**
- Create: `server/migrations/010_storefront.sql`

**Interfaces:**
- Produces: table `storefront_settings` (columns: `id`, `shop_id`, `enabled`, `tagline`, `description`, `logo_url`, `hero_image_url`, `theme_preset`, `updated_at`); new columns on `products`: `show_online BOOLEAN`, `description TEXT`, `photo_url TEXT`.

- [ ] **Step 1: Write the migration**

```sql
-- server/migrations/010_storefront.sql

-- Per-shop public storefront configuration (branding, opt-in visibility),
-- shown at <slug>.wheelhouseepos.com. One row per shop, created lazily the
-- first time an owner opens storefront settings - same singleton-per-shop
-- pattern as shop_theme (009_shop_theme.sql).
CREATE TABLE storefront_settings (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL UNIQUE DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  enabled BOOLEAN NOT NULL DEFAULT false,
  tagline TEXT,
  description TEXT,
  logo_url TEXT,
  hero_image_url TEXT,
  theme_preset TEXT NOT NULL DEFAULT 'forest',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE storefront_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY storefront_settings_shop_isolation ON storefront_settings
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);

-- Per-product opt-in for public storefront visibility, plus the fields a
-- storefront listing needs that the till/inventory UI never required.
ALTER TABLE products ADD COLUMN show_online BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN description TEXT;
ALTER TABLE products ADD COLUMN photo_url TEXT;
```

- [ ] **Step 2: Run the migration**

```bash
npm run migrate
```

Expected: no errors; output confirms migration `010_storefront.sql` applied.

- [ ] **Step 3: Verify the schema manually**

```bash
node --input-type=module -e "
import { pool } from './server/db.js';
const { rows } = await pool.query(\"SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name IN ('show_online','description','photo_url')\");
console.log(rows);
await pool.end();
"
```

Expected: prints all three column names.

- [ ] **Step 4: Commit**

```bash
git add server/migrations/010_storefront.sql
git commit -m "feat: add storefront_settings table and product storefront columns"
```

---

## Task 2: Test infrastructure and shop test helper

**Files:**
- Create: `tests/helpers/testShop.js`
- Create: `tests/helpers/testShop.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `createTestShop(overrides?)` → `Promise<{ id, slug, name, created_at }>`; `deleteTestShop(shopId)` → `Promise<void>`. Every later task's tests import these.

- [ ] **Step 1: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "node --test tests/"
```

- [ ] **Step 2: Write the failing test**

```js
// tests/helpers/testShop.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../../server/load-env.js';
import { pool } from '../../server/db.js';
import { createTestShop, deleteTestShop } from './testShop.js';

test('createTestShop creates a shop row and deleteTestShop removes it', async () => {
  const shop = await createTestShop();
  assert.ok(shop.id, 'shop should have an id');
  assert.match(shop.slug, /^test-/);

  const { rows: [found] } = await pool.query('SELECT * FROM shops WHERE id = $1', [shop.id]);
  assert.equal(found.slug, shop.slug);

  await deleteTestShop(shop.id);
  const { rows: [gone] } = await pool.query('SELECT * FROM shops WHERE id = $1', [shop.id]);
  assert.equal(gone, undefined);
});

test.after(async () => {
  await pool.end();
});
```

- [ ] **Step 3: Run it to confirm it fails**

```bash
npm test
```

Expected: FAIL — `tests/helpers/testShop.js` does not exist yet (module not found).

- [ ] **Step 4: Write the helper**

```js
// tests/helpers/testShop.js
import { randomUUID } from 'node:crypto';
import { pool } from '../../server/db.js';

export async function createTestShop(overrides = {}) {
  const slug = overrides.slug || `test-${randomUUID().slice(0, 8)}`;
  const name = overrides.name || `Test Shop ${slug}`;
  const { rows: [shop] } = await pool.query(
    'INSERT INTO shops (name, slug) VALUES ($1, $2) RETURNING *',
    [name, slug]
  );
  return shop;
}

export async function deleteTestShop(shopId) {
  await pool.query('DELETE FROM shops WHERE id = $1', [shopId]);
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json tests/helpers/testShop.js tests/helpers/testShop.test.js
git commit -m "test: add node:test infrastructure and shop test helper"
```

---

## Task 3: Storefront settings — data layer

**Files:**
- Create: `server/storefront.js`
- Create: `tests/storefront-settings.test.js`

**Interfaces:**
- Consumes: `prepare` from `server/db.js` (signature: `prepare(sql).get(...params)` / `.all(...params)` / `.run(...params)`, `?`-placeholder style); `runWithShop(shopId, fn)` from `server/db.js`.
- Produces: `THEME_PRESETS` (array of 5 preset key strings); `getOrCreateStorefrontSettings()` → `Promise<row>`; `serializeStorefrontSettings(row)` → `{ enabled, tagline, description, logoUrl, heroImageUrl, themePreset, updatedAt }`; `updateStorefrontSettings(patch)` → `Promise<row>` where `patch` may include any of `enabled, tagline, description, logoUrl, heroImageUrl, themePreset` (all optional, unspecified fields unchanged); throws `Error('Invalid theme preset')` for an unrecognized `themePreset`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/storefront-settings.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { getOrCreateStorefrontSettings, updateStorefrontSettings, serializeStorefrontSettings } from '../server/storefront.js';

test('getOrCreateStorefrontSettings creates a default row on first access', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const row = await getOrCreateStorefrontSettings();
      assert.equal(row.enabled, false);
      assert.equal(row.theme_preset, 'forest');

      const again = await getOrCreateStorefrontSettings();
      assert.equal(again.id, row.id, 'second call should not create a second row');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('updateStorefrontSettings persists a partial patch', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await getOrCreateStorefrontSettings();
      const updated = await updateStorefrontSettings({ enabled: true, tagline: 'Bikes done right' });
      assert.equal(updated.enabled, true);
      assert.equal(updated.tagline, 'Bikes done right');
      assert.equal(updated.theme_preset, 'forest', 'unspecified fields should be untouched');

      const serialized = serializeStorefrontSettings(updated);
      assert.deepEqual(Object.keys(serialized).sort(), ['description', 'enabled', 'heroImageUrl', 'logoUrl', 'tagline', 'themePreset', 'updatedAt'].sort());
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('updateStorefrontSettings rejects an unknown theme preset', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      await getOrCreateStorefrontSettings();
      await assert.rejects(
        () => updateStorefrontSettings({ themePreset: 'not-a-real-preset' }),
        /Invalid theme preset/
      );
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test.after(async () => {
  await pool.end();
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test
```

Expected: FAIL — `server/storefront.js` does not exist.

- [ ] **Step 3: Implement the settings data layer**

```js
// server/storefront.js
import { prepare } from './db.js';

export const THEME_PRESETS = ['forest', 'ocean', 'sunset', 'slate', 'plum'];

export function serializeStorefrontSettings(row) {
  return {
    enabled: !!row.enabled,
    tagline: row.tagline || '',
    description: row.description || '',
    logoUrl: row.logo_url || null,
    heroImageUrl: row.hero_image_url || null,
    themePreset: row.theme_preset,
    updatedAt: row.updated_at,
  };
}

export async function getOrCreateStorefrontSettings() {
  let row = await prepare('SELECT * FROM storefront_settings LIMIT 1').get();
  if (!row) {
    await prepare('INSERT INTO storefront_settings DEFAULT VALUES').run();
    row = await prepare('SELECT * FROM storefront_settings LIMIT 1').get();
  }
  return row;
}

export async function updateStorefrontSettings(patch) {
  const existing = await getOrCreateStorefrontSettings();

  if (patch.themePreset !== undefined && !THEME_PRESETS.includes(patch.themePreset)) {
    throw new Error(`Invalid theme preset: must be one of ${THEME_PRESETS.join(', ')}`);
  }

  const enabled = patch.enabled !== undefined ? Boolean(patch.enabled) : existing.enabled;
  const tagline = patch.tagline !== undefined ? String(patch.tagline) : existing.tagline;
  const description = patch.description !== undefined ? String(patch.description) : existing.description;
  const logoUrl = patch.logoUrl !== undefined ? (patch.logoUrl || null) : existing.logo_url;
  const heroImageUrl = patch.heroImageUrl !== undefined ? (patch.heroImageUrl || null) : existing.hero_image_url;
  const themePreset = patch.themePreset !== undefined ? patch.themePreset : existing.theme_preset;

  await prepare(
    `UPDATE storefront_settings
     SET enabled = ?, tagline = ?, description = ?, logo_url = ?, hero_image_url = ?, theme_preset = ?, updated_at = ?
     WHERE id = ?`
  ).run(enabled, tagline, description, logoUrl, heroImageUrl, themePreset, new Date().toISOString(), existing.id);

  return prepare('SELECT * FROM storefront_settings LIMIT 1').get();
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm test
```

Expected: PASS (all 3 new tests, plus the existing `testShop.test.js`).

- [ ] **Step 5: Commit**

```bash
git add server/storefront.js tests/storefront-settings.test.js
git commit -m "feat: add storefront settings data layer"
```

---

## Task 4: Storefront settings — API route

**Files:**
- Modify: `server/server.js` (add near the existing `/api/shop-theme` routes)

**Interfaces:**
- Consumes: `getOrCreateStorefrontSettings`, `updateStorefrontSettings`, `serializeStorefrontSettings` from `server/storefront.js` (Task 3).
- Produces: `GET /api/storefront-settings` (authenticated), `PUT /api/storefront-settings` (authenticated) — same auth/response conventions as every other `/api/*` route in this file.

No new automated test in this task — this is thin HTTP glue over the already-tested Task 3 functions, following the same pattern as the existing (untested) `/api/shop-theme` routes. Verified manually below.

- [ ] **Step 1: Add the import**

At the top of `server/server.js`, alongside the existing imports, add:

```js
import { getOrCreateStorefrontSettings, updateStorefrontSettings, serializeStorefrontSettings } from './storefront.js';
```

- [ ] **Step 2: Add the routes**

Add these two routes near the existing `route('GET', '/api/shop-theme', ...)` / `route('PUT', '/api/shop-theme', ...)` pair:

```js
route('GET', '/api/storefront-settings', async (req, res) => {
  sendJson(res, 200, serializeStorefrontSettings(await getOrCreateStorefrontSettings()));
});

route('PUT', '/api/storefront-settings', async (req, res) => {
  const body = await readJsonBody(req);
  try {
    const updated = await updateStorefrontSettings(body);
    sendJson(res, 200, serializeStorefrontSettings(updated));
  } catch (err) {
    if (err.message.startsWith('Invalid theme preset')) return badRequest(res, err.message);
    throw err;
  }
});
```

- [ ] **Step 3: Verify manually**

```bash
npm start
```

In another terminal (replace `<session-cookie>` with a real cookie from a logged-in browser session, or log in via `curl -c` first):

```bash
curl -b cookies.txt http://localhost:4000/api/storefront-settings
curl -b cookies.txt -X PUT -H "Content-Type: application/json" -d '{"enabled":true,"tagline":"Test tagline"}' http://localhost:4000/api/storefront-settings
```

Expected: first call returns `{"enabled":false,"tagline":"","description":"","logoUrl":null,"heroImageUrl":null,"themePreset":"forest","updatedAt":...}`; second call returns the same shape with `enabled:true` and the new tagline.

- [ ] **Step 4: Commit**

```bash
git add server/server.js
git commit -m "feat: wire up storefront settings API route"
```

---

## Task 5: Tenant resolution and public catalog — data layer

**Files:**
- Modify: `server/storefront.js`
- Create: `tests/storefront-public.test.js`

**Interfaces:**
- Consumes: `pool` from `server/db.js`; `prepare` from `server/db.js`.
- Produces: `STOREFRONT_BASE_DOMAIN` (string, from `process.env.STOREFRONT_BASE_DOMAIN || 'wheelhouseepos.com'`); `parseStorefrontSlugCandidate(req, url)` → `string | null` (no DB access); `resolveStorefrontShop(req, url)` → `Promise<{ id, slug, name } | null>`; `getStorefrontInfo(shopRow)` → `Promise<{ shopName, tagline, description, logoUrl, heroImageUrl, themePreset }>`; `serializeStorefrontProduct(row)`; `listStorefrontProducts()` → `Promise<Array<{ id, name, price, description, photoUrl }>>`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/storefront-public.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop } from '../server/db.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import {
  parseStorefrontSlugCandidate,
  resolveStorefrontShop,
  getStorefrontInfo,
  listStorefrontProducts,
  updateStorefrontSettings,
  getOrCreateStorefrontSettings,
} from '../server/storefront.js';

function fakeRequest(host, pathname, query = {}) {
  const url = new URL(`http://${host}${pathname}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return { req: { headers: { host } }, url };
}

test('parseStorefrontSlugCandidate reads host suffix, path, and query param, in that order', () => {
  const byHost = fakeRequest('acme.wheelhouseepos.com', '/');
  assert.equal(parseStorefrontSlugCandidate(byHost.req, byHost.url), 'acme');

  const byPath = fakeRequest('localhost:4000', '/store/acme');
  assert.equal(parseStorefrontSlugCandidate(byPath.req, byPath.url), 'acme');

  const byQuery = fakeRequest('localhost:4000', '/api/storefront/info', { storefrontSlug: 'acme' });
  assert.equal(parseStorefrontSlugCandidate(byQuery.req, byQuery.url), 'acme');

  const none = fakeRequest('localhost:4000', '/');
  assert.equal(parseStorefrontSlugCandidate(none.req, none.url), null);
});

test('resolveStorefrontShop resolves an enabled shop by subdomain', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, () => updateStorefrontSettings({ enabled: true }));
    const { req, url } = fakeRequest(`${shop.slug}.wheelhouseepos.com`, '/');
    const resolved = await resolveStorefrontShop(req, url);
    assert.deepEqual(resolved, { id: shop.id, slug: shop.slug, name: shop.name });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('resolveStorefrontShop returns null for a disabled storefront', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, () => getOrCreateStorefrontSettings());
    const { req, url } = fakeRequest(`${shop.slug}.wheelhouseepos.com`, '/');
    assert.equal(await resolveStorefrontShop(req, url), null);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('resolveStorefrontShop returns null for an unknown slug', async () => {
  const { req, url } = fakeRequest('no-such-shop-xyz.wheelhouseepos.com', '/');
  assert.equal(await resolveStorefrontShop(req, url), null);
});

test('resolveStorefrontShop falls back to /store/:slug path', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, () => updateStorefrontSettings({ enabled: true }));
    const { req, url } = fakeRequest('localhost:4000', `/store/${shop.slug}`);
    const resolved = await resolveStorefrontShop(req, url);
    assert.deepEqual(resolved, { id: shop.id, slug: shop.slug, name: shop.name });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('resolveStorefrontShop falls back to a ?storefrontSlug= query param', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, () => updateStorefrontSettings({ enabled: true }));
    const { req, url } = fakeRequest('localhost:4000', '/api/storefront/info', { storefrontSlug: shop.slug });
    const resolved = await resolveStorefrontShop(req, url);
    assert.deepEqual(resolved, { id: shop.id, slug: shop.slug, name: shop.name });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('listStorefrontProducts only returns show_online products for the current shop', async () => {
  const shopA = await createTestShop();
  const shopB = await createTestShop();
  try {
    await runWithShop(shopA.id, async () => {
      await pool.query(
        "INSERT INTO products (name, price, show_online, active) SELECT 'Visible Bike', 500, true, 1"
      );
    });
    // Directly setting shop_id would violate RLS from outside runWithShop's context,
    // so shopB's product is inserted the same way, under its own shop context.
    await runWithShop(shopB.id, async () => {
      await pool.query(
        "INSERT INTO products (name, price, show_online, active) SELECT 'Other Shop Bike', 500, true, 1"
      );
    });
    await runWithShop(shopA.id, async () => {
      await pool.query(
        "INSERT INTO products (name, price, show_online, active) SELECT 'Hidden Bike', 500, false, 1"
      );
      const products = await listStorefrontProducts();
      assert.equal(products.length, 1);
      assert.equal(products[0].name, 'Visible Bike');
    });
  } finally {
    await deleteTestShop(shopA.id);
    await deleteTestShop(shopB.id);
  }
});

test('getStorefrontInfo reflects shop name and settings', async () => {
  const shop = await createTestShop({ name: 'Acme Cycles' });
  try {
    await runWithShop(shop.id, async () => {
      await updateStorefrontSettings({ enabled: true, tagline: 'Ride happy' });
      const info = await getStorefrontInfo(shop);
      assert.equal(info.shopName, 'Acme Cycles');
      assert.equal(info.tagline, 'Ride happy');
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test.after(async () => {
  await pool.end();
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test
```

Expected: FAIL — `resolveStorefrontShop`, `getStorefrontInfo`, `listStorefrontProducts` are not exported yet.

- [ ] **Step 3: Implement, appending to `server/storefront.js`**

```js
// Appended to server/storefront.js
import { pool } from './db.js';

export const STOREFRONT_BASE_DOMAIN = process.env.STOREFRONT_BASE_DOMAIN || 'wheelhouseepos.com';

// Cheap, DB-free check for "does this request look like it's addressed to a
// storefront at all" - used by the dispatcher to decide between "not a
// storefront request, keep routing normally" and "was a storefront request,
// but didn't resolve to one - show a generic not-found page" (never fall
// through to the staff app for the latter, and never distinguish "unknown
// slug" from "disabled storefront" in the response).
export function parseStorefrontSlugCandidate(req, url) {
  const hostHeader = String(req.headers.host || '').split(':')[0].toLowerCase();
  const suffix = `.${STOREFRONT_BASE_DOMAIN}`;

  if (hostHeader.endsWith(suffix)) {
    const sub = hostHeader.slice(0, -suffix.length);
    if (sub && sub !== 'www') return sub;
  }
  const pathMatch = url.pathname.match(/^\/store\/([^/]+)/);
  if (pathMatch) return pathMatch[1];

  return url.searchParams.get('storefrontSlug') || null;
}

export async function resolveStorefrontShop(req, url) {
  const slug = parseStorefrontSlugCandidate(req, url);
  if (!slug) return null;

  const { rows: [row] } = await pool.query(
    `SELECT s.id, s.slug, s.name, COALESCE(ss.enabled, false) AS enabled
     FROM shops s LEFT JOIN storefront_settings ss ON ss.shop_id = s.id
     WHERE s.slug = $1`,
    [slug]
  );
  if (!row || !row.enabled) return null;
  return { id: row.id, slug: row.slug, name: row.name };
}

export async function getStorefrontInfo(shopRow) {
  const settings = await getOrCreateStorefrontSettings();
  return {
    shopName: shopRow.name,
    tagline: settings.tagline || '',
    description: settings.description || '',
    logoUrl: settings.logo_url || null,
    heroImageUrl: settings.hero_image_url || null,
    themePreset: settings.theme_preset,
  };
}

export function serializeStorefrontProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    description: row.description || '',
    photoUrl: row.photo_url || null,
  };
}

export async function listStorefrontProducts() {
  const rows = await prepare(
    'SELECT id, name, price, description, photo_url FROM products WHERE show_online = ? AND active = 1 ORDER BY category, name'
  ).all(true);
  return rows.map(serializeStorefrontProduct);
}
```

Note: this uses the `pool` import alongside the existing `prepare` import at the top of the file — combine both into the single existing `import { prepare } from './db.js';` line so it reads `import { prepare, pool } from './db.js';`.

- [ ] **Step 4: Run to confirm pass**

```bash
npm test
```

Expected: PASS (all tests across all files).

- [ ] **Step 5: Commit**

```bash
git add server/storefront.js tests/storefront-public.test.js
git commit -m "feat: add tenant resolution and public catalog data layer"
```

---

## Task 6: Product storefront fields (show online, description, photo)

**Files:**
- Modify: `server/server.js` (`serializeProduct`, `POST /api/products`, `PUT /api/products/:id`)

**Interfaces:**
- Produces: `serializeProduct(row)` gains `showOnline`, `description`, `photoUrl` fields; `POST /api/products` and `PUT /api/products/:id` accept `showOnline` (boolean), `description` (string), `photoUrl` (string or null) in the request body, defaulting to `false` / `''` / `null` respectively when omitted on create, and left unchanged on update when omitted.

This task edits existing, already-large route handlers. Since there's no HTTP-level test harness in this codebase, verify via the manual `curl` pass in Step 4 (matching how the pre-existing `/api/products` routes have always been verified) rather than a route-level automated test — Task 5's `listStorefrontProducts` test already covers the columns end-to-end at the data layer.

- [ ] **Step 1: Extend `serializeProduct`**

Find `function serializeProduct(row) {` in `server/server.js` (currently returns `id, sku, barcode, name, category, price, cost, stockQty, lowStockThreshold, supplier, active, createdAt, updatedAt`) and add three more properties to the returned object:

```js
    showOnline: !!row.show_online,
    description: row.description || '',
    photoUrl: row.photo_url || null,
```

- [ ] **Step 2: Extend `POST /api/products`**

In the `route('POST', '/api/products', ...)` handler, after the existing `const supplier = (body.supplier || '').trim();` line, add:

```js
  const showOnline = Boolean(body.showOnline);
  const description = (body.description || '').trim();
  const photoUrl = body.photoUrl || null;
```

Then change the `INSERT INTO products (...)` column list and `VALUES` placeholders to include the three new columns, and add the three new values to the `.run(...)` call, so the statement reads:

```js
    const info = await db
      .prepare(
        `INSERT INTO products (sku, barcode, name, category, price, cost, stock_qty, low_stock_threshold, supplier, show_online, description, photo_url, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(sku, barcode, name, category, price, cost, stockQty, lowStockThreshold, supplier, showOnline, description, photoUrl, nowIso());
```

- [ ] **Step 3: Extend `PUT /api/products/:id`**

In the `route('PUT', '/api/products/:id', ...)` handler, after the existing `const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;` line, add:

```js
  const showOnline = body.showOnline !== undefined ? Boolean(body.showOnline) : existing.show_online;
  const description = body.description !== undefined ? String(body.description).trim() : existing.description;
  const photoUrl = body.photoUrl !== undefined ? (body.photoUrl || null) : existing.photo_url;
```

Then update the `UPDATE products SET ...` statement and its `.run(...)` call to include the three new columns:

```js
    await db.prepare(
      `UPDATE products SET sku = ?, barcode = ?, name = ?, category = ?, price = ?, cost = ?, low_stock_threshold = ?, supplier = ?, active = ?, show_online = ?, description = ?, photo_url = ?, updated_at = ?
       WHERE id = ?`
    ).run(sku, barcode, name, category, price, cost, lowStockThreshold, supplier, active, showOnline, description, photoUrl, nowIso(), id);
```

- [ ] **Step 4: Verify manually**

```bash
npm start
```

```bash
curl -b cookies.txt -X POST -H "Content-Type: application/json" \
  -d '{"name":"Test Bike","price":499,"showOnline":true,"description":"A great bike"}' \
  http://localhost:4000/api/products
```

Expected: `201` response including `"showOnline":true,"description":"A great bike","photoUrl":null`.

- [ ] **Step 5: Commit**

```bash
git add server/server.js
git commit -m "feat: add show-online, description, and photo fields to products"
```

---

## Task 7: Image upload (product photos, shop logo, shop hero image)

**Files:**
- Modify: `server/server.js` (add new routes near the existing workshop-job-attachment upload route)
- Create: `server/migrations/011_uploaded_image_types.sql`

**Interfaces:**
- Produces: `POST /api/products/:id/photo` (authenticated) — body `{ dataBase64, contentType }`, sets `products.photo_url` to a retrieval URL and returns the updated serialized product; `POST /api/storefront-settings/logo` and `POST /api/storefront-settings/hero` (authenticated) — same body shape, set `storefront_settings.logo_url`/`hero_image_url` respectively and return the updated serialized settings (via `updateStorefrontSettings` from Task 3); `GET /api/uploaded-images/:key` — streams any of the above back with the right content type.

All three upload routes are thin wrappers around one shared helper, since they only differ in image size limit and where the resulting URL gets stored. No automated test — mirrors the existing (untested) attachment-upload route's own precedent exactly, and the image-handling logic itself is a thin, low-risk wrapper around `writeFile`/`createReadStream`. Verified manually.

- [ ] **Step 1: Add the shared upload helper and the three routes**

Add near the existing workshop-job-attachment routes (which already define `UPLOADS_DIR`, `randomBytes` import, and `MAX_ATTACHMENT_BYTES`-style constants to mirror):

```js
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Shared by product photo, logo, and hero image uploads - only the size
// cap and what happens with the resulting URL differ between them.
async function readUploadedImage(req, maxBytes) {
  const maxBodyBytes = Math.ceil(maxBytes * 1.4);
  let body;
  try {
    body = await readJsonBody(req, maxBodyBytes);
  } catch (err) {
    throw new ValidationError(err.message === 'Payload too large' ? `That image is too large (max ${Math.round(maxBytes / 1024 / 1024)}MB).` : 'Invalid request body');
  }
  if (!body.dataBase64) throw new ValidationError('No image data received');

  const contentType = String(body.contentType || '').trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new ValidationError('Image must be JPEG, PNG, or WebP');
  }

  let buffer;
  try {
    buffer = Buffer.from(body.dataBase64, 'base64');
  } catch (err) {
    throw new ValidationError('Could not decode image data');
  }
  if (!buffer.length) throw new ValidationError('That image is empty');
  if (buffer.length > maxBytes) throw new ValidationError(`That image is too large (max ${Math.round(maxBytes / 1024 / 1024)}MB).`);

  const storageKey = randomBytes(24).toString('hex');
  await writeFile(path.join(UPLOADS_DIR, storageKey), buffer);
  await db.prepare('INSERT INTO uploaded_image_types (storage_key, content_type) VALUES (?, ?)').run(storageKey, contentType);
  return `/api/uploaded-images/${storageKey}`;
}

const MAX_PRODUCT_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_SHOP_IMAGE_BYTES = 5 * 1024 * 1024;

route('POST', '/api/products/:id/photo', async (req, res, params) => {
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Product not found');

  let photoUrl;
  try {
    photoUrl = await readUploadedImage(req, MAX_PRODUCT_PHOTO_BYTES);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(res, err.message);
    throw err;
  }

  await db.prepare('UPDATE products SET photo_url = ?, updated_at = ? WHERE id = ?').run(photoUrl, nowIso(), id);
  const row = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  sendJson(res, 200, serializeProduct(row));
});

route('POST', '/api/storefront-settings/logo', async (req, res) => {
  let logoUrl;
  try {
    logoUrl = await readUploadedImage(req, MAX_SHOP_IMAGE_BYTES);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(res, err.message);
    throw err;
  }
  sendJson(res, 200, serializeStorefrontSettings(await updateStorefrontSettings({ logoUrl })));
});

route('POST', '/api/storefront-settings/hero', async (req, res) => {
  let heroImageUrl;
  try {
    heroImageUrl = await readUploadedImage(req, MAX_SHOP_IMAGE_BYTES);
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(res, err.message);
    throw err;
  }
  sendJson(res, 200, serializeStorefrontSettings(await updateStorefrontSettings({ heroImageUrl })));
});

route('GET', '/api/uploaded-images/:key', async (req, res, params) => {
  const filePath = path.join(UPLOADS_DIR, params.key);
  if (!filePath.startsWith(UPLOADS_DIR) || !existsSync(filePath)) {
    return notFound(res, 'Image not found');
  }
  const typeRow = await pool.query('SELECT content_type FROM uploaded_image_types WHERE storage_key = $1', [params.key]);
  const contentType = typeRow.rows[0]?.content_type || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' });
  createReadStream(filePath).pipe(res);
});
```

`ValidationError` is the existing error class already used elsewhere in `server.js` for exactly this "throw with a user-facing message" pattern (check its existing definition/import — do not redeclare it if it already exists in this file).

This introduces one tiny new table to remember each stored image's content-type (uploads are stored as opaque hex-named files with no extension, same as attachments, so the type has to be recorded somewhere) — add it to a new migration:

- [ ] **Step 2: Add the supporting migration**

```sql
-- server/migrations/011_uploaded_image_types.sql

-- Uploaded images (product photos, shop logo, shop hero image) are stored
-- under UPLOADS_DIR by an opaque random key with no file extension (same
-- convention as workshop job attachments), so the retrieval route needs
-- somewhere to remember each one's content type to serve it back with the
-- right header.
CREATE TABLE uploaded_image_types (
  storage_key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Run it:

```bash
npm run migrate
```

- [ ] **Step 3: Verify manually**

```bash
npm start
```

```bash
base64 -w0 some-bike.jpg > /tmp/photo.b64
curl -b cookies.txt -X POST -H "Content-Type: application/json" \
  -d "{\"dataBase64\":\"$(cat /tmp/photo.b64)\",\"contentType\":\"image/jpeg\"}" \
  http://localhost:4000/api/products/1/photo
curl -b cookies.txt -X POST -H "Content-Type: application/json" \
  -d "{\"dataBase64\":\"$(cat /tmp/photo.b64)\",\"contentType\":\"image/jpeg\"}" \
  http://localhost:4000/api/storefront-settings/logo
curl -o /tmp/downloaded.jpg http://localhost:4000/api/uploaded-images/<returned-key>
```

Expected: both uploads return their respective updated resource with the new URL set; the retrieval `curl` downloads back a valid JPEG.

- [ ] **Step 4: Commit**

```bash
git add server/server.js server/migrations/011_uploaded_image_types.sql
git commit -m "feat: add product photo and shop logo/hero image upload"
```

---

## Task 8: Storefront frontend bundle and request routing

**Files:**
- Create: `public-storefront/index.html`
- Create: `public-storefront/storefront.css`
- Create: `public-storefront/storefront.js`
- Modify: `server/server.js` (dispatcher wiring)

**Interfaces:**
- Consumes: `resolveStorefrontShop`, `getStorefrontInfo`, `listStorefrontProducts` from `server/storefront.js` (Task 5); `serveStatic(req, res, pathname, baseDir)` and `runWithShop` (both already defined in `server/server.js`).
- Produces: a working storefront reachable at `<slug>.wheelhouseepos.com/` and `/store/:slug`.

No new automated test — this wires already-tested logic (Task 5) into the HTTP layer and adds a static frontend, verified end-to-end manually in Step 5 (matching the design spec's own testing section, whose final check for this piece is explicitly a manual in-browser pass).

- [ ] **Step 1: Add the `STOREFRONT_DIR` constant and import**

Near the existing `PUBLIC_DIR`/`PORTAL_DIR` constant definitions in `server/server.js`, add:

```js
const STOREFRONT_DIR = path.join(__dirname, '..', 'public-storefront');
```

And extend the existing storefront import to include the new functions:

```js
import {
  getOrCreateStorefrontSettings,
  updateStorefrontSettings,
  serializeStorefrontSettings,
  parseStorefrontSlugCandidate,
  resolveStorefrontShop,
  getStorefrontInfo,
  listStorefrontProducts,
} from './storefront.js';
```

- [ ] **Step 2: Add the dispatcher branch**

At the very top of the `createServer(async (req, res) => { ... })` callback, immediately after `const pathname = decodeURIComponent(url.pathname);`, add:

```js
  if (parseStorefrontSlugCandidate(req, url)) {
    const storefrontShop = await resolveStorefrontShop(req, url);
    if (!storefrontShop) {
      return notFound(res, 'Storefront not found');
    }
    try {
      await runWithShop(storefrontShop.id, () => handleStorefrontRequest(req, res, pathname, storefrontShop));
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }
```

This checks `parseStorefrontSlugCandidate` (host suffix, `/store/` path, or `?storefrontSlug=`) before ever touching the database — a normal request to the staff app matches none of those and falls through to the existing routing untouched. A request that *does* look like a storefront request but doesn't resolve to an enabled shop (unknown slug, or a real slug with the storefront disabled) gets the same generic not-found response either way, rather than silently falling through to the staff app or leaking which case it was.

- [ ] **Step 3: Add `handleStorefrontRequest`**

Add this function above the dispatcher (near `serveStatic`):

```js
async function handleStorefrontRequest(req, res, pathname, shop) {
  if (pathname === '/api/storefront/info' && req.method === 'GET') {
    return sendJson(res, 200, await getStorefrontInfo(shop));
  }
  if (pathname === '/api/storefront/products' && req.method === 'GET') {
    return sendJson(res, 200, await listStorefrontProducts());
  }
  const storePrefix = `/store/${shop.slug}`;
  const relative = pathname.startsWith(storePrefix) ? (pathname.slice(storePrefix.length) || '/') : pathname;
  return serveStatic(req, res, relative, STOREFRONT_DIR);
}
```

- [ ] **Step 4: Write the frontend bundle**

```html
<!-- public-storefront/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Shop</title>
  <link rel="stylesheet" href="storefront.css" />
</head>
<body>
  <div id="app">Loading…</div>
  <script src="storefront.js"></script>
</body>
</html>
```

```css
/* public-storefront/storefront.css */
:root {
  --accent-dark: #164f42;
  --accent: #1f6f5c;
  --modal-bg: #DDF7DF;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, sans-serif;
  color: #1a1a1a;
  background: #fff;
}
.storefront-header {
  background: var(--accent-dark);
  color: #fff;
  padding: 1.5rem 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}
.storefront-header img { height: 48px; }
.storefront-hero {
  background: var(--modal-bg);
  padding: 3rem 2rem;
  text-align: center;
}
.storefront-hero img { max-width: 100%; max-height: 320px; border-radius: 8px; }
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
  padding: 2rem;
}
.product-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
}
.product-card img { width: 100%; height: 160px; object-fit: cover; border-radius: 4px; }
.product-card .price { color: var(--accent); font-weight: bold; }
.storefront-footer {
  padding: 2rem;
  text-align: center;
  border-top: 1px solid #e0e0e0;
}
.storefront-footer a { color: var(--accent); }
.empty-state { padding: 4rem 2rem; text-align: center; color: #666; }
```

```js
// public-storefront/storefront.js
'use strict';

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function slugFromPath() {
  const match = location.pathname.match(/^\/store\/([^/]+)/);
  return match ? match[1] : null;
}

async function api(path) {
  const slug = slugFromPath();
  const url = slug ? `${path}?storefrontSlug=${encodeURIComponent(slug)}` : path;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function applyTheme(themePreset) {
  const THEME_PRESETS = {
    forest: { topbar: '#164f42', accent: '#1f6f5c', modalBg: '#DDF7DF' },
    ocean: { topbar: '#1a3f66', accent: '#2f5f96', modalBg: '#DCEBFA' },
    sunset: { topbar: '#7a3410', accent: '#a8501e', modalBg: '#FBE8D6' },
    slate: { topbar: '#2c333a', accent: '#4a5560', modalBg: '#E6E9EC' },
    plum: { topbar: '#4a2258', accent: '#7a4a94', modalBg: '#F0E4F7' },
  };
  const preset = THEME_PRESETS[themePreset] || THEME_PRESETS.forest;
  document.documentElement.style.setProperty('--accent-dark', preset.topbar);
  document.documentElement.style.setProperty('--accent', preset.accent);
  document.documentElement.style.setProperty('--modal-bg', preset.modalBg);
}

function render(info, products) {
  const slug = slugFromPath();
  const bookHref = slug ? `/book/${slug}` : '/book';
  document.getElementById('app').innerHTML = `
    <header class="storefront-header">
      ${info.logoUrl ? `<img src="${esc(info.logoUrl)}" alt="${esc(info.shopName)} logo" />` : ''}
      <div>
        <h1>${esc(info.shopName)}</h1>
        ${info.tagline ? `<p>${esc(info.tagline)}</p>` : ''}
      </div>
    </header>
    <section class="storefront-hero">
      ${info.heroImageUrl ? `<img src="${esc(info.heroImageUrl)}" alt="" />` : ''}
      ${info.description ? `<p>${esc(info.description)}</p>` : ''}
    </section>
    <section class="product-grid">
      ${products.length ? products.map((p) => `
        <div class="product-card">
          ${p.photoUrl ? `<img src="${esc(p.photoUrl)}" alt="${esc(p.name)}" />` : ''}
          <h3>${esc(p.name)}</h3>
          ${p.description ? `<p>${esc(p.description)}</p>` : ''}
          <p class="price">£${p.price.toFixed(2)}</p>
          <p>Available in store</p>
        </div>
      `).join('') : '<p class="empty-state">No products listed yet.</p>'}
    </section>
    <footer class="storefront-footer">
      <a href="${esc(bookHref)}">Book a workshop slot</a>
    </footer>
  `;
}

async function boot() {
  try {
    const [info, products] = await Promise.all([api('/api/storefront/info'), api('/api/storefront/products')]);
    applyTheme(info.themePreset);
    render(info, products);
  } catch (err) {
    document.getElementById('app').innerHTML = `<div class="empty-state">This storefront isn't available right now.</div>`;
  }
}

boot();
```

- [ ] **Step 5: Verify manually**

```bash
npm start
```

Seed a shop, enable its storefront, and add a `show_online` product (via the API calls from Tasks 4 and 6), then visit `http://localhost:4000/store/<that-shop-slug>` in a browser.

Expected: header shows the shop name, hero section renders (blank if no description/hero image set), the product grid shows the `show_online` product, theme colors match the shop's `theme_preset`, and "Book a workshop slot" links to `/book/<slug>`.

- [ ] **Step 6: Commit**

```bash
git add public-storefront server/server.js
git commit -m "feat: add storefront frontend and request routing"
```

---

## Task 9: Owner-facing configuration UI

**Files:**
- Modify: `public/app.js`

**Interfaces:**
- Consumes: `GET`/`PUT /api/storefront-settings` (Task 4), `POST /api/storefront-settings/logo`, `POST /api/storefront-settings/hero`, `POST /api/products/:id/photo` (all Task 7), `showOnline`/`description`/`photoUrl` fields on `PUT /api/products/:id` (Task 6), the existing `api()` helper, `esc()` helper, and the `THEME_PRESETS` constant already used for shop theming (reuse its keys as the preset picker's options — do not hardcode a second list of preset names).

No automated test — this is UI work in a codebase with no existing frontend test coverage, consistent with the rest of `public/app.js`. Verified manually in the browser.

- [ ] **Step 1: Add a shared file-to-base64 helper**

Add near the existing `api()` helper — every upload UI in this task needs it:

```js
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function uploadImage(endpoint, fileInput, statusEl) {
  const file = fileInput.files[0];
  if (!file) return;
  statusEl.textContent = 'Uploading…';
  try {
    const dataBase64 = await readFileAsBase64(file);
    await api(endpoint, { method: 'POST', body: { dataBase64, contentType: file.type } });
    statusEl.textContent = 'Uploaded';
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  }
}
```

- [ ] **Step 2: Add a "Storefront" settings section**

Search `public/app.js` for the existing shop-theme preset-picker rendering code (around the `THEME_PRESETS` usage described in the design research, roughly line 4332) — the settings/admin screen that renders it. Add a new self-contained section alongside it:

```js
async function renderStorefrontSettingsSection(container) {
  const settings = await api('/api/storefront-settings');
  const presetOptions = Object.keys(THEME_PRESETS)
    .map((key) => `<option value="${esc(key)}" ${settings.themePreset === key ? 'selected' : ''}>${esc(THEME_PRESETS[key].name)}</option>`)
    .join('');
  container.innerHTML = `
    <h3>Storefront</h3>
    <label><input type="checkbox" id="storefront-enabled" ${settings.enabled ? 'checked' : ''}> Enable public storefront</label>
    <label>Tagline <input type="text" id="storefront-tagline" value="${esc(settings.tagline)}" maxlength="200"></label>
    <label>Description <textarea id="storefront-description" maxlength="2000">${esc(settings.description)}</textarea></label>
    <label>Theme <select id="storefront-theme-preset">${presetOptions}</select></label>
    <label>Logo <input type="file" id="storefront-logo-file" accept="image/jpeg,image/png,image/webp"></label>
    <button id="storefront-logo-upload">Upload logo</button>
    <span id="storefront-logo-status">${settings.logoUrl ? 'Current logo set' : 'No logo yet'}</span>
    <label>Hero image <input type="file" id="storefront-hero-file" accept="image/jpeg,image/png,image/webp"></label>
    <button id="storefront-hero-upload">Upload hero image</button>
    <span id="storefront-hero-status">${settings.heroImageUrl ? 'Current hero image set' : 'No hero image yet'}</span>
    <button id="storefront-save">Save storefront settings</button>
    <span id="storefront-save-status"></span>
  `;
  document.getElementById('storefront-save').addEventListener('click', async () => {
    const status = document.getElementById('storefront-save-status');
    try {
      await api('/api/storefront-settings', {
        method: 'PUT',
        body: {
          enabled: document.getElementById('storefront-enabled').checked,
          tagline: document.getElementById('storefront-tagline').value,
          description: document.getElementById('storefront-description').value,
          themePreset: document.getElementById('storefront-theme-preset').value,
        },
      });
      status.textContent = 'Saved';
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
    }
  });
  document.getElementById('storefront-logo-upload').addEventListener('click', () =>
    uploadImage('/api/storefront-settings/logo', document.getElementById('storefront-logo-file'), document.getElementById('storefront-logo-status'))
  );
  document.getElementById('storefront-hero-upload').addEventListener('click', () =>
    uploadImage('/api/storefront-settings/hero', document.getElementById('storefront-hero-file'), document.getElementById('storefront-hero-status'))
  );
}
```

Call `renderStorefrontSettingsSection(someContainerElement)` from wherever the existing settings screen assembles its sections (find the function that renders the theme preset picker and call this alongside it, passing a new container element placed in that screen's template).

- [ ] **Step 3: Add per-product fields to the inventory edit form**

Find the inventory product edit form's template/render function (renders fields like SKU, category, price, cost, supplier) and add:

```js
    <label><input type="checkbox" id="product-show-online" ${product.showOnline ? 'checked' : ''}> Show on storefront</label>
    <label>Online description <textarea id="product-description" maxlength="2000">${esc(product.description)}</textarea></label>
    <label>Photo <input type="file" id="product-photo-file" accept="image/jpeg,image/png,image/webp"></label>
    <button type="button" id="product-photo-upload">Upload photo</button>
    <span id="product-photo-status">${product.photoUrl ? 'Current photo set' : 'No photo yet'}</span>
```

Wire the upload button (this needs the product's `id`, already in scope wherever this form is rendered for an existing product):

```js
    document.getElementById('product-photo-upload').addEventListener('click', () =>
      uploadImage(`/api/products/${product.id}/photo`, document.getElementById('product-photo-file'), document.getElementById('product-photo-status'))
    );
```

And in the form's save handler (wherever it builds the body for `PUT /api/products/:id`), add:

```js
    showOnline: document.getElementById('product-show-online').checked,
    description: document.getElementById('product-description').value,
```

- [ ] **Step 4: Verify manually**

```bash
npm start
```

Log in as a shop, open the settings screen, toggle "Enable public storefront" on, pick a non-default theme, upload a logo and hero image, save, then open an existing product, check "Show on storefront", upload a product photo, save, and reload `/store/<slug>` to confirm every change is reflected (theme colors, logo, hero image, product photo).

Expected: all of the above work with no console errors; the storefront reflects every change after reload.

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat: add storefront settings, theming, image uploads, and product visibility UI"
```

---

## Task 10: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Full manual walkthrough**

1. Start the app (`npm start`) and log in as an existing shop (or create one).
2. Open storefront settings, enable the storefront, set a tagline and description, pick a theme preset other than the default.
3. Mark two products as "Show on storefront" with descriptions; leave a third unmarked.
4. Upload a photo to one of the visible products.
5. Visit `/store/<slug>` — confirm: shop name/tagline/description show, theme colors match the chosen preset, exactly the two marked products appear (with the photo on the one that has it), the unmarked product does not appear, and "Book a workshop slot" links to the existing `/book/<slug>` portal and works.
6. Disable the storefront in settings, reload `/store/<slug>` — confirm it now returns the generic "Storefront not found" response (not the staff app's login page).
7. Visit `/store/some-slug-that-does-not-exist` — confirm it returns the same generic not-found response as step 6 (an outside visitor should not be able to tell "disabled" from "never existed" apart).

- [ ] **Step 3: Note any gaps found for follow-up**

If anything in the walkthrough doesn't match, fix it before considering this plan complete (do not defer visible bugs to the Shopify follow-on plan).

- [ ] **Step 4: Note the remaining production infrastructure step**

This plan implements `/store/:slug` path-based access, which needs no DNS changes and works today. Real subdomains (`<slug>.wheelhouseepos.com`) additionally require a one-time, outside-this-repo infrastructure step before they'll work in production: a wildcard DNS record (`*.wheelhouseepos.com`) and a wildcard TLS certificate covering it (per the design spec's Routing & Hosting section). `server/gateway.js` needs no code change for this — it already forwards the `Host` header untouched. Flag this to whoever owns DNS/hosting; it isn't a code task.
