// A job's life: created, read back, deleted.
//
// Task DS-9. The diary-rule tests exercise creation heavily, but only through
// the rules that reject it - nothing covered a job simply working. The part
// worth pinning down is the linked order: every job silently creates one so it
// is findable from the Orders page, and deleting the job detaches that order
// rather than taking it with it. A shop that has already put parts on an order
// should not lose them because someone tidied up the diary.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { deleteTestShop } from './helpers/testShop.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';

const MONDAY = '2026-09-07';

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

function createJob(cookie, mechanicId, overrides = {}) {
  return staffRequest(server.baseUrl, cookie, '/api/workshop-jobs', {
    method: 'POST',
    body: {
      title: 'Gear cable', jobDate: MONDAY, startTime: '10:00', endTime: '11:00',
      mechanicId, ...overrides,
    },
  });
}

function ordersFor(shopId, jobId) {
  return runWithShop(shopId, () =>
    prepare('SELECT id, workshop_job_id FROM sale_documents WHERE workshop_job_id = ?').all(jobId)
  );
}

test('a job can be created and read back', async () => {
  const { cookie, shop, mechanicId } = await newShop();
  try {
    const created = await createJob(cookie, mechanicId, { notes: 'Rear mech skipping' });
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const fetched = await staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${created.body.id}`);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.title, 'Gear cable');
    assert.equal(fetched.body.jobDate, MONDAY);
    assert.equal(fetched.body.notes, 'Rear mech skipping');
    assert.equal(fetched.body.mechanicId, mechanicId);
    assert.equal(fetched.body.status, 'scheduled');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a new job appears in the diary for its date range', async () => {
  const { cookie, shop, mechanicId } = await newShop();
  try {
    const created = await createJob(cookie, mechanicId);
    assert.equal(created.status, 201);

    const inRange = await staffRequest(server.baseUrl, cookie, `/api/workshop-jobs?start=${MONDAY}&end=${MONDAY}`);
    assert.equal(inRange.body.length, 1);
    assert.equal(inRange.body[0].id, created.body.id);

    const outOfRange = await staffRequest(server.baseUrl, cookie, '/api/workshop-jobs?start=2026-10-01&end=2026-10-02');
    assert.equal(outOfRange.body.length, 0, 'a job outside the range was returned');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('creating a job creates the order that makes it billable', async () => {
  const { cookie, shop, mechanicId } = await newShop();
  try {
    const created = await createJob(cookie, mechanicId);
    assert.equal(created.status, 201);
    assert.ok(created.body.orderId, 'no linked order was created');

    const orders = await ordersFor(shop.id, created.body.id);
    assert.equal(orders.length, 1);
    assert.equal(orders[0].id, created.body.orderId);
  } finally {
    await deleteTestShop(shop.id);
  }
});

// Workshop-only mode (PF-2): a shop using us for the diary but ringing up
// somewhere else has no till of ours for an order to be billed at.
test('a job can be created without an order at all', async () => {
  const { cookie, shop, mechanicId } = await newShop();
  try {
    const created = await createJob(cookie, mechanicId, { skipAutoOrder: true });
    assert.equal(created.status, 201);
    assert.equal(created.body.orderId, null, 'an order was created anyway');

    const orders = await ordersFor(shop.id, created.body.id);
    assert.equal(orders.length, 0);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('deleting a job keeps its order, detached', async () => {
  const { cookie, shop, mechanicId } = await newShop();
  try {
    const created = await createJob(cookie, mechanicId);
    assert.equal(created.status, 201);
    const orderId = created.body.orderId;

    const removed = await staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${created.body.id}`, { method: 'DELETE' });
    assert.equal(removed.status, 200);

    const gone = await staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${created.body.id}`);
    assert.equal(gone.status, 404);

    // The order survives with nothing pointing at it - parts already added to
    // it are not destroyed by tidying up the diary.
    const survivor = await runWithShop(shop.id, () =>
      prepare('SELECT id, workshop_job_id FROM sale_documents WHERE id = ?').get(orderId)
    );
    assert.ok(survivor, 'the order was deleted along with the job');
    assert.equal(survivor.workshop_job_id, null, 'the order still points at a job that no longer exists');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('deleting a job that does not exist is a 404, not a crash', async () => {
  const { cookie, shop } = await newShop();
  try {
    const removed = await staffRequest(server.baseUrl, cookie, '/api/workshop-jobs/99999999', { method: 'DELETE' });
    assert.equal(removed.status, 404);
  } finally {
    await deleteTestShop(shop.id);
  }
});
