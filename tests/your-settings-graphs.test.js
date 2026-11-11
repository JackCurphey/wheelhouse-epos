// Show graphs in reports, the server (openspec/changes/reports-sales-and-takings
// specs/your-settings; Jack's answer 11 of 10 Nov): one more switch on a person's
// login, on to start, refused when it isn't true or false.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
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
const as = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);

test('showGraphs is known and on to start', async () => {
  const res = await as('/api/your-settings');
  assert.equal(res.body.accessibility.showGraphs, true);
});

test('it is saved for this login and can be turned back on', async () => {
  const off = await as('/api/your-settings', { method: 'PUT', body: { accessibility: { showGraphs: false } } });
  assert.equal(off.status, 200, JSON.stringify(off.body));
  assert.equal(off.body.accessibility.showGraphs, false);
  assert.equal((await as('/api/your-settings')).body.accessibility.showGraphs, false);
  assert.equal((await as('/api/your-settings', { method: 'PUT', body: { accessibility: { showGraphs: true } } })).body.accessibility.showGraphs, true);
});

test('it is refused when it is not true or false', async () => {
  for (const bad of ['yes', 1, null, 'false']) {
    const res = await as('/api/your-settings', { method: 'PUT', body: { accessibility: { showGraphs: bad } } });
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
  assert.equal((await as('/api/your-settings')).body.accessibility.showGraphs, true, 'nothing was saved');
});
