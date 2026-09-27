// Sites, till registration and switching a till off (Release 2 offline plan 1).
// Spec: docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md §5, §8
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { hashLinkCode } from '../server/booking-link.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { staffLogin } from './helpers/till.js';

let server; let owner; let staff;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  staff = await staffLogin(owner.shop.id);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const as = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);

test('an owner adds a site; codes are one to three capital letters', async () => {
  const res = await as(owner, '/api/sites', { method: 'POST', body: { name: 'Bolton', code: 'B' } });
  assert.equal(res.status, 201);
  assert.deepEqual({ name: res.body.name, code: res.body.code }, { name: 'Bolton', code: 'B' });
  const bad = await as(owner, '/api/sites', { method: 'POST', body: { name: 'X', code: 'b1' } });
  assert.equal(bad.status, 400);
  const dup = await as(owner, '/api/sites', { method: 'POST', body: { name: 'Again', code: 'B' } });
  assert.equal(dup.status, 409);
});

test('only the owner can add a site or register a till', async () => {
  assert.equal((await as(staff, '/api/sites', { method: 'POST', body: { name: 'S', code: 'S' } })).status, 403);
  assert.equal((await as(staff, '/api/tills', { method: 'POST', body: { siteId: 1, number: 1, name: 'T' } })).status, 403);
});

test('registering a till returns its code and a one-time token; only the hash is stored', async () => {
  const site = (await as(owner, '/api/sites')).body.find((s) => s.code === 'B');
  const res = await as(owner, '/api/tills', { method: 'POST', body: { siteId: site.id, number: 1, name: 'Front counter' } });
  assert.equal(res.status, 201);
  assert.equal(res.body.till.code, 'B1');
  assert.equal(res.body.till.active, true);
  assert.match(res.body.token, /^[0-9a-f]{64}$/);
  const row = await runWithShop(owner.shop.id, () => prepare('SELECT token_hash FROM tills WHERE id = ?').get(res.body.till.id));
  assert.equal(row.token_hash, hashLinkCode(res.body.token));
  const again = await as(owner, '/api/tills', { method: 'POST', body: { siteId: site.id, number: 1, name: 'Dup' } });
  assert.equal(again.status, 409);
});

test('the tills list shows last seen and waiting count, and a till can be switched off', async () => {
  const list = (await as(owner, '/api/tills')).body;
  const b1 = list.find((t) => t.code === 'B1');
  assert.deepEqual(
    { active: b1.active, lastSeenAt: b1.lastSeenAt, pendingCount: b1.pendingCount },
    { active: true, lastSeenAt: null, pendingCount: 0 }
  );
  const off = await as(owner, `/api/tills/${b1.id}/deactivate`, { method: 'POST' });
  assert.deepEqual(off.body, { id: b1.id, active: false });
});

test('a till cannot be registered to another shop\'s site', async () => {
  const other = await staffSignup(server.baseUrl);
  try {
    const theirSite = (await staffRequest(server.baseUrl, other.cookie, '/api/sites', {
      method: 'POST', body: { name: 'Theirs', code: 'T' },
    })).body;
    const res = await as(owner, '/api/tills', { method: 'POST', body: { siteId: theirSite.id, number: 1, name: 'Sneaky' } });
    assert.equal(res.status, 400);
  } finally {
    await deleteTestShop(other.shop.id);
  }
});

test('the owner sets a staff PIN; it is stored hashed and never returned', async () => {
  const { verifyPin } = await import('../server/till/pin.js');
  const empId = await runWithShop(owner.shop.id, async () =>
    (await prepare("INSERT INTO employees (name, is_cashier) VALUES ('Alex', 1)").run()).lastInsertRowid);
  assert.equal((await as(owner, `/api/employees/${empId}/pin`, { method: 'PUT', body: { pin: '12' } })).status, 400);
  assert.equal((await as(staff, `/api/employees/${empId}/pin`, { method: 'PUT', body: { pin: '4821' } })).status, 403);
  const res = await as(owner, `/api/employees/${empId}/pin`, { method: 'PUT', body: { pin: '4821' } });
  assert.equal(res.status, 204);
  const row = await runWithShop(owner.shop.id, () => prepare('SELECT pin_hash FROM employees WHERE id = ?').get(empId));
  assert.equal(verifyPin('4821', row.pin_hash), true);
  assert.equal((await as(owner, '/api/employees/999999/pin', { method: 'PUT', body: { pin: '4821' } })).status, 404);
});
