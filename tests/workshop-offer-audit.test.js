// Offering another time: the cases the 22 Oct audit found untested
// (docs/reviews/2026-10-22-flagged-merges-audit.md, missing tests item 4;
// Jack, 20 Oct, docs/decisions/2026-10-20-offer-another-time.md; the
// workshop-jobs spec's "The shop can offer a request another time" and the
// book spec's "Accepting the offer").
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
import { jsonRequest } from './helpers/http.js';
import { linkActions, bookOnline, liveHolds, jobRow, dayMaker } from './helpers/linkActions.js';

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
const book = (jobDate = nextDay(), startTime = '10:00') => bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
  mechanicId: sam, jobDate, startTime, serviceIds: [types.repair],
});
const version = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body.version;
const act = async (id, action, body = {}) => staff(`/api/workshop-jobs/${id}/${action}`, { method: 'POST', body: { version: await version(id), ...body } });
const acceptOffer = (code, body = {}) => jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/booking-links/${code}/accept-offer`, { method: 'POST', body });
const shopId = () => owner.shop.id;

// The offer race (audit P2 finding 2; Jack, 22 Oct, built in #396): the
// customer's accept carries the date and time their page shows, and is refused
// if the shop has offered a different one since.
test('accepting after staff offered a different time is refused, and the new offer still waits', async () => {
  const booked = await book(nextDay(), '10:00');
  const first = nextDay();
  assert.equal((await act(booked.id, 'offer', { jobDate: first, startTime: '12:00', mechanicId: alex })).status, 200);
  const seen = (await link.read(booked.code)).body;
  assert.equal(seen.jobDate, first);
  const second = nextDay();
  assert.equal((await act(booked.id, 'offer', { jobDate: second, startTime: '09:00', mechanicId: sam })).status, 200);
  const res = await acceptOffer(booked.code, { jobDate: seen.jobDate, startTime: seen.startTime });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'stale');
  const row = await jobRow(shopId(), booked.id);
  assert.equal(row.booking_state, 'offered');
  assert.equal(row.job_date, second);
});

test('staff can’t move an offered booking by saving the job, so an accept can only ever confirm the time shown', async () => {
  const booked = await book(nextDay(), '10:00');
  assert.equal((await act(booked.id, 'offer', { jobDate: nextDay(), startTime: '12:00', mechanicId: alex })).status, 200);
  const seen = (await link.read(booked.code)).body;
  // As the diary's drag saves it: everything but the status (the save refuses one).
  const { status, ...job } = (await staff(`/api/workshop-jobs/${booked.id}`)).body;
  const saved = await staff(`/api/workshop-jobs/${booked.id}`, { method: 'PUT', body: { ...job, jobDate: nextDay() } });
  assert.equal(saved.status, 409, JSON.stringify(saved.body));
  assert.equal(saved.body.code, 'illegal');
  const row = await jobRow(shopId(), booked.id);
  assert.equal(row.job_date, seen.jobDate, 'the save did not move it');
  assert.equal(row.booking_state, 'offered');
  const res = await acceptOffer(booked.code, { jobDate: seen.jobDate, startTime: seen.startTime });
  assert.equal(res.status, 200, JSON.stringify(res.body));
});

// Only a request still waiting (pending or offered) can be offered a time.
for (const [closing, how] of [['cancelled', 'cancel'], ['declined', 'decline'], ['expired', 'expire']]) {
  test(`${closing === 'expired' ? 'an' : 'a'} ${closing} booking can’t be offered another time, and nothing moves`, async () => {
    const asked = nextDay();
    const booked = await book(asked, '11:00');
    const closed = await act(booked.id, how);
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.equal(closed.body.bookingState, closing);
    const res = await act(booked.id, 'offer', { jobDate: nextDay(), startTime: '14:00', mechanicId: alex });
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.equal(res.body.code, 'illegal');
    const row = await jobRow(shopId(), booked.id);
    assert.equal(row.booking_state, closing);
    assert.equal(row.job_date, asked);
    assert.equal(row.offered_from_date, null);
    assert.deepEqual(await liveHolds(shopId(), booked.id), []);
  });
}

test('the shop can let an offered time expire: its time goes and the customer can no longer accept it', async () => {
  const booked = await book(nextDay(), '12:00');
  assert.equal((await act(booked.id, 'offer', { jobDate: nextDay(), startTime: '15:00', mechanicId: alex })).status, 200);
  assert.equal((await liveHolds(shopId(), booked.id)).length, 1);
  const res = await act(booked.id, 'expire');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.bookingState, 'expired');
  assert.equal(res.body.offer, null);
  assert.deepEqual(await liveHolds(shopId(), booked.id), []);
  const late = await acceptOffer(booked.code);
  assert.equal(late.status, 409, JSON.stringify(late.body));
  assert.equal(late.body.code, 'illegal');
  assert.equal((await jobRow(shopId(), booked.id)).booking_state, 'expired');
});

// Audit item 20 (#337): the offer's mechanic is checked before the booking
// lock and must be checked again under it. The test holds the offered day's
// lock itself, sends the offer (which passes the first check and then waits),
// switches the mechanic off, and lets the lock go.
test('a mechanic switched off while the offer waits for the lock doesn’t get the job', async () => {
  const gone = await seedMechanic(owner.shop.id, { name: 'Leaving' });
  const booked = await book(nextDay(), '10:00');
  const offeredDay = nextDay();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::int, $2::int)', [owner.shop.id, Number(offeredDay.replace(/-/g, ''))]);
    let settled = false;
    const pending = act(booked.id, 'offer', { jobDate: offeredDay, startTime: '13:00', mechanicId: gone }).then((r) => { settled = true; return r; });
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(settled, false, 'the offer did not wait for the lock');
    await runWithShop(owner.shop.id, () => prepare('UPDATE employees SET active = 0 WHERE id = ?').run(gone));
    await client.query('COMMIT');
    const res = await pending;
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.error, 'Please choose a mechanic');
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
  const row = await jobRow(shopId(), booked.id);
  assert.equal(row.booking_state, 'pending');
  assert.notEqual(Number(row.mechanic_id), gone);
});
