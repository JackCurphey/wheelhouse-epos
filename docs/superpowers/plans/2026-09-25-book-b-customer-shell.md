# Book piece (b): customer app shell at `/book` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A second React app (the customer app) is built by Vite and served at every `/book` address, with placeholder routes for the six book screens.

**Architecture:** `src/customer/` mirrors `src/staff/` (route table, unstyled shell, entry). Vite gains a `book` input. The server's entry-tag builder takes the manifest key, and one helper serves either app's HTML page; `/book` (main host and storefront subdomains) uses it instead of the old `public-portal/` static files.

**Tech Stack:** React 19, react-router 8 (`createBrowserRouter`), @tanstack/react-query 5, Vite (rolldown), plain Node `http` server, `node:test` + jsdom + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-book-b-customer-shell-design.md`

## Global Constraints

- Customer addresses, exactly:
  `service: '/book/:shopSlug'`, `'service-list': '/book/:shopSlug/services'`, `problem: '/book/:shopSlug/problem'`, `date: '/book/:shopSlug/date'`, `details: '/book/:shopSlug/details'`, `pending: '/book/:shopSlug/booking/:code'`.
- Placeholder text `Not built yet: <id>`; unknown address text `There is no screen at this address.` (same strings as the staff shell).
- Mount point id `wh-book-root`; page `public/book.html`; page title `Book a service`; entry `src/customer/main.tsx`; Vite input name `book`.
- The customer shell is unstyled apart from importing `../styles/theme.css`, and never uses `src/lib/auth/use-session.ts` (staff-only).
- Do not delete `public-portal/` or edit anything that references it except the two `/book` serving blocks and `PORTAL_DIR` in `server/server.js`, and deleting `tests/portal-copy-served.test.js`.
- No change to any `/api/*` route, to `src/staff/*`, or to the staff `ROUTES`.
- Tests need the compose Postgres up (port 5433) and a build: `npm test` runs `pretest` (test build) but NOT `npm run build`; run `npm run build` before server page tests.
- Every new test is watched failing before the code, and has a named break step whose edit is confirmed landed (grep) before running.
- Commit on `feat/book-b-customer-shell`, never main. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Leave the untracked `.claude/launch.json` alone.

---

### Task 1: Customer route table, shell and entry

**Files:**
- Create: `src/customer/routes.ts`, `src/customer/app-shell.tsx`, `src/customer/main.tsx`
- Create: `tests/screens/customer-routes.test.js`, `tests/screens/customer-app-shell.test.js`
- Modify: `vite.config.ts` (input), `vite.test.config.ts` (exclude the customer entry)

**Interfaces:**
- Produces: `CUSTOMER_ROUTES` and `type CustomerScreenId` from `src/customer/routes.ts`; `CustomerAppShell` component from `src/customer/app-shell.tsx`; Vite manifest key `src/customer/main.tsx` (consumed by Task 2's server code).

- [ ] **Step 1: Write the route-table test** — `tests/screens/customer-routes.test.js`

```js
// The customer route table: atlas screen id -> URL under /book.
// Spec: docs/superpowers/specs/2026-09-25-book-b-customer-shell-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CUSTOMER_ROUTES } from '../../src/customer/routes.ts';

const index = JSON.parse(
  await readFile(new URL('../../docs/design/release-1-journey/screen-index.json', import.meta.url), 'utf8'),
);
const BOOK_IDS = index.filter((s) => s.group === 'book').map((s) => s.id);

test('the table has exactly the six book screens from the atlas', () => {
  assert.equal(BOOK_IDS.length, 6, `atlas book group changed: ${BOOK_IDS}`);
  assert.deepEqual(Object.keys(CUSTOMER_ROUTES).sort(), [...BOOK_IDS].sort());
});

test('every customer route lives under /book, the path the server gives this app', () => {
  for (const [id, path] of Object.entries(CUSTOMER_ROUTES)) {
    assert.match(path, /^\/book\//, `${id} -> ${path}`);
  }
});

test('no two screens share a URL', () => {
  const paths = Object.values(CUSTOMER_ROUTES);
  assert.equal(new Set(paths).size, paths.length);
});

test('pending is the private link the server issues', () => {
  // server/booking-link.js linkPath: /book/<slug>/booking/<code>
  assert.equal(CUSTOMER_ROUTES.pending, '/book/:shopSlug/booking/:code');
});
```

- [ ] **Step 2: Write the shell test** — `tests/screens/customer-app-shell.test.js`

```js
// The customer app shell, rendered in jsdom from the test build.
// Spec: docs/superpowers/specs/2026-09-25-book-b-customer-shell-design.md
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/customer/app-shell.js', import.meta.url).href;

let uninstall;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  uninstall?.();
});

async function renderAt(path) {
  uninstall = installDom(`http://localhost${path}`);
  const { render } = await import('@testing-library/react');
  const { createElement } = await import('react');
  const { CustomerAppShell } = await importFresh(SHELL);
  return render(createElement(CustomerAppShell));
}

test('the first book screen renders its placeholder at /book/<shop>', async () => {
  const screen = await renderAt('/book/demo');
  assert.ok(await screen.findByText('Not built yet: service'));
});

test('a private link opened cold reaches the pending screen', async () => {
  const screen = await renderAt(`/book/demo/booking/${'a'.repeat(64)}`);
  assert.ok(await screen.findByText('Not built yet: pending'));
});

test('an unknown /book address says there is no screen there', async () => {
  const screen = await renderAt('/book/demo/nope/nope');
  assert.ok(await screen.findByText('There is no screen at this address.'));
});
```

- [ ] **Step 3: Run both and watch them fail for the right reason**

Run: `npm run pretest && node --test tests/screens/customer-routes.test.js tests/screens/customer-app-shell.test.js`
Expected: the routes test fails to import `src/customer/routes.ts` (module not found); the shell tests fail because `.test-build/customer/app-shell.js` does not exist. Any other failure means a test is wrong.

- [ ] **Step 4: Create `src/customer/routes.ts`**

```ts
/**
 * Atlas screen id -> URL for the customer app, served at every /book address
 * (server/server.js). pending is also the private link the server issues
 * (server/booking-link.js linkPath), so a customer opening it cold lands here.
 *
 * Each journey plan adds its customer screens here and nowhere else. Keys must
 * be book-group ids in screen-index.json and paths must sit under /book
 * (tests/screens/customer-routes.test.js checks both).
 *
 * A .ts file, not .tsx: the tests load it straight into Node.
 * Spec: docs/superpowers/specs/2026-09-25-book-b-customer-shell-design.md
 */
export const CUSTOMER_ROUTES = {
  service: '/book/:shopSlug',
  'service-list': '/book/:shopSlug/services',
  problem: '/book/:shopSlug/problem',
  date: '/book/:shopSlug/date',
  details: '/book/:shopSlug/details',
  pending: '/book/:shopSlug/booking/:code',
} as const;

export type CustomerScreenId = keyof typeof CUSTOMER_ROUTES;
```

- [ ] **Step 5: Create `src/customer/app-shell.tsx`**

```tsx
import type { ComponentType } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, useRouteError } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { ApiError } from '@/lib/api/client.ts';
import { CUSTOMER_ROUTES, type CustomerScreenId } from './routes.ts';

/**
 * The customer app's frame: query client, router, error boundary. The same
 * shape as the staff shell (src/staff/app-shell.tsx) but a separate app: no
 * staff session, and its own addresses under /book.
 *
 * Deliberately unstyled; the screens and their design come in later pieces.
 * Spec: docs/superpowers/specs/2026-09-25-book-b-customer-shell-design.md
 */

// Screens by atlas id. An id with no entry renders the placeholder, so every
// address in CUSTOMER_ROUTES works from day one - including a private link.
const SCREENS: Partial<Record<CustomerScreenId, ComponentType>> = {};

function notBuilt(id: CustomerScreenId): ComponentType {
  function NotBuilt() {
    return <p>Not built yet: {id}</p>;
  }
  NotBuilt.displayName = `NotBuilt(${id})`;
  return NotBuilt;
}

function RouteErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : 'Unknown error';
  return (
    <div role="alert">
      <p>Something went wrong on this screen.</p>
      <p>{message}</p>
    </div>
  );
}

function NoSuchScreen() {
  return <p>There is no screen at this address.</p>;
}

const router = createBrowserRouter([
  {
    ErrorBoundary: RouteErrorBoundary,
    children: [
      ...(Object.entries(CUSTOMER_ROUTES) as [CustomerScreenId, string][]).map(([id, path]) => ({
        path,
        Component: SCREENS[id] ?? notBuilt(id),
      })),
      { path: '/book/*', Component: NoSuchScreen },
    ],
  },
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx will not change on retry - a 404 stays missing - so only server
      // and network failures are retried.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 3,
    },
  },
});

export function CustomerAppShell() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 6: Create `src/customer/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/theme.css';
import { CustomerAppShell } from './app-shell.tsx';

/**
 * Customer entry point. Mounts only where #wh-book-root exists, which is
 * public/book.html - served at /book and /book/* (server/server.js).
 */
const container = document.getElementById('wh-book-root');

if (container) {
  createRoot(container).render(
    <StrictMode>
      <CustomerAppShell />
    </StrictMode>,
  );
}
```

- [ ] **Step 7: Build config**

`vite.config.ts`: in `rollupOptions.input`, add after the `staff` line:

```ts
        book: fileURLToPath(new URL('./src/customer/main.tsx', import.meta.url)),
```

and change the comment above `input` to `// Named entry points: staff (/workshop) and book (/book).`

`vite.test.config.ts`: change the filter to exclude both browser entries:

```ts
const BROWSER_ENTRIES = new Set(['src/staff/main.tsx', 'src/customer/main.tsx']);
const input = globSync('src/**/*.{ts,tsx}').filter(
  (file) => !file.endsWith('.d.ts') && !BROWSER_ENTRIES.has(file),
);
```

and change its comment `// Everything but the browser entry, ...` to `// Everything but the browser entries, which mount into a page and import CSS.` (keep the second comment sentence about globSync).

- [ ] **Step 8: Run and see them pass**

Run: `npm run pretest && node --test tests/screens/customer-routes.test.js tests/screens/customer-app-shell.test.js tests/screens/routes.test.js tests/screens/app-shell.test.js`
Expected: all pass (staff shell tests unchanged).

Run: `npm run build && node -e "const m=require('./public/dist/.vite/manifest.json'); console.log(!!m['src/customer/main.tsx'], !!m['src/staff/main.tsx'])"`
Expected: `true true`.

- [ ] **Step 9: Break steps (record output)**

1. In `src/customer/routes.ts` change `pending` to `'/book/:shopSlug/link/:code'`; confirm with `grep -n "link/:code" src/customer/routes.ts`. Run `npm run pretest && node --test tests/screens/customer-routes.test.js tests/screens/customer-app-shell.test.js`. Expected: `pending is the private link...` fails, and the cold-private-link shell test fails (shows the no-screen text). Restore.
2. In `src/customer/app-shell.tsx` delete the `{ path: '/book/*', Component: NoSuchScreen },` line; confirm with `grep -c "NoSuchScreen }" src/customer/app-shell.tsx` printing `0`. Run the shell test. Expected: `an unknown /book address...` fails. Restore; re-run both files: all pass.

- [ ] **Step 10: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors. Fix only errors in files this task created or changed.

- [ ] **Step 11: Commit**

```bash
git add src/customer tests/screens/customer-routes.test.js tests/screens/customer-app-shell.test.js vite.config.ts vite.test.config.ts
git commit -m "feat: customer app shell with the six book routes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Serve the customer app at `/book`

**Files:**
- Create: `public/book.html`, `tests/book-page.test.js`
- Modify: `server/server.js` (constants ~:287-291; `workshopEntryTags` ~:4951-4968; storefront `/book` forward ~:4989-4992; `/workshop` block ~:5253-5270; `/book` block ~:5272-5283)
- Modify: `tests/workshop-entry-tags.test.js`, `tests/browser/smoke.spec.ts`
- Delete: `tests/portal-copy-served.test.js`

**Interfaces:**
- Consumes: Vite manifest key `src/customer/main.tsx` and mount id `wh-book-root` from Task 1.
- Produces: `export async function appEntryTags(entryKey, manifestPath = VITE_MANIFEST)` in `server/server.js` (replaces `workshopEntryTags`); internal `async function serveAppPage(res, htmlPath, entryKey, label)`.

- [ ] **Step 1: Update `tests/workshop-entry-tags.test.js`**

Replace the import and the two tests' calls, and add a third test:

```js
import { writeFile, mkdtemp } from 'node:fs/promises';
import { appEntryTags } from '../server/server.js';

test('with no build, the error says to run npm run build', async () => {
  const missing = path.join(os.tmpdir(), `no-such-dir-${process.pid}`, 'manifest.json');
  await assert.rejects(appEntryTags('src/staff/main.tsx', missing), /run npm run build/);
});

test('a manifest that exists but cannot be read still fails with its own error', async () => {
  // A directory where the file should be: not "missing", so not the build hint.
  await assert.rejects(appEntryTags('src/staff/main.tsx', os.tmpdir()), (err) => !/run npm run build/.test(err.message));
});

test('a build without the customer entry names the missing entry', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'manifest-'));
  const file = path.join(dir, 'manifest.json');
  await writeFile(file, JSON.stringify({ 'src/staff/main.tsx': { file: 'assets/staff.js' } }));
  await assert.rejects(appEntryTags('src/customer/main.tsx', file), /src\/customer\/main\.tsx/);
});
```

(Keep the file's header comment, `node:test`/`assert`/`path`/`os`/`load-env` imports.)

- [ ] **Step 2: Write `tests/book-page.test.js`**

```js
// The customer app is served at every /book address, on the main host and on
// a shop's storefront subdomain. Needs a built bundle (npm run build).
// Spec: docs/superpowers/specs/2026-09-25-book-b-customer-shell-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let customerScript;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  const manifest = JSON.parse(await readFile(new URL('../public/dist/.vite/manifest.json', import.meta.url), 'utf8'));
  customerScript = `/dist/${manifest['src/customer/main.tsx'].file}`;
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

async function assertCustomerPage(url) {
  const res = await fetch(url);
  assert.equal(res.status, 200, url);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const html = await res.text();
  assert.match(html, /id="wh-book-root"/, 'no customer mount point');
  assert.ok(html.includes(`<script type="module" src="${customerScript}"></script>`), `no customer entry script in ${html}`);
  assert.ok(!html.includes('/book/portal.js'), 'the old booking page was served');
}

test('/book/<shop> serves the customer app', async () => {
  await assertCustomerPage(`${server.baseUrl}/book/${owner.shop.slug}`);
});

test('a private link opened cold gets the customer app', async () => {
  await assertCustomerPage(`${server.baseUrl}/book/${owner.shop.slug}/booking/${'a'.repeat(64)}`);
});

test('the customer app script it names is really there', async () => {
  const res = await fetch(`${server.baseUrl}${customerScript}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /javascript/);
  await res.arrayBuffer();
});

test('on a storefront, /book serves the customer app too', async () => {
  await runWithShop(owner.shop.id, () => prepare(
    'INSERT INTO storefront_settings (enabled) VALUES (true) ON CONFLICT (shop_id) DO UPDATE SET enabled = true'
  ).run());
  // ?storefrontSlug= routes the request through the storefront handler, the
  // same path a <slug>.<base domain> host takes (server/storefront.js).
  await assertCustomerPage(`${server.baseUrl}/book/${owner.shop.slug}?storefrontSlug=${owner.shop.slug}`);
});
```

- [ ] **Step 3: Run and watch them fail for the right reason**

Run: `npm run build && node --test tests/book-page.test.js tests/workshop-entry-tags.test.js`
Expected: the entry-tags tests fail on the missing `appEntryTags` export (SyntaxError on import); the book-page tests fail with `no customer mount point` (the old portal page is served). A failure in the storefront test's INSERT means the SQL is wrong — check `server/migrations/010_storefront.sql` and fix the test first.

- [ ] **Step 4: Create `public/book.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Book a service</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔧</text></svg>" />
</head>
<body>
  <div id="wh-book-root"></div>
  <!--WH_ENTRY-->
</body>
</html>
```

- [ ] **Step 5: Server changes in `server/server.js`**

5a. Constants: delete `const PORTAL_DIR = path.join(__dirname, '..', 'public-portal');` and add after `WORKSHOP_HTML`:

```js
const BOOK_HTML = path.join(PUBLIC_DIR, 'book.html');
```

5b. Replace `workshopEntryTags` (keep the comment block above it, changing its first words to say it serves either app) with:

```js
export async function appEntryTags(entryKey, manifestPath = VITE_MANIFEST) {
  let raw;
  try {
    raw = await readFile(manifestPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`no app build at ${manifestPath} - run npm run build`, { cause: err });
    }
    throw err;
  }
  const manifest = JSON.parse(raw);
  const entry = manifest[entryKey];
  if (!entry) throw new Error(`vite manifest has no ${entryKey} entry - run npm run build`);
  const css = (entry.css || [])
    .map((href) => `<link rel="stylesheet" href="/dist/${href}" />`)
    .join('\n  ');
  return `${css}\n  <script type="module" src="/dist/${entry.file}"></script>`;
}

// One of the React apps' pages: its HTML with the entry's tags put in. Every
// address the app's router owns gets this same page, so a link opened cold
// reaches its screen. No build means a 500 that says so, not a blank page.
// Plain text, so the message needs no HTML escaping.
async function serveAppPage(res, htmlPath, entryKey, label) {
  try {
    const [html, tags] = await Promise.all([readFile(htmlPath, 'utf8'), appEntryTags(entryKey)]);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html.replace('<!--WH_ENTRY-->', tags));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`${label} bundle not built: ${err.message}`);
  }
}
```

5c. Storefront handler: replace

```js
  if (pathname === '/book' || pathname.startsWith('/book/')) {
    const relative = pathname.slice('/book'.length) || '/';
    return serveStatic(req, res, relative, PORTAL_DIR);
  }
```

with

```js
  if (pathname === '/book' || pathname.startsWith('/book/')) {
    return serveAppPage(res, BOOK_HTML, 'src/customer/main.tsx', 'book');
  }
```

and in that function's comment change "the booking portal" to "the customer booking app".

5d. `/workshop` block body becomes (keep its leading comment):

```js
  if (pathname === '/workshop' || pathname.startsWith('/workshop/')) {
    await serveAppPage(res, WORKSHOP_HTML, 'src/staff/main.tsx', 'workshop');
    return;
  }
```

5e. Replace the `/book` block and its comment with:

```js
  // The React customer app (src/customer/). Every path under /book gets the
  // same page because its router owns those addresses, including the private
  // link /book/<slug>/booking/<code>. The old public-portal/ page is no longer
  // served (J1, changed 25 Sep).
  if (pathname === '/book' || pathname.startsWith('/book/')) {
    await serveAppPage(res, BOOK_HTML, 'src/customer/main.tsx', 'book');
    return;
  }
```

5f. Check nothing else uses the removed names: `grep -n "workshopEntryTags\|PORTAL_DIR" server/ tests/ -r` must print nothing.

- [ ] **Step 6: Delete the old-page serving test**

```bash
git rm tests/portal-copy-served.test.js
```

- [ ] **Step 7: Run and see them pass**

Run: `node --test tests/book-page.test.js tests/workshop-entry-tags.test.js tests/workshop-page.test.js tests/static-cache.test.js`
Expected: all pass.

- [ ] **Step 8: Break steps (record output)**

1. In the main `/book` block change `'src/customer/main.tsx'` to `'src/staff/main.tsx'`; confirm with `grep -n "BOOK_HTML, 'src/staff/main.tsx'" server/server.js` (one line). Run `node --test tests/book-page.test.js`. Expected: the three main-host tests fail on `no customer entry script`; the storefront test still passes. Restore.
2. In the storefront handler change `BOOK_HTML` to `WORKSHOP_HTML`; confirm with `grep -n "serveAppPage(res, WORKSHOP_HTML, 'src/customer" server/server.js`. Run the file. Expected: only the storefront test fails, on `no customer mount point`. Restore; re-run: all pass.

- [ ] **Step 9: Browser smoke test** — append to `tests/browser/smoke.spec.ts`

```ts
test('the customer app mounts at /book in a real browser', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/book/any-shop');
  await expect(page.locator('#wh-book-root')).toContainText('Not built yet: service');
  expect(errors).toEqual([]);
});
```

Run: `npm run test:browser`
Expected: 3 passed. Break: comment out the `book:` input line in `vite.config.ts`, confirm with `grep -n "// *book:" vite.config.ts`, run again: the new test fails (500 page, no mount point). Restore; run again: 3 passed.

- [ ] **Step 10: Full checks**

Run: `npm run typecheck && npm run lint && npm run build && npm test`
Expected: no type or lint errors; `npm test` 0 failures. Report the exact counts.

- [ ] **Step 11: Commit**

```bash
git add public/book.html server/server.js tests/book-page.test.js tests/workshop-entry-tags.test.js tests/browser/smoke.spec.ts
git commit -m "feat: serve the customer app at /book in place of the old booking page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`tests/portal-copy-served.test.js` is already staged as deleted by `git rm`.)
