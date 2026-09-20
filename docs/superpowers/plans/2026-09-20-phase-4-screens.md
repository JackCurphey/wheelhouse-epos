# Phase 4 — The Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 82 atlas screens as a real React staff app on the existing server and schema, in journey order, and cut the workshop half of `public/app.js` over to it at the end.

**Architecture:** A new React app under `src/staff/`, mounted on a new page the
existing plain-Node server serves at `/workshop`, talking to the Phase 3 API.
One API client module owns the optimistic-concurrency contract (every mutation
echoes the job's `version`; a 409 means someone else moved it and the screen
refetches and says so). React Query owns cache invalidation so that behaviour is
the default rather than something 82 screens each remember. Print and messaging
sit behind a stub adapter that records intent and never claims delivery. The
old vanilla app keeps till, inventory, suppliers and storefront; only its
workshop screens are retired.

**Tech Stack:** React 19, Vite 8, Tailwind 4 (CSS-first, tokens in
`src/styles/theme.css`), the self-hosted `@/registry` components (no Radix),
`react-router`, `@tanstack/react-query`, `@testing-library/react` + `jsdom`,
Playwright, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-20-release-1-screen-build-design.md`

## Global Constraints

- **Money is a JS float and is totalled in SQL, never in JavaScript.** Decided
  20 Sep (`.agents/ARCHIVE.md`). No screen computes a total. Totals arrive from
  the API. `registry/patterns/money-input.tsx` is the enforcement point at the
  input edge — every amount field uses it.
- **Every mutation sends `version`.** It comes back on every job read
  (`serializeWorkshopJob`, `server/server.js:2353`). A missing version is a 400;
  a stale one is a 409. A screen that swallows a 409 is a defect.
- **Identity is read only through `GET /api/auth/me`.** No screen touches the
  team-login tables or the session cookie directly. This is what keeps the
  approved-but-unbuilt WorkOS migration a provider swap rather than a rewrite.
- **Stubs record intent. They never claim delivery.** The print and message
  adapters display "recorded" / "queued", never "printed" or "sent". Nothing in
  the UI may state a fact the system has not observed.
- **Components come from `@/registry`**, not stock shadcn, and carry no Radix
  dependency. Add a new primitive to `registry/` and rebuild
  (`npm run registry:build`) rather than hand-rolling one inside a screen —
  `scripts/ci/check-registry-drift.mjs` fails if `public/r/` and the source
  disagree.
- **`--accent`, `--accent-dark` and `--modal-bg` are runtime per-shop
  variables** set by `applyShopTheme()` (`public/app.js:6899`). They stay in
  `@theme inline` and are never baked to literals, or per-shop theming dies
  silently for every shop. See the header comment in `src/styles/theme.css`.
- **Every covered endpoint names a screen** in a `// screens:` comment with no
  blank line before the route, and `COVERED` in
  `scripts/ci/assert-screen-trace.mjs` is extended whenever a new route shape
  lands. The check is endpoint → screen only; it cannot tell you a screen has
  no endpoint.
- **Never hand-edit the atlas HTML or `screen-index.json`** — `package.py`
  regenerates them.
- **`npm test` hangs silently without the compose Postgres up** (`npm run
  docker:up`). The app is on `localhost:8080`, Postgres on `5433`.
- **`npm run build` dirties `public/dist`** (gitignored) — check `git status`
  before committing.
- **Never delete the `cf-*` header names in `server/gateway.js`** — removing
  that strip list reintroduces a login brute-force bypass.

## Decisions taken in this plan

| # | Decision | Decided by | Consequence |
|---|---|---|---|
| A | The seven print/message screens are **built against a stub adapter that records intent**, not deferred | Jack, 20 Sep | Every journey stays walkable end to end; the real providers drop in at Phase 5 with no screen change. The stub must be visibly a stub |
| B | The mechanic auth screens build on the **existing team-login**, reading identity only via `GET /api/auth/me` | Jack, 20 Sep | The mechanic entry path works now; the WorkOS migration stays a provider swap behind one call |
| C | The **quote read endpoints ship as a Phase 3 patch** on their own branch, merged before Task 1 | Jack, 20 Sep | Phase 4 contains no server work except the cutover. See `2026-09-20-phase-3-quote-reads.md` |
| D | `react-router`, `@tanstack/react-query`, `@testing-library/react` and Playwright are **approved dependencies** | Jack, 20 Sep | Explicit approval given; no further dependency is added without asking again |
| E | The **workshop half of `public/app.js` is cut over in the final task** of this phase, closing the legacy `status` hole | Jack, 20 Sep | Two unguarded write paths into job records stop existing. Till, inventory, suppliers and storefront stay in the old app |

## Scope: why this is a plan of plans

Phase 3 covered 19 endpoints in 9 tasks. Phase 4 covers 82 screens. At the same
step granularity that is roughly five times the Phase 3 document, which is
neither writable in one pass nor readable by the engineer who has to execute
it.

So this plan contains, at full step granularity, the work that is **shared by
every screen** — the app shell, the API client, the auth guard, the test
harnesses, the stub adapter — and the **cutover** that ends the phase. The six
journey groups each get their own sibling plan, written immediately before that
group is executed, so each one can absorb what the previous group learned.

The contract every journey plan must satisfy is stated in Task 7 below. A
journey plan that does not meet it is not ready to execute.

**Execution order:**

| Order | Plan | Screens |
|---|---|---|
| 0 | `2026-09-20-phase-3-quote-reads.md` (prerequisite, separate branch) | — |
| 1 | This plan, Tasks 1–6 (foundation) | — |
| 2 | `2026-09-20-phase-4a-book.md` | 6 |
| 3 | `2026-09-20-phase-4b-intake.md` | 11 |
| 4 | `2026-09-20-phase-4c-quote.md` | 7 |
| 5 | `2026-09-20-phase-4d-work.md` | 15 |
| 6 | `2026-09-20-phase-4e-setup.md` | 19 |
| 7 | `2026-09-20-phase-4f-edges.md` | 24 |
| 8 | This plan, Task 8 (cutover) | — |

Edges last, as the design requires: 24 of the 82 are alternative outcomes of
journeys that must exist first.

## Test setup convention

Three layers, each proving something the others cannot:

1. **Server tests** (`node:test`, `tests/*.test.js`) — already exist. The API
   is correct in isolation.
2. **Component tests** (`node:test` + `@testing-library/react` + `jsdom`,
   `tests/screens/*.test.js`) — a screen renders the right thing and its
   controls call the right client function. The API is faked.
3. **Journey tests** (Playwright, `tests/browser/*.spec.ts`) — the real app in
   a real browser against the real server and the compose Postgres. Six of
   them, one per journey group. This is the only layer that catches a screen
   wired to the wrong endpoint or dropping the `version` echo, which is the
   failure Phase 4 is most exposed to.

**Every new test is confirmed by breaking the code it covers,** watching it
fail for the right reason, and restoring. Assert the mutation actually landed
before believing the failure — a no-op edit makes a test look sound while
proving nothing.

## File Structure

| File | Responsibility |
|---|---|
| `public/workshop.html` | Host page for the React app. Creates `#wh-root` — the thing that has never existed |
| `server/server.js` | Serves `/workshop`, injecting the hashed entry from the Vite manifest |
| `src/staff/main.tsx` | Mount + providers (router, query client). Modify: currently renders an empty `StrictMode` |
| `src/staff/routes.tsx` | The route table. One place that knows every screen's URL |
| `src/staff/app-shell.tsx` | Chrome: nav, shop theme, error boundary |
| `src/lib/api/client.ts` | `apiGet` / `apiMutate`. Owns the `version` echo, 409 handling, JSON and cookies |
| `src/lib/api/jobs.ts` | Typed job reads and the 15 action calls |
| `src/lib/api/quotes.ts` | Typed quote reads and writes |
| `src/lib/api/types.ts` | Shared response types. One definition per API shape |
| `src/lib/auth/use-session.ts` | `useSession()` over `GET /api/auth/me` — the only identity source |
| `src/lib/adapters/intent.ts` | Stub adapter: records print and message intent, claims nothing |
| `src/screens/<group>/<id>.tsx` | One file per atlas screen, named by its `screen-index.json` id |
| `tests/screens/*.test.js` | Component tests |
| `tests/browser/*.spec.ts` | Six Playwright journey tests |
| `playwright.config.ts` | Playwright config, root |

Screens live grouped by journey, not by technical layer — the files that change
together are the ones in a journey.

---

### Task 1: A page that mounts the app

**Files:**
- Create: `public/workshop.html`
- Modify: `src/staff/main.tsx`
- Modify: `server/server.js` (static route area, near `:4179`)
- Test: `tests/workshop-page.test.js` (create)

**Interfaces:**
- Produces: a `GET /workshop` route serving an HTML page containing
  `<div id="wh-root">`, with a `<script type="module">` tag pointing at the
  hashed bundle Vite emitted. Every later task depends on this existing.

**Why this is task 1:** `npm run build` currently produces a bundle that no
page loads. `public/index.html` references `/app.js` and never `/dist/`, and
`main.tsx` only mounts when `#wh-root` exists, which it never does. Until this
task lands, no screen can be seen in a browser and no Playwright test can run.

- [ ] **Step 1: Write the failing test**

Create `tests/workshop-page.test.js`:

```js
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startLiveServer } from './helpers/liveServer.js';

let server;
before(async () => { server = await startLiveServer(); });
after(async () => { if (server) await server.stop(); });

test('GET /workshop serves a page with a mount point', async () => {
  const res = await fetch(`${server.baseUrl}/workshop`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /id="wh-root"/);
});

test('the page loads the hashed bundle from the manifest, not a guessed path', async () => {
  const res = await fetch(`${server.baseUrl}/workshop`);
  const html = await res.text();
  // Vite content-hashes filenames. A hardcoded /dist/main.js would 404 after
  // any rebuild, so the page must carry a hashed name from the manifest.
  assert.match(html, /<script type="module" src="\/dist\/assets\/[^"]+\.js"/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run docker:up && node --test tests/workshop-page.test.js`
Expected: FAIL with status 404 — `/workshop` is not a route.

- [ ] **Step 3: Create the host page**

Create `public/workshop.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wheelhouse Workshop</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔧</text></svg>" />
</head>
<body>
  <div id="wh-root"></div>
  <!--WH_ENTRY-->
</body>
</html>
```

No stylesheet link: Tailwind and the tokens are compiled into the bundle's own
CSS, which the entry tag pulls in. `public/styles.css` belongs to the old app
and must not be loaded here, or its global selectors will fight the new one.

- [ ] **Step 4: Serve it with the manifest entry injected**

In `server/server.js`, beside the existing static handling (~`:4179`):

```js
// The React workshop app. Vite content-hashes its output, so the entry
// filename is not knowable at author time - it is read from the manifest Vite
// writes into the bundle. Read per request in development and cached in
// production would be premature here: the file is small and there is no shop
// live, so it is read per request and kept simple.
const WORKSHOP_HTML = path.join(PUBLIC_DIR, 'workshop.html');
const VITE_MANIFEST = path.join(PUBLIC_DIR, 'dist', '.vite', 'manifest.json');

async function workshopEntryTags() {
  const manifest = JSON.parse(await fs.readFile(VITE_MANIFEST, 'utf8'));
  const entry = manifest['src/staff/main.tsx'];
  if (!entry) throw new Error('vite manifest has no src/staff/main.tsx entry - run npm run build');
  const css = (entry.css || [])
    .map((href) => `<link rel="stylesheet" href="/dist/${href}" />`)
    .join('\n  ');
  return `${css}\n  <script type="module" src="/dist/${entry.file}"></script>`;
}

route('GET', '/workshop', async (req, res) => {
  try {
    const [html, tags] = await Promise.all([fs.readFile(WORKSHOP_HTML, 'utf8'), workshopEntryTags()]);
    sendHtml(res, 200, html.replace('<!--WH_ENTRY-->', tags));
  } catch (err) {
    // A missing manifest means the bundle was never built. Say that, rather
    // than serving a blank page that looks like a broken app.
    sendHtml(res, 500, `<pre>workshop bundle not built: ${esc(String(err.message))}</pre>`);
  }
});
```

Use whatever the file already calls its HTML sender and its path/fs imports —
read the surrounding 40 lines first and match them. If there is no `sendHtml`,
use the existing static-file response helper rather than adding a new one.

- [ ] **Step 5: Build, then run the test**

Run: `npm run build && node --test tests/workshop-page.test.js`
Expected: PASS, both cases.

- [ ] **Step 6: Break it on purpose**

Rename the manifest key lookup from `'src/staff/main.tsx'` to
`'src/staff/nope.tsx'`. Run the test.
Expected: FAIL — status 500, no script tag. Confirm the edit landed, restore,
re-run to green.

- [ ] **Step 7: See it in a browser**

Run: `npm start`, open `http://localhost:8080/workshop`.
Expected: a blank page with no console errors. Blank is correct — `main.tsx`
still renders an empty `StrictMode`. Confirm in devtools that `#wh-root` exists
and the bundle loaded with status 200.

- [ ] **Step 8: Commit**

```bash
git add public/workshop.html server/server.js tests/workshop-page.test.js
git commit -m "feat: serve a page that mounts the React workshop app"
```

---

### Task 2: The API client and the version contract

**Files:**
- Create: `src/lib/api/client.ts`, `src/lib/api/types.ts`
- Test: `tests/screens/api-client.test.js` (create)

**Interfaces:**
- Produces:
  - `apiGet<T>(path: string): Promise<T>` — throws `ApiError` on non-2xx.
  - `apiMutate<T>(path: string, body: unknown, opts?: { method?: 'POST' | 'PUT' | 'DELETE' }): Promise<T>`
  - `class ApiError extends Error { status: number; code: 'stale' | 'illegal' | 'not_found' | 'bad_request' | 'unauthorized' | 'unknown'; body: unknown }`
  - `jobAction<T>(jobId: number, action: string, version: number, body?: object): Promise<T>` — the only way a screen performs one of the 15 guarded actions. `version` is a required parameter with no default.

  Every later task and every journey plan consumes these exact names.

**Why `version` is a required positional parameter:** an optional one with a
default is a parameter a screen can forget. Making it required means a screen
that does not have the version cannot compile, which is the earliest possible
place to catch it.

- [ ] **Step 1: Install the dependencies**

```bash
npm install --save-dev @tanstack/react-query react-router @testing-library/react @testing-library/dom
```

`jsdom` is already a devDependency (`30.0.1`) and currently unused at root;
this is what starts using it.

These four were approved by Jack on 20 Sep (decision D). **Adding any
dependency beyond this list needs asking first.**

- [ ] **Step 2: Write the failing test**

Create `tests/screens/api-client.test.js`. It runs under `node:test` with a
stubbed `globalThis.fetch` — no server, no browser:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { apiGet, apiMutate, jobAction, ApiError } from '../../src/lib/api/client.ts';

function stubFetch(status, body) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    };
  };
  return calls;
}

test('jobAction sends the version in the body', async () => {
  const calls = stubFetch(200, { id: 1, version: 4 });
  await jobAction(1, 'start', 3);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/workshop-jobs/1/start');
  assert.deepEqual(JSON.parse(calls[0].options.body), { version: 3 });
});

test('a 409 becomes an ApiError with code "stale"', async () => {
  stubFetch(409, { error: 'stale' });
  await assert.rejects(
    () => jobAction(1, 'start', 3),
    (err) => err instanceof ApiError && err.status === 409 && err.code === 'stale',
  );
});

test('a 409 illegal transition is distinguished from a stale one', async () => {
  stubFetch(409, { error: 'illegal' });
  await assert.rejects(
    () => jobAction(1, 'start', 3),
    (err) => err.code === 'illegal',
  );
});

test('apiGet throws on 404 rather than returning undefined', async () => {
  stubFetch(404, { error: 'Job not found' });
  await assert.rejects(() => apiGet('/api/workshop-jobs/9'), (err) => err.status === 404);
});
```

Running `.ts` directly under `node --test` requires Node's type stripping,
which is available on the `>=22.5.0` engine this repo pins. If the import
fails, add `--experimental-strip-types` to the test command in `package.json`
rather than compiling a separate build step for tests.

- [ ] **Step 3: Run it to verify it fails**

Run: `node --test tests/screens/api-client.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the client**

Create `src/lib/api/client.ts`:

```ts
/**
 * The one place the staff app talks to the server.
 *
 * Two rules live here rather than in 82 screens:
 *
 * 1. Every guarded action carries the job's `version`. The server refuses a
 *    missing one with 400 and a stale one with 409 (server/workshop/
 *    transitions.js). `jobAction` takes version as a required parameter so a
 *    screen that does not have it cannot compile.
 * 2. A 409 is not a generic failure. `stale` means someone else moved the job
 *    and the screen must refetch and say so; `illegal` means the action was
 *    never allowed from this state and refetching changes nothing. Screens
 *    behave differently for the two, so the client tells them apart.
 */
export type ApiErrorCode =
  | 'stale'
  | 'illegal'
  | 'not_found'
  | 'bad_request'
  | 'unauthorized'
  | 'unknown';

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  body: unknown;

  constructor(status: number, body: unknown) {
    const serverMessage =
      body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : '';
    super(serverMessage || `request failed with ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.code = classify(status, serverMessage);
  }
}

function classify(status: number, serverMessage: string): ApiErrorCode {
  if (status === 409) return serverMessage.includes('illegal') ? 'illegal' : 'stale';
  if (status === 404) return 'not_found';
  if (status === 401) return 'unauthorized';
  if (status === 400) return 'bad_request';
  return 'unknown';
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...options });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function apiMutate<T>(
  path: string,
  body: unknown,
  opts: { method?: 'POST' | 'PUT' | 'DELETE' } = {},
): Promise<T> {
  return request<T>(path, {
    method: opts.method ?? 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * One of the fifteen guarded actions. `version` is required and never
 * defaulted: defaulting it would send whatever the client last saw, which is
 * precisely the race the optimistic check exists to refuse.
 */
export function jobAction<T>(
  jobId: number,
  action: string,
  version: number,
  body: object = {},
): Promise<T> {
  return apiMutate<T>(`/api/workshop-jobs/${jobId}/${action}`, { ...body, version });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/screens/api-client.test.js`
Expected: PASS, four cases.

- [ ] **Step 6: Break it on purpose**

In `jobAction`, change `{ ...body, version }` to `{ ...body }`.
Run the test. Expected: FAIL on the first case — the body is `{}` not
`{ version: 3 }`. Confirm the edit landed
(`grep -n "{ \.\.\.body }" src/lib/api/client.ts`), restore, re-run to green.

This break matters more than the others in this task: it is the exact defect
the whole contract exists to prevent, and if the test does not catch it, 82
screens are unprotected.

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: clean. The repo runs `strict` with `noUnusedLocals`,
`verbatimModuleSyntax` and `erasableSyntaxOnly` — use `import type` for
type-only imports.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/lib/api tests/screens/api-client.test.js
git commit -m "feat: API client owning the version echo and 409 handling"
```

---

### Task 3: Session, router and shell

**Files:**
- Create: `src/lib/auth/use-session.ts`, `src/staff/routes.tsx`, `src/staff/app-shell.tsx`
- Modify: `src/staff/main.tsx`
- Test: `tests/screens/session.test.js`, `tests/screens/routes.test.js`

**Interfaces:**
- Produces:
  - `useSession(): { status: 'loading' | 'signed-in' | 'signed-out'; user?: { id: number; name: string; email: string }; shop?: { id: number; name: string; slug: string } }`
  - `ROUTES` in `routes.tsx`, an `as const` object keyed by atlas screen id with URL-path values, plus `type ScreenId = keyof typeof ROUTES` exported from the same file — the single mapping
    from an atlas screen id to its URL path. Every journey plan adds its
    screens here and nowhere else.
  - `<AppShell>` providing the query client, router and an error boundary.

**The five standalone edges:** `reschedule` (44), `cancel` (46), `expired`
(50), `preferences` (62) and `service-status` (63) have no inbound link from
any other screen in `screen-index.json` — they are entered from an emailed
link or a stale bookmark. They must be routable URLs from this task, not
in-flow states reachable only by navigation. Add placeholder routes for them
now that render "not built yet"; the edges plan replaces the components.

- [ ] **Step 1: Write the failing session test**

Create `tests/screens/session.test.js`, stubbing `fetch` as in Task 2:

```js
test('useSession reports signed-out on 401 rather than throwing', async () => {
  stubFetch(401, { error: 'Not signed in' });
  const state = await resolveSession();
  assert.equal(state.status, 'signed-out');
});

test('useSession reads identity only from /api/auth/me', async () => {
  const calls = stubFetch(200, { id: 3, name: 'Alex', email: 'a@example.com', shop: { id: 1, name: 'S', slug: 's' } });
  await resolveSession();
  assert.deepEqual(calls.map((c) => c.url), ['/api/auth/me']);
});
```

Export the plain async `resolveSession()` from `use-session.ts` alongside the
hook, so the contract is testable without rendering. The hook wraps it in
`useQuery`.

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/screens/session.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the session module**

```ts
import { useQuery } from '@tanstack/react-query';
import { apiGet, ApiError } from '@/lib/api/client';

/**
 * The ONLY identity source in the staff app.
 *
 * Decision B, 20 Sep: the mechanic screens build on the existing team-login,
 * and the WorkOS migration is approved but unbuilt. Keeping every screen
 * behind this one call is what makes that migration a provider swap rather
 * than 82 screen edits. No screen reads the session cookie or the team tables.
 */
export type SessionUser = { id: number; name: string; email: string };
export type SessionShop = { id: number; name: string; slug: string };
export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: SessionUser; shop: SessionShop };

export async function resolveSession(): Promise<SessionState> {
  try {
    const me = await apiGet<SessionUser & { shop: SessionShop }>('/api/auth/me');
    return { status: 'signed-in', user: { id: me.id, name: me.name, email: me.email }, shop: me.shop };
  } catch (err) {
    // Signed out is an ordinary answer to "who am I", not a failure. Anything
    // else is a real error and must not be disguised as signed-out, or an
    // outage silently becomes a login screen.
    if (err instanceof ApiError && err.status === 401) return { status: 'signed-out' };
    throw err;
  }
}

export function useSession(): SessionState {
  const { data } = useQuery({ queryKey: ['session'], queryFn: resolveSession });
  return data ?? { status: 'loading' };
}
```

Before writing this, run `curl -s localhost:8080/api/auth/me` against a signed-in
session and match the real response shape. If it differs from the shape above,
**the real shape wins** — correct the types rather than the server.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/screens/session.test.js`
Expected: PASS.

- [ ] **Step 5: Break it on purpose**

Change the `err.status === 401` check to `err.status === 403`. Run the test.
Expected: FAIL — the signed-out case now throws. Confirm, restore, re-run.

- [ ] **Step 6: Write the route table**

Create `src/staff/routes.tsx` with the five standalone edge paths present from
the start:

```tsx
/**
 * Atlas screen id -> URL. One table, because five edge screens are entered
 * from outside the app entirely - an emailed link or a stale bookmark - and a
 * router that only knows in-flow navigation cannot serve them.
 * screen-index.json records no inbound branch for reschedule (44), cancel
 * (46), expired (50), preferences (62) or service-status (63).
 */
export const ROUTES = {
  desk: '/workshop',
  reschedule: '/workshop/booking/:jobId/reschedule',
  cancel: '/workshop/booking/:jobId/cancel',
  expired: '/workshop/link-expired',
  preferences: '/workshop/preferences/:customerId',
  'service-status': '/workshop/service-status',
} as const;

export type ScreenId = keyof typeof ROUTES;
```

Each journey plan extends this object. Nothing else in the app writes a URL
string.

- [ ] **Step 7: Write the failing route test, then the shell**

```js
test('the five standalone edge screens have their own URLs', () => {
  for (const id of ['reschedule', 'cancel', 'expired', 'preferences', 'service-status']) {
    assert.ok(ROUTES[id], `${id} has no route`);
  }
});
```

Run it, watch it fail, then wire `AppShell` (QueryClientProvider +
RouterProvider + error boundary) and update `main.tsx` to render `<AppShell />`
instead of an empty `StrictMode`.

- [ ] **Step 8: Verify in the browser**

Run: `npm run build && npm start`, open `http://localhost:8080/workshop`.
Expected: the shell renders, `/workshop/link-expired` renders its placeholder,
no console errors.

- [ ] **Step 9: Commit**

```bash
git add src tests/screens
git commit -m "feat: session, router and app shell"
```

---

### Task 4: The Playwright journey harness

**Files:**
- Create: `playwright.config.ts`, `tests/browser/smoke.spec.ts`
- Modify: `package.json`, `.github/workflows/test.yml`

**Interfaces:**
- Produces: `npm run test:browser` running Playwright against a server the
  config starts, and a CI step that runs it on pull requests.

**Why now and not later:** if the harness lands after the first journey, the
first journey has no end-to-end proof and the done-condition is retrofitted.
Six journey tests are the phase's done-condition; the harness is part of the
foundation.

- [ ] **Step 1: Install**

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

Approved under decision D. Chromium only — three browsers triples CI time for
an internal staff app that runs on one.

- [ ] **Step 2: Write the config**

Create `playwright.config.ts`. `webServer` builds and boots the real server so
the test drives the real bundle, not a dev server:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/browser',
  // Journey tests share one database. Running them in parallel means two
  // journeys booking the same capacity slot, which is a real race that would
  // show up as flake rather than as a finding.
  workers: 1,
  fullyParallel: false,
  // Two retries hide flake. One retry, and a test that needs it gets looked at.
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:8080', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && npm start',
    url: 'http://127.0.0.1:8080/workshop',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Write the failing smoke test**

Create `tests/browser/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('the workshop app mounts in a real browser', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/workshop');
  await expect(page.locator('#wh-root')).not.toBeEmpty();
  expect(errors).toEqual([]);
});
```

- [ ] **Step 4: Add the script and run it**

In `package.json`: `"test:browser": "playwright test"`.

Run: `npm run docker:up && npm run test:browser`
Expected: PASS. If `#wh-root` is empty, Task 3's shell is not rendering —
fix that before continuing rather than weakening the assertion.

- [ ] **Step 5: Break it on purpose**

In `src/staff/main.tsx`, change `getElementById('wh-root')` to
`getElementById('wh-root-nope')`. Run `npm run test:browser`.
Expected: FAIL — `#wh-root` is empty. Confirm the edit landed, restore,
re-run to green.

- [ ] **Step 6: Add it to CI**

In `.github/workflows/test.yml`, after the existing `npm test` step:

```yaml
      - name: Install Playwright browser
        run: npx playwright install --with-deps chromium
      - name: Journey tests
        run: npm run test:browser
```

- [ ] **Step 7: Confirm CI actually ran it**

Push the branch, open the PR, and read the check's log to confirm the journey
step executed and reported a pass count. A workflow edited but not observed
running is not a gate. If the step is skipped or the browser install fails,
fix it now — every later journey depends on this step working.

- [ ] **Step 8: Commit**

```bash
git add playwright.config.ts tests/browser package.json package-lock.json .github/workflows/test.yml
git commit -m "test: Playwright journey harness, running in CI"
```

---

### Task 5: The intent adapter for print and messaging

**Files:**
- Create: `src/lib/adapters/intent.ts`
- Test: `tests/screens/intent-adapter.test.js`

**Interfaces:**
- Produces:
  - `recordPrintIntent(jobId: number, kind: 'tag' | 'job-card'): Promise<IntentRecord>`
  - `recordMessageIntent(jobId: number, channel: 'email' | 'sms' | 'whatsapp', bodyText: string): Promise<IntentRecord>`
  - ```ts
    type IntentBase = { id: string; createdAt: string; state: 'recorded'; deliveredAt: null };
    type PrintIntent = IntentBase & { intent: 'print'; kind: 'tag' | 'job-card'; jobId: number };
    type MessageIntent = IntentBase & { intent: 'message'; channel: 'email' | 'sms' | 'whatsapp'; bodyText: string; jobId: number };
    type IntentRecord = PrintIntent | MessageIntent;
    ```
    `state` is the literal `'recorded'` and `deliveredAt` is the literal
    `null`, so a future edit that tries to report delivery fails to typecheck
    rather than failing silently.

**What this is and is not.** Decision A: the seven print and message screens
are built now, against a stub, so every journey stays walkable. P00b (printer,
label stock, driver host) and P00c (message providers) are outstanding, so the
system genuinely does not know whether anything was printed or sent.

The adapter therefore records **intent** and nothing else. `state` is
`'recorded'`, never `'sent'` or `'printed'`. `deliveredAt` is `null` and there
is no code path that sets it. Screens render "recorded" and say plainly that
delivery is not yet connected.

This is not a style preference. A stub that reports success is fabricated data
— the screen would be stating a fact about the physical world that nothing
observed.

- [ ] **Step 1: Write the failing test**

```js
test('a recorded print intent never claims it printed', async () => {
  const record = await recordPrintIntent(1, 'tag');
  assert.equal(record.state, 'recorded');
  assert.equal(record.deliveredAt, null);
});

test('no adapter code path can produce a delivered state', async () => {
  const source = await readFile('src/lib/adapters/intent.ts', 'utf8');
  // A guard against the stub quietly growing a success path later.
  assert.doesNotMatch(source, /'sent'|'printed'|'delivered'/);
});

test('a recorded message intent keeps the channel and the text', async () => {
  const record = await recordMessageIntent(1, 'sms', 'Your bike is ready');
  assert.equal(record.channel, 'sms');
  assert.equal(record.bodyText, 'Your bike is ready');
  assert.equal(record.state, 'recorded');
});
```

The second test is a source assertion rather than a behavioural one. It is
there because the failure it guards against is a future edit, not a current
bug, and it will be read by whoever writes the Phase 5 real adapter.

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/screens/intent-adapter.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the adapter**

Records are held in memory for now — there is no print-task or message-intent
endpoint (that is P00b/P00c work in Phase 5), and inventing a table here would
be schema work this phase does not own. The module exposes the same function
signatures the real adapter will, so Phase 5 replaces the body and no screen
changes.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/screens/intent-adapter.test.js`
Expected: PASS, three cases.

- [ ] **Step 5: Break it on purpose**

Change `state: 'recorded'` to `state: 'sent'`. Run the test.
Expected: FAIL on both the first and second cases. Confirm, restore, re-run.

- [ ] **Step 6: Commit**

```bash
git add src/lib/adapters tests/screens/intent-adapter.test.js
git commit -m "feat: intent adapter recording print and message intent, claiming nothing"
```

---

### Task 6: Close the foundation

- [ ] **Step 1: Run every canonical command**

```bash
npm run docker:up
npm test && npm run typecheck && npm run lint && npm run build
node scripts/ci/assert-rls-coverage.mjs
node scripts/ci/assert-screen-trace.mjs
npm run registry:validate && node scripts/ci/check-registry-drift.mjs
python3 docs/design/release-1-journey/package.py && node docs/design/release-1-journey/check-static.mjs && node docs/design/release-1-journey/check-notes.mjs
npm run test:browser
```

Record the actual counts. "All green" without numbers is not a report.

- [ ] **Step 2: Update `.agents/STATUS.md`**

State that the foundation is built and what it does not yet include. Check the
byte count against the 8,000 cap **before** committing; trim by moving content
to `ARCHIVE.md`, never by deleting.

While editing, fix the stale pointer: STATUS gives the week view as
`public/app.js:1493`, but the week branch begins at `:1496` — `:1493` is inside
the month branch. The real spec surface for the three diary screens is
`renderWeekGrid` (`:2072`), `buildWeekGridHtml` (`:2038`) and the interaction
wiring at `:1878`–`:2285`.

Add the trap that cost Task 1: `public/index.html` loads `/app.js` and never
`/dist/`, so before Task 1 the built bundle was loaded by no page at all.

- [ ] **Step 3: Open the PR and confirm CI ran**

Read the check log and confirm every step executed, including the new journey
step. A clean merge state is not a passing check.

---

### Task 7: The contract every journey plan must meet

This task produces no code. It is the gate a journey plan passes before it is
executed. Write the journey plan, check it against this list, then execute it.

A journey plan is ready when:

1. **It names its screens by `screen-index.json` id and number**, and the count
   matches the group's count exactly: book 6, intake 11, quote 7, work 15,
   setup 19, edges 24.
2. **Every screen has a file** at `src/screens/<group>/<id>.tsx` and an entry
   in `ROUTES`.
3. **Every screen names the endpoints it reads and writes.** If a screen needs
   an endpoint that does not exist, the plan says so and stops — it does not
   invent one. `assert-screen-trace.mjs` checks endpoint → screen and can never
   tell you a screen has no endpoint.
4. **Every mutation goes through `jobAction` or `apiMutate`** and carries
   `version` where the endpoint is one of the fifteen guarded actions.
5. **Every screen that can receive a 409 has a defined stale state** — what the
   user sees, and that it refetches. The server's refusal message is the copy
   to show (`server/workshop/transitions.js:57`).
6. **No screen computes a money total.** Totals come from the API. Amount
   inputs use `registry/patterns/money-input.tsx`.
7. **Each screen has a component test** that asserts what it renders and that
   its primary control calls the right client function with the right
   arguments.
8. **The group ends with one Playwright journey test** walking the group's
   happy path end to end against the real database.
9. **Every new component is either from `@/registry` or added to the registry**
   and rebuilt (`npm run registry:build`), never hand-rolled inside a screen.
10. **Any screen that touches print or messaging uses the intent adapter** and
    displays recorded intent, never claimed delivery.
11. **Every new test has a named break step** — what to change, what failure to
    expect, and a check that the edit landed.
12. **Any UI or visual design decision beyond applying existing tokens and
    registry components is flagged for Jack before it is built**, not decided
    in the plan.

Two screens carry known caveats the plans that own them must restate:

- `scan` (13, intake) — the software boundary is keystrokes; scanners are
  keyboard-wedge devices. Its done-condition is "the tag resolver works when
  given a code", not "a scanner scanned it". The physical proof belongs to
  P00b, and the atlas barcode stays a declared non-scanning specimen until a
  real printed tag is read.
- `login` / `denied` (59, 60, edges) — build on the existing team-login per
  decision B, reading identity only through `useSession()`. P08's acceptance
  criteria already fix the behaviour: a logged-out scan signs in then returns,
  and wrong-shop access fails.

---

### Task 8: Cutover — retire the workshop half of the old app

**Do not start this task until all six journey plans are executed and green.**

**Files:**
- Modify: `public/app.js` — remove the workshop diary, month view, the job
  form modal and the day-jobs modal
- Modify: `server/server.js` — close the legacy `status` translation
- Modify: `tests/` — the tests that exercise the legacy path
- Test: `tests/legacy-status-closed.test.js` (create)

**What is removed and what stays.** Decision D keeps till, inventory,
suppliers, purchase orders and storefront in the old app. Only the workshop
screens go. From `public/app.js`: the WORKSHOP section (`:1470`–`:2335`), the
month view (`:2337`–`:2455`), the workshop job form modal (`:5812`–`:6478`) and
the day-jobs modal (`:5760`). The TILL, INVENTORY, PURCHASE ORDERS, CUSTOMERS
and SHOP OFFICE sections stay.

**The hole being closed.** `PUT /api/workshop-jobs/:id` accepts an unguarded
legacy `status` (`server/server.js:2751`–`:2771`), translated by
`readLegacyStatus()` into `booking_state` / `work_state` with no version check
and no machine legality check — any of the five legacy values can be set from
any state. `POST /api/workshop-jobs` accepts it too (`:2690`–`:2694`). Three
call sites in the old app use it: `approveJob()` (`:2250`), the complete/reopen
toggle (`:6405`–`:6420`) and the job form submit (`:6439`, `:6446`, `:6448`).

- [ ] **Step 1: Confirm the three call sites are the only ones**

Run: `grep -n "status:" public/app.js | grep -i "workshop\|job"`
Expected: the three sites above and nothing else. The diary drag/move path
(`:1962`, `:2020`) sends no status. **If you find a fourth, stop and report
it** — removing a write path something still uses breaks the old app.

- [ ] **Step 2: Write the failing test**

Create `tests/legacy-status-closed.test.js`:

```js
test('PUT no longer accepts a legacy status', async () => {
  const job = await createJob();
  const res = await staffRequest(server.baseUrl, session.cookie, `/api/workshop-jobs/${job.id}`, {
    method: 'PUT',
    body: { title: 'Still editable', status: 'complete' },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /status/);
});

test('PUT still accepts the fields the old app legitimately edits', async () => {
  const job = await createJob();
  const res = await staffRequest(server.baseUrl, session.cookie, `/api/workshop-jobs/${job.id}`, {
    method: 'PUT',
    body: { title: 'Renamed' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.title, 'Renamed');
});

test('the only way to move a job is a guarded action', async () => {
  const job = await createJob();
  const res = await staffRequest(server.baseUrl, session.cookie, `/api/workshop-jobs/${job.id}/start`, {
    method: 'POST',
    body: { version: job.version },
  });
  assert.equal(res.status, 200);
  assert.notEqual(res.body.workState, job.workState);
});
```

- [ ] **Step 3: Run it to verify it fails**

Expected: FAIL on the first case — the legacy status is accepted and returns
200.

- [ ] **Step 4: Remove the old workshop screens**

Delete the four sections from `public/app.js`. Remove `workshop` from the
`TABS` table (`:294`–`:385`) and point the workshop nav entry at `/workshop`.
Leave `applyShopTheme()` (`:6899`) alone — the React app's runtime accent
variables depend on it.

- [ ] **Step 5: Close the translation**

Remove the `body.status` block from `PUT` (`:2751`–`:2771`) and from `POST`
(`:2690`–`:2694`), and reject a request that carries `status` with a 400 naming
the action endpoints. Keep `readLegacyStatus()` only if something else still
calls it — `grep -n "readLegacyStatus" server/` first, and delete it if
nothing does.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test tests/legacy-status-closed.test.js`
Expected: PASS, three cases. Then run the full suite — legacy-path tests
elsewhere will now fail, and each one must be either updated to the guarded
action or deleted with a reason stated in the commit message. **Do not delete
a failing test to make the suite green** without saying which behaviour it was
protecting and where that behaviour is now tested.

- [ ] **Step 7: Break it on purpose**

Restore the `body.status` handling in `PUT`. Run the test.
Expected: FAIL on the first case. Confirm the edit landed, remove it again,
re-run to green.

- [ ] **Step 8: Walk both apps in a browser**

Run `npm run build && npm start`. Confirm: the till, inventory, purchase
orders and customers screens still work in the old app; the workshop nav goes
to the React app; per-shop theming still applies in both. Take screenshots to
`/tmp/`, never to the repo root.

- [ ] **Step 9: Run everything and close the phase**

Run the full canonical list from Task 6, Step 1. Record actual counts. Then
update `.agents/STATUS.md` and `ARCHIVE.md`: Phase 4 built, the hole closed,
what Phase 5 inherits.

- [ ] **Step 10: Commit and open the PR**

```bash
git add public/app.js server/server.js tests
git commit -m "feat: cut the workshop over to the React app and close the legacy status hole"
```

The PR body lists: sections removed from the old app, the endpoints changed,
every test updated or deleted with its reason, and the pass counts.

---

## What this plan does not cover

- **The 82 screens themselves.** Six sibling journey plans, written to the
  Task 7 contract, each immediately before it is executed.
- **Retiring `public/app.js` entirely.** Decision D: till, inventory,
  suppliers, purchase orders and storefront stay there.
- **Real printing or real messaging.** Phase 5, gated on P00b and P00c. Task 5
  is a stub that records intent and claims nothing.
- **Lightspeed.** P07, Phase 5, gated on P00a — no account and no confirmed
  series exist.
- **WorkOS auth.** Approved and unbuilt. Decision B keeps it a provider swap.
- **The `prototype/` app and the review-pack Python scripts.** Decided 20 Sep:
  they stay out of CI.
- **Mark's screen review (#50).** Outstanding since 17 Sep, still pointed at
  the superseded 84-screen atlas. Decision B in the design accepts the rework
  risk; if he objects structurally, the affected journey plan is rewritten
  rather than this one.
- **Deposits.** The screen 04 note is blocked on Mark's Tallboys reference.
