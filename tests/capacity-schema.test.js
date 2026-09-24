// Migration 023 and the new-shop reserve default.
// Spec: docs/superpowers/specs/2026-09-24-book-server-2-modes-capacity-design.md (2a, Schema)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
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
});

test('a new shop starts with no reserve, since blocks now carry lunch', async () => {
  const res = await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings');
  assert.equal(res.status, 200);
  assert.equal(res.body.fullDayThresholdMinutes, 0);
});

test('a new shop has no per-weekday hours and no scheduled mode change', async () => {
  const row = await runWithShop(owner.shop.id, () =>
    prepare('SELECT weekday_hours, next_booking_mode, next_booking_mode_from FROM workshop_settings LIMIT 1').get());
  assert.equal(row.weekday_hours, '{}');
  assert.equal(row.next_booking_mode, null);
  assert.equal(row.next_booking_mode_from, null);
});

test('the database refuses a weekly block with no mechanic', async () => {
  await assert.rejects(
    runWithShop(owner.shop.id, () => prepare(
      `INSERT INTO workshop_unavailability (employee_id, kind, weekdays, start_time, end_time)
       VALUES (NULL, 'weekly', '[1]', '13:00', '13:30')`
    ).run()),
    /check constraint/i,
  );
});

test('the database refuses a shop-wide closure with times', async () => {
  await assert.rejects(
    runWithShop(owner.shop.id, () => prepare(
      `INSERT INTO workshop_unavailability (employee_id, kind, start_date, end_date, start_time, end_time)
       VALUES (NULL, 'dates', '2026-12-25', '2026-12-26', '09:00', '12:00')`
    ).run()),
    /check constraint/i,
  );
});

test('a mode change needs both a mode and a date, or neither', async () => {
  await assert.rejects(
    runWithShop(owner.shop.id, () => prepare(
      "UPDATE workshop_settings SET next_booking_mode = 'dropoff', next_booking_mode_from = NULL"
    ).run()),
    /check constraint/i,
  );
});
