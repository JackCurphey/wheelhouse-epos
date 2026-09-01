// The diary's rules, enforced by the server.
//
// Task DS-8. Overlap, opening hours, opening days and the complete-job lock
// all lived only in public/app.js, which means they were suggestions: a raw
// HTTP call skips the browser entirely. Every test here talks to the API
// directly, because that is the only way to prove a rule is real.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { deleteTestShop } from './helpers/testShop.js';
import { staffSignup, staffRequest, seedMechanic, setOpeningDays, TEST_SIGNUP_CODE } from './helpers/staff.js';

const MONDAY = '2026-09-07';
const SUNDAY = '2026-09-06';

let server;

before(async () => {
  server = await startLiveServer({ env: { SIGNUP_CODE: TEST_SIGNUP_CODE } });
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

function postJob(cookie, body) {
  return staffRequest(server.baseUrl, cookie, '/api/workshop-jobs', { method: 'POST', body });
}

test('the server rejects a second job overlapping the same mechanic', async () => {
  const { cookie, shop, mechanicId } = await newShop();
  try {
    const first = await postJob(cookie, {
      title: 'First job', jobDate: MONDAY, startTime: '10:00', endTime: '11:00', mechanicId,
    });
    assert.equal(first.status, 201, `setup failed: ${JSON.stringify(first.body)}`);

    const second = await postJob(cookie, {
      title: 'Double booked', jobDate: MONDAY, startTime: '10:30', endTime: '11:30', mechanicId,
    });
    assert.equal(second.status, 400, 'a double booking was accepted');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the server rejects a job outside the shop opening hours', async () => {
  const { cookie, shop, mechanicId } = await newShop();
  try {
    const res = await postJob(cookie, {
      title: 'Three in the morning', jobDate: MONDAY, startTime: '03:00', endTime: '04:00', mechanicId,
    });
    assert.equal(res.status, 400, 'a job before opening time was accepted');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the server rejects a job on a day the shop is closed', async () => {
  const { cookie, shop, mechanicId } = await newShop();
  try {
    await setOpeningDays(shop.id, [1, 2, 3, 4, 5]); // Monday to Friday
    const res = await postJob(cookie, {
      title: 'Sunday job', jobDate: SUNDAY, startTime: '10:00', endTime: '11:00', mechanicId,
    });
    assert.equal(res.status, 400, 'a job on a closed day was accepted');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('the server rejects an edit to a complete job', async () => {
  const { cookie, shop, mechanicId } = await newShop();
  try {
    const created = await postJob(cookie, {
      title: 'Finished job', jobDate: MONDAY, startTime: '10:00', endTime: '11:00', mechanicId,
      status: 'complete',
    });
    assert.equal(created.status, 201, `setup failed: ${JSON.stringify(created.body)}`);

    const edit = await staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${created.body.id}`, {
      method: 'PUT',
      body: { title: 'Edited after completion' },
    });
    assert.equal(edit.status, 400, 'a complete job was edited');
  } finally {
    await deleteTestShop(shop.id);
  }
});

test('reopening a complete job is still allowed', async () => {
  const { cookie, shop, mechanicId } = await newShop();
  try {
    const created = await postJob(cookie, {
      title: 'Finished job', jobDate: MONDAY, startTime: '10:00', endTime: '11:00', mechanicId,
      status: 'complete',
    });
    assert.equal(created.status, 201, `setup failed: ${JSON.stringify(created.body)}`);

    const reopened = await staffRequest(server.baseUrl, cookie, `/api/workshop-jobs/${created.body.id}`, {
      method: 'PUT',
      body: { status: 'scheduled' },
    });
    assert.equal(reopened.status, 200, `reopening was rejected: ${JSON.stringify(reopened.body)}`);
  } finally {
    await deleteTestShop(shop.id);
  }
});
