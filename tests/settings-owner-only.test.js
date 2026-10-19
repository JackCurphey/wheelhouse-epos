// Settings for the Owner only, until roles are built (Jack, 19 Oct,
// docs/decisions/2026-10-19-owner-only-settings.md): a login that isn't the
// Owner can read the settings but not change them.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let jo;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${Date.now()}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});
const as = (who) => (path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const REFUSED = { error: "Only the shop's owner can change settings", code: 'owner_only' };

test('a staff member can read the settings but not change them', async () => {
  const before = (await as(owner)('/api/workshop-settings')).body;
  assert.equal((await as(jo)('/api/workshop-settings')).status, 200);
  assert.equal((await as(jo)('/api/shop-details')).status, 200);
  const ws = await as(jo)('/api/workshop-settings', { method: 'PUT', body: { showSignOffToCustomers: true } });
  assert.equal(ws.status, 403, JSON.stringify(ws.body));
  assert.deepEqual(ws.body, REFUSED);
  const sd = await as(jo)('/api/shop-details', { method: 'PUT', body: { vatNumber: '[VAT number]' } });
  assert.equal(sd.status, 403, JSON.stringify(sd.body));
  assert.deepEqual(sd.body, REFUSED);
  assert.equal((await as(owner)('/api/workshop-settings')).body.showSignOffToCustomers, before.showSignOffToCustomers);
  assert.equal((await as(owner)('/api/shop-details')).body.vatNumber, null);
});

test('the Owner still changes them', async () => {
  const ws = await as(owner)('/api/workshop-settings', { method: 'PUT', body: { showSignOffToCustomers: true } });
  assert.equal(ws.status, 200, JSON.stringify(ws.body));
  const sd = await as(owner)('/api/shop-details', { method: 'PUT', body: { vatNumber: '[VAT number]' } });
  assert.equal(sd.status, 200, JSON.stringify(sd.body));
  assert.equal(sd.body.vatNumber, '[VAT number]');
});
