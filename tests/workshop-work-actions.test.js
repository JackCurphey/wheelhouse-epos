// The work machine over HTTP, and the one state change that does not come from
// a person pressing a button: tendering the order for a job is the shop saying
// the work is done, so it has to go through the machine like every other
// finish rather than writing 'complete' straight to the column.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { seedWorkshopJob } from './helpers/workshopFixtures.js';
import { deleteTestShop } from './helpers/testShop.js';

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
  // A cashier is a different flag from a mechanic (resolveCashierId checks
  // is_cashier), and the convert route refuses an unknown one.
  const cashierId = await runWithShop(shop.id, async () => {
    const { lastInsertRowid } = await prepare(
      "INSERT INTO employees (name, is_cashier, active) VALUES ('Test Cashier', 1, 1)"
    ).run();
    return lastInsertRowid;
  });
  return { cookie, shop, mechanicId, cashierId };
}

const act = (cookie, jobId, action, version) =>
  staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${jobId}/${action}`, {
    method: 'POST',
    body: { version },
  });

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

test('a job cannot resume unless it is on hold', async () => {
  const { cookie, shop } = await newShop();
  try {
    const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'scheduled' });
    const res = await act(cookie, jobId, 'resume', 1);
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.match(res.body.error, /cannot resume a job that is not_started/);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('waiting for parts shows as waiting_parts to the old diary', async () => {
  const { cookie, shop } = await newShop();
  try {
    const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'scheduled' });
    const job = await walk(cookie, jobId, ['start', 'await-parts']);
    assert.equal(job.workState, 'waiting_parts');
    assert.equal(job.status, 'waiting_parts', 'the derived column must follow, or the old diary lies');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('holding and resuming round-trips through the machine', async () => {
  const { cookie, shop } = await newShop();
  try {
    const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'scheduled' });
    const held = await walk(cookie, jobId, ['start', 'hold']);
    assert.equal(held.workState, 'on_hold');
    assert.equal(held.status, 'on_hold');
    const resumed = await act(cookie, jobId, 'resume', held.version);
    assert.equal(resumed.status, 200, JSON.stringify(resumed.body));
    assert.equal(resumed.body.workState, 'in_progress');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('tendering the linked order finishes the work through the machine', async () => {
  const { cookie, shop, mechanicId, cashierId } = await newShop();
  try {
    const created = await staffRequest(server.baseUrl, cookie, '/api/workshop-jobs', {
      method: 'POST',
      body: { title: 'Tender me', jobDate: MONDAY, startTime: '10:00', endTime: '11:00', mechanicId },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const jobId = created.body.id;
    const orderId = created.body.orderId;
    assert.ok(orderId, 'a workshop job is created with a linked order');

    const started = await walk(cookie, jobId, ['book-in', 'start']);

    const converted = await staffRequest(server.baseUrl, cookie, `/api/sale-documents/${orderId}/convert`, {
      method: 'POST',
      body: { cashierId, cashAmount: 0, cashTendered: 0 },
    });
    assert.equal(converted.status, 201, JSON.stringify(converted.body));

    const job = await staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${jobId}`);
    assert.equal(job.body.workState, 'complete');
    assert.ok(
      job.body.version > started.version,
      'the convert path must go through applyEvent, which bumps the version'
    );
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('tendering an order for work that never started is refused, not forced', async () => {
  // A job still not_started has no 'finish' event. The convert must report that
  // rather than writing 'complete' behind the machine's back - which is exactly
  // what the old single status column allowed.
  const { cookie, shop, mechanicId, cashierId } = await newShop();
  try {
    const created = await staffRequest(server.baseUrl, cookie, '/api/workshop-jobs', {
      method: 'POST',
      body: { title: 'Never started', jobDate: MONDAY, startTime: '12:00', endTime: '13:00', mechanicId },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const converted = await staffRequest(server.baseUrl, cookie, `/api/sale-documents/${created.body.orderId}/convert`, {
      method: 'POST',
      body: { cashierId, cashAmount: 0, cashTendered: 0 },
    });
    assert.equal(converted.status, 409, JSON.stringify(converted.body));
    assert.match(converted.body.error, /cannot finish a job that is not_started/);
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a cancelled job is not frozen against edits the way finished work is', async () => {
  // The derived status reads 'complete' for a cancelled booking, and the
  // frozen-job guard used to key off that column. Freezing a cancelled job
  // against edits is a behaviour change nobody asked for.
  const { cookie, shop } = await newShop();
  try {
    const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'scheduled' });
    const cancelled = await act(cookie, jobId, 'cancel', 1);
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
    assert.equal(cancelled.body.status, 'complete');

    const edited = await staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${jobId}`, {
      method: 'PUT',
      body: { title: 'Renamed after cancelling' },
    });
    assert.equal(edited.status, 200, `a cancelled job must still be editable: ${JSON.stringify(edited.body)}`);
    assert.equal(edited.body.title, 'Renamed after cancelling');
  } finally {
    await deleteTestShop(shop.id);
  }
});
