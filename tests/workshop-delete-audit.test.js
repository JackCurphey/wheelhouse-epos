// Deleting a job: the cases the 22 Oct audit found untested
// (docs/reviews/2026-10-22-flagged-merges-audit.md, missing tests item 8, #265).
// Jack, 18 Oct (docs/decisions/2026-10-18-attachments-and-delete.md answer 1):
// not while money has been paid on its order or the bike is in the shop, and
// "Settle up first" says which; both together read "Refund what was paid and
// hand the bike back - then delete." on the job page. The server's own
// wording, checked here, is its reply's `error`. Anything else is deleted.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { deleteTestShop } from './helpers/testShop.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';

const MONDAY = '2026-09-07';

let server;
let shopA;
let shopB;
before(async () => {
  server = await startLiveServer();
  shopA = await staffSignup(server.baseUrl);
  shopA.mechanicId = await seedMechanic(shopA.shop.id);
  shopB = await staffSignup(server.baseUrl);
});
after(async () => {
  if (shopA) await deleteTestShop(shopA.shop.id);
  if (shopB) await deleteTestShop(shopB.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const req = (who, path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const del = (who, id) => req(who, `/api/workshop-jobs/${id}`, { method: 'DELETE' });
const inA = (sql, ...args) => runWithShop(shopA.shop.id, () => prepare(sql).get(...args));

let slot = 0;
async function createJob() {
  // A different hour each time, so the jobs don't clash in the diary.
  const hour = String(9 + (slot % 9)).padStart(2, '0');
  const day = new Date(Date.parse(`${MONDAY}T00:00:00Z`) + Math.floor(slot / 9) * 86_400_000).toISOString().slice(0, 10);
  slot += 1;
  const res = await req(shopA, '/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'Gear cable', jobDate: day, startTime: `${hour}:00`, endTime: `${hour}:30`, mechanicId: shopA.mechanicId },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

// Moves a job through the staff actions, carrying the version forward.
async function walk(job, actions) {
  let version = job.version;
  for (const action of actions) {
    const body = action === 'finish' ? { version, signedOffBy: shopA.mechanicId } : { version };
    const res = await req(shopA, `/api/workshop-jobs/${job.id}/${action}`, { method: 'POST', body });
    assert.equal(res.status, 200, `${action}: ${JSON.stringify(res.body)}`);
    version = res.body.version;
  }
}

test('paid and the bike in the shop: refused, saying both, and the job stays', async () => {
  const job = await createJob();
  await walk(job, ['book-in']);
  await inA("UPDATE sale_documents SET status = 'converted' WHERE id = ?", job.orderId);
  const removed = await del(shopA, job.id);
  assert.equal(removed.status, 409, JSON.stringify(removed.body));
  assert.deepEqual([removed.body.code, removed.body.paid, removed.body.inShop], ['settle_first', true, true]);
  assert.equal(removed.body.error, 'Settle up first: refund what was paid and hand the bike back, then delete.');
  assert.ok(await inA('SELECT id FROM workshop_jobs WHERE id = ?', job.id), 'the job was deleted');
});

test('a collected job, finished, reopened and signed off twice, is deleted with its sign-off history', async () => {
  const job = await createJob();
  await walk(job, ['book-in', 'start', 'finish', 'reopen-work', 'finish', 'collect']);
  const history = await inA('SELECT count(*)::int AS n, count(cleared_at)::int AS cleared FROM workshop_job_sign_offs WHERE workshop_job_id = ?', job.id);
  assert.deepEqual([history.n, history.cleared], [2, 1], 'the walk should leave one cleared and one standing sign-off');

  const removed = await del(shopA, job.id);
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.equal((await req(shopA, `/api/workshop-jobs/${job.id}`)).status, 404);
  const left = await inA('SELECT count(*)::int AS n FROM workshop_job_sign_offs WHERE workshop_job_id = ?', job.id);
  assert.equal(left.n, 0, 'sign-offs left pointing at a deleted job');
  // Its order is kept, unlinked, as for any deleted job.
  const order = await inA('SELECT workshop_job_id FROM sale_documents WHERE id = ?', job.orderId);
  assert.ok(order, 'the order went with the job');
  assert.ok(order.workshop_job_id === null);
});

test('a collected job that was paid is refused for the money only', async () => {
  const job = await createJob();
  await walk(job, ['book-in', 'start', 'finish', 'collect']);
  await inA("UPDATE sale_documents SET status = 'converted' WHERE id = ?", job.orderId);
  const removed = await del(shopA, job.id);
  assert.equal(removed.status, 409, JSON.stringify(removed.body));
  assert.deepEqual([removed.body.code, removed.body.paid, removed.body.inShop], ['settle_first', true, false]);
  assert.equal(removed.body.error, 'Settle up first: refund what was paid, then delete.');
});

test("another shop's job: 404 on DELETE, and the job, its order and its sign-off stay", async () => {
  const job = await createJob();
  await walk(job, ['book-in', 'start', 'finish', 'collect']);
  const removed = await del(shopB, job.id);
  assert.equal(removed.status, 404, JSON.stringify(removed.body));
  assert.ok(await inA('SELECT id FROM workshop_jobs WHERE id = ?', job.id), "shop B deleted shop A's job");
  const order = await inA('SELECT workshop_job_id FROM sale_documents WHERE id = ?', job.orderId);
  assert.equal(order.workshop_job_id, job.id, "shop B's delete unlinked shop A's order");
  const history = await inA('SELECT count(*)::int AS n FROM workshop_job_sign_offs WHERE workshop_job_id = ?', job.id);
  assert.equal(history.n, 1);
});

// Audit item 12 (#265): Jack's answer 1 says "a deposit or a payment", and a
// deposit is not a converted order. Money held for the job stops the delete
// too, whether it was taken on the order (paid_pence) or online (a held or
// taken deposit); one already refunded or released doesn't.
const deposit = (jobId, status) => runWithShop(shopA.shop.id, () => prepare(
  `INSERT INTO online_payments (provider, provider_ref, amount_pence, status, request_key_hash, job_id)
   VALUES ('pretend', ?, 2000, ?, ?, ?)`
).run(`ref-${jobId}-${status}`, status, `key-${jobId}-${status}`, jobId));

test('an open order with a deposit paid on it (paid_pence) refuses the delete, for the money', async () => {
  const job = await createJob();
  await inA('UPDATE sale_documents SET paid_pence = 2000 WHERE id = ?', job.orderId);
  const removed = await del(shopA, job.id);
  assert.equal(removed.status, 409, JSON.stringify(removed.body));
  assert.deepEqual([removed.body.code, removed.body.paid, removed.body.inShop], ['settle_first', true, false]);
  assert.ok(await inA('SELECT id FROM workshop_jobs WHERE id = ?', job.id), 'the job stays');
});

for (const status of ['held', 'taken']) {
  test(`an online deposit that is ${status} refuses the delete, for the money`, async () => {
    const job = await createJob();
    await deposit(job.id, status);
    const removed = await del(shopA, job.id);
    assert.equal(removed.status, 409, JSON.stringify(removed.body));
    assert.deepEqual([removed.body.code, removed.body.paid], ['settle_first', true]);
    assert.ok(await inA('SELECT id FROM workshop_jobs WHERE id = ?', job.id), 'the job stays');
    const pay = await inA('SELECT job_id FROM online_payments WHERE job_id = ?', job.id);
    assert.equal(pay.job_id, job.id, 'the deposit is still on the job');
  });
}

for (const status of ['refunded', 'released', 'declined']) {
  test(`an online deposit that is ${status} doesn't stop the delete`, async () => {
    const job = await createJob();
    await deposit(job.id, status);
    const removed = await del(shopA, job.id);
    assert.equal(removed.status, 200, JSON.stringify(removed.body));
  });
}
