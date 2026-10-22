// Input checks the audit of the flagged merges found loose
// (docs/reviews/2026-10-22-flagged-merges-audit.md, P3 items 19, 21 and 22;
// openspec/changes/input-checks): a mechanic must be sent as a whole number;
// a mechanic deleted or switched off while a job is being finished is refused
// in plain terms, not a server error; and the workshop's on/off settings take
// only a real true or false.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let alex;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const admin = async () => {
  const client = new pg.Client({ connectionString: process.env.ADMIN_DATABASE_URL.replace(/\/[^/]*$/, new URL(process.env.DATABASE_URL).pathname) });
  await client.connect();
  return client;
};
// 10000000000 is a whole number too big for the database's ids.
const NOT_WHOLE = ['abc', 1.5, true, '1', [1], { id: 1 }, 10000000000];

async function newJob(body = {}) {
  const res = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-13', startTime: '10:00', endTime: '11:00', mechanicId: alex, ...body } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

// Item 19.
test('a job refuses a mechanic that is not a whole number, on create and on save', async () => {
  const job = await newJob();
  for (const mechanicId of [...NOT_WHOLE, String(alex)]) {
    const made = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-13', mechanicId } });
    assert.equal(made.status, 400, `create ${JSON.stringify(mechanicId)}: ${JSON.stringify(made.body)}`);
    assert.equal(made.body.error, 'Mechanic not found or inactive');
    const saved = await staff(`/api/workshop-jobs/${job.id}`, { method: 'PUT', body: { version: job.version, mechanicId } });
    assert.equal(saved.status, 400, `save ${JSON.stringify(mechanicId)}: ${JSON.stringify(saved.body)}`);
    assert.equal(saved.body.error, 'Mechanic not found or inactive');
  }
  const now = (await staff(`/api/workshop-jobs/${job.id}`)).body;
  assert.equal(now.mechanicId, alex, 'the job keeps its mechanic');
  // A real number still works, and null still means the shared queue.
  const cleared = await staff(`/api/workshop-jobs/${job.id}`, { method: 'PUT', body: { version: job.version, mechanicId: null } });
  assert.equal(cleared.status, 200, JSON.stringify(cleared.body));
  assert.ok(cleared.body.mechanicId === null);
  const back = await staff(`/api/workshop-jobs/${job.id}`, { method: 'PUT', body: { version: cleared.body.version, mechanicId: alex } });
  assert.equal(back.status, 200, JSON.stringify(back.body));
  assert.equal(back.body.mechanicId, alex);
});

test('finishing refuses a sign-off by an id too big to be anyone', async () => {
  let job = await newJob({ startTime: '16:00', endTime: '17:00' });
  for (const step of ['book-in', 'start']) job = (await staff(`/api/workshop-jobs/${job.id}/${step}`, { method: 'POST', body: { version: job.version } })).body;
  const res = await staff(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: job.version, signedOffBy: 10000000000 } });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(res.body.code, 'sign_off_required');
});

// Item 21: the mechanic goes between the route's check and the sign-off being
// written. A trigger on the job's finishing update stands in for the Owner
// deleting (or switching off) the mechanic at that moment.
async function finishWhileMechanicGoes(what) {
  const signer = await seedMechanic(owner.shop.id, { name: what === 'deletes' ? 'Jo Taylor' : 'Sam Lee' });
  let job = await newJob(what === 'deletes' ? { startTime: '12:00', endTime: '13:00' } : { startTime: '14:00', endTime: '15:00' });
  for (const step of ['book-in', 'start']) {
    const r = await staff(`/api/workshop-jobs/${job.id}/${step}`, { method: 'POST', body: { version: job.version } });
    assert.equal(r.status, 200, `${step}: ${JSON.stringify(r.body)}`);
    job = r.body;
  }
  const db = await admin();
  const fn = `test_mechanic_goes_${job.id}`;
  const change = what === 'deletes' ? `DELETE FROM employees WHERE id = ${signer}` : `UPDATE employees SET active = 0 WHERE id = ${signer}`;
  try {
    await db.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
      BEGIN ${change}; RETURN NEW; END $$`);
    await db.query(`CREATE TRIGGER ${fn} BEFORE UPDATE OF work_state ON workshop_jobs FOR EACH ROW
      WHEN (NEW.id = ${job.id} AND NEW.work_state = 'complete') EXECUTE FUNCTION ${fn}()`);
    const res = await staff(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: job.version, signedOffBy: signer } });
    return { job, res };
  } finally {
    await db.query(`DROP TRIGGER IF EXISTS ${fn} ON workshop_jobs`);
    await db.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    await db.end();
  }
}

for (const what of ['deletes', 'switches off']) {
  test(`a mechanic the Owner ${what} while the job is being finished: refused, and nothing moves`, async () => {
    const { job, res } = await finishWhileMechanicGoes(what);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.deepEqual(res.body, { error: 'Choose who is signing this off', code: 'sign_off_required' });
    const now = (await staff(`/api/workshop-jobs/${job.id}`)).body;
    assert.equal(now.workState, 'in_progress');
    assert.equal(now.version, job.version);
    assert.ok(now.signedOffBy === null);
    const rows = await runWithShop(owner.shop.id, () => prepare('SELECT id FROM workshop_job_sign_offs WHERE workshop_job_id = ?').all(job.id));
    assert.equal(rows.length, 0, 'no sign-off history written');
  });
}

// Item 22, and its siblings: each on/off setting takes only true or false.
const SWITCHES = [
  ['showSignOffToCustomers', 'show_sign_off_to_customers'],
  ['showPricesOnline', 'show_prices_online'],
  ['confirmBookingsAutomatically', 'confirm_bookings_automatically'],
];
for (const [key, column] of SWITCHES) {
  test(`${key} takes only true or false; anything else is refused and changes nothing`, async () => {
    const stored = async () => (await runWithShop(owner.shop.id, () => prepare(`SELECT ${column} AS v FROM workshop_settings LIMIT 1`).get())).v;
    const off = await staff('/api/workshop-settings', { method: 'PUT', body: { [key]: false } });
    assert.equal(off.status, 200, JSON.stringify(off.body));
    assert.equal(off.body[key], false);
    for (const sloppy of ['false', 'true', 'yes', 1, 0, null, '', [], {}]) {
      const res = await staff('/api/workshop-settings', { method: 'PUT', body: { [key]: sloppy } });
      assert.equal(res.status, 400, `${JSON.stringify(sloppy)}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.error, `${key} must be true or false`);
      assert.equal(await stored(), 0, `${JSON.stringify(sloppy)} left it off`);
    }
    const on = await staff('/api/workshop-settings', { method: 'PUT', body: { [key]: true } });
    assert.equal(on.status, 200, JSON.stringify(on.body));
    assert.equal(on.body[key], true);
    const refused = await staff('/api/workshop-settings', { method: 'PUT', body: { [key]: 'false' } });
    assert.equal(refused.status, 400);
    assert.equal(await stored(), 1, '"false" did not turn it off either');
    // Left out, it stays as it is.
    const other = await staff('/api/workshop-settings', { method: 'PUT', body: { confirmationNote: 'Please bring the lock key, and tell us about any accessories.' } });
    assert.equal(other.status, 200, JSON.stringify(other.body));
    assert.equal(other.body[key], true);
    await staff('/api/workshop-settings', { method: 'PUT', body: { [key]: false } });
  });
}
