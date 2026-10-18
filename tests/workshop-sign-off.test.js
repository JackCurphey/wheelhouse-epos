// The mechanic sign-off, piece 1 (Jack, 16 and 18 Oct,
// docs/decisions/2026-10-16-mechanic-sign-off.md; openspec/changes/mechanic-sign-off
// design.md's contract): finishing the work needs an active mechanic to sign
// it off, and records who and when; reopening clears it, the earlier sign-off
// kept in workshop_job_sign_offs.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
before(async () => { server = await startLiveServer(); });
after(async () => {
  if (server) await server.stop();
  await pool.end();
});

async function shopWithJob() {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const alex = await seedMechanic(shop.id, { name: 'Alex Morgan' });
  const req = (path, options) => staffRequest(server.baseUrl, cookie, path, options);
  let job = (await req('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-13', startTime: '10:00', endTime: '11:00', mechanicId: alex } })).body;
  for (const step of ['book-in', 'start']) {
    const r = await req(`/api/workshop-jobs/${job.id}/${step}`, { method: 'POST', body: { version: job.version } });
    assert.equal(r.status, 200, `${step}: ${JSON.stringify(r.body)}`);
    job = r.body;
  }
  return { shop, req, alex, job };
}
const history = (shopId, jobId) => runWithShop(shopId, () => prepare(
  'SELECT employee_id, signed_off_at, cleared_at FROM workshop_job_sign_offs WHERE workshop_job_id = ? ORDER BY id'
).all(jobId));

test('finishing without a mechanic is refused, and the work stays in progress', async () => {
  const { shop, req, job } = await shopWithJob();
  try {
    const res = await req(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: job.version } });
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.deepEqual(res.body, { error: 'Choose who is signing this off', code: 'sign_off_required' });
    const now = (await req(`/api/workshop-jobs/${job.id}`)).body;
    assert.equal(now.workState, 'in_progress');
    assert.equal(now.version, job.version);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('only an active mechanic of this shop can sign off', async () => {
  const { shop, req, job } = await shopWithJob();
  const other = await staffSignup(server.baseUrl);
  try {
    const theirs = await seedMechanic(other.shop.id, { name: 'Jo Taylor' });
    const cashier = await runWithShop(shop.id, async () => (await prepare("INSERT INTO employees (name, is_cashier, active) VALUES ('Sam Lee', 1, 1)").run()).lastInsertRowid);
    const gone = await runWithShop(shop.id, async () => (await prepare("INSERT INTO employees (name, is_mechanic, active) VALUES ('Old Mechanic', 1, 0)").run()).lastInsertRowid);
    for (const who of [cashier, gone, theirs, 'Alex']) {
      const res = await req(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: job.version, signedOffBy: who } });
      assert.equal(res.status, 400, `${who}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.code, 'sign_off_required');
    }
    assert.equal((await req(`/api/workshop-jobs/${job.id}`)).body.workState, 'in_progress');
  } finally {
    await deleteTestShop(shop.id);
    await deleteTestShop(other.shop.id);
  }
});

test('signing off finishes the work and records who and when, on the job and in the history', async () => {
  const { shop, req, alex, job } = await shopWithJob();
  try {
    const res = await req(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: job.version, signedOffBy: alex } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.workState, 'complete');
    assert.equal(res.body.signedOffBy, alex);
    assert.equal(res.body.signedOffByName, 'Alex Morgan');
    assert.ok(!Number.isNaN(Date.parse(res.body.signedOffAt)), String(res.body.signedOffAt));
    const read = (await req(`/api/workshop-jobs/${job.id}`)).body;
    assert.equal(read.signedOffByName, 'Alex Morgan');
    const listed = (await req('/api/workshop-jobs')).body.find((j) => j.id === job.id);
    assert.equal(listed.signedOffBy, alex);
    const rows = await history(shop.id, job.id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].employee_id, alex);
    assert.equal(rows[0].cleared_at, null);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('reopening the work clears the sign-off; the history keeps it, marked cleared', async () => {
  const { shop, req, alex, job } = await shopWithJob();
  try {
    const done = (await req(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: job.version, signedOffBy: alex } })).body;
    const res = await req(`/api/workshop-jobs/${job.id}/reopen-work`, { method: 'POST', body: { version: done.version } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.workState, 'in_progress');
    assert.deepEqual([res.body.signedOffBy, res.body.signedOffByName, res.body.signedOffAt], [null, null, null]);
    const rows = await history(shop.id, job.id);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].cleared_at !== null, 'the earlier sign-off is marked cleared');
    // Finishing again asks again, and adds a second sign-off.
    const again = await req(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: res.body.version, signedOffBy: alex } });
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.equal((await history(shop.id, job.id)).length, 2);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the old form reopening finished work clears the sign-off too', async () => {
  const { shop, req, alex, job } = await shopWithJob();
  try {
    const done = (await req(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: job.version, signedOffBy: alex } })).body;
    const res = await req(`/api/workshop-jobs/${job.id}`, { method: 'PUT', body: { status: 'scheduled', version: done.version } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.workState, 'not_started');
    assert.equal(res.body.signedOffBy, null);
    assert.ok((await history(shop.id, job.id))[0].cleared_at !== null);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('an old-form save that leaves finished work finished keeps the sign-off', async () => {
  const { shop, req, alex, job } = await shopWithJob();
  try {
    const done = (await req(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: job.version, signedOffBy: alex } })).body;
    const res = await req(`/api/workshop-jobs/${job.id}`, { method: 'PUT', body: { status: done.status, version: done.version } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.signedOffBy, alex);
    assert.equal((await history(shop.id, job.id))[0].cleared_at, null);
  } finally {
    await deleteTestShop(shop.id);
  }
});
