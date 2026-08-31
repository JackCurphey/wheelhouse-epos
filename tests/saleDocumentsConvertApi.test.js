// tests/saleDocumentsConvertApi.test.js
//
// HTTP-level coverage for POST /api/sale-documents/:id/convert when the
// order being converted contains a labour line. Follows the pattern in
// tests/workshopServicesApi.test.js: spawn the real server as a child
// process on a free port, authenticate with the real createShop/createSession
// from server/auth.js, and drive it with fetch.
//
// This exists because the convert route's mapping from stored
// sale_document_items rows to createSale's expected item shape drops
// line_type, service_id and minutes - a stored labour line (product_id
// NULL) then arrives at loadDocumentLine looking like an incomplete product
// line and is rejected. loadDocumentLine-level and createSale-level unit
// tests never touch that mapping, so only a real round trip through the
// convert route catches it.
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
import { pool } from '../server/db.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let child;
let baseUrl;
let shop;
let cookie;
let cashierId;

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
    shopName: `Convert API Test ${suffix}`,
    ownerName: 'Test Owner',
    email: `convert-api-test-${suffix}@example.com`,
    password: 'a-strong-test-password',
  });
  shop = created.shop;
  const token = await createSession(created.login.id);
  cookie = `${SESSION_COOKIE}=${token}`;

  // createSale (and so the convert route) refuses to proceed without a
  // resolvable cashier, so the order-conversion test needs a real one.
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    const { rows: [cashier] } = await client.query(
      `INSERT INTO employees (shop_id, name, is_cashier, active) VALUES ($1, 'Test Cashier', 1, 1) RETURNING id`,
      [shop.id]
    );
    cashierId = cashier.id;
  } finally {
    client.release();
  }
});

after(async () => {
  if (child && child.exitCode === null) child.kill('SIGTERM');
  if (shop) await deleteTestShop(shop.id);
});

// Before the fix, the convert route mapped stored sale_document_items rows
// to {productId, qty, unitPrice} only, dropping line_type/service_id/minutes.
// A stored labour line (product_id NULL) then reached loadDocumentLine
// looking like an incomplete product line and was rejected with 400 "Each
// item needs a valid productId and positive qty" - confirmed by running this
// exact test before the mapping fix landed (see task-6-report.md). It is
// left out of the suite now because a permanent test must assert the
// current, correct behaviour, not the bug - that is exactly what the test
// below does.
test('converting an order with a labour line succeeds and the resulting sale carries the labour line', async () => {
  const created = await authedFetch('/api/sale-documents', {
    method: 'POST',
    body: JSON.stringify({
      kind: 'order',
      items: [{ lineType: 'labour', name: 'Fit chain', unitPrice: 15, minutes: 20 }],
    }),
  }).then((r) => r.json());

  const res = await authedFetch(`/api/sale-documents/${created.id}/convert`, {
    method: 'POST',
    body: JSON.stringify({ cashierId, cashAmount: 15, cashTendered: 15 }),
  });
  const body = await res.json();
  assert.equal(res.status, 201, JSON.stringify(body));
  assert.ok(body.id, 'response should be the resulting sale, with its id');

  // serializeSale does not (yet) expose line_type/service_id/minutes over
  // the API - that is outside this task's scope - so the proof that the
  // labour line survived conversion intact is read straight from storage,
  // the same way the createSale-level test in saleDocuments.test.js does.
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop.id)]);
    const { rows } = await client.query('SELECT * FROM sale_items WHERE sale_id = $1', [body.id]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].line_type, 'labour');
    assert.equal(rows[0].product_id, null);
    assert.equal(rows[0].minutes, 20);
  } finally {
    client.release();
  }
});
