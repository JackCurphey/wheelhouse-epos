// Migration 035 (piece 12): a booking's stored change request, who cancelled
// it and when, when staff saw a customer's cancellation and declined a change,
// and holds marked as a requested slot's. The 024 live-slot index is keyed on
// the slot, so it guards requested slots too and lets one job hold two slots.
// A separate index below caps a job at one live requested hold, so a second
// change request cannot pile up capacity behind the customer's back.
// Spec: docs/superpowers/specs/2026-09-27-book-server-12-change-cancel-design.md
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

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const column = async (table, name) => (await pool.query(
  'SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
  [table, name]
)).rows[0];

const inShop = (fn) => runWithShop(owner.shop.id, fn);
const newJob = () => inShop(() => prepare(
  "INSERT INTO workshop_jobs (title, job_date) VALUES ('x', '2030-02-04')"
).run()).then((r) => r.lastInsertRowid);
const hold = (fields) => inShop(() => prepare(
  `INSERT INTO workshop_capacity_holds (workshop_job_id, job_date, start_time, mechanic_id, minutes${fields.purpose ? ', purpose' : ''})
   VALUES (?, ?, ?, ?, 60${fields.purpose ? ', ?' : ''}) RETURNING purpose`
).get(...[fields.jobId ?? null, fields.date, fields.start, sam, ...(fields.purpose ? [fields.purpose] : [])]));

test('workshop_jobs gains the request, cancellation and decline columns, all optional', async () => {
  const expected = {
    requested_job_date: 'text',
    requested_mechanic_id: 'integer',
    requested_start_time: 'text',
    requested_end_time: 'text',
    requested_at: 'timestamp with time zone',
    cancelled_by: 'text',
    cancelled_at: 'timestamp with time zone',
    cancellation_seen_at: 'timestamp with time zone',
    change_declined_at: 'timestamp with time zone',
  };
  for (const [name, type] of Object.entries(expected)) {
    const c = await column('workshop_jobs', name);
    assert.ok(c, `${name} missing`);
    assert.equal(c.data_type, type, name);
    assert.equal(c.is_nullable, 'YES', name);
  }
});

test('cancelled_by is customer or staff, nothing else', async () => {
  const id = await newJob();
  await inShop(() => prepare("UPDATE workshop_jobs SET cancelled_by = 'customer' WHERE id = ?").run(id));
  await assert.rejects(
    inShop(() => prepare("UPDATE workshop_jobs SET cancelled_by = 'robot' WHERE id = ?").run(id)),
    /check constraint/i
  );
});

test('a hold is for a booking unless it says otherwise', async () => {
  const row = await hold({ date: '2030-02-05', start: '09:00' });
  assert.equal(row.purpose, 'booking');
});

test("a hold's purpose is booking or requested, nothing else", async () => {
  await assert.rejects(hold({ date: '2030-02-05', start: '10:00', purpose: 'maybe' }), /check constraint/i);
  assert.equal((await hold({ date: '2030-02-05', start: '11:00', purpose: 'requested' })).purpose, 'requested');
});

test('a requested hold cannot share a live slot with a booking hold', async () => {
  await hold({ date: '2030-02-06', start: '10:00' });
  await assert.rejects(hold({ date: '2030-02-06', start: '10:00', purpose: 'requested' }), (err) => err.code === '23505');
});

test('one job can hold its own slot and a requested slot at once', async () => {
  const jobId = await newJob();
  await hold({ jobId, date: '2030-02-07', start: '10:00' });
  await hold({ jobId, date: '2030-02-08', start: '14:00', purpose: 'requested' });
  const row = await inShop(() => prepare(
    "SELECT count(*)::int AS n FROM workshop_capacity_holds WHERE workshop_job_id = ? AND state IN ('held', 'confirmed')"
  ).get(jobId));
  assert.equal(row.n, 2);
});

test('a job cannot hold two live requested holds at once', async () => {
  const jobId = await newJob();
  await hold({ jobId, date: '2030-02-09', start: '09:00', purpose: 'requested' });
  await assert.rejects(
    hold({ jobId, date: '2030-02-10', start: '15:00', purpose: 'requested' }),
    (err) => err.code === '23505'
  );
});
