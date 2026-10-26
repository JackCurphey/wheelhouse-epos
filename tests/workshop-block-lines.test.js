// What a diary block shows first and second (Workshop day 17 and 29, 27 Sep;
// drawn as set-workshop-diary's Diary blocks, 30 Sep; built 22 Oct on Jack's
// word): bike, then job title, by default; each shop chooses from bike, job
// title, customer and job number. One setting for the business (shops and
// sites, 5 Oct).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});
const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const put = (body) => staff('/api/workshop-settings', { method: 'PUT', body });

test('a shop starts with the bike, then the job title', async () => {
  const { body } = await staff('/api/workshop-settings');
  assert.deepEqual([body.blockFirst, body.blockSecond], ['bike', 'jobTitle']);
});

test('the Owner chooses each line from bike, job title, customer and job number', async () => {
  const saved = await put({ blockFirst: 'customer', blockSecond: 'reference' });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.deepEqual([saved.body.blockFirst, saved.body.blockSecond], ['customer', 'reference']);
  const one = await put({ blockFirst: 'jobTitle' });
  assert.deepEqual([one.body.blockFirst, one.body.blockSecond], ['jobTitle', 'reference']);
  await put({ blockFirst: 'bike', blockSecond: 'jobTitle' });
});

test('anything else, or the same thing twice, is refused', async () => {
  for (const body of [{ blockFirst: 'colour' }, { blockSecond: 7 }, { blockFirst: 'jobTitle', blockSecond: 'jobTitle' }, { blockSecond: 'bike' }]) {
    const res = await put(body);
    assert.equal(res.status, 400, JSON.stringify([body, res.body]));
  }
  const { body } = await staff('/api/workshop-settings');
  assert.deepEqual([body.blockFirst, body.blockSecond], ['bike', 'jobTitle']);
});

test('only the Owner changes it', async () => {
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const jo = await staffFreshCookie(made.body.loginId);
  assert.equal((await staffRequest(server.baseUrl, jo, '/api/workshop-settings', { method: 'PUT', body: { blockFirst: 'customer' } })).status, 403);
});
