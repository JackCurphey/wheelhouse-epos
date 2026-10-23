// The hosted test copy's switches (add-hosted-copy design §5 and "The commit
// it runs"; tasks 2.3–2.5): with WHEELHOUSE_HOSTED_COPY=1 connecting Shopify
// is refused and saves nothing, /healthz reports the commit it runs from
// WHEELHOUSE_COMMIT, and a pinned test clock has no effect.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { createShop, createSession, SESSION_COOKIE } from '../server/auth.js';
import { pool, runWithShop } from '../server/db.js';
import { getShopifyConnection } from '../server/shopify.js';
import { currentMoment } from '../server/clock.js';
import { startLiveServer, TEST_CLOCK_PIN } from './helpers/liveServer.js';
import { deleteTestShop } from './helpers/testShop.js';

const REFUSAL = 'This is a test copy of Wheelhouse: connecting Shopify is switched off.';
// Production needs a Shopify key before the server loads; a dummy one, never used.
const HOSTED = {
  WHEELHOUSE_HOSTED_COPY: '1',
  NODE_ENV: 'production',
  SHOPIFY_TOKEN_ENCRYPTION_KEY: 'test-only-'.padEnd(64, 'x'),
};
// A reserved domain that never resolves, so even a missing refusal can't
// reach a real store.
const CONNECT_BODY = JSON.stringify({
  shopDomain: 'hosted-copy-test.invalid',
  accessToken: 'shpat_fake',
  storefrontApiToken: 'storefront_fake',
});

let hosted;
let plain;
let shop;
let cookie;

before(async () => {
  [hosted, plain] = await Promise.all([
    startLiveServer({ env: { ...HOSTED, WHEELHOUSE_COMMIT: 'test-commit-0001' } }),
    startLiveServer({ env: { WHEELHOUSE_COMMIT: '', WHEELHOUSE_HOSTED_COPY: '', NODE_ENV: '' } }),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const created = await createShop({
    shopName: `Hosted Copy Switches ${suffix}`,
    ownerName: 'Test Owner',
    email: `hosted-copy-${suffix}@example.com`,
    password: 'a-strong-test-password',
  });
  shop = created.shop;
  cookie = `${SESSION_COOKIE}=${await createSession(created.login.id)}`;
});

after(async () => {
  await Promise.all([hosted?.stop(), plain?.stop()]);
  if (shop) await deleteTestShop(shop.id);
  await pool.end();
});

test('connecting Shopify on the hosted copy is refused and saves nothing', async () => {
  const res = await fetch(`${hosted.baseUrl}/api/shopify/connection`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: CONNECT_BODY,
  });
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: REFUSAL });
  assert.equal(await runWithShop(shop.id, () => getShopifyConnection()), null);
});

test('with the setting off, connecting Shopify is not refused', async () => {
  // An empty form stops at the usual check, before any request to a store.
  const res = await fetch(`${plain.baseUrl}/api/shopify/connection`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'shopDomain, accessToken, and storefrontApiToken are all required' });
});

test('/healthz reports the commit from WHEELHOUSE_COMMIT', async () => {
  const res = await fetch(`${hosted.baseUrl}/healthz`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok', commit: 'test-commit-0001' });
});

test('/healthz leaves out commit when WHEELHOUSE_COMMIT is unset', async () => {
  const res = await fetch(`${plain.baseUrl}/healthz`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('on the hosted copy a pinned test clock has no effect', () => {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, { WHEELHOUSE_HOSTED_COPY: '1', NODE_ENV: 'production', WHEELHOUSE_TEST_CLOCK: TEST_CLOCK_PIN });
    const startedAt = Date.now();
    const moment = currentMoment().getTime();
    assert.ok(moment >= startedAt && moment <= Date.now(), `expected the real time, got ${new Date(moment).toISOString()}`);
  } finally {
    for (const key of ['WHEELHOUSE_HOSTED_COPY', 'NODE_ENV', 'WHEELHOUSE_TEST_CLOCK']) {
      if (key in saved) process.env[key] = saved[key]; else delete process.env[key];
    }
  }
});
