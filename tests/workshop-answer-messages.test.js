// Booking messages and staff answers: the cases the 22 Oct audit found
// untested (docs/reviews/2026-10-22-flagged-merges-audit.md, missing tests
// items 5 and 7; Jack, 20 Oct, docs/decisions/2026-10-20-booking-messages.md
// answers 4 and 5; the messages spec). A refused answer changes nothing, so it
// sends nothing; the reply tells staff when the customer can't be reached, and
// says nothing when the message is switched off.
// Link calls in this file must stay under 30 (the limiter is per server).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import { linkActions, bookOnline, seedRequest, dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let sam;
let alex;
let types;
let customer;
let link;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  link = linkActions(server.baseUrl, owner.shop.slug);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const version = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body.version;
const act = async (id, action, body = {}) => staff(`/api/workshop-jobs/${id}/${action}`, { method: 'POST', body: { version: await version(id), ...body } });
const messagesFor = (jobId) => runWithShop(owner.shop.id, () => prepare('SELECT template_key FROM customer_messages WHERE job_id = ? ORDER BY id').all(jobId))
  .then((rows) => rows.map((r) => r.template_key));
const book = (jobDate = nextDay(), startTime = '10:00', who = customer) => bookOnline(server.baseUrl, who.cookie, owner.shop.slug, {
  mechanicId: sam, jobDate, startTime, serviceIds: [types.service],
});
const switchMessage = (key, enabled) => staff(`/api/message-templates/${key}`, { method: 'PUT', body: { enabled } });
// A booking whose customer then has no phone number or email on file.
const unreachable = async (jobDate, startTime) => {
  const quiet = await portalSignup(server.baseUrl, owner.shop.slug, {});
  const booked = await book(jobDate, startTime, quiet);
  await runWithShop(owner.shop.id, async () => {
    const { customer_id: id } = await prepare('SELECT customer_id FROM workshop_jobs WHERE id = ?').get(booked.id);
    await prepare('UPDATE customers SET phone = NULL, email = NULL WHERE id = ?').run(id);
  });
  return booked;
};

// Item 5: a refused answer queues no message.
test('an out-of-date accept sends nothing', async () => {
  const booked = await book(nextDay(), '10:00');
  const res = await staff(`/api/workshop-jobs/${booked.id}/accept`, { method: 'POST', body: { version: (await version(booked.id)) - 1 } });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'stale');
  assert.equal(res.body.bookingMessage, undefined);
  assert.deepEqual(await messagesFor(booked.id), []);
});

test('an accept refused for a busy mechanic sends nothing', async () => {
  const day = nextDay();
  const busy = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Already booked', jobDate: day, startTime: '11:00', endTime: '12:00', mechanicId: alex } });
  assert.equal(busy.status, 201, JSON.stringify(busy.body));
  const booked = await book(day, '11:00');
  const res = await act(booked.id, 'accept', { mechanicId: alex });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /That mechanic is already booked/);
  assert.deepEqual(await messagesFor(booked.id), []);
});

test('an out-of-date offer, or one for a time already taken, sends nothing', async () => {
  const day = nextDay();
  const first = await book(day, '10:00');
  const second = await book(day, '14:00');
  const stale = await staff(`/api/workshop-jobs/${second.id}/offer`, {
    method: 'POST', body: { version: (await version(second.id)) - 1, jobDate: nextDay(), startTime: '12:00', mechanicId: sam },
  });
  assert.equal(stale.status, 409, JSON.stringify(stale.body));
  assert.equal(stale.body.code, 'stale');
  const taken = await act(second.id, 'offer', { jobDate: day, startTime: '10:00', mechanicId: sam });
  assert.equal(taken.status, 409, JSON.stringify(taken.body));
  assert.equal(taken.body.code, 'capacity');
  assert.deepEqual(await messagesFor(second.id), []);
  assert.deepEqual(await messagesFor(first.id), []);
  // The same offer made properly does send, so the silence above is the refusal's.
  assert.equal((await act(second.id, 'offer', { jobDate: nextDay(), startTime: '12:00', mechanicId: sam })).status, 200);
  assert.deepEqual(await messagesFor(second.id), ['time_offered']);
});

test('an out-of-date accept-change, or one for a time since taken, sends nothing more', async () => {
  const booked = await book(nextDay(), '09:00');
  assert.equal((await act(booked.id, 'accept')).status, 200);
  const asked = await link.change(booked.code, { jobDate: nextDay(), startTime: '15:00', mechanicId: sam });
  assert.equal(asked.status, 200, JSON.stringify(asked.body));
  const stale = await staff(`/api/workshop-jobs/${booked.id}/accept-change`, { method: 'POST', body: { version: (await version(booked.id)) - 1 } });
  assert.equal(stale.status, 409, JSON.stringify(stale.body));
  assert.equal(stale.body.code, 'stale');
  assert.deepEqual(await messagesFor(booked.id), ['booking_confirmed']);

  // A request onto a time another job has (seeded, as the change route would
  // have refused it): staff accepting it are told the time has gone.
  const day = nextDay();
  const other = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Already booked', jobDate: day, startTime: '14:00', endTime: '15:00', mechanicId: sam } });
  assert.equal(other.status, 201, JSON.stringify(other.body));
  const later = await book(nextDay(), '09:00');
  assert.equal((await act(later.id, 'accept')).status, 200);
  await seedRequest(owner.shop.id, later.id, { jobDate: day, mechanicId: sam, startTime: '14:30', endTime: '15:30' });
  const gone = await act(later.id, 'accept-change');
  assert.equal(gone.status, 409, JSON.stringify(gone.body));
  assert.equal(gone.body.code, 'capacity');
  assert.deepEqual(await messagesFor(later.id), ['booking_confirmed']);
});

// Item 7: what the reply tells staff.
test('accepting a date change for a customer with no way to reach them says so, by name', async () => {
  const booked = await unreachable(nextDay(), '11:00');
  assert.equal((await act(booked.id, 'accept')).status, 200);
  const asked = await link.change(booked.code, { jobDate: nextDay(), startTime: '15:00', mechanicId: sam });
  assert.equal(asked.status, 200, JSON.stringify(asked.body));
  const res = await act(booked.id, 'accept-change');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.bookingMessage, { skipped: 'no_contact', name: 'Date change answered' });
  assert.deepEqual(await messagesFor(booked.id), []);
});

test('a message switched off leaves the reply saying nothing about it', async () => {
  try {
    assert.equal((await switchMessage('booking_confirmed', false)).status, 200);
    assert.equal((await switchMessage('date_change_answered', false)).status, 200);
    const booked = await book(nextDay(), '12:00');
    const accepted = await act(booked.id, 'accept');
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.equal('bookingMessage' in accepted.body, false, JSON.stringify(accepted.body.bookingMessage));
    const asked = await link.change(booked.code, { jobDate: nextDay(), startTime: '15:00', mechanicId: sam });
    assert.equal(asked.status, 200, JSON.stringify(asked.body));
    const changed = await act(booked.id, 'accept-change');
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    assert.equal('bookingMessage' in changed.body, false, JSON.stringify(changed.body.bookingMessage));
    assert.deepEqual(await messagesFor(booked.id), []);
  } finally {
    await switchMessage('booking_confirmed', true);
    await switchMessage('date_change_answered', true);
  }
});
