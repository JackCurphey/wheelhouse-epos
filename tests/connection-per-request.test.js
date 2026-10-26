// A request holds one pooled connection for its shop (runWithShop) and must
// never need a second one while it does. The Owner-only check asked "who is
// signed in?" again from inside that scope, which took a second connection
// from the same pool of 10: about ten such requests at once each held one,
// all waited for another, and after the 5-second connection wait they all
// failed (openspec/changes/server-connection-per-request).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

// More than the pool's 10 connections, so the old double checkout cannot
// all fit.
const AT_ONCE = 12;
// Under the pool's 5-second connection wait: a stall shows as a failure here
// rather than as a slow pass.
const QUICKLY_MS = 4000;

let server;
let northStreet;
let riverside;
let jo;
before(async () => {
  server = await startLiveServer();
  northStreet = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  riverside = await staffSignup(server.baseUrl, { shopName: 'Riverside Bikes' });
  const made = await staffRequest(server.baseUrl, northStreet.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  // Make each shop's label settings row once, so the burst below only updates.
  for (const owner of [northStreet, riverside]) {
    const got = await staffRequest(server.baseUrl, owner.cookie, '/api/label-settings');
    assert.equal(got.status, 200, JSON.stringify(got.body));
  }
  // Open all 10 of the server's pooled connections first, as a shop that has
  // been running for a while would have. With a cold pool, opening each new
  // connection is slow enough to spread a burst out and hide the stall.
  const warm = await Promise.all(Array.from({ length: AT_ONCE }, () => staffRequest(server.baseUrl, northStreet.cookie, '/api/label-settings')));
  assert.deepEqual(warm.map((a) => a.status), Array(AT_ONCE).fill(200));
});
after(async () => {
  if (northStreet) await deleteTestShop(northStreet.shop.id);
  if (riverside) await deleteTestShop(riverside.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const save = (who, widthMm) =>
  staffRequest(server.baseUrl, who.cookie, '/api/label-settings', { method: 'PUT', body: { widthMm, heightMm: 30 } });

test(`${AT_ONCE} Owner-only requests at once all answer quickly`, async () => {
  const started = Date.now();
  const answers = await Promise.all(Array.from({ length: AT_ONCE }, () => save(northStreet, 50)));
  const took = Date.now() - started;
  assert.deepEqual(answers.map((a) => a.status), Array(AT_ONCE).fill(200), JSON.stringify(answers.map((a) => a.body)));
  assert.ok(took < QUICKLY_MS, `took ${took}ms`);
});

test('two shops at once: each owner changes only their own shop, and a staff member is still refused', async () => {
  const burst = [];
  for (let i = 0; i < AT_ONCE / 2; i++) {
    burst.push(save(northStreet, 60), save(riverside, 70));
  }
  burst.push(save(jo, 99));
  const answers = await Promise.all(burst);
  const joAnswer = answers.pop();
  assert.equal(joAnswer.status, 403, JSON.stringify(joAnswer.body));
  assert.equal(joAnswer.body.code, 'owner_only');
  assert.deepEqual(answers.map((a) => a.status), Array(AT_ONCE).fill(200), JSON.stringify(answers.map((a) => a.body)));

  const north = await staffRequest(server.baseUrl, northStreet.cookie, '/api/label-settings');
  const river = await staffRequest(server.baseUrl, riverside.cookie, '/api/label-settings');
  assert.equal(north.body.widthMm, 60, JSON.stringify(north.body));
  assert.equal(river.body.widthMm, 70, JSON.stringify(river.body));
});
