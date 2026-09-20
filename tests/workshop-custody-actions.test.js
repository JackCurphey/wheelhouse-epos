// Custody is where the physical bike is; work is what the mechanic is doing.
// They are separate machines because they are separate facts - a finished bike
// is still in the shop until someone collects it - and encoding one inside the
// other is what produced the ambiguous single status column these replace.
//
// So the cases that matter here are the ones that would pass either way if the
// two were conflated, and fail the moment they are.
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
  await seedMechanic(shop.id);
  return { cookie, shop };
}

const act = (cookie, jobId, action, version) =>
  staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${jobId}/${action}`, {
    method: 'POST',
    body: { version },
  });

// Walks a job through a sequence of actions, carrying the version forward.
// Returns the final body.
async function walk(cookie, jobId, actions) {
  let version = 1;
  let body;
  for (const action of actions) {
    const res = await act(cookie, jobId, action, version);
    assert.equal(res.status, 200, `${action} failed: ${JSON.stringify(res.body)}`);
    body = res.body;
    version = body.version;
  }
  return body;
}

test('a bike cannot be collected before it is booked in', async () => {
  const { cookie, shop } = await newShop();
  try {
    const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'scheduled' });
    const res = await act(cookie, jobId, 'collect', 1);
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.match(res.body.error, /cannot collect a job that is expected/);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('finishing the work does not collect the bike', async () => {
  const { cookie, shop } = await newShop();
  try {
    const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'scheduled' });
    const job = await walk(cookie, jobId, ['book-in', 'start', 'finish']);
    assert.equal(job.workState, 'complete');
    assert.equal(job.custodyState, 'in_shop', 'a finished bike is still in the shop until someone collects it');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('collecting a bike whose work is done leaves the work alone', async () => {
  const { cookie, shop } = await newShop();
  try {
    const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'scheduled' });
    const job = await walk(cookie, jobId, ['book-in', 'start', 'finish', 'collect']);
    assert.equal(job.custodyState, 'collected');
    assert.equal(job.workState, 'complete');
    assert.equal(job.status, 'complete');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a bike can be collected before the work is finished', async () => {
  // The customer changes their mind and takes the bike away unrepaired. Custody
  // rests; work does not. A single status column could not say this at all.
  const { cookie, shop } = await newShop();
  try {
    const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'scheduled' });
    const job = await walk(cookie, jobId, ['book-in', 'start', 'collect']);
    assert.equal(job.custodyState, 'collected');
    assert.equal(job.workState, 'in_progress');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('reopen-custody brings a collected bike back without touching the work', async () => {
  const { cookie, shop } = await newShop();
  try {
    const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'scheduled' });
    const job = await walk(cookie, jobId, ['book-in', 'start', 'finish', 'collect', 'reopen-custody']);
    assert.equal(job.custodyState, 'in_shop');
    assert.equal(job.workState, 'complete', 'the bike came back; the work that was done is still done');
  } finally {
    await deleteTestShop(shop.id);
  }
});
