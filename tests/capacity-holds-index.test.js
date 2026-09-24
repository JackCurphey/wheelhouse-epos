// Migration 024: two untimed (drop-off) holds for one mechanic on one day
// coexist; two timed holds at the same start still collide.
// Plan: docs/superpowers/plans/2026-09-24-book-server-2b-booking-modes.md (decision 1)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let sam;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

const hold = (startTime) => runWithShop(owner.shop.id, () => prepare(
  `INSERT INTO workshop_capacity_holds (job_date, start_time, mechanic_id, minutes, state)
   VALUES ('2030-01-07', ?, ?, 60, 'held')`
).run(startTime, sam));

test('two drop-off holds for one mechanic on one day coexist', async () => {
  await hold('');
  await hold('');
});

test('two timed holds at the same start still collide', async () => {
  await hold('10:00');
  await assert.rejects(hold('10:00'), (err) => err.code === '23505');
});
