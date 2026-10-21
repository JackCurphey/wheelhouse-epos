// A staff answer to a booking (cancel, decline) and deleting a job each write
// several rows. They commit together or not at all, under the job's booking
// lock; a fault midway, or a payment landing midway, must not leave half of it.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
before(async () => { server = await startLiveServer(); });
after(async () => {
  if (server) await server.stop();
  await pool.end();
});

const admin = async () => {
  const client = new pg.Client({ connectionString: process.env.ADMIN_DATABASE_URL.replace(/\/[^/]*$/, new URL(process.env.DATABASE_URL).pathname) });
  await client.connect();
  return client;
};
const jobRow = (shopId, id) => runWithShop(shopId, () => prepare('SELECT * FROM workshop_jobs WHERE id = ?').get(id));
const liveHolds = (shopId, id) => runWithShop(shopId, () =>
  prepare("SELECT id FROM workshop_capacity_holds WHERE workshop_job_id = ? AND state IN ('held', 'confirmed')").all(id));

test('a cancel or decline that fails after the state change leaves the booking and its hold as they were', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const req = (path, options) => staffRequest(server.baseUrl, cookie, path, options);
  const mechanic = await seedMechanic(shop.id);
  const make = async (status, startTime) => {
    const res = await req('/api/workshop-jobs', { method: 'POST', body: { title: 'Service', jobDate: '2026-10-13', startTime, mechanicId: mechanic, status } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body;
  };
  const toCancel = await make('scheduled', '09:00');
  const toDecline = await make('pending', '11:00');
  const holdsBefore = [(await liveHolds(shop.id, toCancel.id)).length, (await liveHolds(shop.id, toDecline.id)).length];
  assert.deepEqual(holdsBefore, [1, 1], 'setup: each live job holds its time');

  const db = await admin();
  const fn = `refuse_answer_${shop.id}`;
  await db.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id IN (${toCancel.id}, ${toDecline.id}) AND (NEW.cancelled_by IS NOT NULL OR NEW.decline_message IS NOT NULL) THEN RAISE EXCEPTION 'refused for this test'; END IF; RETURN NEW; END $$`);
  await db.query(`CREATE TRIGGER ${fn} BEFORE UPDATE ON workshop_jobs FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
  try {
    const cancel = await req(`/api/workshop-jobs/${toCancel.id}/cancel`, { method: 'POST', body: { version: toCancel.version } });
    assert.equal(cancel.status, 500, JSON.stringify(cancel.body));
    const decline = await req(`/api/workshop-jobs/${toDecline.id}/decline`, { method: 'POST', body: { version: toDecline.version, message: 'Sorry, we are full' } });
    assert.equal(decline.status, 500, JSON.stringify(decline.body));

    const cancelled = await jobRow(shop.id, toCancel.id);
    assert.deepEqual([cancelled.booking_state, cancelled.version, cancelled.cancelled_by], ['scheduled', toCancel.version, null]);
    const declined = await jobRow(shop.id, toDecline.id);
    assert.deepEqual([declined.booking_state, declined.version, declined.decline_message], ['pending', toDecline.version, null]);
    assert.equal((await liveHolds(shop.id, toCancel.id)).length, 1, 'the cancelled job still holds its time');
    assert.equal((await liveHolds(shop.id, toDecline.id)).length, 1, 'the declined job still holds its time');
  } finally {
    await db.query(`DROP TRIGGER ${fn} ON workshop_jobs`);
    await db.query(`DROP FUNCTION ${fn}()`);
    await db.end();
    await deleteTestShop(shop.id);
  }
});

test('deleting a job while its order is being paid is refused, not a paid order cut loose', async () => {
  const { cookie, shop } = await staffSignup(server.baseUrl);
  const req = (path, options) => staffRequest(server.baseUrl, cookie, path, options);
  const alex = await seedMechanic(shop.id, { name: 'Alex Morgan' });
  const cashier = await runWithShop(shop.id, async () => (await prepare("INSERT INTO employees (name, is_cashier, active) VALUES ('Jo Taylor', 1, 1)").run()).lastInsertRowid);
  let job = (await req('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-13', mechanicId: alex } })).body;
  job = (await req(`/api/workshop-jobs/${job.id}/start`, { method: 'POST', body: { version: job.version } })).body;
  const items = await req(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [{ lineType: 'labour', name: 'Standard service', unitPrice: 65, minutes: 60 }] } });
  assert.equal(items.status, 200, JSON.stringify(items.body));

  // Makes the payment slow to commit, so the delete arrives while it is in flight.
  const db = await admin();
  const fn = `slow_payment_${shop.id}`;
  await db.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = ${job.orderId} AND NEW.status = 'converted' THEN PERFORM pg_sleep(1.5); END IF; RETURN NEW; END $$`);
  await db.query(`CREATE TRIGGER ${fn} BEFORE UPDATE ON sale_documents FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
  try {
    const pay = req(`/api/sale-documents/${job.orderId}/convert`, { method: 'POST', body: { cardAmount: 65, cashierId: cashier } });
    await new Promise((r) => setTimeout(r, 600));
    const del = req(`/api/workshop-jobs/${job.id}`, { method: 'DELETE' });
    const [paid, deleted] = await Promise.all([pay, del]);
    assert.equal(paid.status, 201, JSON.stringify(paid.body));
    assert.equal(deleted.status, 409, JSON.stringify(deleted.body));
    assert.equal(deleted.body.code, 'settle_first');
    assert.equal(deleted.body.paid, true);
    assert.ok((await jobRow(shop.id, job.id)) !== undefined, 'the job is still there');
    const order = await runWithShop(shop.id, () => prepare('SELECT status, workshop_job_id FROM sale_documents WHERE id = ?').get(job.orderId));
    assert.deepEqual([order.status, order.workshop_job_id], ['converted', job.id], 'the paid order is still linked to its job');
  } finally {
    await db.query(`DROP TRIGGER ${fn} ON sale_documents`);
    await db.query(`DROP FUNCTION ${fn}()`);
    await db.end();
    await deleteTestShop(shop.id);
  }
});
