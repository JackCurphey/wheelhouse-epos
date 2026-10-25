// Print jobs belong to one shop's helper (found 25 Oct while looking at the
// label printer helper's sign-in): jobs were kept by device id alone, so a
// session from another shop checking in with the same device id took them.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let a;
let b;
before(async () => {
  server = await startLiveServer();
  a = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  b = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
});
after(async () => {
  if (a) await deleteTestShop(a.shop.id);
  if (b) await deleteTestShop(b.shop.id);
  await server?.stop();
});

const checkin = (who, deviceId) => staffRequest(server.baseUrl, who.cookie, '/api/print-agents/checkin', {
  method: 'POST', body: { deviceId, deviceName: 'Stockroom PC', printers: ['Label printer'] },
});
const label = { printerName: 'Label printer', widthMm: 50, heightMm: 25, pages: ['<p>[label]</p>'] };

test('a job for one shop’s helper never reaches another shop’s helper with the same device id', async () => {
  assert.equal((await checkin(a, 'pc1')).status, 200);
  const queued = await staffRequest(server.baseUrl, a.cookie, '/api/print-agents/pc1/jobs', { method: 'POST', body: label });
  assert.equal(queued.status, 201, JSON.stringify(queued.body));

  const other = await checkin(b, 'pc1');
  assert.equal(other.status, 200);
  assert.deepEqual(other.body.jobs, [], 'another shop’s helper gets nothing');

  const own = await checkin(a, 'pc1');
  assert.equal(own.body.jobs.length, 1, 'the shop’s own helper still gets its job');
  assert.equal(own.body.jobs[0].jobId, queued.body.jobId);
});

test('each shop sees only its own helpers', async () => {
  await checkin(a, 'pc-a');
  await checkin(b, 'pc-b');
  const seen = await staffRequest(server.baseUrl, a.cookie, '/api/print-agents');
  const ids = seen.body.agents.map((x) => x.deviceId);
  assert.ok(ids.includes('pc-a'));
  assert.ok(!ids.includes('pc-b'));
});

test('only the shop that queued a job can mark it done', async () => {
  await checkin(a, 'pc2');
  const queued = await staffRequest(server.baseUrl, a.cookie, '/api/print-agents/pc2/jobs', { method: 'POST', body: label });
  const fromB = await staffRequest(server.baseUrl, b.cookie, `/api/print-agents/jobs/${queued.body.jobId}/complete`, { method: 'POST', body: { ok: true } });
  assert.equal(fromB.status, 404);
  const fromA = await staffRequest(server.baseUrl, a.cookie, `/api/print-agents/jobs/${queued.body.jobId}/complete`, { method: 'POST', body: { ok: true } });
  assert.equal(fromA.status, 200);
});
