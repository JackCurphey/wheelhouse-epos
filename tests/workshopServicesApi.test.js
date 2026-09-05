// tests/workshopServicesApi.test.js
//
// HTTP-level coverage for the /api/workshop-services routes. Follows the
// pattern in tests/static-cache.test.js: spawn the real server as a child
// process on a free port, once for the whole file, and drive it with fetch.
//
// The routes require a signed-in shop (currentSession() -> runWithShop()),
// so this file needs a real session cookie. Rather than inventing a
// test-only auth bypass, it calls the same production functions the real
// signup route calls (createShop, createSession from server/auth.js)
// directly against the DB, then sends the resulting session token as a
// cookie on every request - exactly the cookie a browser would hold after
// signing up or logging in.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { createShop, createSession, SESSION_COOKIE } from '../server/auth.js';
import { deleteTestShop } from './helpers/testShop.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let child;
let baseUrl;
let shop;
let cookie;

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${child.exitCode}`);
    }
    try {
      // /api/auth/me needs no auth to respond (401 when signed out), so it's
      // a safe readiness probe that doesn't depend on a signup/login flow.
      const res = await fetch(`${url}/api/auth/me`);
      if (res.status === 401) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not start in ${timeoutMs}ms: ${lastErr}`);
}

function authedFetch(pathname, options = {}) {
  const headers = { ...(options.headers || {}), Cookie: cookie };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${baseUrl}${pathname}`, { ...options, headers });
}

before(async () => {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
  await waitForServer(baseUrl);

  const suffix = randomUUID().slice(0, 8);
  const created = await createShop({
    shopName: `Workshop API Test ${suffix}`,
    ownerName: 'Test Owner',
    email: `workshop-api-test-${suffix}@example.com`,
    password: 'a-strong-test-password',
  });
  shop = created.shop;
  const token = await createSession(created.login.id);
  cookie = `${SESSION_COOKIE}=${token}`;
});

after(async () => {
  if (child && child.exitCode === null) child.kill('SIGTERM');
  if (shop) await deleteTestShop(shop.id);
});

test('POST /api/workshop-services creates a service and returns 201 with the camelCase body', async () => {
  const res = await authedFetch('/api/workshop-services', {
    method: 'POST',
    body: JSON.stringify({ name: 'Puncture repair', price: 12, minutes: 15 }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.name, 'Puncture repair');
  assert.equal(Number(body.price), 12);
  assert.equal(body.minutes, 15);
  assert.equal(body.active, true);
  assert.equal(typeof body.id, 'number');
});

test('GET /api/workshop-services lists a created service', async () => {
  const created = await authedFetch('/api/workshop-services', {
    method: 'POST',
    body: JSON.stringify({ name: 'Gear tune', price: 18, minutes: 20 }),
  }).then((r) => r.json());

  const res = await authedFetch('/api/workshop-services');
  assert.equal(res.status, 200);
  const rows = await res.json();
  const found = rows.find((r) => r.id === created.id);
  assert.ok(found, 'created service should appear in the list');
  assert.equal(found.name, 'Gear tune');
  assert.equal(Number(found.price), 18);
  assert.equal(found.minutes, 20);
  assert.equal(found.active, true);
});

test('PUT /api/workshop-services/:id updates name, price and minutes', async () => {
  const created = await authedFetch('/api/workshop-services', {
    method: 'POST',
    body: JSON.stringify({ name: 'Brake bleed', price: 25, minutes: 30 }),
  }).then((r) => r.json());

  const res = await authedFetch(`/api/workshop-services/${created.id}`, {
    method: 'PUT',
    body: JSON.stringify({ name: 'Full brake bleed', price: 30, minutes: 45 }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.id, created.id);
  assert.equal(body.name, 'Full brake bleed');
  assert.equal(Number(body.price), 30);
  assert.equal(body.minutes, 45);
  assert.equal(body.active, true);
});

test('DELETE /api/workshop-services/:id deactivates rather than deletes', async () => {
  const created = await authedFetch('/api/workshop-services', {
    method: 'POST',
    body: JSON.stringify({ name: 'Wheel true', price: 15, minutes: 20 }),
  }).then((r) => r.json());

  const res = await authedFetch(`/api/workshop-services/${created.id}`, { method: 'DELETE' });
  assert.equal(res.status, 200);

  // The row must still exist - deactivate, never delete - but with active
  // now false, and it must no longer be selectable for a new job line.
  const rows = await authedFetch('/api/workshop-services').then((r) => r.json());
  const found = rows.find((r) => r.id === created.id);
  assert.ok(found, 'a deactivated service must still exist, not be gone');
  assert.equal(found.active, false);

  const selectable = rows.filter((r) => r.active);
  assert.ok(!selectable.some((r) => r.id === created.id), 'a deactivated service must not be selectable');
});

test('POST /api/workshop-services rejects a missing name with 400 and a human-readable message', async () => {
  const res = await authedFetch('/api/workshop-services', {
    method: 'POST',
    body: JSON.stringify({ price: 10 }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /name/i);
});

test('POST /api/workshop-services rejects a negative price with 400 and a human-readable message', async () => {
  const res = await authedFetch('/api/workshop-services', {
    method: 'POST',
    body: JSON.stringify({ name: 'Bad price', price: -5 }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /price/i);
});

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
