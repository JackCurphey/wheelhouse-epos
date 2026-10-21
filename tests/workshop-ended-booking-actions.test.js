// A booking that has ended (cancelled by the customer or by staff, declined,
// expired) can't be booked in or started (issue #190 A; Jack's decision 5 in
// docs/decisions/2026-10-15-job-page-fixes.md leaves the server refusal to Mark).
// A bike that is already in the shop is still really there, so collecting it
// stays allowed.
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

let server;

before(async () => {
  server = await startLiveServer();
});

after(async () => {
  if (server) await server.stop();
  await pool.end();
});

const act = (cookie, jobId, action, version) =>
  staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${jobId}/${action}`, { method: 'POST', body: { version } });

async function setup(endedBy, extra = '') {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  await seedMechanic(shop.id);
  const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'scheduled' });
  if (endedBy === 'staff-cancel') {
    const res = await act(cookie, jobId, 'cancel', 1);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  } else {
    const sql = {
      'customer-cancel': "booking_state = 'cancelled', cancelled_by = 'customer', cancelled_at = now()",
      declined: "booking_state = 'declined'",
      expired: "booking_state = 'expired'",
    }[endedBy];
    await runWithShop(shop.id, () => prepare(`UPDATE workshop_jobs SET ${sql}${extra} WHERE id = ?`).run(jobId));
  }
  const version = await runWithShop(shop.id, async () => (await prepare('SELECT version FROM workshop_jobs WHERE id = ?').get(jobId)).version);
  return { cookie, shop, jobId, version };
}

for (const endedBy of ['customer-cancel', 'staff-cancel', 'declined', 'expired']) {
  for (const action of ['book-in', 'start', 'hold']) {
    test(`${action} is refused on a booking that ended (${endedBy})`, async () => {
      const { cookie, shop, jobId, version } = await setup(endedBy);
      try {
        const res = await act(cookie, jobId, action, version);
        assert.equal(res.status, 409, JSON.stringify(res.body));
        assert.equal(res.body.code, 'illegal');
        const why = { 'customer-cancel': 'was cancelled', 'staff-cancel': 'was cancelled', declined: 'was declined', expired: 'expired' }[endedBy];
        const what = { 'book-in': 'booked in', start: 'started', hold: 'put on hold' }[action];
        assert.equal(res.body.error, `This booking ${why}, so the job can't be ${what}.`);
      } finally {
        await deleteTestShop(shop.id);
      }
    });
  }
}

test('a bike already in the shop on an ended booking can still be collected', async () => {
  const { cookie, shop, jobId, version } = await setup('declined', ", custody_state = 'in_shop'");
  try {
    const res = await act(cookie, jobId, 'collect', version);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.custodyState, 'collected');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('finished work on an ended booking cannot be reopened', async () => {
  const { cookie, shop, jobId, version } = await setup('expired', ", work_state = 'complete'");
  try {
    const res = await act(cookie, jobId, 'reopen-work', version);
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.equal(res.body.code, 'illegal');
    const after = await runWithShop(shop.id, () => prepare('SELECT work_state FROM workshop_jobs WHERE id = ?').get(jobId));
    assert.equal(after.work_state, 'complete');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a booking request (pending) can still be booked in, as before', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  try {
    const { jobId } = await seedWorkshopJob({ shopId: shop.id, customerId: null, legacyStatus: 'pending' });
    const res = await act(cookie, jobId, 'book-in', 1);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('an ended booking with an out-of-date version is refused as illegal, not stale, and nothing changes', async () => {
  const { cookie, shop, jobId, version } = await setup('customer-cancel');
  try {
    const res = await act(cookie, jobId, 'start', version - 1);
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.equal(res.body.code, 'illegal');
    assert.equal(res.body.error, "This booking was cancelled, so the job can't be started.");
    const after = await runWithShop(shop.id, () => prepare('SELECT version, work_state, custody_state FROM workshop_jobs WHERE id = ?').get(jobId));
    assert.equal(after.version, version);
    assert.equal(after.work_state, 'not_started');
    assert.equal(after.custody_state, 'expected');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('a collected bike on an ended booking can be brought back into the shop', async () => {
  const { cookie, shop, jobId, version } = await setup('declined', ", custody_state = 'collected'");
  try {
    const res = await act(cookie, jobId, 'reopen-custody', version);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.custodyState, 'in_shop');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('work already under way on an ended booking can still be put on hold', async () => {
  const { cookie, shop, jobId, version } = await setup('expired', ", work_state = 'in_progress'");
  try {
    const res = await act(cookie, jobId, 'hold', version);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.workState, 'on_hold');
  } finally {
    await deleteTestShop(shop.id);
  }
});
