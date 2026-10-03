// Migration 037: a job's parts, one row per day it is worked (Workshop day
// decision 52: "one block per day"). Part 1 is the job's own date, times and
// mechanic, kept identical by triggers, so every existing write path stays
// correct untouched. Additive only.
// Spec: docs/superpowers/specs/2026-10-03-multi-day-jobs-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let sam;
let jo;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  jo = await seedMechanic(owner.shop.id, { name: 'Jo' });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const inShop = (fn) => runWithShop(owner.shop.id, fn);
const parts = (jobId) => inShop(() => prepare(
  'SELECT part_date, start_time, end_time, mechanic_id, position FROM workshop_job_parts WHERE workshop_job_id = ? ORDER BY position'
).all(jobId)).then((rows) => rows.map((r) => ({ ...r })));
const newJob = (date = '2030-02-04', start = '10:00', end = '11:00', mech = sam) => inShop(() => prepare(
  "INSERT INTO workshop_jobs (title, job_date, start_time, end_time, mechanic_id) VALUES ('x', ?, ?, ?, ?)"
).run(date, start, end, mech)).then((r) => r.lastInsertRowid);

test('workshop_job_parts has the job, day, times, mechanic and position', async () => {
  const cols = (await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'workshop_job_parts'",
  )).rows.map((r) => r.column_name).sort();
  assert.deepEqual(cols, ['end_time', 'id', 'mechanic_id', 'part_date', 'position', 'shop_id', 'start_time', 'workshop_job_id']);
});

test('a new job gets part 1, the same as the job', async () => {
  const id = await newJob();
  assert.deepEqual(await parts(id), [{ part_date: '2030-02-04', start_time: '10:00', end_time: '11:00', mechanic_id: sam, position: 1 }]);
});

test('changing the job\'s day, times or mechanic changes part 1, and leaves later parts alone', async () => {
  const id = await newJob();
  await inShop(() => prepare("INSERT INTO workshop_job_parts (workshop_job_id, part_date, start_time, end_time, mechanic_id, position) VALUES (?, '2030-02-05', '10:00', '11:00', ?, 2)").run(id, sam));
  await inShop(() => prepare("UPDATE workshop_jobs SET job_date = '2030-02-06', start_time = '13:00', end_time = '15:00', mechanic_id = ? WHERE id = ?").run(jo, id));
  assert.deepEqual(await parts(id), [
    { part_date: '2030-02-06', start_time: '13:00', end_time: '15:00', mechanic_id: jo, position: 1 },
    { part_date: '2030-02-05', start_time: '10:00', end_time: '11:00', mechanic_id: sam, position: 2 },
  ]);
});

test('a job\'s parts go when the job goes', async () => {
  const id = await newJob();
  await inShop(() => prepare('DELETE FROM workshop_jobs WHERE id = ?').run(id));
  assert.deepEqual(await parts(id), []);
});

test('two parts of one job cannot share a position', async () => {
  const id = await newJob();
  await assert.rejects(() => inShop(() => prepare(
    "INSERT INTO workshop_job_parts (workshop_job_id, part_date, position) VALUES (?, '2030-02-05', 1)",
  ).run(id)));
});

test('every job has a part 1 (the backfill and the trigger together)', async () => {
  await newJob();
  const missing = await inShop(() => prepare(
    'SELECT count(*)::int AS n FROM workshop_jobs w WHERE NOT EXISTS (SELECT 1 FROM workshop_job_parts p WHERE p.workshop_job_id = w.id AND p.position = 1)',
  ).get());
  assert.equal(missing.n, 0);
});

test('parts are only seen inside their own shop', async () => {
  const other = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  try {
    await newJob();
    const seen = await runWithShop(other.shop.id, () => prepare('SELECT count(*)::int AS n FROM workshop_job_parts').get());
    assert.equal(seen.n, 0);
  } finally {
    await deleteTestShop(other.shop.id);
  }
});
