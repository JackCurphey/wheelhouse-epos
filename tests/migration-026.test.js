// Migration 026 added workshop_jobs.service_id/booked_price (piece 3b).
// Migration 030 superseded both: they moved into workshop_job_services (one
// row per booked service) and the old columns were dropped. See
// tests/migration-030.test.js for the coverage that replaced this file's
// column assertions ("the old per-job service columns are gone").
// Spec: docs/superpowers/specs/2026-09-26-book-server-7-multiple-services-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
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

test('workshop_job_services.booked_price is a nullable money amount to the penny', async () => {
  const c = (await pool.query(
    `SELECT data_type, is_nullable, numeric_precision, numeric_scale
     FROM information_schema.columns WHERE table_name = 'workshop_job_services' AND column_name = 'booked_price'`
  )).rows[0];
  assert.ok(c, 'column missing');
  assert.equal(c.data_type, 'numeric');
  assert.equal(c.numeric_precision, 10);
  assert.equal(c.numeric_scale, 2);
  assert.equal(c.is_nullable, 'YES');
});
