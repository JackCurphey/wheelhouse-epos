# WorkOS Authentication Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace this app's hand-rolled authentication with WorkOS AuthKit, add real role-based permissions, and lay the groundwork for SSO — without touching Postgres RLS, `runWithShop`, or the 98 API handlers.

**Architecture:** Every protected route funnels through one function, `currentSession()` at `server/server.js:187`, which returns `{login, shop}` and hands `shop.id` to Postgres RLS. The migration replaces what happens *inside* that function. Shops become WorkOS Organizations linked by `external_id`; `shops.id` stays ours because RLS keys off it. AuthKit sealed-session cookies replace the `sessions` table. `logins.is_owner` becomes four RBAC roles carrying ten permission slugs, enforced centrally in the dispatcher.

**Tech Stack:** Node.js ≥22.11 (`node:http`, no framework), PostgreSQL with row-level security, `pg`, `@workos-inc/node` 10.12.0, `node:test`, Docker Compose. Frontend: React 19 + Vite + shadcn (`src/staff/`).

**Spec:** [`docs/superpowers/specs/2026-08-31-workos-auth-migration-design.md`](../specs/2026-08-31-workos-auth-migration-design.md) — read it before starting. It records the decisions, the trust-boundary trade, and six open questions that must be verified rather than guessed.

---

## Global Constraints

These apply to every task below.

- **Environment is local Docker only.** No production deploy, no real users, no cutover ceremony. Target `docker compose up` against a WorkOS **staging** environment.
- **Node floor moves to `>=22.11.0`** (`@workos-inc/node` 10.12.0 requires it). Update `package.json` `engines.node`, currently `>=22.5.0`.
- **Do not modify** `server/db.js`, `runWithShop`, any RLS policy, `server/gateway.js`, `server/storefront.js`, the Shopify webhook path, or `/api/uploaded-images/`.
- **Never check role slugs. Check permissions.** `role === 'owner'` breaks on custom roles; `permissions.includes('team:manage')` does not.
- **Every WorkOS call goes through `server/workos.js`.** No file imports `@workos-inc/node` directly except that one. This is the test seam — CI cannot reach workos.com.
- **Test-first, and watch tests fail before implementing.** After writing a test, break the thing it covers, confirm it fails for the right reason, restore. A test that passes when the code is broken is not testing the code.
- **Cookie names:** staff `wos-session`, customer `wos-customer-session`.
- **Do not commit** the in-flight shadcn/Vite work in the working tree. Stage only files a task names.
- **Existing test style:** `node:test` + `node:assert/strict`, `createTestShop`/`deleteTestShop` from `tests/helpers/testShop.js`, wrap shop-scoped work in `runWithShop(shop.id, async () => {...})`, always clean up in a `finally`.
- **CI already asserts the app's Postgres role is not a superuser** (`rolsuper = 'f'`). Keep that assertion — it is load-bearing, and it caught the app silently bypassing RLS once already.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `server/workos.js` | The only module importing `@workos-inc/node`. Constructs the client, validates env vars at boot, exports the narrow surface the app uses. The test seam. |
| `server/permissions.js` | Role → permission map, permission slug constants, the `INTENTIONALLY_OPEN` route allowlist. Pure data plus one lookup function; no I/O. |
| `server/migrations/014_workos_identity.sql` | Schema change. |
| `tests/helpers/fakeWorkos.js` | In-memory fake implementing `server/workos.js`'s surface. Counts calls so tests can assert verify-once. |
| `tests/helpers/httpServer.js` | Boots the real server on an ephemeral port, returns a `request()` helper with cookie-jar support. |
| `tests/auth-http.test.js` | HTTP-level tests for `/api/auth/*` and `/callback`. |
| `tests/permissions.test.js` | Role/permission enforcement, plus the meta-test that every route declares a permission. |
| `tests/auth-boundary.test.js` | Staff/customer trust-boundary negative tests. |
| `tests/auth-session.test.js` | Session resolution, refresh, deactivation, verify-once. |
| `tests/auth-org-selection.test.js` | Sign-in for a person who works at two shops. |
| `tests/create-shop.test.js` | Shop creation provisions and rolls back a WorkOS organization. |
| `tests/migration-014.test.js` | Schema assertions for the identity migration. |
| `tests/workos-config.test.js` | Boot-time environment validation. |
| `tests/workos-webhooks.test.js` | Webhook signature verification and event handling. |
| `server/print-agents.js` | Device pairing and bearer-token authentication for the Electron print agent. |
| `tests/print-agent-auth.test.js` | Device credential tests. |
| `.env.example` | Committed, names only, no values. |

**Modified:** `server/auth.js` (gutted to WorkOS-backed lookups), `server/customer-auth.js`, `server/team.js`, `server/server.js`, `tests/helpers/testShop.js`, `tests/team.test.js`, `package.json`, `docker-compose.yml`, `README.md`, `src/staff/`.

**Deleted:** nothing outright — `server/auth.js` keeps its module identity so imports elsewhere don't churn.

---

## Phase 0 — Build the safety net first

`server/auth.js` has **zero test coverage** today, and there are no HTTP-level tests anywhere in the repo. Migrating untested code and then writing tests against the result proves only that the new code does what the new code does. Characterize the current behaviour first, watch it pass, then migrate and watch it keep passing.

---

### Task 1: HTTP test harness

**Files:**
- Create: `tests/helpers/httpServer.js`
- Test: `tests/helpers/httpServer.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `startTestServer()` → `Promise<{ request, close, port }>`, where
  `request(method, path, { body, headers, cookies })` → `Promise<{ status, headers, body, cookies }>`.
  `body` is parsed JSON when the response is JSON, otherwise a string. `cookies` is a `Map<string,string>` of cookies the response set. Redirects are **not** followed — tests assert on `302` and `Location` directly.

`server/server.js` currently calls `server.listen()` at module scope. Importing it from a test would bind port 4000 and never release it, so the harness spawns the server as a child process instead. That keeps this task from requiring a refactor of `server.js`, which Task 5 touches anyway.

- [ ] **Step 1: Write the failing test**

```js
// tests/helpers/httpServer.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './httpServer.js';

test('harness boots the app and serves an unauthenticated 401', async () => {
  const server = await startTestServer();
  try {
    const res = await server.request('GET', '/api/products');
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Not signed in');
  } finally {
    await server.close();
  }
});

test('harness captures Set-Cookie into a cookie map', async () => {
  const server = await startTestServer();
  try {
    const res = await server.request('POST', '/api/auth/login', {
      body: { email: 'nobody@example.com', password: 'wrong-password' },
    });
    assert.equal(res.status, 401);
    assert.equal(res.cookies.size, 0);
  } finally {
    await server.close();
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/helpers/httpServer.test.js`
Expected: FAIL — `Cannot find module './httpServer.js'`.

- [ ] **Step 3: Implement the harness**

```js
// tests/helpers/httpServer.js
// Boots the real server as a child process on an ephemeral port. Spawning
// rather than importing because server/server.js calls listen() at module
// scope - importing it would bind the real port and never release it.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';

async function freePort() {
  const probe = createServer();
  probe.listen(0);
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

function parseSetCookie(headers) {
  const jar = new Map();
  for (const raw of headers['set-cookie'] || []) {
    const [pair] = raw.split(';');
    const idx = pair.indexOf('=');
    jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
  return jar;
}

export async function startTestServer(env = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, ['server/server.js'], {
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Wait for the port to accept connections rather than for a log line, so
  // this doesn't break when the startup banner changes.
  const deadline = Date.now() + 15000;
  for (;;) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${child.exitCode}`);
    }
    try {
      await fetch(`http://127.0.0.1:${port}/api/auth/me`);
      break;
    } catch {
      if (Date.now() > deadline) throw new Error('server did not start in 15s');
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  async function request(method, path, { body, headers = {}, cookies } = {}) {
    const init = { method, headers: { ...headers }, redirect: 'manual' };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    if (cookies && cookies.size) {
      init.headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    const res = await fetch(`http://127.0.0.1:${port}${path}`, init);
    const raw = await res.text();
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers),
      body: isJson && raw ? JSON.parse(raw) : raw,
      cookies: parseSetCookie({ 'set-cookie': res.headers.getSetCookie() }),
    };
  }

  async function close() {
    child.kill('SIGTERM');
    await once(child, 'exit');
  }

  return { request, close, port };
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `node --test tests/helpers/httpServer.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 5: Prove the harness actually exercises the server**

Temporarily change the dispatcher's 401 message at `server/server.js:3592` from `'Not signed in'` to `'BROKEN'`. Re-run. The first test must fail on the assertion (not error out). Restore the message and confirm green again. If the test still passes with `BROKEN` in place, the harness is not hitting the real server — fix it before continuing.

- [ ] **Step 6: Commit**

```bash
git add tests/helpers/httpServer.js tests/helpers/httpServer.test.js
git commit -m "test: add HTTP-level test harness for the server"
```

---

### Task 2: Characterize current auth behaviour

**Files:**
- Create: `tests/auth-http.test.js`

**Interfaces:**
- Consumes: `startTestServer()` from Task 1, `createTestShop`/`deleteTestShop`.
- Produces: a behavioural baseline. Every test here must still pass after Task 7, with only the sign-in mechanics changed.

These tests describe what the app does **today**. They are written before any WorkOS work so that the migration has something to be measured against.

- [ ] **Step 1: Write the tests**

```js
// tests/auth-http.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startTestServer } from './helpers/httpServer.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';
import { hashPassword } from '../server/auth.js';

async function seedOwner(shopId, email) {
  const { rows: [login] } = await pool.query(
    `INSERT INTO logins (shop_id, name, email, password_hash, is_owner)
     VALUES ($1, 'Owner', $2, $3, true) RETURNING *`,
    [shopId, email, hashPassword('correct-horse-battery')]
  );
  return login;
}

test('an unauthenticated request to a protected route is rejected', async () => {
  const server = await startTestServer();
  try {
    const res = await server.request('GET', '/api/products');
    assert.equal(res.status, 401);
  } finally {
    await server.close();
  }
});

test('signing in sets an HttpOnly session cookie and admits the caller', async () => {
  const shop = await createTestShop();
  const server = await startTestServer();
  try {
    const email = `owner-${shop.id}@example.com`;
    await seedOwner(shop.id, email);

    const login = await server.request('POST', '/api/auth/login', {
      body: { email, password: 'correct-horse-battery' },
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.shopSlug, shop.slug);
    assert.ok(login.cookies.size > 0, 'expected a session cookie');

    const setCookie = login.headers['set-cookie'];
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);

    const me = await server.request('GET', '/api/auth/me', { cookies: login.cookies });
    assert.equal(me.status, 200);
    assert.equal(me.body.email, email);

    const products = await server.request('GET', '/api/products', { cookies: login.cookies });
    assert.equal(products.status, 200);
  } finally {
    await server.close();
    await deleteTestShop(shop.id);
  }
});

test('a wrong password is rejected without revealing whether the email exists', async () => {
  const shop = await createTestShop();
  const server = await startTestServer();
  try {
    const email = `owner-${shop.id}@example.com`;
    await seedOwner(shop.id, email);

    const wrongPassword = await server.request('POST', '/api/auth/login', {
      body: { email, password: 'not-the-password' },
    });
    const unknownEmail = await server.request('POST', '/api/auth/login', {
      body: { email: `nobody-${shop.id}@example.com`, password: 'not-the-password' },
    });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.deepEqual(wrongPassword.body, unknownEmail.body);
  } finally {
    await server.close();
    await deleteTestShop(shop.id);
  }
});

test('deactivating a login takes effect on the next request', async () => {
  const shop = await createTestShop();
  const server = await startTestServer();
  try {
    const email = `owner-${shop.id}@example.com`;
    const login = await seedOwner(shop.id, email);

    const signedIn = await server.request('POST', '/api/auth/login', {
      body: { email, password: 'correct-horse-battery' },
    });
    assert.equal(signedIn.status, 200);

    await pool.query('UPDATE logins SET active = false WHERE id = $1', [login.id]);

    const after = await server.request('GET', '/api/products', { cookies: signedIn.cookies });
    assert.equal(after.status, 401, 'a deactivated login must not keep working');
  } finally {
    await server.close();
    await deleteTestShop(shop.id);
  }
});

test('signing out stops the session cookie working', async () => {
  const shop = await createTestShop();
  const server = await startTestServer();
  try {
    const email = `owner-${shop.id}@example.com`;
    await seedOwner(shop.id, email);

    const signedIn = await server.request('POST', '/api/auth/login', {
      body: { email, password: 'correct-horse-battery' },
    });
    await server.request('POST', '/api/auth/logout', { cookies: signedIn.cookies });

    const after = await server.request('GET', '/api/products', { cookies: signedIn.cookies });
    assert.equal(after.status, 401);
  } finally {
    await server.close();
    await deleteTestShop(shop.id);
  }
});
```

- [ ] **Step 2: Run and confirm they pass against current code**

Run: `docker compose up -d --wait && npm run migrate && node --test tests/auth-http.test.js`
Expected: PASS, 5 tests. They describe existing behaviour, so they should be green immediately.

- [ ] **Step 3: Prove each test is real**

One at a time, break the behaviour and confirm the matching test goes red for the right reason, then restore:

| Break | Expected failure |
|---|---|
| In `server/auth.js` `verifyPassword`, `return true` unconditionally | "a wrong password is rejected…" fails |
| In `server/auth.js` `getSessionContext`, drop the `!login.active` check | "deactivating a login…" fails |
| In `server/server.js` `clearSessionCookie`, make it a no-op | "signing out…" fails |

Assert the edit actually landed each time — a no-op edit makes a test look sound while proving nothing.

- [ ] **Step 4: Commit**

```bash
git add tests/auth-http.test.js
git commit -m "test: characterize current authentication behaviour before migrating"
```

---

## Phase 1 — Introduce WorkOS behind a seam

---

### Task 3: The WorkOS client module and its fake

**Files:**
- Create: `server/workos.js`, `tests/helpers/fakeWorkos.js`
- Modify: `package.json`, `.env`, `.env.example` (create), `docker-compose.yml`
- Test: `tests/workos-config.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `getWorkos()` → the configured `WorkOS` client.
  - `assertWorkosConfig()` → throws `Error` listing every missing env var; called at boot.
  - `WORKOS_CONFIG` → frozen `{ clientId, redirectUri, cookiePassword, webhookSecret }`.
  - `setWorkosClient(client)` / `resetWorkosClient()` — test-only injection.
  - `makeFakeWorkos({ users, orgs })` from the fake, exposing `.calls` (a `Map<string, number>`) for verify-once assertions.

- [ ] **Step 1: Install the SDK and raise the Node floor**

```bash
npm install @workos-inc/node@10.12.0
npm pkg set engines.node=">=22.11.0"
```

Confirm `@workos-inc/node` is in `dependencies` (not `devDependencies`) and that `engines.node` reads `>=22.11.0`. Check `.github/workflows/test.yml:39` — it pins `node-version: '22'`, a floating major that already resolves above 22.11, so no change is needed there, but read it and confirm rather than assuming.

- [ ] **Step 2: Write the failing config test**

```js
// tests/workos-config.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { assertWorkosConfig } from '../server/workos.js';

const REQUIRED = [
  'WORKOS_API_KEY',
  'WORKOS_CLIENT_ID',
  'WORKOS_REDIRECT_URI',
  'WORKOS_COOKIE_PASSWORD',
];

test('assertWorkosConfig names every missing variable at once', () => {
  const saved = {};
  for (const key of REQUIRED) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  try {
    assert.throws(() => assertWorkosConfig(), (err) => {
      for (const key of REQUIRED) {
        assert.match(err.message, new RegExp(key), `error should name ${key}`);
      }
      return true;
    });
  } finally {
    for (const key of REQUIRED) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

test('a cookie password under 32 characters is rejected', () => {
  const saved = process.env.WORKOS_COOKIE_PASSWORD;
  process.env.WORKOS_API_KEY ||= 'sk_test_x';
  process.env.WORKOS_CLIENT_ID ||= 'client_x';
  process.env.WORKOS_REDIRECT_URI ||= 'http://localhost:4000/callback';
  process.env.WORKOS_COOKIE_PASSWORD = 'too-short';
  try {
    assert.throws(() => assertWorkosConfig(), /at least 32 characters/);
  } finally {
    process.env.WORKOS_COOKIE_PASSWORD = saved;
  }
});
```

- [ ] **Step 3: Run and watch it fail**

Run: `node --test tests/workos-config.test.js`
Expected: FAIL — `Cannot find module '../server/workos.js'`.

- [ ] **Step 4: Implement the module**

```js
// server/workos.js
// The ONLY module that imports @workos-inc/node. Everything else reaches
// WorkOS through here, which is what makes the whole auth path testable
// without network access - tests call setWorkosClient() with a fake.
//
// Config is asserted rather than defaulted. server/shopify.js takes the same
// stance for its encryption key, but only in production; here it is
// unconditional, because there is no meaningful fallback for an auth key and
// a silently half-configured auth system is worse than a refusal to boot.
import { WorkOS } from '@workos-inc/node';

const REQUIRED = [
  'WORKOS_API_KEY',
  'WORKOS_CLIENT_ID',
  'WORKOS_REDIRECT_URI',
  'WORKOS_COOKIE_PASSWORD',
];

export function assertWorkosConfig() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `WorkOS is not configured. Missing environment variable(s): ${missing.join(', ')}. ` +
        `See .env.example and docs/superpowers/specs/2026-08-31-workos-auth-migration-design.md`
    );
  }
  if (process.env.WORKOS_COOKIE_PASSWORD.length < 32) {
    throw new Error('WORKOS_COOKIE_PASSWORD must be at least 32 characters (openssl rand -base64 32)');
  }
}

export const WORKOS_CONFIG = Object.freeze({
  get clientId() { return process.env.WORKOS_CLIENT_ID; },
  get redirectUri() { return process.env.WORKOS_REDIRECT_URI; },
  get cookiePassword() { return process.env.WORKOS_COOKIE_PASSWORD; },
  get webhookSecret() { return process.env.WORKOS_WEBHOOK_SECRET; },
});

let client = null;

export function getWorkos() {
  if (!client) {
    assertWorkosConfig();
    client = new WorkOS(process.env.WORKOS_API_KEY, {
      clientId: process.env.WORKOS_CLIENT_ID,
    });
  }
  return client;
}

// Test-only. Production code must never call these.
export function setWorkosClient(fake) { client = fake; }
export function resetWorkosClient() { client = null; }
```

- [ ] **Step 5: Run and confirm the tests pass**

Run: `node --test tests/workos-config.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 6: Write the fake**

```js
// tests/helpers/fakeWorkos.js
// In-memory stand-in for the WorkOS client. Mirrors only the surface this
// app uses. Sealed "cookies" are plain JSON here - the point is to exercise
// our control flow, not WorkOS's cryptography.
//
// .calls counts method invocations so tests can assert a request verifies
// the session exactly once (see the double-verification trap in the spec).

function seal(payload) { return Buffer.from(JSON.stringify(payload)).toString('base64url'); }
function unseal(data) {
  try { return JSON.parse(Buffer.from(String(data), 'base64url').toString('utf8')); }
  catch { return null; }
}

export function makeFakeWorkos({ users = [], orgs = [] } = {}) {
  const calls = new Map();
  const bump = (name) => calls.set(name, (calls.get(name) || 0) + 1);

  const state = { users: [...users], orgs: [...orgs], memberships: [], invitations: [] };

  const userManagement = {
    getAuthorizationUrl({ redirectUri, clientId }) {
      bump('getAuthorizationUrl');
      return `https://api.workos.com/user_management/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    },

    async authenticateWithCode({ code }) {
      bump('authenticateWithCode');
      const payload = unseal(code);
      if (!payload) throw new Error('invalid code');
      const user = state.users.find((u) => u.id === payload.userId);
      if (!user) throw new Error('unknown user');
      return {
        user,
        sealedSession: seal({
          userId: user.id,
          organizationId: payload.organizationId ?? null,
          role: payload.role ?? null,
          permissions: payload.permissions ?? [],
          expiresAt: payload.expiresAt ?? Date.now() + 300_000,
        }),
      };
    },

    loadSealedSession({ sessionData }) {
      const payload = unseal(sessionData);
      return {
        async authenticate() {
          bump('authenticate');
          if (!sessionData) return { authenticated: false, reason: 'no_session_cookie_provided' };
          if (!payload) return { authenticated: false, reason: 'invalid_session_cookie' };
          if (payload.expiresAt <= Date.now()) return { authenticated: false, reason: 'invalid_jwt' };
          const user = state.users.find((u) => u.id === payload.userId);
          if (!user) return { authenticated: false, reason: 'invalid_jwt' };
          return {
            authenticated: true,
            user,
            sessionId: `session_${payload.userId}`,
            organizationId: payload.organizationId,
            role: payload.role,
            permissions: payload.permissions,
          };
        },
        async refresh() {
          bump('refresh');
          if (!payload) return { authenticated: false, reason: 'invalid_session_cookie' };
          if (payload.revoked) return { authenticated: false, reason: 'invalid_jwt' };
          const user = state.users.find((u) => u.id === payload.userId);
          if (!user) return { authenticated: false, reason: 'invalid_jwt' };
          const next = { ...payload, expiresAt: Date.now() + 300_000 };
          return {
            authenticated: true,
            sealedSession: seal(next),
            user,
            organizationId: next.organizationId,
            role: next.role,
            permissions: next.permissions,
          };
        },
        async getLogoutUrl() {
          bump('getLogoutUrl');
          return 'https://api.workos.com/user_management/sessions/logout';
        },
      };
    },

    async createOrganizationMembership({ userId, organizationId, roleSlug }) {
      bump('createOrganizationMembership');
      const membership = { id: `om_${state.memberships.length + 1}`, userId, organizationId, role: { slug: roleSlug } };
      state.memberships.push(membership);
      return membership;
    },

    async listOrganizationMemberships({ userId, organizationId }) {
      bump('listOrganizationMemberships');
      return {
        data: state.memberships.filter(
          (m) => (!userId || m.userId === userId) && (!organizationId || m.organizationId === organizationId)
        ),
      };
    },

    async updateOrganizationMembership(id, { roleSlug }) {
      bump('updateOrganizationMembership');
      const membership = state.memberships.find((m) => m.id === id);
      if (!membership) throw new Error('unknown membership');
      membership.role = { slug: roleSlug };
      return membership;
    },

    async sendInvitation({ email, organizationId, roleSlug }) {
      bump('sendInvitation');
      const invitation = { id: `invitation_${state.invitations.length + 1}`, email, organizationId, roleSlug };
      state.invitations.push(invitation);
      return invitation;
    },

    async createUser({ email, firstName, lastName, externalId }) {
      bump('createUser');
      const user = { id: `user_${state.users.length + 1}`, email, firstName, lastName, externalId };
      state.users.push(user);
      return user;
    },
  };

  const organizations = {
    async createOrganization({ name, externalId }) {
      bump('createOrganization');
      const org = { id: `org_${state.orgs.length + 1}`, name, externalId };
      state.orgs.push(org);
      return org;
    },
    async getOrganizationByExternalId(externalId) {
      bump('getOrganizationByExternalId');
      const org = state.orgs.find((o) => o.externalId === String(externalId));
      if (!org) throw new Error('organization not found');
      return org;
    },
  };

  const portal = {
    async generateLink({ organization, intent }) {
      bump('generateLink');
      return { link: `https://setup.workos.com/portal/launch?intent=${intent}&org=${organization}` };
    },
  };

  // Task 14 needs this. The real SDK verifies an HMAC; here a signature is
  // valid when it equals `sig_${secret}`, which is enough to exercise the
  // accept path and the reject path without reimplementing WorkOS's crypto.
  const webhooks = {
    constructEvent({ payload, sigHeader, secret }) {
      bump('constructEvent');
      if (sigHeader !== `sig_${secret}`) throw new Error('Signature verification failed');
      return typeof payload === 'string' ? JSON.parse(payload) : payload;
    },
  };

  return {
    userManagement,
    organizations,
    portal,
    webhooks,
    calls,
    state,
    // Helpers for tests to build inputs without knowing the sealing scheme.
    __sealFor(payload) { return seal(payload); },
    __codeFor(payload) { return seal(payload); },
    __expiredSessionFor(payload) { return seal({ ...payload, expiresAt: Date.now() - 1000 }); },
  };
}
```

- [ ] **Step 7: Add env vars**

Append to `.env` (gitignored) and create `.env.example` (committed, **names only, no values**):

```
WORKOS_API_KEY=
WORKOS_CLIENT_ID=
WORKOS_REDIRECT_URI=http://localhost:4000/callback
WORKOS_COOKIE_PASSWORD=
WORKOS_WEBHOOK_SECRET=
```

Generate a real cookie password for `.env` with `openssl rand -base64 32`. Pass all five through to the app service in `docker-compose.yml`.

`WORKOS_REDIRECT_URI` must match the Redirect URI registered in the WorkOS dashboard **exactly**, and must use the **host-visible** port from `docker-compose.yml`, not the in-container port if they differ. Confirm which by reading the `ports:` mapping.

- [ ] **Step 8: Confirm `.env` is still ignored**

Run: `git check-ignore -v .env && git status --porcelain .env`
Expected: `.env` reported as ignored, and absent from `git status`. If `.env` shows as untracked, stop and fix `.gitignore` before committing anything.

- [ ] **Step 9: Commit**

```bash
git add server/workos.js tests/helpers/fakeWorkos.js tests/workos-config.test.js .env.example package.json package-lock.json docker-compose.yml
git commit -m "feat: add WorkOS client module, test fake and configuration"
```

---

### Task 4: Schema migration

**Files:**
- Create: `server/migrations/014_workos_identity.sql`
- Modify: `tests/helpers/testShop.js`
- Test: `tests/migration-014.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `shops.workos_org_id TEXT UNIQUE`, `logins.workos_user_id TEXT`, `customer_logins.workos_user_id TEXT`. Drops `logins.password_hash`, `logins.is_owner`, the global unique index on `logins.email`, and the `sessions` / `customer_sessions` tables.

This task **breaks the build**. `server/auth.js`, `server/team.js` and `tests/team.test.js` all reference dropped columns. Tasks 5–8 repair it. Do not merge Phase 1 and Phase 2 separately to a shared branch — they land together.

- [ ] **Step 1: Write the migration**

```sql
-- server/migrations/014_workos_identity.sql
-- Moves identity to WorkOS. See
-- docs/superpowers/specs/2026-08-31-workos-auth-migration-design.md
--
-- shops.id stays the tenant key - every RLS policy reads it via
-- current_setting('app.current_shop_id'), and every business table
-- references it. WorkOS holds a pointer to us (organizations.external_id),
-- not the reverse, so losing the WorkOS org record never orphans shop data.

ALTER TABLE shops ADD COLUMN workos_org_id TEXT UNIQUE;

-- WorkOS owns the credential; logins becomes the local profile + the record
-- of which shop this person is staff at.
ALTER TABLE logins ADD COLUMN workos_user_id TEXT;
ALTER TABLE logins DROP COLUMN password_hash;

-- is_owner is superseded by the RBAC 'owner' role on the WorkOS membership.
ALTER TABLE logins DROP COLUMN is_owner;

-- Global email uniqueness was why one person could not be staff at two
-- shops. Sessions now carry org_id, so the shop is resolved from the token
-- and a person can hold one membership per shop.
ALTER TABLE logins DROP CONSTRAINT logins_email_key;
ALTER TABLE logins ADD CONSTRAINT logins_shop_user_unique UNIQUE (shop_id, workos_user_id);
CREATE INDEX idx_logins_workos_user ON logins(workos_user_id);

ALTER TABLE customer_logins ADD COLUMN workos_user_id TEXT;
ALTER TABLE customer_logins DROP COLUMN password_hash;
CREATE INDEX idx_customer_logins_workos_user ON customer_logins(workos_user_id);

-- Sealed session cookies replace server-side session rows entirely.
DROP TABLE sessions;
DROP TABLE customer_sessions;
```

`workos_user_id` is deliberately nullable: a `logins` row exists from the moment an invitation is sent and only gains its id when the person first signs in. A null means "invited, not yet active", and such a row cannot authenticate — which is correct.

- [ ] **Step 2: Write the test**

```js
// tests/migration-014.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';

async function columns(table) {
  const { rows } = await pool.query(
    'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
    [table]
  );
  return rows.map((r) => r.column_name);
}

test('logins carries workos_user_id and no longer stores credentials', async () => {
  const cols = await columns('logins');
  assert.ok(cols.includes('workos_user_id'));
  assert.ok(!cols.includes('password_hash'), 'password_hash must be gone');
  assert.ok(!cols.includes('is_owner'), 'is_owner is superseded by RBAC roles');
});

test('shops points at its WorkOS organization', async () => {
  assert.ok((await columns('shops')).includes('workos_org_id'));
});

test('session tables are gone', async () => {
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('sessions', 'customer_sessions')`
  );
  assert.deepEqual(rows, []);
});

test('one person can be staff at two different shops', async () => {
  const { rows: [a] } = await pool.query(
    "INSERT INTO shops (slug, name) VALUES ('mig14-a', 'A') RETURNING *"
  );
  const { rows: [b] } = await pool.query(
    "INSERT INTO shops (slug, name) VALUES ('mig14-b', 'B') RETURNING *"
  );
  try {
    await pool.query(
      `INSERT INTO logins (shop_id, name, email, workos_user_id)
       VALUES ($1, 'Dual', 'dual@example.com', 'user_dual'),
              ($2, 'Dual', 'dual@example.com', 'user_dual')`,
      [a.id, b.id]
    );
    const { rows } = await pool.query(
      "SELECT shop_id FROM logins WHERE workos_user_id = 'user_dual' ORDER BY shop_id"
    );
    assert.equal(rows.length, 2, 'the old global email unique constraint should be gone');
  } finally {
    await pool.query('DELETE FROM logins WHERE shop_id = ANY($1)', [[a.id, b.id]]);
    await pool.query('DELETE FROM shops WHERE id = ANY($1)', [[a.id, b.id]]);
  }
});

test('the same person cannot hold two memberships of one shop', async () => {
  const { rows: [shop] } = await pool.query(
    "INSERT INTO shops (slug, name) VALUES ('mig14-c', 'C') RETURNING *"
  );
  try {
    await pool.query(
      `INSERT INTO logins (shop_id, name, email, workos_user_id)
       VALUES ($1, 'Once', 'once@example.com', 'user_once')`,
      [shop.id]
    );
    await assert.rejects(
      pool.query(
        `INSERT INTO logins (shop_id, name, email, workos_user_id)
         VALUES ($1, 'Twice', 'once@example.com', 'user_once')`,
        [shop.id]
      ),
      /logins_shop_user_unique|duplicate key/
    );
  } finally {
    await pool.query('DELETE FROM logins WHERE shop_id = $1', [shop.id]);
    await pool.query('DELETE FROM shops WHERE id = $1', [shop.id]);
  }
});
```

- [ ] **Step 3: Run migrations and the test**

Run: `npm run migrate && node --test tests/migration-014.test.js`
Expected: PASS, 5 tests.

If `npm run migrate` reports the migration already applied, reset the dev database — `docker compose down -v && docker compose up -d --wait && npm run migrate` — rather than hand-editing the migrations table.

- [ ] **Step 4: Update the test helper**

`tests/helpers/testShop.js` deletes from `sessions` and `customer_sessions`, which no longer exist. Remove exactly those two lines (currently lines 18 and 20) and leave every other cleanup in place:

```js
    await client.query('DELETE FROM logins WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM customer_logins WHERE shop_id = $1', [shopId]);
```

- [ ] **Step 5: Confirm the helper still works**

Run: `node --test tests/helpers/testShop.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/migrations/014_workos_identity.sql tests/migration-014.test.js tests/helpers/testShop.js
git commit -m "feat: schema migration moving identity to WorkOS"
```

---

## Phase 2 — Replace the seam

---

### Task 5: WorkOS-backed session resolution

**Files:**
- Modify: `server/auth.js`, `server/server.js:187-200`
- Test: `tests/auth-session.test.js` (create)

**Interfaces:**
- Consumes: `getWorkos`, `WORKOS_CONFIG` (Task 3); `logins.workos_user_id`, `shops.workos_org_id` (Task 4).
- Produces:
  - `SESSION_COOKIE = 'wos-session'` (replaces `'wh_session'`).
  - `resolveSession(sessionCookieValue)` → `Promise<null | { login, shop, permissions, role, refreshedSessionCookie }>`.
    `refreshedSessionCookie` is a string when the session was refreshed and the caller **must** re-set the cookie, otherwise `null`.
  - Removed: `hashPassword`, `verifyPassword`, `verifyLogin`, `createSession`, `destroySession`, `getSessionContext`, `SESSION_MAX_AGE_MS`, `SESSION_MAX_AGE_SECONDS`.
  - Kept: `AuthError`, `EMAIL_RE`, `validateNewLogin`, `createShop` (reworked in Task 8).

- [ ] **Step 1: Write the failing tests**

```js
// tests/auth-session.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { setWorkosClient, resetWorkosClient } from '../server/workos.js';
import { makeFakeWorkos } from './helpers/fakeWorkos.js';
import { resolveSession } from '../server/auth.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

async function seedStaff(shop, { userId, orgId, permissions = [], role = 'owner', active = true }) {
  await pool.query('UPDATE shops SET workos_org_id = $1 WHERE id = $2', [orgId, shop.id]);
  const { rows: [login] } = await pool.query(
    `INSERT INTO logins (shop_id, name, email, workos_user_id, active)
     VALUES ($1, 'Staffer', $2, $3, $4) RETURNING *`,
    [shop.id, `staff-${shop.id}@example.com`, userId, active]
  );
  return { login, role, permissions };
}

function fakeWith(userId, orgId, permissions, role) {
  const fake = makeFakeWorkos({ users: [{ id: userId, email: 'staff@example.com' }] });
  setWorkosClient(fake);
  return {
    fake,
    cookie: fake.__sealFor({ userId, organizationId: orgId, role, permissions, expiresAt: Date.now() + 300_000 }),
    expiredCookie: fake.__expiredSessionFor({ userId, organizationId: orgId, role, permissions }),
  };
}

test('a valid session resolves to the login, shop and permissions', async () => {
  const shop = await createTestShop();
  try {
    await seedStaff(shop, { userId: 'user_1', orgId: 'org_1' });
    const { cookie } = fakeWith('user_1', 'org_1', ['team:manage'], 'owner');

    const ctx = await resolveSession(cookie);
    assert.ok(ctx);
    assert.equal(ctx.shop.id, shop.id);
    assert.equal(ctx.login.workos_user_id, 'user_1');
    assert.deepEqual(ctx.permissions, ['team:manage']);
    assert.equal(ctx.refreshedSessionCookie, null);
  } finally {
    resetWorkosClient();
    await deleteTestShop(shop.id);
  }
});

test('no cookie resolves to null', async () => {
  fakeWith('user_1', 'org_1', [], 'owner');
  try {
    assert.equal(await resolveSession(undefined), null);
    assert.equal(await resolveSession(''), null);
  } finally {
    resetWorkosClient();
  }
});

test('a token with no organization is not a staff session', async () => {
  const shop = await createTestShop();
  try {
    await seedStaff(shop, { userId: 'user_1', orgId: 'org_1' });
    const fake = makeFakeWorkos({ users: [{ id: 'user_1', email: 'c@example.com' }] });
    setWorkosClient(fake);
    // A customer: authenticated, but holds no organization membership.
    const cookie = fake.__sealFor({ userId: 'user_1', organizationId: null, role: null, permissions: [], expiresAt: Date.now() + 300_000 });

    assert.equal(await resolveSession(cookie), null);
  } finally {
    resetWorkosClient();
    await deleteTestShop(shop.id);
  }
});

test('a valid token with no logins row for that shop is rejected', async () => {
  const shop = await createTestShop();
  try {
    await pool.query('UPDATE shops SET workos_org_id = $1 WHERE id = $2', ['org_1', shop.id]);
    const { cookie } = fakeWith('user_stranger', 'org_1', [], 'owner');

    assert.equal(await resolveSession(cookie), null, 'a WorkOS user with no logins row is not staff');
  } finally {
    resetWorkosClient();
    await deleteTestShop(shop.id);
  }
});

test('a deactivated login is rejected without waiting for the token to expire', async () => {
  const shop = await createTestShop();
  try {
    await seedStaff(shop, { userId: 'user_1', orgId: 'org_1', active: false });
    const { cookie } = fakeWith('user_1', 'org_1', [], 'owner');

    assert.equal(await resolveSession(cookie), null);
  } finally {
    resetWorkosClient();
    await deleteTestShop(shop.id);
  }
});

test('an expired session is refreshed and the new cookie is handed back to the caller', async () => {
  const shop = await createTestShop();
  try {
    await seedStaff(shop, { userId: 'user_1', orgId: 'org_1' });
    const { expiredCookie } = fakeWith('user_1', 'org_1', ['till:operate'], 'cashier');

    const ctx = await resolveSession(expiredCookie);
    assert.ok(ctx, 'an expired access token should refresh, not 401');
    assert.ok(ctx.refreshedSessionCookie, 'caller must be told to re-set the cookie');
    assert.notEqual(ctx.refreshedSessionCookie, expiredCookie);
  } finally {
    resetWorkosClient();
    await deleteTestShop(shop.id);
  }
});

test('a session resolves with exactly one authenticate call', async () => {
  const shop = await createTestShop();
  try {
    await seedStaff(shop, { userId: 'user_1', orgId: 'org_1' });
    const { fake, cookie } = fakeWith('user_1', 'org_1', [], 'owner');

    await resolveSession(cookie);
    assert.equal(fake.calls.get('authenticate'), 1);
    assert.equal(fake.calls.get('refresh'), undefined);
  } finally {
    resetWorkosClient();
    await deleteTestShop(shop.id);
  }
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/auth-session.test.js`
Expected: FAIL — `resolveSession` is not exported from `server/auth.js`.

- [ ] **Step 3: Rewrite `server/auth.js`'s session half**

Replace the credential and session functions. Keep `AuthError`, `EMAIL_RE`, `validateNewLogin`, `slugify`/`uniqueSlug`, and `createShop` (Task 8 reworks the last). Delete `hashPassword`, `verifyPassword`, `verifyLogin`, `createSession`, `getSessionContext`, `destroySession`, and the `SESSION_MAX_AGE_*` constants. Add:

```js
import { getWorkos, WORKOS_CONFIG } from './workos.js';

export const SESSION_COOKIE = 'wos-session';

// Resolves a sealed session cookie to the person, their shop and their
// permissions. Replaces getSessionContext(): same job, same return shape
// plus permissions, but the credential and the session both live in WorkOS
// now rather than in our sessions table.
//
// Returns refreshedSessionCookie when the access token had expired and was
// refreshed. The caller MUST write that value back as the cookie - WorkOS
// may rotate the refresh token, so dropping it logs the user out on their
// next request.
export async function resolveSession(sessionData) {
  if (!sessionData) return null;

  const session = getWorkos().userManagement.loadSealedSession({
    sessionData,
    cookiePassword: WORKOS_CONFIG.cookiePassword,
  });

  let refreshedSessionCookie = null;
  let result = await session.authenticate();

  if (!result.authenticated) {
    // Any failure reason is treated the same. WorkOS documents only
    // 'no_session_cookie_provided'; the rest are unpublished, so switching
    // exhaustively on the value would be guessing (see the spec's open
    // questions).
    const refreshed = await session.refresh();
    if (!refreshed.authenticated) return null;
    refreshedSessionCookie = refreshed.sealedSession;
    result = refreshed;
  }

  // No organization means this is not a staff session. Customers are WorkOS
  // users with no organization membership, so this single check is what
  // keeps a portal session out of the staff API. It is load-bearing - see
  // tests/auth-boundary.test.js.
  if (!result.organizationId) return null;

  const { rows: [shop] } = await pool.query(
    'SELECT * FROM shops WHERE workos_org_id = $1',
    [result.organizationId]
  );
  if (!shop) return null;

  // Re-read on every request so deactivating someone takes effect on their
  // next click rather than at their next token refresh - preserving the
  // behaviour the sessions table used to give us.
  const { rows: [login] } = await pool.query(
    'SELECT * FROM logins WHERE workos_user_id = $1 AND shop_id = $2 AND active',
    [result.user.id, shop.id]
  );
  if (!login) return null;

  return {
    login,
    shop,
    role: result.role ?? null,
    permissions: result.permissions ?? [],
    refreshedSessionCookie,
  };
}
```

- [ ] **Step 4: Rewire `currentSession` in `server/server.js`**

Replace `currentSession` (lines 187-190) and `setSessionCookie`/`clearSessionCookie` (lines 138-148). `setSessionCookie` loses its `Max-Age` — the sealed cookie's lifetime is the session's, and pinning a 30-day age would outlive it:

```js
function setSessionCookie(req, res, sealedSession) {
  const secure = isHttpsRequest(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${sealedSession}; HttpOnly; Path=/; SameSite=Lax${secure}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

async function currentSession(req, res) {
  const { [SESSION_COOKIE]: sessionData } = parseCookies(req);
  const ctx = await resolveSession(sessionData);
  // Writing the refreshed cookie back is mandatory, not an optimisation.
  if (ctx?.refreshedSessionCookie && res) {
    setSessionCookie(req, res, ctx.refreshedSessionCookie);
  }
  return ctx;
}
```

Update the import block at `server/server.js:15-20` to pull `resolveSession` and `SESSION_COOKIE` and drop the removed names.

- [ ] **Step 5: Run and confirm**

Run: `node --test tests/auth-session.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 6: Prove the tests bite**

Delete the `if (!result.organizationId) return null;` guard. Re-run: "a token with no organization is not a staff session" must fail. Restore it. Then make `refresh()`'s return drop `refreshedSessionCookie` (set it to `null`); the refresh test must fail. Restore.

- [ ] **Step 7: Commit**

```bash
git add server/auth.js server/server.js tests/auth-session.test.js
git commit -m "feat: resolve staff sessions through WorkOS sealed sessions"
```

---

### Task 6: Pass `ctx` into handlers

**Files:**
- Modify: `server/server.js` — the `route()` helper (line 359), the dispatcher (lines 3569-3600), and the ten handlers that re-resolve the session (lines 434, 1343, 2602, 2608, 2630, 2638, 2647, 2662, 2678, 2691).
- Test: `tests/auth-session.test.js` (extend)

**Interfaces:**
- Consumes: `resolveSession` (Task 5).
- Produces: handler signature becomes `handler(req, res, params, searchParams, ctx)`. For portal routes the fifth argument stays the resolved `shop`, unchanged. No handler calls `currentSession` itself any more.

**Why this is not cosmetic.** The dispatcher resolves `ctx` at line 3591 and throws it away; ten handlers call `currentSession(req)` again. Today that is a repeat Postgres lookup nobody notices. After Task 5 it is a second sealed-cookie decrypt, a second JWT verification, and — the real problem — a possible second `.refresh()`. Two refreshes in one request can rotate the refresh token twice, so the cookie written by the first is already invalid. That surfaces as intermittent random logouts, which is a genuinely unpleasant thing to debug.

- [ ] **Step 1: Write the failing test**

Append to `tests/auth-session.test.js`:

```js
import { startTestServer } from './helpers/httpServer.js';

test('an owner-gated request verifies the session exactly once', async () => {
  // Guards against the double-verification trap: two authenticate() calls in
  // one request can mean two refreshes, the second invalidating the cookie
  // the first just wrote.
  const shop = await createTestShop();
  const server = await startTestServer({ WORKOS_FAKE: '1' });
  try {
    await seedStaff(shop, { userId: 'user_1', orgId: 'org_1' });
    const { fake, cookie } = fakeWith('user_1', 'org_1', ['team:manage'], 'owner');

    fake.calls.clear();
    await server.request('GET', '/api/team', { cookies: new Map([['wos-session', cookie]]) });

    assert.equal(fake.calls.get('authenticate'), 1, 'session must be verified once per request');
  } finally {
    resetWorkosClient();
    await server.close();
    await deleteTestShop(shop.id);
  }
});
```

This test needs the fake inside the spawned server process. Add to `server/workos.js`:

```js
// Test-only escape hatch: when WORKOS_FAKE=1 the spawned server process uses
// the in-memory fake instead of the real client, so HTTP-level tests work
// without network access. Guarded so it can never engage in a normal run.
if (process.env.WORKOS_FAKE === '1' && process.env.NODE_ENV !== 'production') {
  const { makeFakeWorkos } = await import('../tests/helpers/fakeWorkos.js');
  client = makeFakeWorkos({ users: [{ id: 'user_1', email: 'staff@example.com' }] });
}
```

If a cleaner seam is preferred, have the harness pass a module path to import instead. Either way, **the fake must never be reachable in production** — assert that in review.

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/auth-session.test.js`
Expected: FAIL — `authenticate` called twice.

- [ ] **Step 3: Thread `ctx` through the dispatcher**

In the `/api/` branch (around line 3591):

```js
      const ctx = await currentSession(req, res);
      if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });

      try {
        await runWithShop(ctx.shop.id, () => r.handler(req, res, params, url.searchParams, ctx));
      } catch (err) {
```

- [ ] **Step 4: Delete the redundant calls**

In each of the ten handlers, replace the opening pair:

```js
  const ctx = await currentSession(req);
  if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
```

with accepting `ctx` as the fifth parameter. For example at line 2602:

```js
route('GET', '/api/team', async (req, res, params, searchParams, ctx) => {
  const team = await listTeam(ctx.shop.id);
  sendJson(res, 200, team);
});
```

Leave `/api/auth/*` handlers alone — they run outside the gate and resolve their own session deliberately. Leave portal handlers alone; Task 12 covers them.

- [ ] **Step 5: Verify no stragglers**

Run: `grep -n "currentSession(req)" server/server.js`
Expected: matches only inside `/api/auth/*` handlers. Any match inside a gated handler is a bug.

- [ ] **Step 6: Run the full suite**

Run: `node --test "tests/**/*.test.js"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/server.js server/workos.js tests/auth-session.test.js
git commit -m "refactor: pass the resolved session into handlers instead of re-resolving"
```

---

### Task 7: Sign-in, callback and sign-out routes

**Files:**
- Modify: `server/server.js:389-437`
- Test: `tests/auth-http.test.js` (rewrite the sign-in mechanics from Task 2)

**Interfaces:**
- Consumes: `getWorkos`, `WORKOS_CONFIG`, `resolveSession`, `setSessionCookie`, `clearSessionCookie`.
- Produces:
  - `GET /api/auth/login` → `302` to the AuthKit authorization URL.
  - `GET /callback` → exchanges `?code=`, sets `wos-session`, `302` to `/`. On error, `302` to `/?auth_error=...` rather than a JSON body — the browser is mid-redirect and cannot render JSON.
  - `POST /api/auth/logout` → `200 { logoutUrl }`, cookie cleared. The client navigates to `logoutUrl` so the session ends at WorkOS too.
  - `GET /api/auth/me` → unchanged shape **plus** `permissions: string[]` and `role: string | null`.

`POST /api/auth/login` is deleted. AuthKit hosts the sign-in form, so the app no longer receives passwords.

- [ ] **Step 1: Update the characterization tests**

In `tests/auth-http.test.js`, replace the two tests that post credentials with:

```js
test('GET /api/auth/login redirects to AuthKit', async () => {
  const server = await startTestServer({ WORKOS_FAKE: '1' });
  try {
    const res = await server.request('GET', '/api/auth/login');
    assert.equal(res.status, 302);
    assert.match(res.headers.location, /user_management\/authorize/);
    assert.match(res.headers.location, /redirect_uri=/);
  } finally {
    await server.close();
  }
});

test('the callback exchanges the code, sets the session cookie and redirects home', async () => {
  const shop = await createTestShop();
  const server = await startTestServer({ WORKOS_FAKE: '1' });
  try {
    await pool.query('UPDATE shops SET workos_org_id = $1 WHERE id = $2', ['org_1', shop.id]);
    await pool.query(
      `INSERT INTO logins (shop_id, name, email, workos_user_id)
       VALUES ($1, 'Owner', $2, 'user_1')`,
      [shop.id, `owner-${shop.id}@example.com`]
    );

    const code = Buffer.from(JSON.stringify({
      userId: 'user_1', organizationId: 'org_1', role: 'owner',
      permissions: ['team:manage'], expiresAt: Date.now() + 300_000,
    })).toString('base64url');

    const res = await server.request('GET', `/callback?code=${code}`);
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/');
    assert.ok(res.cookies.has('wos-session'));
    assert.match(res.headers['set-cookie'], /HttpOnly/);
    assert.match(res.headers['set-cookie'], /SameSite=Lax/);

    const me = await server.request('GET', '/api/auth/me', { cookies: res.cookies });
    assert.equal(me.status, 200);
    assert.deepEqual(me.body.permissions, ['team:manage']);
  } finally {
    await server.close();
    await deleteTestShop(shop.id);
  }
});

test('the callback redirects with an error rather than rendering JSON', async () => {
  const server = await startTestServer({ WORKOS_FAKE: '1' });
  try {
    const res = await server.request('GET', '/callback?code=not-a-real-code');
    assert.equal(res.status, 302);
    assert.match(res.headers.location, /auth_error/);
  } finally {
    await server.close();
  }
});
```

Keep the "unauthenticated request is rejected", "deactivating a login takes effect", and "signing out" tests from Task 2 — adapt only how they sign in. They are the behavioural continuity check.

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/auth-http.test.js`
Expected: FAIL — `/api/auth/login` is a POST route and `/callback` does not exist.

- [ ] **Step 3: Implement the routes**

```js
route('GET', '/api/auth/login', async (req, res) => {
  const authorizationUrl = getWorkos().userManagement.getAuthorizationUrl({
    provider: 'authkit',
    redirectUri: WORKOS_CONFIG.redirectUri,
    clientId: WORKOS_CONFIG.clientId,
  });
  res.writeHead(302, { Location: authorizationUrl });
  res.end();
});

route('POST', '/api/auth/logout', async (req, res) => {
  const { [SESSION_COOKIE]: sessionData } = parseCookies(req);
  let logoutUrl = '/';
  if (sessionData) {
    try {
      const session = getWorkos().userManagement.loadSealedSession({
        sessionData,
        cookiePassword: WORKOS_CONFIG.cookiePassword,
      });
      logoutUrl = await session.getLogoutUrl();
    } catch {
      // An unreadable cookie is already effectively signed out. Clearing it
      // locally is the whole job.
    }
  }
  clearSessionCookie(res);
  sendJson(res, 200, { logoutUrl });
});

route('GET', '/api/auth/me', async (req, res) => {
  const ctx = await currentSession(req, res);
  if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });
  sendJson(res, 200, serializeSession(ctx));
});
```

`/callback` is not under `/api/`, so register it in the dispatcher before the static-file fallback, alongside the other non-`/api/` branches:

```js
  if (pathname === '/callback') {
    const code = url.searchParams.get('code');
    if (!code) {
      res.writeHead(302, { Location: '/?auth_error=missing_code' });
      return res.end();
    }
    try {
      const { sealedSession } = await getWorkos().userManagement.authenticateWithCode({
        clientId: WORKOS_CONFIG.clientId,
        code,
        session: { sealSession: true, cookiePassword: WORKOS_CONFIG.cookiePassword },
      });
      setSessionCookie(req, res, sealedSession);
      res.writeHead(302, { Location: '/' });
      return res.end();
    } catch (err) {
      // Mid-redirect: the browser expects a navigation, not a JSON error.
      console.error('WorkOS callback failed', err);
      res.writeHead(302, { Location: '/?auth_error=exchange_failed' });
      return res.end();
    }
  }
```

Update `serializeSession` (line 192) — `login.is_owner` is gone:

```js
function serializeSession({ login, shop, role, permissions }) {
  return {
    id: login.id,
    name: login.name,
    email: login.email,
    role,
    permissions,
    shopName: shop.name,
    shopSlug: shop.slug,
  };
}
```

- [ ] **Step 4: Delete the dead rate limiter**

`loginLimiter` (line 184) gated `POST /api/auth/login`, which no longer exists — AuthKit hosts and rate-limits that form. Delete `loginLimiter` and its uses. **Keep** `signupLimiter`, `portalSignupLimiter` and `portalGuestBookingLimiter`: they gate our routes, not AuthKit's.

- [ ] **Step 5: Run and confirm**

Run: `node --test tests/auth-http.test.js`
Expected: PASS.

- [ ] **Step 6: Register the redirect URI**

In the WorkOS dashboard, add `http://localhost:4000/callback` (matching `WORKOS_REDIRECT_URI`) as a Redirect URI. Then verify end to end by hand: `docker compose up -d --wait`, open `http://localhost:4000`, sign in, confirm you land back on the app signed in. A green test suite against a fake does not prove the real integration works.

- [ ] **Step 7: Commit**

```bash
git add server/server.js tests/auth-http.test.js
git commit -m "feat: sign in, callback and sign out through AuthKit"
```

---

### Task 7a: Organization selection for people at more than one shop

**Files:**
- Modify: `server/server.js` (the `/callback` branch from Task 7), `src/staff/`
- Test: `tests/auth-org-selection.test.js` (create)

**Interfaces:**
- Consumes: `getWorkos`, `WORKOS_CONFIG`.
- Produces:
  - `GET /callback` handles the organization-selection error by redirecting to `/choose-shop?pat=<pendingAuthenticationToken>`.
  - `POST /api/auth/select-organization` `{ pendingAuthenticationToken, organizationId }` → sets the session cookie, `200 { ok: true }`.
  - `POST /api/auth/switch-shop` `{ organizationId }` → re-seals the session against another organization the user belongs to.

Task 4 dropped the global unique index on `logins.email`, so one person can now
be staff at two shops. That is a deliberate bug fix (spec §4.1) — but it creates
a case the app has never had to handle: a user whose token could belong to more
than one organization. Without this task, such a user cannot sign in at all.

- [ ] **Step 1: Write the failing tests**

```js
// tests/auth-org-selection.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startTestServer } from './helpers/httpServer.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

async function seedMembership(shop, orgId, userId) {
  await pool.query('UPDATE shops SET workos_org_id = $1 WHERE id = $2', [orgId, shop.id]);
  await pool.query(
    `INSERT INTO logins (shop_id, name, email, workos_user_id)
     VALUES ($1, 'Dual Role', $2, $3)`,
    [shop.id, `dual-${shop.id}@example.com`, userId]
  );
}

test('a user in two shops is sent to choose one instead of being refused', async () => {
  const a = await createTestShop();
  const b = await createTestShop();
  const server = await startTestServer({ WORKOS_FAKE: '1', WORKOS_FAKE_MULTI_ORG: '1' });
  try {
    await seedMembership(a, 'org_a', 'user_dual');
    await seedMembership(b, 'org_b', 'user_dual');

    const code = Buffer.from(JSON.stringify({ userId: 'user_dual', multiOrg: true })).toString('base64url');
    const res = await server.request('GET', `/callback?code=${code}`);

    assert.equal(res.status, 302);
    assert.match(res.headers.location, /^\/choose-shop\?pat=/);
    assert.ok(!res.cookies.has('wos-session'), 'no session until a shop is chosen');
  } finally {
    await server.close();
    await deleteTestShop(a.id);
    await deleteTestShop(b.id);
  }
});

test('choosing a shop completes sign-in against that organization', async () => {
  const a = await createTestShop();
  const b = await createTestShop();
  const server = await startTestServer({ WORKOS_FAKE: '1', WORKOS_FAKE_MULTI_ORG: '1' });
  try {
    await seedMembership(a, 'org_a', 'user_dual');
    await seedMembership(b, 'org_b', 'user_dual');

    const chosen = await server.request('POST', '/api/auth/select-organization', {
      body: { pendingAuthenticationToken: 'pat_dual', organizationId: 'org_b' },
    });
    assert.equal(chosen.status, 200);
    assert.ok(chosen.cookies.has('wos-session'));

    const me = await server.request('GET', '/api/auth/me', { cookies: chosen.cookies });
    assert.equal(me.body.shopSlug, b.slug, 'the session must be scoped to the chosen shop');
  } finally {
    await server.close();
    await deleteTestShop(a.id);
    await deleteTestShop(b.id);
  }
});
```

- [ ] **Step 2: Extend the fake**

Add to `tests/helpers/fakeWorkos.js`'s `userManagement`, and make
`authenticateWithCode` throw a selection error when the code carries `multiOrg`:

```js
    async authenticateWithOrganizationSelection({ organizationId, pendingAuthenticationToken }) {
      bump('authenticateWithOrganizationSelection');
      const userId = pendingAuthenticationToken.replace(/^pat_/, 'user_');
      const user = state.users.find((u) => u.id === userId) || { id: userId, email: `${userId}@example.com` };
      return {
        user,
        sealedSession: seal({
          userId: user.id, organizationId, role: 'owner',
          permissions: ['team:manage'], expiresAt: Date.now() + 300_000,
        }),
      };
    },
```

In `authenticateWithCode`, before building the session:

```js
      if (payload.multiOrg) {
        const err = new Error('organization_selection_required');
        err.rawData = { pending_authentication_token: `pat_${payload.userId.replace(/^user_/, '')}` };
        err.pendingAuthenticationToken = `pat_${payload.userId.replace(/^user_/, '')}`;
        throw err;
      }
```

- [ ] **Step 3: Run and watch them fail**

Run: `node --test tests/auth-org-selection.test.js`
Expected: FAIL — `/callback` treats the selection error as a generic failure and redirects to `/?auth_error=exchange_failed`.

- [ ] **Step 4: Handle selection in `/callback`**

```js
    } catch (err) {
      // A user who belongs to more than one shop must pick one. WorkOS
      // signals this with a pending authentication token rather than a
      // session - it is a normal branch, not an error.
      const pat = err?.pendingAuthenticationToken ?? err?.rawData?.pending_authentication_token;
      if (pat) {
        res.writeHead(302, { Location: `/choose-shop?pat=${encodeURIComponent(pat)}` });
        return res.end();
      }
      console.error('WorkOS callback failed', err);
      res.writeHead(302, { Location: '/?auth_error=exchange_failed' });
      return res.end();
    }
```

**Verify the real error shape before relying on it.** The fake above models
both `err.pendingAuthenticationToken` and `err.rawData.pending_authentication_token`
because the SDK's exact error type was not verifiable during design. Trigger a
real two-organization sign-in against staging, log the caught error, and narrow
this to whichever field actually appears.

- [ ] **Step 5: Add the selection and switch routes**

```js
route('POST', '/api/auth/select-organization', async (req, res) => {
  const body = await readJsonBody(req);
  if (!body.pendingAuthenticationToken || !body.organizationId) {
    return badRequest(res, 'Choose a shop to continue');
  }
  try {
    const { sealedSession } = await getWorkos().userManagement.authenticateWithOrganizationSelection({
      clientId: WORKOS_CONFIG.clientId,
      organizationId: body.organizationId,
      pendingAuthenticationToken: body.pendingAuthenticationToken,
      session: { sealSession: true, cookiePassword: WORKOS_CONFIG.cookiePassword },
    });
    setSessionCookie(req, res, sealedSession);
    sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('Organization selection failed', err);
    sendJson(res, 401, { error: 'Could not sign you in to that shop' });
  }
});
```

`POST /api/auth/switch-shop` uses `authenticateWithRefreshToken({ clientId,
refreshToken, organizationId })` to re-scope an existing session without a full
re-authentication. The refresh token lives inside the sealed cookie, so read it
via `loadSealedSession(...).authenticate()` first.

- [ ] **Step 6: Build the chooser screen**

`/choose-shop` in `src/staff/` lists the user's organizations and posts the
chosen one. Serve it from the same SPA bundle as every other client route.

- [ ] **Step 7: Run and confirm**

Run: `node --test tests/auth-org-selection.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 8: Commit**

```bash
git add server/server.js src/staff tests/auth-org-selection.test.js tests/helpers/fakeWorkos.js
git commit -m "feat: let a person who works at two shops choose which to sign in to"
```

---

### Task 8: Shop creation provisions a WorkOS organization

**Files:**
- Modify: `server/auth.js` (`createShop`), `server/server.js:389-406`
- Test: `tests/create-shop.test.js` (create)

**Interfaces:**
- Consumes: `getWorkos`.
- Produces: `createShop({ shopName, ownerName, email, workosUserId })` → `{ shop, login, organization }`. The `password` parameter is gone.

- [ ] **Step 1: Write the failing tests**

```js
// tests/create-shop.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { setWorkosClient, resetWorkosClient } from '../server/workos.js';
import { makeFakeWorkos } from './helpers/fakeWorkos.js';
import { createShop } from '../server/auth.js';
import { deleteTestShop } from './helpers/testShop.js';

test('creating a shop creates the WorkOS organization and owner membership', async () => {
  const fake = makeFakeWorkos({ users: [{ id: 'user_owner', email: 'owner@example.com' }] });
  setWorkosClient(fake);
  let shopId;
  try {
    const { shop, login, organization } = await createShop({
      shopName: 'Spoke & Sprocket',
      ownerName: 'Ada',
      email: 'owner@example.com',
      workosUserId: 'user_owner',
    });
    shopId = shop.id;

    assert.equal(organization.externalId, String(shop.id), 'org must point back at our shop id');
    assert.equal(shop.workos_org_id, organization.id);
    assert.equal(login.workos_user_id, 'user_owner');

    const [membership] = fake.state.memberships;
    assert.equal(membership.organizationId, organization.id);
    assert.equal(membership.role.slug, 'owner');
  } finally {
    resetWorkosClient();
    if (shopId) await deleteTestShop(shopId);
  }
});

test('a failed WorkOS call leaves no half-created shop behind', async () => {
  const fake = makeFakeWorkos({ users: [{ id: 'user_owner', email: 'owner@example.com' }] });
  fake.organizations.createOrganization = async () => { throw new Error('WorkOS is down'); };
  setWorkosClient(fake);
  try {
    await assert.rejects(
      createShop({ shopName: 'Doomed Cycles', ownerName: 'Ada', email: 'owner@example.com', workosUserId: 'user_owner' }),
      /WorkOS is down/
    );
    const { rows } = await pool.query("SELECT id FROM shops WHERE name = 'Doomed Cycles'");
    assert.deepEqual(rows, [], 'a shop with no organization could never be signed into');
  } finally {
    resetWorkosClient();
  }
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/create-shop.test.js`
Expected: FAIL — `createShop` still expects a password and does not touch WorkOS.

- [ ] **Step 3: Rework `createShop`**

Keep the existing transaction and every seed insert (`customer_groups`, `workshop_settings`, `label_settings`, `shop_theme`, the mock supplier) and the `set_config('app.current_shop_id', ...)` call exactly as they are — the seeds hit RLS-protected tables and need that session variable.

Create the organization **inside** the transaction, before `COMMIT`, so a WorkOS failure rolls the shop back. Replace the password argument and the `insertLogin` hashing:

```js
export async function createShop({ shopName, ownerName, email, workosUserId }) {
  shopName = (shopName || '').trim();
  if (!shopName) throw new AuthError('Shop name is required');
  if (!workosUserId) throw new AuthError('A WorkOS user is required');
  const { name, email: cleanEmail } = await validateNewLogin({ name: ownerName, email });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const slug = await uniqueSlug(client, shopName);
    const { rows: [shop] } = await client.query(
      'INSERT INTO shops (slug, name) VALUES ($1, $2) RETURNING *',
      [slug, shopName]
    );

    // Inside the transaction on purpose: a shop with no organization can
    // never be signed into, so it must not survive a WorkOS failure.
    const workos = getWorkos();
    const organization = await workos.organizations.createOrganization({
      name: shopName,
      externalId: String(shop.id),
    });
    await workos.userManagement.createOrganizationMembership({
      userId: workosUserId,
      organizationId: organization.id,
      roleSlug: 'owner',
    });

    const { rows: [updated] } = await client.query(
      'UPDATE shops SET workos_org_id = $1 WHERE id = $2 RETURNING *',
      [organization.id, shop.id]
    );

    await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    const { rows: [login] } = await client.query(
      'INSERT INTO logins (shop_id, name, email, workos_user_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [shop.id, name, cleanEmail, workosUserId]
    );

    // ... existing seed inserts, unchanged ...

    await client.query('COMMIT');
    return { shop: updated, login, organization };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

`validateNewLogin` loses its password rule and its global-email-uniqueness query — email is no longer globally unique. Keep the name and email-format checks.

**Note the rollback is not perfect:** if `COMMIT` fails after the organization is created, the org is orphaned in WorkOS. Harmless (an org with no shop is inert and re-findable by `externalId`), but log it clearly so it is diagnosable.

- [ ] **Step 4: Update the signup route**

`POST /api/auth/signup` currently takes a password. It now needs an authenticated WorkOS user who does not yet have a shop: sign up through AuthKit first, land on `/callback` with a session but no `logins` row, and have the client post the shop name to `/api/auth/signup`. Keep the `SIGNUP_CODE` gate and `signupLimiter` — AuthKit authenticates people; deciding who may create a shop is still our policy.

```js
route('POST', '/api/auth/signup', async (req, res) => {
  if (!process.env.SIGNUP_CODE) return sendJson(res, 403, { error: 'Sign-ups are closed' });
  if (!signupLimiter.check(clientIp(req))) return sendJson(res, 429, { error: 'Too many sign-ups, try later' });

  const body = await readJsonBody(req);
  if (body.signupCode !== process.env.SIGNUP_CODE) return sendJson(res, 403, { error: 'Invalid sign-up code' });

  // The caller must already be authenticated with WorkOS but hold no shop.
  const { [SESSION_COOKIE]: sessionData } = parseCookies(req);
  if (!sessionData) return sendJson(res, 401, { error: 'Sign in first' });
  const session = getWorkos().userManagement.loadSealedSession({
    sessionData, cookiePassword: WORKOS_CONFIG.cookiePassword,
  });
  const auth = await session.authenticate();
  if (!auth.authenticated) return sendJson(res, 401, { error: 'Sign in first' });

  try {
    const created = await createShop({
      shopName: body.shopName,
      ownerName: body.ownerName || auth.user.firstName || auth.user.email,
      email: auth.user.email,
      workosUserId: auth.user.id,
    });
    sendJson(res, 201, { shopSlug: created.shop.slug });
  } catch (err) {
    if (err instanceof AuthError) return sendJson(res, 400, { error: err.message });
    throw err;
  }
});
```

The new owner's session has no `org_id` yet, so they must sign in again (or refresh with the new organization) before the app admits them. Return the slug and have the client bounce through `/api/auth/login`.

- [ ] **Step 5: Run and confirm**

Run: `node --test tests/create-shop.test.js && node --test "tests/**/*.test.js"`
Expected: PASS. `tests/team.test.js` will still fail here — Task 10 repairs it.

- [ ] **Step 6: Commit**

```bash
git add server/auth.js server/server.js tests/create-shop.test.js
git commit -m "feat: provision a WorkOS organization when a shop is created"
```

---

## Phase 3 — Roles and permissions

---

### Task 9: Permission map and central enforcement

**Files:**
- Create: `server/permissions.js`
- Modify: `server/server.js` — `route()` (line 359) and the `/api/` dispatcher branch
- Test: `tests/permissions.test.js`

**Interfaces:**
- Consumes: `ctx.permissions` (Task 5).
- Produces:
  - `PERMISSIONS` — frozen object of the ten slugs.
  - `ROLE_PERMISSIONS` — `{ owner, manager, mechanic, cashier }` → `string[]`.
  - `INTENTIONALLY_OPEN` — `Set<string>` of `"METHOD /path"` strings that deliberately need no permission.
  - `route(method, pattern, handler, permission)` — fourth argument optional.

- [ ] **Step 1: Write the permission module**

```js
// server/permissions.js
// The role/permission model. Pure data plus one lookup - no I/O, so it is
// cheap to test exhaustively.
//
// Always check permissions, never role slugs: a shop with a custom role
// breaks `role === 'owner'` but not `permissions.includes('team:manage')`.

export const PERMISSIONS = Object.freeze({
  TILL_OPERATE: 'till:operate',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_WRITE: 'inventory:write',
  WORKSHOP_READ: 'workshop:read',
  WORKSHOP_WRITE: 'workshop:write',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_WRITE: 'customers:write',
  SETTINGS_MANAGE: 'settings:manage',
  TEAM_MANAGE: 'team:manage',
  DEVICES_MANAGE: 'devices:manage',
});

const P = PERMISSIONS;

export const ROLE_PERMISSIONS = Object.freeze({
  owner: [
    P.TILL_OPERATE, P.INVENTORY_READ, P.INVENTORY_WRITE, P.WORKSHOP_READ,
    P.WORKSHOP_WRITE, P.CUSTOMERS_READ, P.CUSTOMERS_WRITE, P.SETTINGS_MANAGE,
    P.TEAM_MANAGE, P.DEVICES_MANAGE,
  ],
  manager: [
    P.TILL_OPERATE, P.INVENTORY_READ, P.INVENTORY_WRITE, P.WORKSHOP_READ,
    P.WORKSHOP_WRITE, P.CUSTOMERS_READ, P.CUSTOMERS_WRITE, P.SETTINGS_MANAGE,
    P.DEVICES_MANAGE,
  ],
  mechanic: [
    P.INVENTORY_READ, P.WORKSHOP_READ, P.WORKSHOP_WRITE,
    P.CUSTOMERS_READ, P.CUSTOMERS_WRITE,
  ],
  cashier: [
    P.TILL_OPERATE, P.INVENTORY_READ, P.WORKSHOP_READ,
    P.CUSTOMERS_READ, P.CUSTOMERS_WRITE,
  ],
});

// Routes that deliberately need no permission beyond being signed in.
// A route absent from both this set and the permission map is a bug, and
// tests/permissions.test.js fails the build for it - otherwise a new route
// added without a permission would be silently wide open.
export const INTENTIONALLY_OPEN = new Set([
  'GET /api/auth/me',
  'GET /api/dashboard',
  'GET /api/employees',
]);

export function hasPermission(ctx, permission) {
  return Array.isArray(ctx?.permissions) && ctx.permissions.includes(permission);
}
```

- [ ] **Step 2: Write the failing tests**

```js
// tests/permissions.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_PERMISSIONS, PERMISSIONS, INTENTIONALLY_OPEN } from '../server/permissions.js';
import { routes } from '../server/server.js';

test('only the owner can manage the team', () => {
  assert.ok(ROLE_PERMISSIONS.owner.includes(PERMISSIONS.TEAM_MANAGE));
  for (const role of ['manager', 'mechanic', 'cashier']) {
    assert.ok(
      !ROLE_PERMISSIONS[role].includes(PERMISSIONS.TEAM_MANAGE),
      `${role} must not manage the team`
    );
  }
});

test('a mechanic cannot operate the till and a cashier cannot edit workshop jobs', () => {
  assert.ok(!ROLE_PERMISSIONS.mechanic.includes(PERMISSIONS.TILL_OPERATE));
  assert.ok(!ROLE_PERMISSIONS.cashier.includes(PERMISSIONS.WORKSHOP_WRITE));
});

test('every role grants only slugs that exist', () => {
  const known = new Set(Object.values(PERMISSIONS));
  for (const [role, granted] of Object.entries(ROLE_PERMISSIONS)) {
    for (const slug of granted) {
      assert.ok(known.has(slug), `${role} grants unknown permission ${slug}`);
    }
  }
});

test('every staff route declares a permission or is explicitly open', () => {
  // A new route added without a permission would otherwise be silently
  // available to every role. Fail the build instead.
  const undeclared = [];
  for (const r of routes) {
    const key = `${r.method} ${r.pattern}`;
    if (r.pattern.startsWith('/api/portal/')) continue;
    if (r.pattern.startsWith('/api/auth/')) continue;
    if (r.permission) continue;
    if (INTENTIONALLY_OPEN.has(key)) continue;
    undeclared.push(key);
  }
  assert.deepEqual(
    undeclared, [],
    'these routes need a permission argument, or an entry in INTENTIONALLY_OPEN'
  );
});
```

- [ ] **Step 3: Run and watch it fail**

Run: `node --test tests/permissions.test.js`
Expected: FAIL — `routes` is not exported, and once it is, ~76 routes are listed as undeclared.

- [ ] **Step 4: Make `server/server.js` importable**

The test above imports `routes` from `server/server.js`, but that module calls
`server.listen()` at line 3646 as a side effect of being imported — Task 1
spawns a child process precisely to avoid this. Importing it from a test would
bind port 4000 and never release it.

Guard the listen call so importing the module is side-effect-free:

```js
// Only listen when run directly (`node server/server.js`). Importing this
// module - which tests do, to read the route table - must not bind a port.
if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, () => { /* existing startup log */ });
}
```

Confirm the app still starts: `npm start` must still serve on port 4000, and
`node -e "import('./server/server.js').then(() => console.log('imported clean'))"`
must print and exit rather than hang.

- [ ] **Step 5: Extend `route()` and export the table**

```js
export const routes = [];
function route(method, pattern, handler, permission = null) {
  const paramNames = [];
  // ... existing regex construction, unchanged ...
  routes.push({ method, pattern, regex, paramNames, handler, permission });
}
```

Note the added `pattern` field — the meta-test needs the human-readable pattern, not just the compiled regex.

- [ ] **Step 6: Enforce centrally**

In the `/api/` branch, immediately after the 401:

```js
      const ctx = await currentSession(req, res);
      if (!ctx) return sendJson(res, 401, { error: 'Not signed in' });

      if (r.permission && !ctx.permissions.includes(r.permission)) {
        return sendJson(res, 403, { error: 'You do not have permission to do that' });
      }
```

- [ ] **Step 7: Annotate every route**

Work through the route table adding the fourth argument, per the map in spec §6.3. For example:

```js
route('POST', '/api/sales', handler, PERMISSIONS.TILL_OPERATE);
route('GET',  '/api/products', handler, PERMISSIONS.INVENTORY_READ);
route('POST', '/api/products', handler, PERMISSIONS.INVENTORY_WRITE);
route('GET',  '/api/team', handler, PERMISSIONS.TEAM_MANAGE);
route('POST', '/api/print-agents/checkin', handler, PERMISSIONS.DEVICES_MANAGE);
```

Re-run `node --test tests/permissions.test.js` after each group; the meta-test's failure list shrinks as you go and reaches empty when you are done. That list is your worklist — you do not need to track progress separately.

- [ ] **Step 8: Confirm all four tests pass**

Run: `node --test tests/permissions.test.js`
Expected: PASS, 4 tests, with an empty undeclared list.

- [ ] **Step 9: Prove the meta-test bites**

Add `route('GET', '/api/leak-test', async (req, res) => sendJson(res, 200, {}));` with no permission. Re-run — the meta-test must name `GET /api/leak-test`. Delete the route.

- [ ] **Step 10: Commit**

```bash
git add server/permissions.js server/server.js tests/permissions.test.js
git commit -m "feat: central permission enforcement with a role/permission map"
```

---

### Task 10: Replace `is_owner` in team management

**Files:**
- Modify: `server/team.js`, `server/server.js:2600-2696`
- Test: `tests/team.test.js` (rewrite)

**Interfaces:**
- Consumes: `PERMISSIONS`, `ctx` (Tasks 6, 9).
- Produces: `createTeamMember({ shopId, name, isMechanic, isCashier, email, roleSlug, inviterUserId })` → sends a WorkOS invitation and creates the local `logins` row with a null `workos_user_id`. `attachRoles({ shopId, loginId, roleSlug })` updates the WorkOS membership.

**Preserve every cross-shop guard.** Commit `5cdd4fd` fixed a real privilege-escalation bug — any shop owner could deactivate another shop's staff by guessing an id, because `logins` has no RLS. Every `logins` query in `server/team.js` must keep its `AND shop_id = $n`. The five regression tests at `tests/team.test.js:361-475` must survive this rewrite in spirit, adapted to the new columns.

- [ ] **Step 1: Port the cross-shop regression tests first**

Before changing `server/team.js`, rewrite those five tests against the new schema (no `password_hash`, no `is_owner`, `workos_user_id` instead). Run them against the current code and watch them fail to compile, then keep them red as your target.

```js
test('an owner cannot deactivate a login belonging to another shop', async () => {
  const mine = await createTestShop();
  const theirs = await createTestShop();
  try {
    const { rows: [victim] } = await pool.query(
      `INSERT INTO logins (shop_id, name, email, workos_user_id)
       VALUES ($1, 'Victim', $2, 'user_victim') RETURNING *`,
      [theirs.id, `victim-${theirs.id}@example.com`]
    );

    await runWithShop(mine.id, async () => {
      await assert.rejects(
        deactivateLoginOnly({ shopId: mine.id, loginId: victim.id }),
        TeamError
      );
    });

    const { rows: [after] } = await pool.query('SELECT active FROM logins WHERE id = $1', [victim.id]);
    assert.equal(after.active, true, 'the other shop\'s login must be untouched');
  } finally {
    await deleteTestShop(mine.id);
    await deleteTestShop(theirs.id);
  }
});
```

Repeat the same shape for `reactivateLoginOnly`, `attachRoles`, `deactivateTeamMember` and `reactivateTeamMember` — one test each, matching the five originals.

- [ ] **Step 2: Update `server/team.js`**

- Drop `password_hash` from every insert and `is_owner` from every select and update.
- `createTeamMember` sends an invitation instead of setting a password:

```js
export async function createTeamMember({ shopId, name, isMechanic, isCashier, email, roleSlug, inviterUserId }) {
  if (!ROLE_PERMISSIONS[roleSlug]) throw new TeamError('Unknown role');
  const { rows: [shop] } = await pool.query('SELECT workos_org_id FROM shops WHERE id = $1', [shopId]);
  if (!shop?.workos_org_id) throw new TeamError('This shop has no WorkOS organization');

  await getWorkos().userManagement.sendInvitation({
    email,
    organizationId: shop.workos_org_id,
    roleSlug,
    inviterUserId,
  });

  // workos_user_id stays null until they accept and first sign in. A null
  // means "invited, not yet active" - and such a row cannot authenticate,
  // which is exactly right.
  // ... existing employee + login transaction, with password_hash removed ...
}
```

- The owner-cannot-be-deactivated rule was `is_owner`-based. Re-express it against the WorkOS membership role: refuse when the target's membership role is `owner`, fetched via `listOrganizationMemberships({ userId, organizationId })`.

- [ ] **Step 3: Update the eight team routes**

Replace each `if (!ctx.login.is_owner) return sendJson(res, 403, ...)` — the central check from Task 9 now covers them. Annotate all eight with `PERMISSIONS.TEAM_MANAGE` and delete the inline checks.

- [ ] **Step 4: Run the suite**

Run: `node --test tests/team.test.js`
Expected: PASS, including all five cross-shop tests.

- [ ] **Step 5: Prove the cross-shop guards still bite**

Remove `AND shop_id = $2` from `deactivateLoginOnly`'s query. Re-run — the matching cross-shop test must fail. Restore it. Do this for at least two of the five; if a guard can be removed with the suite staying green, that test is not testing anything.

- [ ] **Step 6: Commit**

```bash
git add server/team.js server/server.js tests/team.test.js
git commit -m "feat: replace the is_owner flag with WorkOS roles in team management"
```

---

### Task 11: Frontend permission gating

**Files:**
- Modify: `src/staff/` — the auth boot path and navigation
- Test: manual, plus whatever test setup `src/staff/` has by then

**Interfaces:**
- Consumes: `GET /api/auth/me` → `{ id, name, email, role, permissions, shopName, shopSlug }`.
- Produces: a `useAuth()` hook (or the equivalent in whatever pattern `src/staff/` has settled on) exposing `{ user, permissions, can(permission) }`.

`src/staff/` is mid-build. Read what exists before designing this — do not impose a pattern the rest of the app is not using.

- [ ] **Step 1: Read the current state**

Run: `ls -R src/staff src/lib && cat src/staff/main.tsx`
Establish how routing, data fetching and state are handled before writing anything.

- [ ] **Step 2: Replace the sign-in screen**

The old screen (`public/app.js:6807-6890`) collected email and password. It becomes a single "Sign in" button navigating to `/api/auth/login`. There is no password field — the app never sees a password again.

- [ ] **Step 3: Gate navigation on permissions**

```tsx
export function useAuth() {
  const { data } = useMe();
  return {
    user: data,
    permissions: data?.permissions ?? [],
    can: (permission: string) => (data?.permissions ?? []).includes(permission),
  };
}
```

Hide the Team section unless `can('team:manage')`, the till unless `can('till:operate')`, inventory editing unless `can('inventory:write')`, and so on per spec §6.3.

**This is cosmetic only.** Server-side enforcement (Task 9) is the load-bearing check. The client gate exists so the UI does not offer buttons that 403.

- [ ] **Step 4: Handle the 401 path**

`public/app.js:118-123` treats any 401 outside `/api/auth/*` as "session gone" and re-renders the auth screen. Preserve that behaviour, and add 403: a 403 is *not* a session problem and must not sign the user out — show "You do not have permission to do that" instead.

- [ ] **Step 5: Verify by hand**

Sign in as each of the four roles and confirm the navigation matches the §6.3 table, and that no visible control produces a 403.

- [ ] **Step 6: Commit**

```bash
git add src/staff
git commit -m "feat: gate staff UI on WorkOS permissions"
```

---

## Phase 4 — Customer portal

---

### Task 12: Portal sessions and the trust boundary

**Files:**
- Modify: `server/customer-auth.js`, `server/server.js:3039-3095`
- Test: `tests/auth-boundary.test.js` (create)

**Interfaces:**
- Consumes: `getWorkos`, `WORKOS_CONFIG`.
- Produces: `CUSTOMER_SESSION_COOKIE = 'wos-customer-session'`, `resolveCustomerSession(sessionData, shopSlug)` → `null | { customerLogin, shop, refreshedSessionCookie }`.

**Read spec §7 before starting.** This is the part of the design with the least margin. One WorkOS environment means a customer and a staff member are the same kind of object, and the separation that used to be two tables is now three predicates that must *all* hold:

1. Different cookie names — a cookie sent on the wrong path is not read.
2. Customers have **no** organization membership, so their tokens carry no `org_id`, and `resolveSession` returns null without one.
3. A `logins` row must exist for that `workos_user_id` and shop.

Any one failing open is privilege escalation across the staff/customer boundary. Write the negative tests first.

- [ ] **Step 1: Write the boundary tests before any implementation**

```js
// tests/auth-boundary.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { setWorkosClient, resetWorkosClient } from '../server/workos.js';
import { makeFakeWorkos } from './helpers/fakeWorkos.js';
import { resolveSession } from '../server/auth.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

test('a customer session is not a staff session', async () => {
  const shop = await createTestShop();
  try {
    await pool.query('UPDATE shops SET workos_org_id = $1 WHERE id = $2', ['org_1', shop.id]);
    const { rows: [customer] } = await pool.query(
      'INSERT INTO customers (shop_id, name) VALUES ($1, $2) RETURNING *',
      [shop.id, 'Casual Cyclist']
    );
    await pool.query(
      `INSERT INTO customer_logins (shop_id, customer_id, email, workos_user_id)
       VALUES ($1, $2, $3, 'user_customer')`,
      [shop.id, customer.id, `cust-${shop.id}@example.com`]
    );

    const fake = makeFakeWorkos({ users: [{ id: 'user_customer', email: 'cust@example.com' }] });
    setWorkosClient(fake);
    // A customer holds no organization membership, so no org_id.
    const customerCookie = fake.__sealFor({
      userId: 'user_customer', organizationId: null, role: null,
      permissions: [], expiresAt: Date.now() + 300_000,
    });

    assert.equal(
      await resolveSession(customerCookie), null,
      'a customer session must never resolve to a staff context'
    );
  } finally {
    resetWorkosClient();
    await deleteTestShop(shop.id);
  }
});

test('a forged org_id does not admit a customer without a logins row', async () => {
  const shop = await createTestShop();
  try {
    await pool.query('UPDATE shops SET workos_org_id = $1 WHERE id = $2', ['org_1', shop.id]);
    const { rows: [customer] } = await pool.query(
      'INSERT INTO customers (shop_id, name) VALUES ($1, $2) RETURNING *',
      [shop.id, 'Casual Cyclist']
    );
    await pool.query(
      `INSERT INTO customer_logins (shop_id, customer_id, email, workos_user_id)
       VALUES ($1, $2, $3, 'user_customer')`,
      [shop.id, customer.id, `cust-${shop.id}@example.com`]
    );

    const fake = makeFakeWorkos({ users: [{ id: 'user_customer', email: 'cust@example.com' }] });
    setWorkosClient(fake);
    const escalated = fake.__sealFor({
      userId: 'user_customer', organizationId: 'org_1', role: 'owner',
      permissions: ['team:manage'], expiresAt: Date.now() + 300_000,
    });

    assert.equal(
      await resolveSession(escalated), null,
      'the logins-row check is the last line of defence and must hold'
    );
  } finally {
    resetWorkosClient();
    await deleteTestShop(shop.id);
  }
});

test('a staff session presented to the portal does not resolve to a customer', async () => {
  const shop = await createTestShop();
  try {
    await pool.query('UPDATE shops SET workos_org_id = $1 WHERE id = $2', ['org_1', shop.id]);
    await pool.query(
      `INSERT INTO logins (shop_id, name, email, workos_user_id)
       VALUES ($1, 'Staffer', $2, 'user_staff')`,
      [shop.id, `staff-${shop.id}@example.com`]
    );

    const fake = makeFakeWorkos({ users: [{ id: 'user_staff', email: 'staff@example.com' }] });
    setWorkosClient(fake);
    const staffCookie = fake.__sealFor({
      userId: 'user_staff', organizationId: 'org_1', role: 'owner',
      permissions: ['team:manage'], expiresAt: Date.now() + 300_000,
    });

    const { resolveCustomerSession } = await import('../server/customer-auth.js');
    assert.equal(await resolveCustomerSession(staffCookie, shop.slug), null);
  } finally {
    resetWorkosClient();
    await deleteTestShop(shop.id);
  }
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/auth-boundary.test.js`
Expected: the first two may already pass from Task 5's guards — that is fine and worth confirming explicitly. The third fails: `resolveCustomerSession` does not exist.

- [ ] **Step 3: Implement `resolveCustomerSession`**

Mirror `resolveSession`, inverted: require **no** `organizationId`, and look up `customer_logins` scoped by the shop resolved from `shopSlug`.

```js
export async function resolveCustomerSession(sessionData, shopSlug) {
  if (!sessionData) return null;
  const session = getWorkos().userManagement.loadSealedSession({
    sessionData, cookiePassword: WORKOS_CONFIG.cookiePassword,
  });

  let refreshedSessionCookie = null;
  let result = await session.authenticate();
  if (!result.authenticated) {
    const refreshed = await session.refresh();
    if (!refreshed.authenticated) return null;
    refreshedSessionCookie = refreshed.sealedSession;
    result = refreshed;
  }

  // Inverted from the staff check: an organization membership means this is
  // a staff session, which must not be honoured as a customer.
  if (result.organizationId) return null;

  const { rows: [shop] } = await pool.query('SELECT * FROM shops WHERE slug = $1', [shopSlug]);
  if (!shop) return null;

  const { rows: [customerLogin] } = await pool.query(
    'SELECT * FROM customer_logins WHERE workos_user_id = $1 AND shop_id = $2 AND active',
    [result.user.id, shop.id]
  );
  if (!customerLogin) return null;

  return { customerLogin, shop, refreshedSessionCookie };
}
```

Delete `signupCustomer`'s and `verifyCustomerLogin`'s password handling and the `hashPassword`/`verifyPassword` import from `server/auth.js` (both are gone).

- [ ] **Step 4: Leave guest bookings alone**

`resolveGuestCustomer` (`server/customer-auth.js:87-100`) takes a name and phone, never touches auth, and must stay exactly as it is. Confirm `tests/customer-auth-guest.test.js` still passes untouched.

- [ ] **Step 5: Run the boundary and guest tests**

Run: `node --test tests/auth-boundary.test.js tests/customer-auth-guest.test.js`
Expected: PASS.

- [ ] **Step 6: Prove all three predicates are load-bearing**

One at a time, remove each guard and confirm the matching test fails:

| Remove | Test that must fail |
|---|---|
| `if (!result.organizationId) return null` in `resolveSession` | "a customer session is not a staff session" |
| the `logins` lookup's `AND shop_id = $2` | "a forged org_id does not admit a customer" |
| `if (result.organizationId) return null` in `resolveCustomerSession` | "a staff session presented to the portal…" |

If any guard can be removed with the suite green, that test is not protecting the boundary. Fix the test, not the assertion.

- [ ] **Step 7: Commit**

```bash
git add server/customer-auth.js server/server.js tests/auth-boundary.test.js
git commit -m "feat: move customer portal sessions to WorkOS and test the staff boundary"
```

---

## Phase 5 — Peripherals and finishing

---

### Task 13: Print agent device credentials

**Files:**
- Create: `server/migrations/015_print_agent_devices.sql`
- Modify: `server/server.js:2915-2990`, `print-agent/main.js`
- Test: `tests/print-agent-auth.test.js` (create)

**Interfaces:**
- Produces: `print_agent_devices(id, shop_id, device_id, device_name, token_hash, created_at, last_seen_at)` — shop-scoped, RLS-protected, token hashed at rest. `POST /api/print-agents/pair` issues a token once; the agent presents it as `Authorization: Bearer <token>`.

**This is a prerequisite for the cutover, not an optional extra.** `print-agent/main.js:29,54-80` signs in with staff credentials and stores a raw `wh_session` cookie on disk. The moment `wh_session` stops existing the print agent stops working. A human's session is the wrong credential for a headless device anyway — it expires, and refreshing it non-interactively from Electron is awkward.

Design the pairing flow before implementing: an owner generates a pairing code in the app, the agent exchanges it once for a device token, and the token is shown to the user exactly once. Follow the `server/shopify.js` encryption pattern for storage.

- [ ] **Step 1: Write the migration**

```sql
-- server/migrations/015_print_agent_devices.sql
-- A print agent is a device, not a person. Giving it a user's session was
-- always a workaround; this gives it its own credential with its own
-- lifecycle, so revoking a device does not mean disabling a human.
CREATE TABLE print_agent_devices (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  UNIQUE (shop_id, device_id)
);
CREATE INDEX idx_print_agent_devices_shop ON print_agent_devices(shop_id);
ALTER TABLE print_agent_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_agent_devices FORCE ROW LEVEL SECURITY;
CREATE POLICY print_agent_devices_shop_isolation ON print_agent_devices
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
```

- [ ] **Step 2: Write the tests**

```js
// tests/print-agent-auth.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { createHash } from 'node:crypto';
import { pool, runWithShop } from '../server/db.js';
import { pairDevice, authenticateDevice, revokeDevice } from '../server/print-agents.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

test('pairing returns a token that is not stored in the clear', async () => {
  const shop = await createTestShop();
  try {
    await runWithShop(shop.id, async () => {
      const { token, device } = await pairDevice({ shopId: shop.id, deviceId: 'till-1', deviceName: 'Front Till' });
      assert.ok(token.length >= 32);

      const { rows: [stored] } = await pool.query(
        'SELECT token_hash FROM print_agent_devices WHERE id = $1', [device.id]
      );
      assert.notEqual(stored.token_hash, token, 'the raw token must never be stored');
      assert.equal(stored.token_hash, createHash('sha256').update(token).digest('hex'));
    });
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a paired token authenticates and resolves to its own shop', async () => {
  const shop = await createTestShop();
  try {
    const token = await runWithShop(shop.id, async () => {
      const { token } = await pairDevice({ shopId: shop.id, deviceId: 'till-1', deviceName: 'Front Till' });
      return token;
    });
    const device = await authenticateDevice(token);
    assert.ok(device);
    assert.equal(device.shop_id, shop.id);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('one shop\'s device token is useless against another shop', async () => {
  const mine = await createTestShop();
  const theirs = await createTestShop();
  try {
    const token = await runWithShop(theirs.id, async () => {
      const { token } = await pairDevice({ shopId: theirs.id, deviceId: 'till-1', deviceName: 'Theirs' });
      return token;
    });
    const device = await authenticateDevice(token);
    assert.notEqual(device.shop_id, mine.id, 'a device must only ever resolve to the shop that paired it');
  } finally {
    await deleteTestShop(mine.id);
    await deleteTestShop(theirs.id);
  }
});

test('a revoked device is refused', async () => {
  const shop = await createTestShop();
  try {
    const token = await runWithShop(shop.id, async () => {
      const { token, device } = await pairDevice({ shopId: shop.id, deviceId: 'till-1', deviceName: 'Front Till' });
      await revokeDevice({ shopId: shop.id, deviceId: device.device_id });
      return token;
    });
    assert.equal(await authenticateDevice(token), null);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('an unknown or absent token authenticates nobody', async () => {
  assert.equal(await authenticateDevice('not-a-real-token'), null);
  assert.equal(await authenticateDevice(undefined), null);
});
```

- [ ] **Step 3: Run and watch them fail**

Run: `node --test tests/print-agent-auth.test.js`
Expected: FAIL — `server/print-agents.js` does not exist.

- [ ] **Step 3a: Implement**

Create `server/print-agents.js` exporting `pairDevice({ shopId, deviceId, deviceName })` → `{ token, device }`, `authenticateDevice(token)` → `device | null`, and `revokeDevice({ shopId, deviceId })`. Generate the token with `randomBytes(32).toString('hex')`, store only `createHash('sha256')` of it, and return the raw value exactly once.

`authenticateDevice` runs **before** any shop context exists — it is what resolves the shop — so like `resolveSession` it queries with the bare `pool` rather than inside `runWithShop`. Scope every lookup by `token_hash`, never by `device_id` alone.

Wire the bearer check into the dispatcher ahead of the `currentSession` gate for `/api/print-agents/*`, in the same spirit as the Shopify webhook branch, then `runWithShop(device.shop_id, ...)`.

Add `DELETE FROM print_agent_devices WHERE shop_id = $1` to `tests/helpers/testShop.js`.

- [ ] **Step 4: Update the Electron agent**

Replace the `session.json` cookie with the device token. Never log it.

- [ ] **Step 5: Commit**

```bash
git add server/migrations/015_print_agent_devices.sql server/server.js print-agent/main.js tests/print-agent-auth.test.js tests/helpers/testShop.js
git commit -m "feat: give print agents their own device credentials"
```

---

### Task 14: WorkOS webhooks

**Files:**
- Modify: `server/server.js` (add `POST /webhooks/workos`)
- Test: `tests/workos-webhooks.test.js` (create)

**Interfaces:**
- Consumes: `getWorkos().webhooks.constructEvent({ payload, sigHeader, secret })`, `WORKOS_CONFIG.webhookSecret`.
- Produces: handling for `user.created`, `user.updated`, `user.deleted`, `organization_membership.created`, `organization_membership.updated`, `organization_membership.deleted`.

`logins.email` and `logins.name` are denormalised copies and drift when someone changes their details in AuthKit.

- [ ] **Step 1: Write the tests**

```js
// tests/workos-webhooks.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startTestServer } from './helpers/httpServer.js';
import { createTestShop, deleteTestShop } from './helpers/testShop.js';

const SECRET = 'test-webhook-secret';

async function seedLogin(shop, userId, email) {
  await pool.query('UPDATE shops SET workos_org_id = $1 WHERE id = $2', ['org_1', shop.id]);
  const { rows: [login] } = await pool.query(
    `INSERT INTO logins (shop_id, name, email, workos_user_id)
     VALUES ($1, 'Staffer', $2, $3) RETURNING *`,
    [shop.id, email, userId]
  );
  return login;
}

function post(server, event, { signed = true } = {}) {
  return server.request('POST', '/webhooks/workos', {
    body: event,
    headers: { 'workos-signature': signed ? `sig_${SECRET}` : 'sig_wrong' },
  });
}

test('user.updated refreshes the denormalised email', async () => {
  const shop = await createTestShop();
  const server = await startTestServer({ WORKOS_FAKE: '1', WORKOS_WEBHOOK_SECRET: SECRET });
  try {
    const login = await seedLogin(shop, 'user_1', `old-${shop.id}@example.com`);

    const res = await post(server, {
      event: 'user.updated',
      data: { id: 'user_1', email: `new-${shop.id}@example.com`, first_name: 'Renamed' },
    });
    assert.equal(res.status, 200);

    const { rows: [after] } = await pool.query('SELECT email FROM logins WHERE id = $1', [login.id]);
    assert.equal(after.email, `new-${shop.id}@example.com`);
  } finally {
    await server.close();
    await deleteTestShop(shop.id);
  }
});

test('an invalid signature is rejected and changes nothing', async () => {
  const shop = await createTestShop();
  const server = await startTestServer({ WORKOS_FAKE: '1', WORKOS_WEBHOOK_SECRET: SECRET });
  try {
    const login = await seedLogin(shop, 'user_1', `keep-${shop.id}@example.com`);

    const res = await post(server, {
      event: 'user.updated',
      data: { id: 'user_1', email: 'attacker@example.com' },
    }, { signed: false });
    assert.equal(res.status, 401);

    const { rows: [after] } = await pool.query('SELECT email FROM logins WHERE id = $1', [login.id]);
    assert.equal(after.email, `keep-${shop.id}@example.com`, 'an unverified payload must not be applied');
  } finally {
    await server.close();
    await deleteTestShop(shop.id);
  }
});

test('organization_membership.deleted deactivates that shop login only', async () => {
  const shop = await createTestShop();
  const other = await createTestShop();
  const server = await startTestServer({ WORKOS_FAKE: '1', WORKOS_WEBHOOK_SECRET: SECRET });
  try {
    const login = await seedLogin(shop, 'user_1', `a-${shop.id}@example.com`);
    await pool.query('UPDATE shops SET workos_org_id = $1 WHERE id = $2', ['org_2', other.id]);
    const { rows: [elsewhere] } = await pool.query(
      `INSERT INTO logins (shop_id, name, email, workos_user_id)
       VALUES ($1, 'Same Person', $2, 'user_1') RETURNING *`,
      [other.id, `b-${other.id}@example.com`]
    );

    const res = await post(server, {
      event: 'organization_membership.deleted',
      data: { user_id: 'user_1', organization_id: 'org_1' },
    });
    assert.equal(res.status, 200);

    const { rows: [gone] } = await pool.query('SELECT active FROM logins WHERE id = $1', [login.id]);
    const { rows: [kept] } = await pool.query('SELECT active FROM logins WHERE id = $1', [elsewhere.id]);
    assert.equal(gone.active, false);
    assert.equal(kept.active, true, 'losing one shop must not remove them from another');
  } finally {
    await server.close();
    await deleteTestShop(shop.id);
    await deleteTestShop(other.id);
  }
});

test('an unrecognised event type is acknowledged rather than retried forever', async () => {
  const server = await startTestServer({ WORKOS_FAKE: '1', WORKOS_WEBHOOK_SECRET: SECRET });
  try {
    const res = await post(server, { event: 'something.we.do.not.handle', data: {} });
    assert.equal(res.status, 200);
  } finally {
    await server.close();
  }
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/workos-webhooks.test.js`
Expected: FAIL — `/webhooks/workos` returns 404.

- [ ] **Step 3: Implement the handler**

Register the branch alongside the Shopify webhook branch, before the `/api/`
gate. Signature verification needs the **raw** body — `server/server.js` already
accumulates raw Buffers for Shopify, so reuse that path rather than adding a
second one.

```js
  if (pathname === '/webhooks/workos' && req.method === 'POST') {
    const rawBody = await readRawBody(req);
    let event;
    try {
      event = getWorkos().webhooks.constructEvent({
        payload: rawBody.toString('utf8'),
        sigHeader: req.headers['workos-signature'],
        secret: WORKOS_CONFIG.webhookSecret,
      });
    } catch {
      return sendJson(res, 401, { error: 'Invalid signature' });
    }

    try {
      switch (event.event) {
        case 'user.updated':
          await pool.query(
            'UPDATE logins SET email = $1, updated_at = now() WHERE workos_user_id = $2',
            [event.data.email, event.data.id]
          );
          break;
        case 'user.deleted':
          await pool.query(
            'UPDATE logins SET active = false WHERE workos_user_id = $1',
            [event.data.id]
          );
          break;
        case 'organization_membership.deleted':
          await pool.query(
            `UPDATE logins SET active = false
              WHERE workos_user_id = $1
                AND shop_id = (SELECT id FROM shops WHERE workos_org_id = $2)`,
            [event.data.user_id, event.data.organization_id]
          );
          break;
        default:
          // Acknowledged deliberately. WorkOS retries any non-2xx, and
          // retrying an event we will never handle is just noise.
          break;
      }
      sendJson(res, 200, { ok: true });
    } catch (err) {
      console.error('WorkOS webhook processing failed', err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }
```

`user.created` and `organization_membership.created` need no handling yet: a
`logins` row already exists from the invitation, and its `workos_user_id` is
filled in at first sign-in. Add them here if that changes.

- [ ] **Step 4: Confirm and prove the signature check bites**

Run: `node --test tests/workos-webhooks.test.js`
Expected: PASS, 4 tests.

Then make `constructEvent`'s failure path fall through to processing instead of
returning 401. The invalid-signature test must fail. Restore it — an unverified
webhook body is attacker-controlled input.

- [ ] **Step 5: Note the local-development limitation**

Webhook delivery to `localhost` needs a tunnel. The tests exercise the handler directly with a signed body, so CI needs no tunnel. Document in the README that verifying real delivery requires exposing the port.

- [ ] **Step 6: Commit**

```bash
git add server/server.js tests/workos-webhooks.test.js
git commit -m "feat: sync user and membership changes from WorkOS webhooks"
```

---

### Task 15: SSO self-service via the Admin Portal

**Files:**
- Modify: `server/server.js`, `src/staff/`
- Test: `tests/admin-portal.test.js` (create)

**Interfaces:**
- Produces: `GET /api/sso/portal-link` → `{ link }`, gated on `PERMISSIONS.TEAM_MANAGE`.

- [ ] **Step 1: Verify the intent values first**

Fetch `https://workos.com/docs/reference/admin-portal` and confirm the valid `intent` values and the full `generateLink` parameter list. Spec open question 4 records these as reported-but-unverified (`sso`, `dsync`, `audit_logs`, `log_streams`, `certificate_renewal`, `domain_verification`). **Do not code against the unverified list** — confirm it, then use it.

- [ ] **Step 2: Write the test**

Assert the route returns a link for the caller's own organization, 403s without `team:manage`, and — importantly — that the `organization` passed to `generateLink` is the **caller's** org, never one from the request body. Use `fake.state` to check.

- [ ] **Step 3: Implement**

```js
route('GET', '/api/sso/portal-link', async (req, res, params, searchParams, ctx) => {
  if (!ctx.shop.workos_org_id) return sendJson(res, 400, { error: 'This shop has no WorkOS organization' });
  const { link } = await getWorkos().portal.generateLink({
    organization: ctx.shop.workos_org_id,   // from the session, never the request
    intent: 'sso',
  });
  sendJson(res, 200, { link });
}, PERMISSIONS.TEAM_MANAGE);
```

- [ ] **Step 4: Document the IdP role-mapping caveat**

Add a note to the Team UI, for SSO-backed shops: IdP role assignment **always overrides** roles set by API or Dashboard, and silently reverts them at the user's next login. The UI must not present role editing as authoritative for those shops. IdP mapping also only works with environment-level roles — a second reason not to create org-level roles.

- [ ] **Step 5: Commit**

```bash
git add server/server.js src/staff tests/admin-portal.test.js
git commit -m "feat: let shop owners configure SSO through the WorkOS Admin Portal"
```

---

### Task 16: Documentation and cleanup

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-08-31-workos-auth-migration-design.md`

- [ ] **Step 1: Fix the stale README claims**

- "no internet connection or npm install required" (line ~5) is now false in both halves. Rewrite.
- The "Data lives only on this computer … `data/accounts.db`" bullet (lines 132-134) refers to a SQLite file that stopped existing when auth moved to Postgres. Delete it.
- The "No per-employee permissions yet" gap (lines ~118-136) is now closed. Replace with the §6.3 role table.
- Document the five `WORKOS_*` variables alongside the existing `SHOPIFY_TOKEN_ENCRYPTION_KEY` section, which is a good model to follow.

- [ ] **Step 2: Close the spec's open questions**

Six questions in spec §14 were unanswerable from published docs. Record the values found during implementation — access token lifetime, inactivity timeout, `.authenticate()` reasons observed, confirmed portal intents, roles API endpoints — so the next person does not repeat the research.

- [ ] **Step 3: Run everything**

```bash
docker compose down -v && docker compose up -d --wait
npm run migrate
node --test "tests/**/*.test.js"
```

Expected: all green. Paste the actual output into the pull request — a claim that tests pass is not evidence that they do.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-08-31-workos-auth-migration-design.md
git commit -m "docs: update README and close the spec's open questions"
```

---

## Deferred

Not in this plan. Each is additive; none is blocked by it.

- **MFA** — AuthKit supports it; enable in the dashboard.
- **Audit Logs** — there is still no login audit trail after this work.
- **Directory Sync (SCIM)** — preferred over SSO-only group mapping when a shop is large enough to want it, because roles propagate in real time rather than at next login.
- **Fine-grained authorization (FGA)** — the §6 model is shop-wide and coarse.
- **PIN / fast user switching on a shared till** — absent today, unchanged by this work.
- **Production cutover** — spec §12. Password import is viable: Node's `scryptSync` defaults (N=16384, r=8, p=1, 64-byte key) match WorkOS's documented scrypt PHC example exactly, so hashes convert by re-encoding hex as base64. Verify with one real import before trusting it.

---

## Pre-existing issues, not addressed here

Found while mapping the auth system (spec §15). Not caused by this work and deliberately out of scope — raise them separately.

- **The storefront owner-preview feature does not work.** `server/storefront.js:85` takes a third `sessionShopId` argument; the only production caller, `server/server.js:3441`, passes two. So `sessionShopId` is always `undefined` and the check can never pass. Only the tests pass the third argument, so the suite is green while the shipped behaviour from commits `8ee6553` and `9f88409` is broken.
- **No CSRF protection** beyond `SameSite=Lax`. AuthKit does not change this.
- **`attachRoles` and `deactivateTeamMember` update `employees` filtered on `id` alone**, without `shop_id` — safe only because `employees` is RLS-protected and those run inside `runWithShop`, unlike `logins`, which is not. That asymmetry is what caused `5cdd4fd`, and it is still there.
