// One endpoint per thing a person does to a booking, guarded by the Phase 1
// machine and by the version column.
//
// Failure cases first, deliberately. An illegal move and a lost race are both
// 409 but mean different things, and a screen can only offer "reload and look
// again" for the second if the server distinguishes them.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { seedWorkshopJob } from './helpers/workshopFixtures.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;

before(async () => {
  server = await startLiveServer();
});

after(async () => {
  if (server) await server.stop();
  await pool.end();
});

async function newShop() {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const mechanicId = await seedMechanic(shop.id);
  return { cookie, shop, mechanicId };
}

const act = (cookie, jobId, action, body) =>
  staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${jobId}/${action}`, { method: 'POST', body });

const read = (cookie, jobId) =>
  staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${jobId}`);

test('accepting a job that is already scheduled is a 409, not a 400', async () => {
  const { cookie, shop } = await newShop();
  try {
    const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'scheduled' });
    const res = await act(cookie, jobId, 'accept', { version: 1 });
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.match(res.body.error, /cannot accept a job that is scheduled/);
    // The screen reads the code, never the wording: an illegal move is not retried.
    assert.equal(res.body.code, 'illegal');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a stale version is refused with 409 and a reload message', async () => {
  const { cookie, shop } = await newShop();
  try {
    const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'pending' });
    const first = await act(cookie, jobId, 'accept', { version: 1 });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const second = await act(cookie, jobId, 'cancel', { version: 1 });
    assert.equal(second.status, 409);
    assert.match(second.body.error, /changed while you were looking at it/);
    assert.equal(second.body.code, 'stale');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a missing version is a 400 - the caller must say what it saw', async () => {
  const { cookie, shop } = await newShop();
  try {
    const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'pending' });
    const res = await act(cookie, jobId, 'accept', {});
    assert.equal(res.status, 400);
    assert.match(res.body.error, /version is required/);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test("another shop's job is 404, not 403", async () => {
  const { shop } = await newShop();
  const other = await newShop();
  try {
    const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'pending' });
    const res = await act(other.cookie, jobId, 'accept', { version: 1 });
    assert.equal(res.status, 404);
  } finally {
    await deleteTestShop(shop.id);
    await deleteTestShop(other.shop.id);
  }
});

test('accepting a pending request schedules it and the old column follows', async () => {
  const { cookie, shop } = await newShop();
  try {
    const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'pending' });
    const res = await act(cookie, jobId, 'accept', { version: 1 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.bookingState, 'scheduled');
    assert.equal(res.body.status, 'scheduled', 'the derived column must follow, or the old diary lies');
    assert.equal(res.body.version, 2, 'the caller needs the new version for its next action');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('cancelling keeps the record and reads as complete to the old diary', async () => {
  const { cookie, shop } = await newShop();
  try {
    const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'scheduled' });
    const res = await act(cookie, jobId, 'cancel', { version: 1 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.bookingState, 'cancelled');
    assert.equal(res.body.status, 'complete');

    const still = await read(cookie, jobId);
    assert.equal(still.status, 200, 'a cancelled job is kept, not deleted');
    assert.equal(still.body.bookingState, 'cancelled');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('declining and expiring are their own endpoints, and are terminal', async () => {
  const { cookie, shop } = await newShop();
  try {
    const declined = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'pending' });
    const d = await act(cookie, declined.jobId, 'decline', { version: 1 });
    assert.equal(d.status, 200, JSON.stringify(d.body));
    assert.equal(d.body.bookingState, 'declined');
    // declined is a rest state with no way out.
    const again = await act(cookie, declined.jobId, 'accept', { version: d.body.version });
    assert.equal(again.status, 409);

    const expired = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'pending' });
    const e = await act(cookie, expired.jobId, 'expire', { version: 1 });
    assert.equal(e.status, 200, JSON.stringify(e.body));
    assert.equal(e.body.bookingState, 'expired');
  } finally {
    await deleteTestShop(shop.id);
  }
});
