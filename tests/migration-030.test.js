// Migration 030: a booking's services live in their own table, one row per
// service with the price it was booked at; the per-job columns are gone.
// Spec: docs/superpowers/specs/2026-09-26-book-server-7-multiple-services-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
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

const column = async (table, name) => (await pool.query(
  `SELECT data_type, is_nullable, numeric_precision, numeric_scale
   FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`, [table, name]
)).rows[0];

test('workshop_job_services has the booked service, price to the penny, and order', async () => {
  for (const name of ['id', 'shop_id', 'workshop_job_id', 'service_id', 'position']) {
    const c = await column('workshop_job_services', name);
    assert.ok(c, `${name} missing`);
    assert.equal(c.is_nullable, 'NO', `${name} should be required`);
  }
  const price = await column('workshop_job_services', 'booked_price');
  assert.equal(price.data_type, 'numeric');
  assert.equal(price.numeric_precision, 10);
  assert.equal(price.numeric_scale, 2);
  assert.equal(price.is_nullable, 'YES');
});

test('the old per-job service columns are gone', async () => {
  assert.equal(await column('workshop_jobs', 'service_id'), undefined);
  assert.equal(await column('workshop_jobs', 'booked_price'), undefined);
});

test('row-level security is enabled and forced', async () => {
  const { rows: [t] } = await pool.query(
    "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'workshop_job_services'");
  assert.equal(t.relrowsecurity, true);
  assert.equal(t.relforcerowsecurity, true);
});

test('another shop cannot see a shop\'s booked services', async () => {
  const other = await staffSignup(server.baseUrl);
  try {
    const seen = await runWithShop(other.shop.id, () => prepare(
      'SELECT count(*)::int AS n FROM workshop_job_services WHERE shop_id = ?').get(owner.shop.id));
    assert.equal(seen.n, 0);
  } finally {
    await deleteTestShop(other.shop.id);
  }
});

test('a job cannot list the same service twice, and rows go with the job', async () => {
  await runWithShop(owner.shop.id, async () => {
    const svc = (await prepare("INSERT INTO workshop_services (name, price, minutes, updated_at) VALUES ('Once', 10, 30, now())").run()).lastInsertRowid;
    const job = (await prepare("INSERT INTO workshop_jobs (title, job_date, updated_at) VALUES ('x', '2030-01-01', now())").run()).lastInsertRowid;
    await prepare('INSERT INTO workshop_job_services (workshop_job_id, service_id, booked_price, position) VALUES (?, ?, 10, 0)').run(job, svc);
    await assert.rejects(prepare('INSERT INTO workshop_job_services (workshop_job_id, service_id, booked_price, position) VALUES (?, ?, 10, 1)').run(job, svc));
    await prepare('DELETE FROM workshop_jobs WHERE id = ?').run(job);
    const left = await prepare('SELECT count(*)::int AS n FROM workshop_job_services WHERE workshop_job_id = ?').get(job);
    assert.equal(left.n, 0);
  });
});
