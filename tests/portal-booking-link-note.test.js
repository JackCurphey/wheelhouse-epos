// The shop's additional note on the confirmation (Jack, 19 Oct,
// docs/decisions/2026-10-19-confirmation-note.md; openspec/changes/confirmation-note):
// each shop writes its own, starting with the drawn sentence; a booking that
// stands carries it on its link.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { seedJobTypes, BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let owner;
let sam;
let types;
let customer;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

let n = 0;
const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
async function book() {
  const res = await portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: { mechanicId: sam, jobDate: futureDate(1 + (n++ % 5)), startTime: n % 2 ? '10:00' : '14:00', description: 'Squeaky brakes', newBike: { make: 'Trek', model: 'Domane AL 3' }, serviceIds: [types.service], ...BOOKING_CONTACT },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const code = res.body.privateLink.split('/').pop();
  const job = await runWithShop(owner.shop.id, () => prepare('SELECT id FROM workshop_jobs WHERE reference = ?').get(res.body.reference));
  return { code, id: job.id };
}
const read = (code) => jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/booking-links/${code}`);
const setJob = (id, sql, ...args) => runWithShop(owner.shop.id, () => prepare(`UPDATE workshop_jobs SET ${sql} WHERE id = ?`).run(...args, id));
const settings = (body) => staff('/api/workshop-settings', { method: 'PUT', body });

const DRAWN = 'Please bring the lock key, and tell us about any accessories.';
const STANDS = "booking_state = 'scheduled', custody_state = 'expected', work_state = 'not_started', start_time = '11:30'";

test('every shop starts with the drawn sentence', async () => {
  assert.equal((await staff('/api/workshop-settings')).body.confirmationNote, DRAWN);
});

test('the note saves trimmed, can be emptied, and keeps its place when not sent', async () => {
  try {
    const saved = await settings({ confirmationNote: '  Park round the back and ring the bell.  ' });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.confirmationNote, 'Park round the back and ring the bell.');
    assert.equal((await settings({ timedLeadMinutes: 30 })).body.confirmationNote, 'Park round the back and ring the bell.');
    assert.equal((await settings({ confirmationNote: '   ' })).body.confirmationNote, '');
  } finally {
    await settings({ confirmationNote: DRAWN });
  }
});

test('a note over 300 characters, or not text, is refused', async () => {
  try {
    const long = await settings({ confirmationNote: 'x'.repeat(301) });
    assert.equal(long.status, 400);
    assert.equal(long.body.error, 'The note can be up to 300 characters');
    assert.equal((await settings({ confirmationNote: 'x'.repeat(300) })).status, 200);
    const notText = await settings({ confirmationNote: 42 });
    assert.equal(notText.status, 400);
    assert.equal(notText.body.error, 'The note must be text');
  } finally {
    await settings({ confirmationNote: DRAWN });
  }
});

test('a confirmed booking, or one with a change waiting, carries the note', async () => {
  const { code, id } = await book();
  await setJob(id, STANDS);
  assert.equal((await read(code)).body.confirmationNote, DRAWN);
  await setJob(id, "booking_state = 'reschedule_requested', requested_job_date = job_date, requested_start_time = '14:00', requested_end_time = '15:00'");
  assert.equal((await read(code)).body.confirmationNote, DRAWN, 'change waiting');
});

test('a request waiting, a bike in, or an empty note carries none', async () => {
  const { code, id } = await book();
  await setJob(id, "booking_state = 'pending', custody_state = 'expected'");
  assert.equal((await read(code)).body.confirmationNote, null, 'request waiting');
  await setJob(id, "booking_state = 'scheduled', custody_state = 'in_shop', work_state = 'in_progress'");
  assert.equal((await read(code)).body.confirmationNote, null, 'bike in');
  await setJob(id, STANDS);
  try {
    await settings({ confirmationNote: '' });
    assert.equal((await read(code)).body.confirmationNote, null, 'empty note');
  } finally {
    await settings({ confirmationNote: DRAWN });
  }
});

test('a set-time shop’s job with no time still carries the note', async () => {
  const { code, id } = await book();
  await setJob(id, "booking_state = 'scheduled', custody_state = 'expected', work_state = 'not_started', start_time = NULL, end_time = NULL");
  const view = (await read(code)).body;
  assert.equal(view.dropOff, null);
  assert.equal(view.confirmationNote, DRAWN);
});
