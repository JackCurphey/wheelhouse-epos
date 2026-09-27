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

test('many valid requests at once are never refused', async () => {
  const results = await Promise.all(Array.from({ length: 25 }, () => snap(b1.token)));
  assert.deepEqual(results.map((r) => r.status), Array(25).fill(200));
});

test('an unknown shop with a well-formed token is refused as unrecognised', async () => {
  assert.equal((await snap(b1.token, 'no-such-shop-anywhere')).status, 401);
});

// Must run last: it deliberately blocks owner.shop.slug for this test
// process's IP for the failure window, which would otherwise poison every
// test above and below it that uses `snap()` with a good token.
test('repeated bad tokens are refused with 429, never lock out a good till, and do not block another shop', async () => {
  const bad = '1'.repeat(64);
  let last;
  for (let i = 0; i < 20; i++) last = await snap(bad);
  assert.equal(last.status, 401);
  const blocked = await snap(bad);
  assert.equal(blocked.status, 429);
  // A till presenting its good token is served even while its address and
  // shop are blocked - and serving it does not lift the block on guessers.
  assert.equal((await snap(b1.token)).status, 200);
  assert.equal((await snap(bad)).status, 429);
  const otherShop = await tillRequest(server.baseUrl, other.shop.slug, otherTill.token, '/snapshot');
  assert.equal(otherShop.status, 200);
});
