// Migration 026: the service a booking named and the price it was booked at.
// Spec: docs/superpowers/specs/2026-09-25-book-server-3b-booked-price-design.md
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
   FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
  [table, name]
)).rows[0];

test('workshop_jobs.service_id is a nullable integer', async () => {
  const c = await column('workshop_jobs', 'service_id');
  assert.ok(c, 'column missing');
  assert.equal(c.data_type, 'integer');
  assert.equal(c.is_nullable, 'YES');
});

test('workshop_jobs.booked_price is a nullable money amount to the penny', async () => {
  const c = await column('workshop_jobs', 'booked_price');
  assert.ok(c, 'column missing');
  assert.equal(c.data_type, 'numeric');
  assert.equal(c.numeric_precision, 10);
  assert.equal(c.numeric_scale, 2);
  assert.equal(c.is_nullable, 'YES');
});

test('service_id refuses an id that is not a service', async () => {
  await assert.rejects(
    runWithShop(owner.shop.id, () => prepare(
      "INSERT INTO workshop_jobs (title, job_date, service_id) VALUES ('x', '2030-01-01', 2147483647)"
    ).run()),
    /foreign key/i
  );
});
